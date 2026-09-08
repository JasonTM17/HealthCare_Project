const path = require('path');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const playwrightPath = path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test');
const { chromium } = require(playwrightPath);

(async () => {
  const svgPath = path.join(rootDir, 'docs', 'assets', 'architecture.svg');
  const pngPath = path.join(rootDir, 'docs', 'assets', 'architecture.png');
  const legacyPngPath = path.join(rootDir, 'assets', 'images', 'healthcare-system-architecture.png');

  console.log(`Reading SVG from: ${svgPath}`);
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 2 // 2880 x 1960 Retina 2x high resolution
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background: #F8FAFC; display: flex; justify-content: center; align-items: center; }
    svg { display: block; width: 1440px; height: 980px; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;

  await page.setContent(html, { waitUntil: 'networkidle' });
  // Wait slightly for any font rendering
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: pngPath,
    fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 980 }
  });
  console.log(`Rendered PNG to: ${pngPath}`);

  // Also copy to legacy path
  fs.copyFileSync(pngPath, legacyPngPath);
  console.log(`Copied PNG to legacy path: ${legacyPngPath}`);

  await browser.close();
  console.log('Rendering completed successfully.');
})();
