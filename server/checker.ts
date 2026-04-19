import { chromium, Browser, BrowserContext } from 'playwright';
import { getDb } from './db';
import { downloadImage, extractOfferDetails } from './scraperUtils';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function delay(min: number, max: number) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, ms));
}

export let isChecking = false;
let isCheckingLock = false; // Mutex to prevent synchronous event loop race conditions

export function stopCheck() {
  if (isChecking) {
    console.log('Stopping check process...');
    isChecking = false;
  }
}

export async function runCheck() {
  // Sync lock check to avoid event loop race conditions
  if (isCheckingLock) {
    console.log('Check process lock exists. Skipping.');
    return;
  }
  isCheckingLock = true;
  
  if (isChecking) {
    console.log('Check process already running. Skipping.');
    isCheckingLock = false;
    return;
  }
  isChecking = true;
  isCheckingLock = false;
  
  console.log('Starting runCheck process...');
  const db = getDb();
  const activeOffers = db.prepare("SELECT * FROM offers WHERE status = 'active'").all() as any[];

  if (activeOffers.length === 0) {
    console.log('No active offers to check.');
    isChecking = false;
    return;
  }

  const logInsert = db.prepare('INSERT INTO run_logs (run_type) VALUES (?)');
  const logId = logInsert.run('check').lastInsertRowid;

  let soldFoundCount = 0;
  let priceDropsCount = 0;
  let errorsCount = 0;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    console.log(`Checking ${activeOffers.length} active offers in parallel batches...`);
    
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
      viewport: { width: 1280, height: 720 },
      locale: 'pl-PL',
      timezoneId: 'Europe/Warsaw',
      javaScriptEnabled: true,
    });

    const batchSize = 8;
    
    for (let i = 0; i < activeOffers.length; i += batchSize) {
      if (!isChecking) break;
      const batch = activeOffers.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activeOffers.length/batchSize)}...`);

      await Promise.all(batch.map(async (offer) => {
        let page = null;
        try {
          const exists = db.prepare('SELECT 1 FROM offers WHERE id = ?').get(offer.id);
          if (!exists) return;

          page = await context!.newPage();
          // Block images and other non-essential assets to speed up
          await page.route('**/*.{png,jpg,jpeg,gif,svg,css,woff2,woff,ttf,otf}', route => route.abort());

          await page.goto(offer.url, { waitUntil: 'commit', timeout: 15000 });
          
          // Small delay to let redirects happen
          await delay(200, 500);

          const currentUrl = page.url();
          const title = await page.title();
          
          // Check for removal via URL and Title first (fastest)
          let isRemoved = 
            currentUrl.endsWith('olx.pl/') || 
            currentUrl.includes('/404') || 
            title.includes('404') ||
            title.includes('Ogłoszenie nieaktualne');

          // If not obvious, check body content
          if (!isRemoved) {
            isRemoved = await page.evaluate(() => {
              if (!document.body) return false;
              const text = document.body.innerText.toLowerCase();
              return text.includes('to ogłoszenie wygasło') ||
                     text.includes('ogłoszenie nieaktywne') ||
                     text.includes('oferta została usunięta') ||
                     text.includes('nie znaleźliśmy');
            });
          }

          if (isRemoved) {
            db.prepare(`
              UPDATE offers 
              SET status = 'sold_or_removed', 
                  sold_detected_at = CURRENT_TIMESTAMP,
                  lifetime_days = CAST(ROUND(julianday(CURRENT_TIMESTAMP) - julianday(added_at), 1) AS REAL)
              WHERE id = ?
            `).run(offer.id);
            db.prepare(`INSERT INTO notifications (offer_id, type, message) VALUES (?, 'sold', ?)`).run(offer.offer_id, `Oferta "${offer.title}" została wyłączona lub usunięta.`);
            soldFoundCount++;
          } else {
            // Check for price changes
            const priceText = await page.evaluate(() => {
              const selectors = [
                '[data-testid="ad-price-container"]',
                '[data-testid="ad-price-container"] h3',
                'h3.css-1277o9a',
                '.css-1277o9a',
                '.css-904s7'
              ];
              for (const selector of selectors) {
                const el = document.querySelector(selector);
                if (el && el.textContent) return el.textContent;
              }
              return null;
            });

            if (priceText && !priceText.toLowerCase().includes('zamienię') && !priceText.toLowerCase().includes('za darmo')) {
              const match = priceText.match(/([\d\s,]+)/);
              if (match) {
                const currentPrice = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
                if (!isNaN(currentPrice) && currentPrice < 1000000) {
                  const lastPriceRow = db.prepare('SELECT price FROM price_history WHERE offer_id = ? ORDER BY checked_at DESC LIMIT 1').get(offer.offer_id) as any;
                  
                  if (!lastPriceRow || Math.abs(lastPriceRow.price - currentPrice) > 0.01) {
                    // VALIDATION: Prevent fake price drops
                    if (lastPriceRow && (currentPrice < lastPriceRow.price * 0.2)) {
                      console.log(`Detected extreme price drop for ${offer.offer_id}: ${lastPriceRow.price} -> ${currentPrice}. Re-verifying...`);
                      await delay(2000, 3000);
                      const recheckPriceText = await page.evaluate(() => {
                        const el = document.querySelector('[data-testid="ad-price-container"]');
                        return el ? el.textContent : null;
                      });
                      const recheckMatch = recheckPriceText?.match(/([\d\s,]+)/);
                      const recheckPrice = recheckMatch ? parseFloat(recheckMatch[1].replace(/\s/g, '').replace(',', '.')) : null;
                      
                      if (!recheckPrice || Math.abs(recheckPrice - currentPrice) > 1) {
                        console.log(`Extreme price drop for ${offer.offer_id} was NOT confirmed. Skipping.`);
                        return;
                      }
                    }

                    db.prepare('INSERT INTO price_history (offer_id, price) VALUES (?, ?)').run(offer.offer_id, currentPrice);
                    db.prepare('UPDATE offers SET price = ? WHERE offer_id = ?').run(currentPrice, offer.offer_id);
                    
                    if (lastPriceRow && currentPrice < lastPriceRow.price) {
                      console.log(`[DROP] Price decreased for ${offer.offer_id}: ${lastPriceRow.price} -> ${currentPrice}`);
                      db.prepare(`INSERT INTO notifications (offer_id, type, message) VALUES (?, 'price_drop', ?)`).run(offer.offer_id, `Cena oferty "${offer.title}" spadła z ${lastPriceRow.price} PLN na ${currentPrice} PLN.`);
                      priceDropsCount++;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error(`Error checking offer ${offer.offer_id}:`, e);
          errorsCount++;
        } finally {
          // Wrap closing in a catch block inside the promise map to avoid unhandled rejections that might leave pages floating
          if (page) {
            try { await page.close(); } catch (err) { /* ignore cleanup error */ }
          }
        }
      }));

      // Small cooldown between batches to avoid rate limiting
      await delay(500, 1000);
      
      // Dynamic log update
      db.prepare(`UPDATE run_logs SET sold_found = ?, price_drops = ? WHERE id = ?`).run(soldFoundCount, priceDropsCount, logId);
    }

  } catch (e) {
    console.error('Fatal error in runCheck:', e);
    errorsCount++;
  } finally {
    const wasStopped = !isChecking;
    isChecking = false;
    if (context) await context.close();
    if (browser) await browser.close();

    db.prepare(`
      UPDATE run_logs 
      SET finished_at = CURRENT_TIMESTAMP, sold_found = ?, price_drops = ?, errors = ?, run_type = ?
      WHERE id = ?
    `).run(soldFoundCount, priceDropsCount, errorsCount, wasStopped ? 'check_stopped' : 'check', logId);
  }
}
