import { Page } from 'playwright';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { getDb } from './db';

const IMAGES_DIR = path.join(process.cwd(), 'data', 'images');
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

export async function downloadImage(url: string, offerId: string, index: number, userAgent: string): Promise<string | null> {
  const maxRetries = 2;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const offerDir = path.join(IMAGES_DIR, offerId);
      if (!fs.existsSync(offerDir)) {
        fs.mkdirSync(offerDir, { recursive: true });
      }

      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
        timeout: 15000,
        headers: {
          'User-Agent': userAgent,
          'Referer': 'https://www.olx.pl/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'image',
          'sec-fetch-mode': 'no-cors',
          'sec-fetch-site': 'cross-site',
        }
      });

      const filename = `${index}.jpg`;
      const filePath = path.join(offerDir, filename);
      
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(`/api/images/${offerId}/${filename}`));
        writer.on('error', (err) => {
          writer.close();
          fs.unlink(filePath, () => {}); // cleanup partial file
          reject(err);
        });
      });
    } catch (e: any) {
      if (attempt === maxRetries) {
        if (axios.isAxiosError(e)) {
          console.error(`Axios error downloading image ${url}: ${e.message} (Status: ${e.response?.status})`);
        } else {
          console.error(`Failed to download image ${url}:`, e.message);
        }
        return null;
      }
      // Wait before retry
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  return null;
}

export async function extractOfferDetails(page: Page) {
  try {
    // Handle cookie consent if visible
    const cookieButton = await page.$('button#onetrust-accept-btn-handler');
    if (cookieButton) {
      await cookieButton.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Extract description
    const description = await page.$eval('[data-testid="ad_description"] div', el => {
      const text = el.textContent || '';
      return text.replace(/^Opis\s*/i, '').trim();
    }).catch(async () => {
      const text = await page.$eval('[data-testid="ad_description"]', el => el.textContent || '');
      return text.replace(/^Opis\s*/i, '').trim();
    }).catch(() => '');
    
    // Extract parameters - try multiple selectors and be very inclusive
    let parameters = await page.$$eval('li[data-testid="ad_param_item"], [data-testid="ad_params_list"] li, [data-testid="ad_params_list"] div > div, .css-1r07h79 li, .css-1277o9a li, ul > li > p, p.css-odhutu, p[data-nx-name="P3"]', items => {
      const results: {label: string, value: string}[] = [];
      const seen = new Set<string>();

      items.forEach(item => {
        const text = item.textContent?.trim() || '';
        
        // Skip obvious UI elements
        if (text.includes('Zaloguj') || text.includes('Na OLX od') || text.includes('Ostatnio online') || text.includes('Osoba prywatna') || text.includes('Zgłoś naruszenie')) return;
        if (text.length > 60) return;

        // Pattern: "Label: Value"
        if (text.includes(':')) {
          const [label, ...valueParts] = text.split(':');
          const value = valueParts.join(':').trim();
          const l = label.trim();
          if (l && value && !seen.has(l)) {
            results.push({ label: l, value });
            seen.add(l);
          }
        } 
        // Pattern: "Label" -> "Label" / "Prywatne" (standalone pills)
        else if (text === 'Prywatne' || text === 'Firmowe' || text.includes('Gwarancja') || text === 'Możliwa zamiana') {
           if (!seen.has(text)) {
              results.push({ label: 'Typ', value: text });
              seen.add(text);
           }
        }
      });
      return results;
    }).catch(() => []);

    // If still no parameters, try a more global search for "Label: Value" patterns
    if (parameters.length === 0) {
      parameters = await page.evaluate(() => {
        const results: {label: string, value: string}[] = [];
        const seen = new Set<string>();
        
        document.querySelectorAll('p, span, div, li').forEach(el => {
          const text = el.textContent?.trim() || '';
          if (text.includes(':') && text.length < 100 && !text.includes('\n')) {
            const [label, ...valueParts] = text.split(':');
            const l = label.trim();
            const v = valueParts.join(':').trim();
            
            if (l && v && l.length < 30 && v.length < 50 && !seen.has(l)) {
              results.push({ label: l, value: v });
              seen.add(l);
            }
          }
        });
        
        return results;
      }).catch(() => []);
    }

    // Extract images - target the gallery specifically to avoid profile photos and other ads
    const imageUrls = await page.evaluate(() => {
      const images: string[] = [];
      
      // 1. Try specific gallery selectors first
      const gallerySelectors = [
        '[data-testid="ad_gallery"] img',
        '[data-testid="gallery-image"] img',
        '[data-testid="swiper-image"]',
        '.swiper-slide img',
        '.image-gallery img',
        '.photo-glowne img',
        '#photo-gallery img'
      ];

      gallerySelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
          
          if (srcset) {
            const sources = srcset.split(',').map(s => s.trim().split(' ')[0]);
            if (sources.length > 0) images.push(sources[sources.length - 1]);
          } else if (src) {
            images.push(src);
          }
        });
      });

      // 2. Fallback to a more general but filtered search if gallery not found
      if (images.length === 0) {
        document.querySelectorAll('img').forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src');
          if (!src) return;

          // Only include images that look like product photos (usually from OLX's CDN)
          const isProductPhoto = src.includes('apollo-ireland.akamaized.net') || 
                                src.includes('olxcdn.com') ||
                                src.includes('img.olx.pl');
          
          if (isProductPhoto && !src.includes('avatar') && !src.includes('logo') && !src.includes('icon')) {
            images.push(src);
          }
        });
      }

      return images.filter(src => {
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) return false;
        
        const isIcon = src.includes('icon') || src.includes('logo') || src.includes('avatar') || src.includes('user');
        const isTracker = src.includes('pixel') || src.includes('analytics') || src.includes('doubleclick');
        
        return !isIcon && !isTracker;
      });
    }).catch((err) => {
      console.error('Error in page.evaluate for images:', err);
      return [];
    });

    // Unique images only
    const uniqueImages = [...new Set(imageUrls)].map(url => {
      if (url.startsWith('//')) return `https:${url}`;
      if (url.startsWith('/')) return `https://www.olx.pl${url}`;
      return url;
    });
    console.log(`Found ${uniqueImages.length} unique image URLs for offer`);

    return { description, parameters, imageUrls: uniqueImages };
  } catch (e) {
    console.error('Error in extractOfferDetails:', e);
    return { description: '', parameters: [], imageUrls: [] };
  }
}
