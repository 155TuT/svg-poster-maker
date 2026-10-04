#!/usr/bin/env node
// Export the edited slogan_page.svg. Only files in output/ are written.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(ROOT, 'output', 'slogan_page', 'origin');
const SOURCE = path.join(ROOT, 'slogan_page.svg');
const MIME = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function makeStandalone(source) {
  // Read the stylesheet referenced by the source, then inline it in memory.
  // Keep the editable source and CSS separate and untouched on disk.
  let svg = source;
  const styles = [];
  for (const match of source.matchAll(/<\?xml-stylesheet\b[^?]*\bhref="([^"]+)"[^?]*\?>/g)) {
    const css = await fs.readFile(path.resolve(ROOT, match[1]), 'utf8');
    styles.push(css);
    svg = svg.replace(match[0], '');
  }
  if (styles.length) {
    const css = styles.join('\n').replace(/\]\]>/g, ']]]]><![CDATA[>');
    svg = svg.replace(/<svg\b[^>]*>/, opening =>
      `${opening}\n  <style id="slogan-page-styles"><![CDATA[\n${css}  ]]></style>`);
  }

  // Embed the original image bytes in the export so it can be moved or shared.
  // The source keeps its readable relative asset paths.
  for (const match of [...svg.matchAll(/(<image\b[^>]*\bhref=")([^"]+)(")/g)]) {
    const reference = match[2];
    if (reference.startsWith('data:')) continue;
    const mime = MIME[path.extname(reference).toLowerCase()];
    if (!mime) throw new Error(`Unsupported image asset: ${reference}`);
    const bytes = await fs.readFile(path.resolve(ROOT, reference));
    const embedded = `${match[1]}data:${mime};base64,${bytes.toString('base64')}${match[3]}`;
    svg = svg.replace(match[0], () => embedded);
  }
  return svg;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node slogan_page.mjs [--scale NUMBER]\nExport the current slogan_page.svg and its referenced CSS/images.\n--scale: PNG export scale; default 2. The preview is at most 800 px wide.\nThe source SVG, CSS and component assets are never rewritten.');
    return;
  }
  let scale = 2;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--scale') throw new Error(`Unknown option: ${args[i]}`);
    scale = Number(args[++i]);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('--scale needs a positive number.');
  }

  const source = await fs.readFile(SOURCE, 'utf8');
  const standalone = await makeStandalone(source);
  const buffer = Buffer.from(standalone, 'utf8');
  await fs.mkdir(OUTPUT, { recursive: true });
  const [, png] = await Promise.all([
    fs.writeFile(path.join(OUTPUT, 'slogan_page.svg'), standalone, 'utf8'),
    sharp(buffer, { density: 72 * scale }).png()
      .toFile(path.join(OUTPUT, 'slogan_page.png')),
    sharp(buffer).resize({ width: 800, withoutEnlargement: true }).png()
      .toFile(path.join(OUTPUT, 'slogan_page-preview.png')),
  ]);
  console.log(`Exported output/slogan_page/origin/: slogan_page.svg, slogan_page.png (${png.width} × ${png.height}) and slogan_page-preview.png.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
