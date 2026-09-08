const path = require('path');
const fs = require('fs');
const rootDir = path.resolve(__dirname, '..');
const playwrightPath = path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test');
const { chromium } = require(playwrightPath);

const outDir = path.join(rootDir, 'docs', 'assets', 'screenshots');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('--- 1. Capturing Desktop Homepage ---');
  try {
    await page.goto('https://www.healthcare.id.vn/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const homePath = path.join(outDir, '01-desktop-homepage.png');
    await page.screenshot({ path: homePath, fullPage: false });
    console.log('Saved 01-desktop-homepage.png');
  } catch (err) {
    console.error('Error capturing home:', err);
  }

  console.log('--- 2. Capturing Mobile Responsive Homepage ---');
  try {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true
    });
    const mobPage = await mobileContext.newPage();
    await mobPage.goto('https://www.healthcare.id.vn/', { waitUntil: 'networkidle', timeout: 30000 });
    await mobPage.waitForTimeout(1000);
    const mobPath = path.join(outDir, '05-mobile-responsive.png');
    await mobPage.screenshot({ path: mobPath, fullPage: false });
    console.log('Saved 05-mobile-responsive.png');
    await mobileContext.close();
  } catch (err) {
    console.error('Error capturing mobile:', err);
  }

  console.log('--- 3. Capturing Specialties Catalog ---');
  try {
    await page.goto('https://www.healthcare.id.vn/specialties', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const specPath = path.join(outDir, '06-specialties-catalog.png');
    await page.screenshot({ path: specPath, fullPage: false });
    console.log('Saved 06-specialties-catalog.png');
  } catch (err) {
    console.error('Error capturing specialties:', err);
  }

  console.log('--- 4. Capturing Doctors Directory ---');
  try {
    await page.goto('https://www.healthcare.id.vn/doctors', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const docPath = path.join(outDir, '07-doctors-directory.png');
    await page.screenshot({ path: docPath, fullPage: false });
    console.log('Saved 07-doctors-directory.png');
  } catch (err) {
    console.error('Error capturing doctors:', err);
  }

  console.log('--- 5. Testing Portal Login ---');
  try {
    await page.goto('https://www.healthcare.id.vn/auth/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('input[type="email"]', 'patient@healthcare.com');
    await page.fill('input[type="password"]', 'HealthCare@2026');
    await Promise.all([
      page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(3000);
    console.log('Patient login landed on:', page.url());
    if (page.url().includes('/patient')) {
      const patPath = path.join(outDir, '02-patient-hub.png');
      await page.screenshot({ path: patPath, fullPage: false });
      console.log('Saved live 02-patient-hub.png');
    }
  } catch (err) {
    console.log('Live patient login note:', err.message);
  }

  console.log('--- 6. Capturing Doctor Clinical Studio ---');
  try {
    const docBrowserContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const docPage = await docBrowserContext.newPage();
    await docPage.goto('https://www.healthcare.id.vn/auth/login', { waitUntil: 'networkidle', timeout: 30000 });
    await docPage.fill('input[type="email"]', 'doctor@healthcare.com');
    await docPage.fill('input[type="password"]', 'HealthCare@2026');
    await Promise.all([
      docPage.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      docPage.click('button[type="submit"]')
    ]);
    await docPage.waitForTimeout(3000);
    console.log('Doctor login landed on:', docPage.url());
    if (docPage.url().includes('/doctor')) {
      const docStudioPath = path.join(outDir, '03-doctor-clinical-dashboard.png');
      await docPage.screenshot({ path: docStudioPath, fullPage: false });
      console.log('Saved live 03-doctor-clinical-dashboard.png');
    }
    await docBrowserContext.close();
  } catch (err) {
    console.log('Live doctor login note:', err.message);
  }

  console.log('--- 7. Capturing Admin AI Governance ---');
  try {
    const adminBrowserContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const adminPage = await adminBrowserContext.newPage();
    await adminPage.goto('https://www.healthcare.id.vn/auth/login', { waitUntil: 'networkidle', timeout: 30000 });
    await adminPage.fill('input[type="email"]', 'admin@healthcare.com');
    await adminPage.fill('input[type="password"]', 'HealthCare@2026');
    await Promise.all([
      adminPage.waitForNavigation({ timeout: 15000 }).catch(() => {}),
      adminPage.click('button[type="submit"]')
    ]);
    await adminPage.waitForTimeout(3000);
    console.log('Admin login landed on:', adminPage.url());
    // Navigate to ai-reviews if not already there
    await adminPage.goto('https://www.healthcare.id.vn/admin/ai-content-reviews', { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
    await adminPage.waitForTimeout(1500);
    const adminPath = path.join(outDir, '04-admin-ai-governance.png');
    await adminPage.screenshot({ path: adminPath, fullPage: false });
    console.log('Saved live 04-admin-ai-governance.png');
    await adminBrowserContext.close();
  } catch (err) {
    console.log('Live admin login note:', err.message);
  }

  await browser.close();
  console.log('Live capture script finished.');
})();
