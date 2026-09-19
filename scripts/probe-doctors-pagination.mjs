import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const rootDir = path.resolve(__dirname, '..');
const playwrightPath = path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test');
const { chromium } = require(playwrightPath);

const BASE_URL = process.env.BASE_URL || 'https://www.healthcare.id.vn';

async function probePagination() {
  console.log('--- Probing Doctor Catalog Pagination with Response Wait ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log(`Navigating to ${BASE_URL}/doctors ...`);
  await page.goto(`${BASE_URL}/doctors`, { waitUntil: 'networkidle', timeout: 35000 });

  await page.waitForSelector('.catalog-card', { timeout: 15000 });
  const initialCards = await page.$$eval('.catalog-card h2', els => els.map(e => e.textContent.trim()));
  const initialStatus = await page.$eval('.catalog-pagination__status', el => el.textContent.trim());
  console.log('Initial Status:', initialStatus);
  console.log('Initial First 3 Doctors:', initialCards.slice(0, 3));
  console.log('Total Cards Rendered on Page 1:', initialCards.length);

  const nextBtn = page.locator('.catalog-pagination__button', { hasText: 'Sau' });
  console.log('Clicking "Sau →" and waiting for /hospital/doctors response...');

  const responsePromise = page.waitForResponse(
    resp => resp.url().includes('/hospital/doctors') && resp.url().includes('page=1') && resp.status() === 200,
    { timeout: 25000 }
  );

  await nextBtn.click();
  const response = await responsePromise;
  console.log('Received response from:', response.url(), 'status:', response.status());

  // Wait for loading indicator to disappear or status to update
  await page.waitForFunction(() => {
    const el = document.querySelector('.catalog-pagination__status');
    return el && el.textContent.includes('Trang 2 /');
  }, { timeout: 10000 });

  const page2Status = await page.$eval('.catalog-pagination__status', el => el.textContent.trim());
  const page2Cards = await page.$$eval('.catalog-card h2', els => els.map(e => e.textContent.trim()));
  console.log('Page 2 Status:', page2Status);
  console.log('Page 2 First 3 Doctors:', page2Cards.slice(0, 3));
  console.log('Page 2 Total Cards Rendered:', page2Cards.length);

  // Now let's test clicking "← Trước"
  const prevBtn = page.locator('.catalog-pagination__button', { hasText: 'Trước' });
  console.log('Clicking "← Trước" and waiting for page=0 response...');
  const prevResponsePromise = page.waitForResponse(
    resp => resp.url().includes('/hospital/doctors') && resp.url().includes('page=0') && resp.status() === 200,
    { timeout: 25000 }
  );
  await prevBtn.click();
  await prevResponsePromise;

  await page.waitForFunction(() => {
    const el = document.querySelector('.catalog-pagination__status');
    return el && el.textContent.includes('Trang 1 /');
  }, { timeout: 10000 });

  const backStatus = await page.$eval('.catalog-pagination__status', el => el.textContent.trim());
  console.log('Back to Page 1 Status:', backStatus);

  await browser.close();
  console.log('SUCCESS: Pagination transitions to Page 2 and back to Page 1 cleanly!');
}

probePagination().catch(err => {
  console.error('Probe failed:', err);
  process.exit(1);
});
