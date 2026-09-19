import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { chromium } = require(path.join(__dirname, '..', 'apps', 'frontend', 'node_modules', '@playwright', 'test'));

async function inspectLivePackages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  console.log("Navigating to https://www.healthcare.id.vn/packages...");
  await page.goto('https://www.healthcare.id.vn/packages', { waitUntil: 'networkidle', timeout: 35000 });

  const cards = await page.$$eval('article', (articles) => articles.map(a => {
    const title = a.querySelector('h2, h3')?.textContent?.trim();
    const cat = a.querySelector('span[class*="category"]')?.textContent?.trim();
    const img = a.querySelector('img')?.getAttribute('src');
    return { title, cat, img };
  }));

  console.log(`Found ${cards.length} package cards on page 1:`);
  cards.forEach((c, idx) => {
    console.log(`  [${idx + 1}] Title: "${c.title}" | Category: "${c.cat}" | Image: "${c.img}"`);
  });

  await browser.close();
}

inspectLivePackages().catch(console.error);
