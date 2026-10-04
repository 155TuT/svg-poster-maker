#!/usr/bin/env node
// Export paper-backed and transparent-ink versions from the same editable layouts.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, 'output');
const PAGES = [
  { name: 'logo_page', ink: 'assets/logo_page_bg/output/image-halftone-ink.png' },
  {
    name: 'slogan_page',
    ink: 'assets/slogan_page_bg/output/image-halftone-ink.png',
    // Align the full ink layer with the existing 1054 × 1255 hand-cropped background.
    // Pixel matching in the top, middle and bottom bands locates its start near y=2.
    inkCrop: [0, 2, 1054, 1255],
  },
];
const VARIANTS = ['origin', 'ink'];
const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

function variantSource(source, page, variant, stem) {
  const background = /<image\b[^>]*\bid="background-art"[^>]*\/>/;
  if (!background.test(source)) throw new Error(`${page.name}: missing background-art image.`);
  let svg = source.replace(background, image => {
    let updated = image.replace(/\bhref="[^"]+"/,
      `href="output/${page.name}/260x360mm_${variant}/${stem}-background-bleed.png"`);
    if (variant === 'ink') {
      updated = updated.replace(/\bdata-bleed-source="[^"]+"/, `data-bleed-source="${page.ink}"`);
      if (page.inkCrop) updated = updated.replace(/\/>$/, `data-extract-rect="${page.inkCrop.join(' ')}" />`);
    }
    return updated;
  });
  svg = svg.replace(/<svg\b[^>]*>/, opening => opening.replace(/>$/, ` data-background-mode="${variant}">`));
  if (variant === 'ink') {
    svg = svg.replace('</title>', ' · 透明 ink 背景</title>')
      .replace('</desc>', '背景仅使用原透明油墨层，保留主体的暖白遮罩。</desc>');
  }
  return svg;
}

async function extendBackgrounds(source) {
  const backgrounds = [];
  for (const match of source.matchAll(/<image\b[^>]*\bdata-bleed-source="([^"]+)"[^>]*>/g)) {
    const pixels = Number(match[0].match(/\bdata-extend-vertical-px="([^"]+)"/)?.[1]);
    const reference = match[0].match(/\bhref="([^"]+)"/)?.[1];
    if (!Number.isInteger(pixels) || pixels < 1 || !reference?.startsWith('output/')) {
      throw new Error('Expected a positive background extension and an output/ destination.');
    }
    const destination = path.resolve(ROOT, reference);
    if (!destination.startsWith(`${OUTPUT}${path.sep}`)) throw new Error('Background destination must remain inside output/.');
    const cropText = match[0].match(/\bdata-extract-rect="([^"]+)"/)?.[1];
    const crop = cropText ? cropText.trim().split(/\s+/).map(Number) : null;
    let background = sharp(path.resolve(ROOT, match[1]));
    if (crop) {
      if (crop.length !== 4 || !crop.every(Number.isInteger) || crop[0] < 0 || crop[1] < 0 || crop[2] < 1 || crop[3] < 1) {
        throw new Error(`Invalid background crop: ${cropText}`);
      }
      background = background.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    }
    // Extend before SVG rasterization to prevent an antialiased seam at the trim line.
    // Preserve the source RGBA values, including transparent spaces between ink dots.
    await background
      .extend({ top: pixels, bottom: pixels, left: 0, right: 0, extendWith: 'mirror' })
      .png().toFile(destination);
    backgrounds.push({ source: match[1], cropPx: crop, verticalExtensionPx: pixels, asset: reference });
  }
  return backgrounds;
}

async function makeStandalone(source) {
  let svg = source;
  const styles = [];
  for (const match of source.matchAll(/<\?xml-stylesheet\b[^?]*\bhref="([^"]+)"[^?]*\?>/g)) {
    styles.push(await fs.readFile(path.resolve(ROOT, match[1]), 'utf8'));
    svg = svg.replace(match[0], '');
  }
  if (styles.length) {
    const css = styles.join('\n').replace(/\]\]>/g, ']]]]><![CDATA[>');
    svg = svg.replace(/<svg\b[^>]*>/, opening => `${opening}\n  <style><![CDATA[\n${css}  ]]></style>`);
  }
  for (const match of [...svg.matchAll(/(<image\b[^>]*\bhref=")([^"]+)(")/g)]) {
    if (match[2].startsWith('data:')) continue;
    const mime = MIME[path.extname(match[2]).toLowerCase()];
    if (!mime) throw new Error(`Unsupported image asset: ${match[2]}`);
    const bytes = await fs.readFile(path.resolve(ROOT, match[2]));
    svg = svg.replace(match[0], () => `${match[1]}data:${mime};base64,${bytes.toString('base64')}${match[3]}`);
  }
  return svg;
}

function trimVersion(svg, width, height) {
  return svg.replace(/<svg\b[^>]*>/, opening => opening
    .replace(/\bwidth="[^"]+"/, `width="${width}mm"`)
    .replace(/\bheight="[^"]+"/, `height="${height}mm"`)
    .replace(/\bviewBox="[^"]+"/, `viewBox="0 0 ${width} ${height}"`)
    .replace(/\bdata-bleed-mm="[^"]+"/, 'data-bleed-mm="0"'))
    .replace(/，四边出血 3 mm/g, '，成品裁切预览');
}

async function exportPng(svg, directory, file, widthMm, heightMm, dpi, transparent) {
  const expected = [widthMm, heightMm].map(mm => Math.round(mm / 25.4 * dpi));
  // Use explicit pixel dimensions for rasterization: some SVG backends apply
  // density twice to physical units. The delivery SVG retains exact mm units.
  // Subpixel rounding is absorbed here; no low-resolution raster is enlarged.
  const rasterSvg = svg.replace(/<svg\b[^>]*>/, opening => opening
    .replace(/\bwidth="[^"]+"/, `width="${expected[0]}"`)
    .replace(/\bheight="[^"]+"/, `height="${expected[1]}"`)
    .replace(/>$/, ' preserveAspectRatio="none">'));
  const rendered = await sharp(Buffer.from(rasterSvg)).png().toBuffer();
  const metadata = await sharp(rendered).metadata();
  if (metadata.width !== expected[0] || metadata.height !== expected[1]) {
    throw new Error(`${file}: unexpected raster dimensions ${metadata.width} × ${metadata.height}.`);
  }
  const stats = await sharp(rendered).stats();
  if (transparent) {
    if (!metadata.hasAlpha || stats.isOpaque || stats.channels[3].min !== 0 || stats.channels[3].max === 0) {
      throw new Error(`${file}: expected visible ink and fully transparent background gaps.`);
    }
  } else if (!stats.isOpaque) {
    throw new Error(`${file}: background does not cover the complete print canvas.`);
  }
  const output = sharp(rendered);
  if (!transparent) output.removeAlpha();
  await output.withMetadata({ density: dpi }).png().toFile(path.join(directory, file));
  return { file, widthPx: expected[0], heightPx: expected[1], density: dpi, transparent };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node print_pages.mjs [--dpi NUMBER]\nExport both 260 × 360 mm pages with 3 mm bleed, in paper-backed and transparent-ink versions.\nOutput: output/{logo_page,slogan_page}/260x360mm_{origin,ink}/\nDefault: 300 dpi. The ink version retains the body underlay and the PNG alpha channel.');
    return;
  }
  let dpi = 300;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--dpi') throw new Error(`Unknown option: ${args[i]}`);
    dpi = Number(args[++i]);
    if (!Number.isFinite(dpi) || dpi < 72 || dpi > 600) throw new Error('--dpi must be between 72 and 600.');
  }
  await fs.mkdir(OUTPUT, { recursive: true });
  for (const page of PAGES) {
    const baseStem = `${page.name}_260x360mm`;
    const source = await fs.readFile(path.join(ROOT, `${baseStem}.svg`), 'utf8');
    const opening = source.match(/<svg\b[^>]*>/)?.[0] ?? '';
    const numeric = name => Number(opening.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1]);
    const width = numeric('data-trim-width-mm');
    const height = numeric('data-trim-height-mm');
    const bleed = numeric('data-bleed-mm');
    if (width !== 260 || height !== 360 || bleed !== 3) throw new Error(`${baseStem}: expected a 260 × 360 mm trim box and 3 mm bleed.`);
    for (const variant of VARIANTS) {
      const transparent = variant === 'ink';
      const stem = `${baseStem}${transparent ? '_ink' : ''}`;
      const directory = path.join(OUTPUT, page.name, `260x360mm_${variant}`);
      await fs.mkdir(directory, { recursive: true });
      const prepared = variantSource(source, page, variant, stem);
      const backgrounds = await extendBackgrounds(prepared);
      const standalone = await makeStandalone(prepared);
      const trimmed = trimVersion(standalone, width, height);
      await fs.writeFile(path.join(directory, `${stem}_bleed3mm.svg`), standalone, 'utf8');
      await fs.writeFile(path.join(directory, `${stem}.svg`), trimmed, 'utf8');
      const print = await exportPng(standalone, directory, `${stem}_bleed3mm.png`, width + 2 * bleed, height + 2 * bleed, dpi, transparent);
      const trim = await exportPng(trimmed, directory, `${stem}.png`, width, height, dpi, transparent);
      const preview = await sharp(path.join(directory, trim.file)).resize({ width: 800 }).png().toBuffer();
      await fs.writeFile(path.join(directory, `${stem}-preview.png`), preview);
      if (transparent) {
        // Viewing aid only: this flat paper-colour simulation is never used by the print files.
        await sharp(preview).flatten({ background: '#b58b5d' }).png()
          .toFile(path.join(directory, `${stem}-kraft-preview.png`));
      }
      const spec = {
        page: page.name, variant, source: `${baseStem}.svg`,
        trimMm: [width, height], bleedPerSideMm: bleed,
        mediaMm: [width + 2 * bleed, height + 2 * bleed], dpi, colorSpace: 'sRGB',
        transparentBackground: transparent, bodyUnderlay: 'preserved', backgrounds, print, trim,
        bodyCenterMm: [130, 180], bodySizeMm: [1008, 1424].map(n => n * 0.64 * 360 / 1369),
      };
      await fs.writeFile(path.join(directory, 'print-spec.json'), `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
      console.log(`${page.name}/260x360mm_${variant}: print ${print.widthPx} × ${print.heightPx} px; trim ${trim.widthPx} × ${trim.heightPx} px; ${dpi} dpi${transparent ? '; alpha preserved' : ''}.`);
    }
  }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
