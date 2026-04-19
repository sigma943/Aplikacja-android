import { chromium, Browser, BrowserContext } from 'playwright';
import { getDb } from './db';
import { downloadImage, extractOfferDetails } from './scraperUtils';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function delay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

export let activeProcesses = new Set<number | string>();
let scrapingLock = false;

export function stopCollect(slotId?: number) {
  if (slotId) {
    activeProcesses.delete(slotId);
  } else {
    activeProcesses.clear();
  }
}

export async function runCollect(slotId?: number) {
  if (scrapingLock) return;
  scrapingLock = true;
  
  const processKey = slotId || 'all';
  if (activeProcesses.has(processKey)) {
    console.log(`Collect process for ${processKey} is already running. Skipping.`);
    scrapingLock = false;
    return;
  }
  
  activeProcesses.add(processKey);
  scrapingLock = false;

  const db = getDb();
  let slots = [];
  if (slotId) {
    slots = db.prepare('SELECT * FROM slots WHERE id = ? AND active = 1').all(slotId);
  } else {
    slots = db.prepare('SELECT * FROM slots WHERE active = 1').all();
  }

  if (slots.length === 0) {
    activeProcesses.delete(processKey);
    return;
  }

  const logInsert = db.prepare('INSERT INTO run_logs (run_type, slot_id) VALUES (?, ?)');
  const logId = logInsert.run('collect', slotId || null).lastInsertRowid;

  let newOffersCount = 0;
  let errorsCount = 0;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });

    context = await browser.newContext({
      userAgent: getRandomUserAgent(),
      viewport: { width: 1920, height: 1080 },
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
      extraHTTPHeaders: {
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'sec-fetch-user': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      javaScriptEnabled: true,
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pl-PL', 'pl', 'en-US'],
      });
      (window as any).chrome = { runtime: {} };
    });

    const page = await context.newPage();

    for (const slot of slots) {
      if (!activeProcesses.has(processKey)) break;
      
      console.log(`Pobieranie ofert dla slotu: ${slot.name}`);
      
      let currentPage = 1;
      let offersCollectedInThisRun = 0;
      const maxOffers = slot.max_offers || 50;
      const maxPages = 3; // Let's limit to 3 pages per run to be reasonable
      
      while (currentPage <= maxPages) {
        if (!activeProcesses.has(processKey)) break;
        
        const url = new URL(slot.url);
        if (currentPage > 1) {
          url.searchParams.set('page', currentPage.toString());
        }

        try {
          await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Check for anti-bot block
          const isBlocked = await page.evaluate(() => {
            const text = document.body.innerText.toLowerCase();
            return text.includes('weryfikacja') || text.includes('captcha') || text.includes('robot') || text.includes('access denied');
          });

          if (isBlocked) {
            console.error(`Blokada anty-botowa wykryta dla slotu ${slot.id} strona ${currentPage}`);
            errorsCount++;
            break;
          }
          
          try {
            await page.waitForSelector('[data-testid="listing-grid"]', { timeout: 15000 });
          } catch (e) {
            console.log(`No listing grid found or timeout for slot ${slot.id} page ${currentPage}`);
            break; // No more results or blocked
          }

          const cards = await page.$$('[data-testid="l-card"]');
          if (cards.length === 0) break;

          for (const card of cards) {
            const href = await card.$eval('a[href]', el => el.getAttribute('href')).catch(() => null);
            if (!href) continue;

            const fullUrl = href.startsWith('http') ? href : `https://www.olx.pl${href}`;
            if (fullUrl.includes('allegrolokalnie.pl')) continue;

            const offerIdMatch = /ID([a-zA-Z0-9]+)\.html/.exec(fullUrl);
            const offerId = offerIdMatch ? offerIdMatch[1] : await card.getAttribute('id');
            
            if (!offerId) continue;

            // Check if exists
            const exists = db.prepare('SELECT id FROM offers WHERE offer_id = ?').get(offerId);
            if (exists) continue;

            if (!activeProcesses.has(processKey)) {
              console.log(`Stopping collect for ${processKey}`);
              break;
            }

            const title = await card.$eval('h4', el => el.textContent).catch(() => 'Brak tytułu');
            
            // Exclude words filtering
            let skipOffer = false;
            if (slot.exclude_words) {
                const excludeWordsCheck = slot.exclude_words.split(',').map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 1);
                const titleLowerStr = title.toLowerCase();
                for (const word of excludeWordsCheck) {
                    if (titleLowerStr.includes(word)) {
                        console.log(`Skipping offer (excluded word in title '${word}'): ${title}`);
                        skipOffer = true;
                        break;
                    }
                }
            }
            if (skipOffer) continue;

            // Keyword filtering
            const slotKeywords = slot.name.toLowerCase().split(/\s+/).filter((k: string) => k.length > 2);
            const titleLower = title.toLowerCase();
            const isRelevant = slotKeywords.every((k: string) => titleLower.includes(k)) || 
                               slotKeywords.some((k: string) => titleLower.includes(k) && /\d/.test(k));
            
            const slotNumbers: string[] = slot.name.match(/\d+/g) || [];
            const titleNumbers: string[] = title.match(/\d+/g) || [];
            const hasConflictingNumber = slotNumbers.some(sn => titleNumbers.length > 0 && !titleNumbers.includes(sn));

            if (hasConflictingNumber && slotNumbers.length > 0) {
              console.log(`Skipping irrelevant offer: ${title} (expected ${slot.name})`);
              continue;
            }

            const priceText = await card.$eval('[data-testid="ad-price"]', el => el.textContent).catch(() => '');
            let price = null;
            let currency = 'PLN';
            
            if (priceText) {
                const lowerPrice = priceText.toLowerCase();
                if (lowerPrice.includes('zamienię')) {
                    currency = 'Zamienię';
                } else if (lowerPrice.includes('za darmo')) {
                    currency = 'Za darmo';
                } else {
                   const match = priceText.match(/([\d\s,]+)/);
                   if (match) {
                     price = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
                     if (isNaN(price) || price > 1000000) price = null;
                   }
                }
            }

            const locationDateText = await card.$eval('[data-testid="location-date"]', el => el.textContent).catch(() => '');
            const city = locationDateText.split(' - ')[0] || '';
            const postedAt = locationDateText.split(' - ')[1] || '';

            // Visit offer page for details BEFORE inserting
            const detailPage = await context.newPage();
            try {
              await delay(500, 1500);
              await detailPage.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
              
              // Simulate some human behavior and trigger lazy loading
              await detailPage.mouse.move(Math.random() * 500, Math.random() * 500);
              await delay(200, 500);
              await detailPage.evaluate(async () => {
                for (let i = 0; i < 2; i++) {
                  window.scrollBy(0, 800);
                  await new Promise(r => setTimeout(r, 200));
                }
              });
              
              const { description, parameters, imageUrls } = await extractOfferDetails(detailPage);
              
              // Exclude words filtering on parameters
              let skipFromParams = false;
              if (slot.exclude_words) {
                const excludeWordsCheck = slot.exclude_words.split(',').map((w: string) => w.trim().toLowerCase()).filter((w: string) => w.length > 1);
                
                // check values and labels
                const paramsText = parameters.map((p: any) => `${p.label} ${p.value}`).join(' ').toLowerCase();
                for (const word of excludeWordsCheck) {
                    if (paramsText.includes(word)) {
                        console.log(`Skipping offer (excluded word in params '${word}'): ${title}`);
                        skipFromParams = true;
                        break;
                    }
                }
              }
              if (skipFromParams) {
                  await detailPage.close();
                  continue;
              }

              // Download ONLY the main image locally as requested
              let downloadedCount = 0;
              if (imageUrls.length > 0) {
                const localPath = await downloadImage(imageUrls[0], offerId, 0, getRandomUserAgent());
                if (localPath) downloadedCount = 1;
              }

              // Insert offer with ALL details
              const insertOffer = db.prepare(`
                INSERT OR IGNORE INTO offers (
                  slot_id, offer_id, title, price, currency, city, posted_at, url, 
                  status, description, parameters, images_dir, images_count
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
              `);
              
              const result = insertOffer.run(
                slot.id, offerId, title, price, currency, city, postedAt, fullUrl,
                description, JSON.stringify(parameters), `/api/images/${offerId}`, downloadedCount
              );
              
              if (result.changes > 0) {
                console.log(`New offer added with details: ${offerId} - ${title} (${downloadedCount} images)`);
                if (price !== null) {
                  db.prepare('INSERT INTO price_history (offer_id, price) VALUES (?, ?)').run(offerId, price);
                }
                newOffersCount++;
                offersCollectedInThisRun++;
                // Dynamic log update
                db.prepare(`UPDATE run_logs SET new_offers = ? WHERE id = ?`).run(newOffersCount, logId);
              }
            } catch (e) {
              console.error(`Error visiting detail page for ${offerId}:`, e);
            } finally {
              try { await detailPage.close(); } catch (e) {} // Silent close to avoid cascading failure
            }

            await delay(200, 800);
          }

          if (!activeProcesses.has(processKey)) break;

          // Prune old offers if we exceeded max_offers
          const activeCount = (db.prepare("SELECT COUNT(*) as count FROM offers WHERE slot_id = ? AND status = 'active'").get(slot.id) as any).count;
          if (activeCount > maxOffers) {
            const overCount = activeCount - maxOffers;
            console.log(`Slot ${slot.name} exceeded limit. Pruning ${overCount} oldest offers.`);
            
            // Delete history items strictly bound to offers we are about to retire to save space
            db.prepare(`
              DELETE FROM price_history 
              WHERE offer_id IN (
                SELECT offer_id FROM offers 
                WHERE slot_id = ? AND status = 'active' 
                ORDER BY added_at ASC 
                LIMIT ?
              )
            `).run(slot.id, overCount);
            
            db.prepare(`
              UPDATE offers 
              SET status = 'retired' 
              WHERE id IN (
                SELECT id FROM offers 
                WHERE slot_id = ? AND status = 'active' 
                ORDER BY added_at ASC 
                LIMIT ?
              )
            `).run(slot.id, overCount);
          }

          const hasNextPage = await page.$('[data-testid="pagination-forward"]');
          if (!hasNextPage || offersCollectedInThisRun > 20) break; // Don't go too deep if we already found 20 new ones in one run

          currentPage++;
          await delay(500, 1500);

        } catch (e) {
          console.error(`Error processing slot ${slot.id} page ${currentPage}:`, e);
          errorsCount++;
          break;
        }
      }
    }

  } catch (e) {
    console.error('Fatal error in runCollect:', e);
    errorsCount++;
  } finally {
    const isStopped = !activeProcesses.has(processKey);
    activeProcesses.delete(processKey);
    if (context) await context.close();
    if (browser) await browser.close();

    db.prepare(`
      UPDATE run_logs 
      SET finished_at = CURRENT_TIMESTAMP, new_offers = ?, errors = ?, run_type = ?
      WHERE id = ?
    `).run(newOffersCount, errorsCount, isStopped ? 'collect_stopped' : 'collect', logId);
  }
}
