const path = require('node:path');
const fs = require('node:fs');
const { chromium, expect } = require('../../apps/frontend/node_modules/@playwright/test');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'docs/assets/repo-tours');
const raw = path.join(__dirname, 'assets/raw-video');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(raw, { recursive: true });
fs.mkdirSync(path.join(__dirname, 'reports'), { recursive: true });
const base = 'http://localhost:3000';
const manifestPath = path.join(__dirname, 'reports/capture-manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { environment: 'local Compose, seeded fictional data', base, sourceHead: require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), recordedAt: new Date().toISOString(), tours: [] };
const captureHead = require('node:child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
manifest.sourceHead = captureHead;
manifest.lastCaptureStartedAt = new Date().toISOString();
manifest.sourceRuntimeParity = 'NOT_VERIFIED';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const tours = [
  { name: 'public', paths: ['/', '/specialties', '/doctors', '/packages', '/dat-lich'], titles: [/./, /chuyên khoa/i, /bác sĩ/i, /gói/i, /đặt lịch/i] },
  { name: 'patient', role: 'patient', paths: ['/patient/dashboard', '/patient/dashboard#appointments', '/patient/dashboard#records', '/patient/dashboard#prescriptions', '/patient/chat'], titles: [/Xin chào|lịch hẹn/i, /lịch hẹn/i, /lịch sử khám/i, /đơn thuốc/i, /^Trao đổi có lưu lịch sử$/i] },
  { name: 'doctor', role: 'doctor', paths: ['/doctor/dashboard', '/doctor/appointments', '/doctor/consultations', '/doctor/care-plans', '/doctor/articles'], titles: [/lâm sàng/i, /lịch/i, /tư vấn|hội thoại/i, /chăm sóc/i, /bài viết/i] },
  { name: 'admin', role: 'admin', paths: ['/admin', '/admin/doctors', '/admin/users', '/admin/content', '/admin/ai-content-reviews', '/admin/payments'], titles: [/điều hành/i, /bác sĩ/i, /tài khoản|người dùng/i, /nội dung/i, /AI|kiểm duyệt/i, /thanh toán|đối soát/i] }
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const tour of tours.filter(t => !process.env.REPO_TOUR_NAMES || process.env.REPO_TOUR_NAMES.split(',').includes(t.name))) {
      let state;
      if (tour.role) {
        if (!process.env.REPO_DEMO_PASSWORD) throw new Error('REPO_DEMO_PASSWORD must be supplied for local seeded role capture');
        const loginContext = await browser.newContext();
        const loginPage = await loginContext.newPage();
        await loginPage.goto(base + '/auth/login', { waitUntil: 'domcontentloaded' });
        await loginPage.getByLabel('Email', { exact: true }).fill(tour.role + '@healthcare.com');
        await loginPage.getByLabel('Mật khẩu', { exact: true }).fill(process.env.REPO_DEMO_PASSWORD);
        await loginPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
        await loginPage.waitForURL(new RegExp('/' + tour.role + '(?:/|$)'), { timeout: 30000 });
        state = await loginContext.storageState();
        await loginContext.close();
      }
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: state, recordVideo: { dir: raw, size: { width: 1440, height: 900 } } });
      const page = await context.newPage();
      const item = { name: tour.name, sourceHead: captureHead, recordedAt: new Date().toISOString(), expectedRoutes: tour.paths.length, status: 'RUNNING', routes: [], video: null };
      manifest.tours = manifest.tours.filter(t => t.name !== tour.name);
      manifest.tours.push(item);
      let currentRoute;
      try {
      for (let i = 0; i < tour.paths.length; i++) {
        const route = tour.paths[i];
        currentRoute = route;
        await page.goto(base + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
        if (route.includes('#')) await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('h1,h2').filter({ hasText: tour.titles[i] }).first().waitFor({ timeout: 15000 });
        await expect(page).not.toHaveURL(/auth\/login/);
        const expectedRoute = route === '/doctor/appointments' ? '/doctor/dashboard#daily-appointments' : route;
        await expect(page).toHaveURL(base + expectedRoute);
        await page.evaluate(() => window.scrollTo(0, 0));
        await pause(1400);
        await page.evaluate(() => window.scrollTo(0, 0));
        await pause(200);
        const name = tour.name + '-' + String(i + 1).padStart(2, '0') + '.png';
        await page.screenshot({ path: path.join(out, name), fullPage: false });
        item.routes.push({ route, actualRoute: new URL(page.url()).pathname + new URL(page.url()).hash, screenshot: name, headingCheck: 'PASS' });
        await pause(1300);
        await page.mouse.wheel(0, 420);
        await pause(1100);
        await page.mouse.wheel(0, -420);
        await pause(800);
        console.log(tour.name + ' ' + route + ' PASS');
      }
      item.status = 'PASS';
      } catch (error) {
        item.status = 'FAIL';
        item.failure = { route: currentRoute, type: error.name };
        throw error;
      } finally {
        const video = page.video();
        await context.close();
        item.video = path.relative(root, await video.path()).replaceAll('\\', '/');
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      }
      fs.writeFileSync(path.join(__dirname, 'reports/capture-manifest.json'), JSON.stringify(manifest, null, 2));
    }
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await mobile.newPage();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await pause(1800);
    await page.screenshot({ path: path.join(out, 'public-mobile.png') });
    await mobile.close();
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(__dirname, 'reports/capture-manifest.json'), JSON.stringify(manifest, null, 2));
  }
})().catch(error => { console.error('Capture failed: ' + error.name + '; inspect the redacted route manifest.'); process.exitCode = 1; });
