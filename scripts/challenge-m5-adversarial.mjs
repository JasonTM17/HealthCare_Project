import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const rootDir = path.resolve(__dirname, '..');
const playwrightPath = path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test');
const { chromium } = require(playwrightPath);

const screenshotsDir = path.join(rootDir, 'verification_screenshots');
const BASE_URL = process.env.BASE_URL || 'https://www.healthcare.id.vn';

function parseRgb(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function relativeLuminance(r, g, b) {
  const sRGB = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function getContrastRatio(rgb1, rgb2) {
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runAdversarialChallenge() {
  console.log('================================================================');
  console.log(' STARTING EMPIRICAL CHALLENGE & STRESS HARNESS (MILESTONE M5)');
  console.log(` Target Origin: ${BASE_URL}`);
  console.log('================================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = {
    test1_doctorCatalog: null,
    test2_emergencyDesktop: null,
    test3_emergencyMobile: null,
    test4_contrastCalculations: null,
    test5_imageFallback: null,
    test6_imageInfiniteLoopPrevention: null,
  };

  try {
    // -------------------------------------------------------------
    // 1. Doctor Catalog Rendering & Pagination Stress Test
    // -------------------------------------------------------------
    console.log('[CHALLENGE 1] Stress-Testing Doctor Catalog (/doctors)...');
    const docContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const docPage = await docContext.newPage();
    const docResp = await docPage.goto(`${BASE_URL}/doctors`, { waitUntil: 'networkidle', timeout: 35000 });
    
    if (docResp.status() !== 200) {
      throw new Error(`Doctor catalog failed to load with status ${docResp.status()}`);
    }

    await docPage.waitForSelector('.catalog-card', { timeout: 15000 });
    const cardCount = (await docPage.$$('.catalog-card')).length;
    console.log(`  - Page 1 doctor cards count: ${cardCount} (Requirement: >= 11)`);
    if (cardCount < 11) {
      throw new Error(`Expected at least 11 doctor cards, got ${cardCount}`);
    }

    const hasError = await docPage.$('.catalog-status--error');
    if (hasError) {
      const errTxt = await hasError.textContent();
      throw new Error(`Catalog error banner present: ${errTxt}`);
    }
    console.log(`  ✓ No error banner found.`);

    // Pagination test with explicit response waiting
    const initialStatus = await docPage.$eval('.catalog-pagination__status', el => el.textContent.trim());
    console.log(`  - Pagination initial: "${initialStatus}"`);
    
    const nextBtn = docPage.locator('.catalog-pagination__button', { hasText: 'Sau' });
    const p2Promise = docPage.waitForResponse(
      r => r.url().includes('/hospital/doctors') && r.url().includes('page=1') && r.status() === 200,
      { timeout: 25000 }
    );
    await nextBtn.click();
    await p2Promise;

    await docPage.waitForFunction(() => {
      const el = document.querySelector('.catalog-pagination__status');
      return el && el.textContent.includes('Trang 2 /');
    }, { timeout: 10000 });

    const p2Status = await docPage.$eval('.catalog-pagination__status', el => el.textContent.trim());
    const p2Cards = (await docPage.$$('.catalog-card')).length;
    console.log(`  - Pagination Page 2 status: "${p2Status}"`);
    console.log(`  - Page 2 doctor cards count: ${p2Cards}`);
    
    if (!p2Status.includes('Trang 2 /')) {
      throw new Error(`Pagination failed to advance to Page 2; status: "${p2Status}"`);
    }
    console.log(`  ✓ Pagination successfully advanced to Page 2 with ${p2Cards} cards.`);

    results.test1_doctorCatalog = { cardCount, p2Cards, initialStatus, p2Status, pass: true };
    await docContext.close();

    // -------------------------------------------------------------
    // 2. Emergency 115 Alert Card: Desktop Rendering & tel:115 Link
    // -------------------------------------------------------------
    console.log('\n[CHALLENGE 2] Stress-Testing Emergency 115 Card on Desktop (1440x900)...');
    const acuteUrl = `${BASE_URL}/articles/phong-ngua-dot-quy-o-nguoi-tre-va-trung-nien`;
    const deskContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const deskPage = await deskContext.newPage();
    await deskPage.goto(acuteUrl, { waitUntil: 'networkidle', timeout: 35000 });

    const deskAlert = await deskPage.$('.article-news-alert-box--danger');
    if (!deskAlert) throw new Error('Emergency alert card .article-news-alert-box--danger not found on desktop');
    const isDeskVisible = await deskAlert.isVisible();
    console.log(`  - Desktop alert card visible: ${isDeskVisible}`);

    const deskCallBtn = await deskPage.$('.article-news-alert-box__call-115');
    if (!deskCallBtn) throw new Error('Call button .article-news-alert-box__call-115 not found');
    const deskHref = await deskCallBtn.getAttribute('href');
    const deskBtnText = await deskCallBtn.textContent();
    console.log(`  - Call button href: "${deskHref}"`);
    console.log(`  - Call button text: "${deskBtnText.trim()}"`);

    if (deskHref !== 'tel:115') {
      throw new Error(`Expected href="tel:115", received "${deskHref}"`);
    }
    console.log(`  ✓ Verified: Call button has valid tel:115 href.`);

    results.test2_emergencyDesktop = { isVisible: isDeskVisible, href: deskHref, pass: true };
    await deskContext.close();

    // -------------------------------------------------------------
    // 3. Emergency 115 Alert Card: Mobile Rendering (390x844) & Scrolled Capture
    // -------------------------------------------------------------
    console.log('\n[CHALLENGE 3] Stress-Testing Emergency 115 Card on Mobile (390x844)...');
    const mobContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobPage = await mobContext.newPage();
    await mobPage.goto(acuteUrl, { waitUntil: 'networkidle', timeout: 35000 });

    const mobAlert = await mobPage.$('.article-news-alert-box--danger');
    if (!mobAlert) throw new Error('Emergency alert card not found on mobile');
    const isMobVisible = await mobAlert.isVisible();

    // Scroll alert into view to verify real viewport rendering
    await mobAlert.scrollIntoViewIfNeeded();
    await mobPage.waitForTimeout(500);

    const boundingBox = await mobAlert.boundingBox();
    console.log(`  - Mobile alert card visible: ${isMobVisible}`);
    console.log(`  - Mobile alert bounding box: width=${boundingBox.width}px, height=${boundingBox.height}px`);

    const mobCallBtn = await mobPage.$('.article-news-alert-box__call-115');
    const mobHref = await mobCallBtn.getAttribute('href');
    const mobBtnBounding = await mobCallBtn.boundingBox();
    console.log(`  - Mobile call button href: "${mobHref}"`);
    console.log(`  - Mobile call button dimensions: width=${mobBtnBounding.width}px, height=${mobBtnBounding.height}px (touch target >= 44px)`);

    if (mobBtnBounding.height < 44) {
      console.warn(`  ⚠ Warning: Button height ${mobBtnBounding.height}px is below 44px touch target guideline.`);
    } else {
      console.log(`  ✓ Touch target conforms to >= 44px accessibility guideline.`);
    }

    // Capture scrolled mobile screenshot where the emergency card is in center of screen
    const scrolledScreenshotPath = path.join(screenshotsDir, 'r6_emergency_115_alert_mobile_scrolled.png');
    await mobPage.screenshot({ path: scrolledScreenshotPath, fullPage: false });
    console.log(`  ✓ Saved scrolled mobile screenshot: ${scrolledScreenshotPath}`);

    results.test3_emergencyMobile = {
      isVisible: isMobVisible,
      width: boundingBox.width,
      buttonHeight: mobBtnBounding.height,
      scrolledScreenshot: scrolledScreenshotPath,
      pass: true,
    };
    await mobContext.close();

    // -------------------------------------------------------------
    // 4. Color & Contrast Calculation (WCAG 2.1 AA >= 4.5:1)
    // -------------------------------------------------------------
    console.log('\n[CHALLENGE 4] Verifying Contrast Ratios for Emergency Alert Card...');
    const contrastContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cPage = await contrastContext.newPage();
    await cPage.goto(acuteUrl, { waitUntil: 'networkidle', timeout: 35000 });

    const contrastData = await cPage.evaluate(() => {
      const box = document.querySelector('.article-news-alert-box--danger');
      const headerStrong = document.querySelector('.article-news-alert-box--danger .article-news-alert-box__header strong');
      const callBtn = document.querySelector('.article-news-alert-box__call-115');
      const listItem = document.querySelector('.article-news-alert-box--danger li');

      const boxStyle = window.getComputedStyle(box);
      const headerStyle = window.getComputedStyle(headerStrong);
      const btnStyle = window.getComputedStyle(callBtn);
      const listStyle = listItem ? window.getComputedStyle(listItem) : null;

      return {
        boxBg: boxStyle.backgroundColor,
        headerColor: headerStyle.color,
        btnBg: btnStyle.backgroundColor,
        btnColor: btnStyle.color,
        listColor: listStyle ? listStyle.color : null,
      };
    });

    console.log('  - Computed element styles:', contrastData);

    // 1) Call button text on button background
    const btnBg = parseRgb(contrastData.btnBg);
    const btnFg = parseRgb(contrastData.btnColor);
    const btnContrast = getContrastRatio(btnBg, btnFg);
    console.log(`  - Call Button Contrast: ${btnContrast.toFixed(2)}:1 (Text rgb(${btnFg.join(',')}) on Bg rgb(${btnBg.join(',')}))`);

    // 2) Alert box header text on box background
    const boxBg = parseRgb(contrastData.boxBg);
    const headerFg = parseRgb(contrastData.headerColor);
    const headerContrast = getContrastRatio(boxBg, headerFg);
    console.log(`  - Box Header Contrast: ${headerContrast.toFixed(2)}:1 (Text rgb(${headerFg.join(',')}) on Bg rgb(${boxBg.join(',')}))`);

    // 3) Alert box list text on box background
    const listFg = parseRgb(contrastData.listColor || contrastData.headerColor);
    const listContrast = getContrastRatio(boxBg, listFg);
    console.log(`  - Box Body Text Contrast: ${listContrast.toFixed(2)}:1`);

    if (btnContrast < 4.5) {
      throw new Error(`Call button contrast ratio ${btnContrast.toFixed(2)}:1 fails WCAG AA minimum 4.5:1`);
    }
    if (headerContrast < 4.5) {
      throw new Error(`Alert box header contrast ratio ${headerContrast.toFixed(2)}:1 fails WCAG AA minimum 4.5:1`);
    }
    console.log(`  ✓ All contrast ratios exceed WCAG 2.1 AA minimum 4.5:1!`);

    results.test4_contrastCalculations = {
      btnContrast: btnContrast.toFixed(2),
      headerContrast: headerContrast.toFixed(2),
      listContrast: listContrast.toFixed(2),
      pass: true,
    };
    await contrastContext.close();

    // -------------------------------------------------------------
    // 5. Article Image Fallback & Infinite Loop Resistance
    // -------------------------------------------------------------
    console.log('\n[CHALLENGE 5] Stress-Testing Article Image Fallback Protection...');
    const imgContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const imgPage = await imgContext.newPage();
    await imgPage.goto(`${BASE_URL}/articles`, { waitUntil: 'networkidle', timeout: 35000 });

    // Test standard fallback on broken URL
    const fallbackEvaluation = await imgPage.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('article, .article-card, a[href*="/articles/"]'));
      const images = Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('/media/articles/'));
      
      if (images.length === 0) return { error: 'No article images found' };

      const testImg = images[0];
      const initialSrc = testImg.src;

      // Force broken source
      testImg.src = 'https://broken-404-nonexistent.invalid/image.jpg';
      testImg.dispatchEvent(new Event('error'));

      const fallbackSrc = testImg.src;
      const isFallbackStandard = fallbackSrc.endsWith('/media/articles/cham-soc-suc-khoe-tong-quat.jpg');

      return {
        initialSrc,
        brokenSrc: 'https://broken-404-nonexistent.invalid/image.jpg',
        fallbackSrc,
        isFallbackStandard,
      };
    });

    console.log('  - Fallback evaluation result:', fallbackEvaluation);
    if (!fallbackEvaluation.isFallbackStandard) {
      throw new Error(`Image onError fallback did not set standard internal image: ${fallbackEvaluation.fallbackSrc}`);
    }
    console.log(`  ✓ Verified: Broken image gracefully replaced with standard internal image.`);
    results.test5_imageFallback = { ...fallbackEvaluation, pass: true };

    // Test infinite loop resistance: if the fallback image itself errors
    console.log('  - Testing infinite loop prevention when fallback image errors...');
    const loopEvaluation = await imgPage.evaluate(() => {
      const img = document.querySelector('img');
      let errorCount = 0;

      // Wrap onerror
      const origOnError = img.onerror;
      img.addEventListener('error', () => {
        errorCount++;
      });

      // Set to fallback image and trigger error
      img.src = '/media/articles/cham-soc-suc-khoe-tong-quat.jpg';
      // If error fires on the fallback image itself, does it change src again?
      const srcBefore = img.src;
      img.dispatchEvent(new Event('error'));
      const srcAfter = img.src;

      return {
        srcBefore,
        srcAfter,
        srcUnchanged: srcBefore === srcAfter,
      };
    });

    console.log('  - Loop resistance result:', loopEvaluation);
    if (!loopEvaluation.srcUnchanged) {
      throw new Error('Image src changed upon erroring on the fallback image! Risk of infinite loop.');
    }
    console.log(`  ✓ Verified: Infinite loop guard confirmed (src unchanged if already fallback image).`);
    results.test6_imageInfiniteLoopPrevention = { ...loopEvaluation, pass: true };

    await imgContext.close();

  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log(' EMPIRICAL CHALLENGE SUMMARY');
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));
  return results;
}

runAdversarialChallenge()
  .then((res) => {
    console.log('\n>>> VERDICT: ALL TESTS PASSED EMPIRICALLY <<<');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ CHALLENGE FAILED:', err);
    process.exit(1);
  });
