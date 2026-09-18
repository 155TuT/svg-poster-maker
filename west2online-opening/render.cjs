/* Export the SVG as edited. Fonts and styling belong to the artwork. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const sharp = require('sharp');

async function main() {
  const sourceFile = path.join(__dirname, '2026-opening.svg');
  const outputDir = path.join(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });

  const executablePath = [
    process.env.OPENING_BROWSER,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].filter(Boolean).find(file => fs.existsSync(file));
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(sourceFile).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const artwork = page.locator('svg').first();
    const size = await artwork.evaluate(svg => ({
      width: Math.ceil(svg.width.baseVal.value),
      height: Math.ceil(svg.height.baseVal.value),
    }));
    await page.setViewportSize(size);

    const fullFile = path.join(outputDir, '2026-opening.png');
    await artwork.screenshot({ path: fullFile, animations: 'disabled' });
    await sharp(fullFile).resize({ width: 402 }).png()
      .toFile(path.join(outputDir, '2026-opening-preview.png'));
    await sharp(fullFile).resize(390, 844, { fit: 'cover', position: 'centre' }).png()
      .toFile(path.join(outputDir, '2026-opening-mobile-390x844.png'));
    console.log('Exported 3 PNGs to output/');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });