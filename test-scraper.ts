import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://www.olx.pl/elektronika/telefony/smartfony/q-iphone/');
  await page.waitForSelector('[data-testid="l-card"]');
  const card = await page.$('[data-testid="l-card"]');
  const href = await card!.$eval('a[href]', el => el.getAttribute('href'));
  const fullUrl = href ? (href.startsWith('http') ? href : `https://www.olx.pl${href}`) : '';
  console.log("Navigating to: ", fullUrl);
  
  await page.goto(fullUrl);
  await page.waitForTimeout(3000);
  
  const paramsExtract = await page.evaluate(() => {
    // try data-testid="ad_params_list" or similar, or just grab all p[data-nx-name="P3"], css-odhutu
    const items: any[] = [];
    document.querySelectorAll('p[data-nx-name="P3"], p.css-odhutu, ul > li > p').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text && text.length < 100) {
            // "Stan: Używane" -> label: "Stan", value: "Używane"
            // "Prywatne" -> label: "Rodzaj", value: "Prywatne" (or just show it directly)
            items.push(text);
        }
    });
    return Array.from(new Set(items));
  });
  console.log("Extracted params:", paramsExtract);
  
  await browser.close();
}
test();
