import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const rootDir = path.resolve(__dirname, '..');
let chromium;
try {
  const playwright = require(path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test'));
  chromium = playwright.chromium;
} catch {
  const playwright = require(path.join(rootDir, 'apps', 'frontend', 'node_modules', 'playwright'));
  chromium = playwright.chromium;
}

const screenshotsDir = path.join(rootDir, '.agents', 'orchestrator_8', 'worker_deploy_qa', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const BASE_URL = process.env.BASE_URL || 'https://www.healthcare.id.vn';

async function main() {
  console.log('===============================================================');
  console.log(' STARTING PRODUCTION DEPLOY & QA VISUAL VERIFICATION');
  console.log(` Target: ${BASE_URL}`);
  console.log(` Output directory: ${screenshotsDir}`);
  console.log('===============================================================\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  const report = {
    homepage: {},
    doctorsCatalog: {},
    packagesCatalog: {},
    doctorBookingSchedule: {},
    apiScheduleVerification: {},
  };

  try {
    // -------------------------------------------------------------
    // 1. Homepage Doctor Portraits
    // -------------------------------------------------------------
    console.log('[1/5] Checking Homepage doctor portraits at / ...');
    const homePage = await context.newPage();
    await homePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 35000 });

    // Scroll to doctors section
    await homePage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('h2, h3')).find(h => h.textContent.includes('Bác sĩ'))?.closest('section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      else window.scrollBy(0, 1200);
    });
    await homePage.waitForTimeout(2000);

    const homeImages = await homePage.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img[alt*="bác sĩ" i], img[alt*="Bác sĩ" i], .resource-avatar__img'));
      const initials = Array.from(document.querySelectorAll('.resource-avatar__initials, [aria-hidden="true"]'))
        .map(el => el.textContent.trim())
        .filter(t => /^[A-Z]{2}$/.test(t) && (t === 'QH' || t === 'QM'));
      return {
        totalImages: imgs.length,
        loadedImages: imgs.filter(img => img.complete && img.naturalWidth > 0).length,
        sources: imgs.map(img => img.src),
        forbiddenInitials: initials,
      };
    });

    const homeScreenshot = path.join(screenshotsDir, '01-homepage-doctors.png');
    await homePage.screenshot({ path: homeScreenshot, fullPage: false });
    console.log(`  ✓ Homepage screenshot saved: ${homeScreenshot}`);
    console.log(`  - Doctor images found: ${homeImages.totalImages}, Loaded: ${homeImages.loadedImages}`);
    console.log(`  - Forbidden initials count (QH, QM): ${homeImages.forbiddenInitials.length}`);
    report.homepage = homeImages;
    await homePage.close();

    // -------------------------------------------------------------
    // 2. Doctor Catalog (/doctors)
    // -------------------------------------------------------------
    console.log('\n[2/5] Checking Doctor Catalog at /doctors ...');
    const docPage = await context.newPage();
    await docPage.goto(`${BASE_URL}/doctors`, { waitUntil: 'networkidle', timeout: 35000 });

    await docPage.waitForSelector('.catalog-card', { timeout: 20000 });
    await docPage.evaluate(() => window.scrollBy(0, 400));
    await docPage.waitForTimeout(1500);

    const docCatalogData = await docPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.catalog-card'));
      const imgs = cards.map(c => c.querySelector('img')).filter(Boolean);
      const initials = cards.map(c => {
        const initEl = c.querySelector('.resource-avatar__initials');
        return initEl ? initEl.textContent.trim() : null;
      }).filter(Boolean);

      const forbiddenInitials = initials.filter(t => t === 'QH' || t === 'QM');

      return {
        cardCount: cards.length,
        imageCount: imgs.length,
        loadedImages: imgs.filter(img => img.complete && img.naturalWidth > 0).length,
        forbiddenInitials,
        sampleSources: imgs.slice(0, 5).map(img => img.src),
      };
    });

    const docScreenshot = path.join(screenshotsDir, '02-doctors-catalog.png');
    await docPage.screenshot({ path: docScreenshot, fullPage: false });
    console.log(`  ✓ Doctor catalog screenshot saved: ${docScreenshot}`);
    console.log(`  - Doctor cards: ${docCatalogData.cardCount}`);
    console.log(`  - Images loaded: ${docCatalogData.loadedImages}/${docCatalogData.imageCount}`);
    console.log(`  - Forbidden initials (QH, QM): ${docCatalogData.forbiddenInitials.length}`);
    report.doctorsCatalog = docCatalogData;
    await docPage.close();

    // -------------------------------------------------------------
    // 3. Packages Catalog (/packages)
    // -------------------------------------------------------------
    console.log('\n[3/5] Checking Packages Catalog at /packages ...');
    const pkgPage = await context.newPage();
    await pkgPage.goto(`${BASE_URL}/packages`, { waitUntil: 'networkidle', timeout: 35000 });

    // In /packages, items are article elements inside the catalog grid
    await pkgPage.waitForSelector('article', { timeout: 25000 });
    await pkgPage.evaluate(() => window.scrollBy(0, 300));
    await pkgPage.waitForTimeout(1500);

    const pkgData = await pkgPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('article'));
      const imgs = cards.map(c => c.querySelector('img')).filter(Boolean);
      const srcs = imgs.map(img => img.src);
      const uniqueSrcs = Array.from(new Set(srcs));
      const generalCheckupOnly = srcs.filter(s => s.includes('general-checkup.jpg'));

      return {
        cardCount: cards.length,
        imageCount: imgs.length,
        loadedImages: imgs.filter(img => img.complete && img.naturalWidth > 0).length,
        uniqueImagesCount: uniqueSrcs.length,
        generalCheckupCount: generalCheckupOnly.length,
        sampleSources: uniqueSrcs.slice(0, 6),
      };
    });

    const pkgScreenshot = path.join(screenshotsDir, '03-packages-catalog.png');
    await pkgPage.screenshot({ path: pkgScreenshot, fullPage: false });
    console.log(`  ✓ Packages catalog screenshot saved: ${pkgScreenshot}`);
    console.log(`  - Package cards: ${pkgData.cardCount}`);
    console.log(`  - Total package images: ${pkgData.imageCount}`);
    console.log(`  - Unique package images: ${pkgData.uniqueImagesCount}`);
    console.log(`  - Duplicated general-checkup images: ${pkgData.generalCheckupCount}`);
    report.packagesCatalog = pkgData;
    await pkgPage.close();

    // -------------------------------------------------------------
    // 4. API Doctor Schedules & Slots Direct Verification
    // -------------------------------------------------------------
    console.log('\n[4/5] Checking Doctor Schedules & Slots via Live API ...');
    // Fetch doctor and branches from live API
    const docRes = await fetch(`${BASE_URL}/api/v1/hospital/doctors?page=0&size=5`);
    const docJson = await docRes.json();
    const sampleDoctors = docJson.content || [];
    console.log(`  - Sample doctors found: ${sampleDoctors.length}`);

    const apiScheduleResults = [];
    // Test for the first doctor across 3 different days
    if (sampleDoctors.length > 0) {
      const targetDoc = sampleDoctors[0];
      const branchId = targetDoc.branchIds?.[0] || '1';
      console.log(`  - Target doctor: ${targetDoc.fullName} (id=${targetDoc.id}) at branchId=${branchId}`);

      // Check 3 dates: tomorrow, +2 days, +5 days (covering weekday and weekend)
      const testDates = [];
      const now = new Date();
      for (const offset of [1, 3, 5]) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        testDates.push(d.toISOString().slice(0, 10));
      }

      for (const testDate of testDates) {
        const slotsUrl = `${BASE_URL}/api/v1/appointments/doctors/${encodeURIComponent(targetDoc.id)}/slots?date=${testDate}&branchId=${branchId}`;
        const slotRes = await fetch(slotsUrl);
        const slots = await slotRes.json();
        const morningSlots = Array.isArray(slots) ? slots.filter(s => {
          const h = parseInt(s.startTime?.split(':')[0], 10);
          return h >= 8 && h < 12;
        }) : [];
        const afternoonSlots = Array.isArray(slots) ? slots.filter(s => {
          const h = parseInt(s.startTime?.split(':')[0], 10);
          return h >= 13 && h <= 17;
        }) : [];

        apiScheduleResults.push({
          date: testDate,
          totalSlots: Array.isArray(slots) ? slots.length : 0,
          morningSlots: morningSlots.length,
          afternoonSlots: afternoonSlots.length,
          status: slotRes.status,
        });
        console.log(`    Date ${testDate}: Total=${Array.isArray(slots) ? slots.length : 0} (Morning=${morningSlots.length}, Afternoon=${afternoonSlots.length})`);
      }
    }
    report.apiScheduleVerification = apiScheduleResults;

    // -------------------------------------------------------------
    // 5. Doctor Booking Flow UI & Schedules in Browser
    // -------------------------------------------------------------
    console.log('\n[5/5] Checking Doctor Booking Flow UI & Schedule rendering in Browser ...');
    const bookPage = await context.newPage();
    console.log('  - Navigating to /dat-lich ...');
    await bookPage.goto(`${BASE_URL}/dat-lich`, { waitUntil: 'networkidle', timeout: 35000 });

    // In /dat-lich, BookingInlineExperience is mounted directly on page
    console.log('  - Waiting for Step 1 (Chuyên khoa) ...');
    await bookPage.waitForSelector('#booking-specialty', { timeout: 20000 });
    await bookPage.waitForTimeout(1000);

    // Select first specialty
    await bookPage.selectOption('#booking-specialty', { index: 1 });
    await bookPage.waitForTimeout(500);

    const step1Next = await bookPage.waitForSelector('button:has-text("Tiếp tục: Chọn cơ sở")', { timeout: 10000 });
    await step1Next.click();
    console.log('  - Advanced to Step 2 (Cơ sở)');
    await bookPage.waitForTimeout(1500);

    // Select first branch
    await bookPage.waitForSelector('#booking-branch', { timeout: 10000 });
    await bookPage.selectOption('#booking-branch', { index: 0 });
    await bookPage.waitForTimeout(500);

    const step2Next = await bookPage.waitForSelector('button:has-text("Tiếp tục: Chọn bác sĩ")', { timeout: 10000 });
    await step2Next.click();
    console.log('  - Advanced to Step 3 (Bác sĩ)');
    await bookPage.waitForTimeout(2000);

    // Select doctor
    await bookPage.waitForSelector('#booking-doctor', { timeout: 10000 });
    // Wait for options to load
    await bookPage.waitForFunction(() => {
      const select = document.querySelector('#booking-doctor');
      return select && select.options.length > 1;
    }, { timeout: 15000 });

    await bookPage.selectOption('#booking-doctor', { index: 1 });
    await bookPage.waitForTimeout(500);

    const step3Next = await bookPage.waitForSelector('button:has-text("Tiếp tục: Chọn ngày")', { timeout: 10000 });
    await step3Next.click();
    console.log('  - Advanced to Step 4 (Ngày khám)');
    await bookPage.waitForTimeout(1000);

    // Click "Xem khung giờ"
    const step4Next = await bookPage.waitForSelector('button:has-text("Xem khung giờ")', { timeout: 10000 });
    await step4Next.click();
    console.log('  - Advanced to Step 5 (Khung giờ)');
    await bookPage.waitForTimeout(2500);

    // Wait for slot buttons to render
    await bookPage.waitForSelector('[aria-labelledby="booking-slot-label"] button', { timeout: 20000 });
    await bookPage.evaluate(() => window.scrollBy(0, 300));
    await bookPage.waitForTimeout(1000);

    const slotInfo = await bookPage.evaluate(() => {
      const slotButtons = Array.from(document.querySelectorAll('[aria-labelledby="booking-slot-label"] button'));
      const slots = slotButtons.map(btn => {
        const time = btn.querySelector('.font-bold')?.textContent.trim() || btn.textContent.trim();
        const status = btn.querySelector('.text-\\[10px\\]')?.textContent.trim() || '';
        const disabled = btn.hasAttribute('disabled');
        return { time, status, available: !disabled };
      });

      const morningSlots = slots.filter(s => {
        const h = parseInt(s.time.split(':')[0], 10);
        return h >= 8 && h < 12;
      });

      const afternoonSlots = slots.filter(s => {
        const h = parseInt(s.time.split(':')[0], 10);
        return h >= 13 && h <= 17;
      });

      return {
        totalSlots: slots.length,
        slots,
        morningSlotsCount: morningSlots.length,
        afternoonSlotsCount: afternoonSlots.length,
        hasMorningSlots: morningSlots.length > 0,
        hasAfternoonSlots: afternoonSlots.length > 0,
      };
    });

    const scheduleScreenshot = path.join(screenshotsDir, '04-doctor-booking-schedule.png');
    await bookPage.screenshot({ path: scheduleScreenshot, fullPage: false });
    console.log(`  ✓ Doctor schedule screenshot saved: ${scheduleScreenshot}`);
    console.log(`  - Total slots on UI: ${slotInfo.totalSlots}`);
    console.log(`  - Morning slots (08:00 - 12:00): ${slotInfo.morningSlotsCount}`);
    console.log(`  - Afternoon slots (13:30 - 17:30): ${slotInfo.afternoonSlotsCount}`);
    report.doctorBookingSchedule = slotInfo;

    await bookPage.close();

    console.log('\n===============================================================');
    console.log(' VISUAL VERIFICATION SUMMARY');
    console.log('===============================================================');
    console.log(JSON.stringify(report, null, 2));

    fs.writeFileSync(
      path.join(screenshotsDir, 'verification-summary.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );
    console.log(`\nSummary saved to: ${path.join(screenshotsDir, 'verification-summary.json')}`);

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
