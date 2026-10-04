#!/usr/bin/env node
// Export the current SVG as edited. This script never writes to mainbody.svg.
// npm run build and npm run render both use this same export-only path.
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(ROOT, 'mainbody.svg');
const OUTPUT = path.join(ROOT, 'output');
const runFile = promisify(execFile);

// FINAL PNG TYPE ONLY: the clean SVG / preview keep the existing cut-letter design.
// Spacing is in SVG units and follows --scale, so export resolution does not
// change the apparent dot size. Completion opacity belongs to mainbody.css.
// Current logo_page.svg places the body at 0.64 scale, so the chosen 5.2 pitch
// becomes 5.2 * 0.64 = 3.328 canvas units in the final composition.
const halftone = {
  completeLetters: ['e', 's', 't', 'o', 'n', 'l', 'i'],
  spacing: 5.2,
  angle: 45,
  ink: '#111111',
  paper: '#ffffff', // Temporary tonal reference, never delivered as a background.
  gamma: 1.1,
  dotScale: 1,
  grain: 0.018,
  samples: 3,
  seed: 2026,
};

function addPrintCompletions(svg) {
  let count = 0;
  // Reuse the actual edited SVG glyph and transform. No font rebuild or change
  // to source text is needed; the full faint glyph sits behind the dark fragment.
  const group = /(<g\b[^>]*\bdata-character="([^"]+)"[^>]*>)(\s*<g\b[^>]*class="[^"]*\bletter-fragment\b[^"]*"[^>]*>\s*(<use\b[^>]*\/>)\s*<\/g>)/g;
  const completed = svg.replace(group, (match, opening, character, fragment, glyph) => {
    if (!halftone.completeLetters.includes(character)) return match;
    count++;
    return `${opening}\n        <g class="halftone-completion">\n          ${glyph}\n        </g>${fragment}`;
  });
  const expected = [...svg.matchAll(/data-character="([^"]+)"/g)]
    .filter(match => halftone.completeLetters.includes(match[1])).length;
  if (count !== expected) throw new Error('Cannot locate every selected glyph for the final PNG completion layer.');
  return { svg: completed, count };
}

async function renderHalftone(standalone, scale) {
  // Each export owns a fresh system-temp directory; no repository tmp is needed.
  const temporaryRoot = path.resolve(tmpdir());
  const temporary = await fs.mkdtemp(path.join(temporaryRoot, 'west2online-mainbody-'));
  try {
    await renderHalftoneLayers(standalone, scale, temporary);
  } finally {
    // Remove only the unique directory created above, including on export errors.
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function renderHalftoneLayers(standalone, scale, temporary) {
  const completed = addPrintCompletions(standalone);
  const input = path.join(temporary, 'mainbody-tonal-input.png');
  const detailsFile = path.join(temporary, 'mainbody-clean-details.png');
  // Only the display letters enter the dot screen. Keep the rules, editable
  // small type and original logo in a separate transparent raster layer.
  const detailSelectors = [
    '.grid-frame', '.cell-divider', '.writing-rule', '.split-rule',
    '.extra-guide', '.registration', '.annotation', '.microcopy', '.caption', '.logo-asset',
  ].join(',');
  const typeOnly = completed.svg.replace('</svg>', `<style>${detailSelectors}{display:none!important}</style></svg>`);
  const detailsOnly = standalone.replace('</svg>', '<style>.letter-fragment,.halftone-completion{display:none!important}</style></svg>');
  // Flatten opacity into light RGB first. Otherwise the existing halftone
  // algorithm would screen a dark, low-alpha glyph as a faint solid silhouette.
  await Promise.all([
    sharp(Buffer.from(typeOnly), { density: 72 * scale })
      .flatten({ background: halftone.paper }).png().toFile(input),
    sharp(Buffer.from(detailsOnly), { density: 72 * scale }).png().toFile(detailsFile),
  ]);
  const args = [
    path.resolve(ROOT, '../logo_page_bg/halftone.cjs'),
    '--input', input,
    '--output', temporary,
    '--mode', 'color',
    '--spacing', String(halftone.spacing * scale),
    '--angle', String(halftone.angle),
    '--ink', halftone.ink,
    '--paper', halftone.paper,
    '--gamma', String(halftone.gamma),
    '--dot-scale', String(halftone.dotScale),
    '--grain', String(halftone.grain),
    '--samples', String(halftone.samples),
    '--seed', String(halftone.seed),
  ];
  console.log(`Screening display letters only with logo_page_bg/halftone.cjs; ${completed.count} faint cut-letter completions.`);
  const result = await runFile(process.execPath, args, {
    cwd: ROOT,
    windowsHide: true,
    env: {
      ...process.env,
      // Let the sibling script reuse this subproject's installed sharp package.
      NODE_PATH: [path.join(ROOT, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    },
  });
  console.log(result.stdout.trim().split(/\r?\n/)[0]);
  // The ink layer contains only large type, with transparent gaps and no paper.
  // Put the unprocessed detail layer on top, matching its order in the SVG.
  // Buffers keep image readers from holding temporary file handles on Windows.
  const [ink, details] = await Promise.all([
    fs.readFile(path.join(temporary, 'image-halftone-ink.png')),
    fs.readFile(detailsFile),
  ]);
  const meta = await sharp(ink).metadata();
  if (!meta.hasAlpha) throw new Error('Halftone ink export lost transparency.');
  await sharp(ink).composite([{ input: details, blend: 'over' }])
    .png().toFile(path.join(OUTPUT, 'mainbody.png'));
}

async function render(scale) {
  const [source, css] = await Promise.all([
    fs.readFile(SOURCE, 'utf8'),
    fs.readFile(path.join(ROOT, 'mainbody.css'), 'utf8'),
  ]);
  // Keep the authoring SVG and CSS separate; the delivery SVG is self-contained.
  let standalone = source.replace(/<\?xml-stylesheet[^?]*\?>\s*/g, '')
    .replace(/(<svg\b[^>]*>)/, `$1\n  <style id="mainbody-styles"><![CDATA[\n${css}  ]]></style>`);
  // Preserve readable relative asset paths in the source. Embed their original
  // bytes only in the delivery SVG so it also works after moving out of this folder.
  for (const match of [...standalone.matchAll(/(<image\b[^>]*\bhref=")([^"]+)(")/g)]) {
    const reference = match[2];
    if (reference.startsWith('data:')) continue;
    const mime = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[path.extname(reference).toLowerCase()];
    if (!mime) throw new Error(`Unsupported image asset: ${reference}`);
    const bytes = await fs.readFile(path.resolve(ROOT, reference));
    standalone = standalone.replace(match[0], `${match[1]}data:${mime};base64,${bytes.toString('base64')}${match[3]}`);
  }
  const size = source.match(/viewBox="\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*"/);
  if (!size) throw new Error('Expected a viewBox starting at 0 0.');
  const width = Number(size[1]);
  const height = Number(size[2]);
  if (/<(?:foreignObject|script)\b/i.test(source)) throw new Error('Mainbody source must not contain scripts or foreignObject.');
  await fs.mkdir(OUTPUT, { recursive: true });
  await fs.writeFile(path.join(OUTPUT, 'mainbody.svg'), standalone, 'utf8');
  const png = await sharp(Buffer.from(standalone), { density: 72 * scale }).png().toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== Math.round(width * scale) || meta.height !== Math.round(height * scale) || !meta.hasAlpha) {
    throw new Error('PNG dimensions or transparency did not match the source.');
  }
  await sharp(png).resize({ width: Math.round(width) }).png().toFile(path.join(OUTPUT, 'mainbody-preview.png'));
  await renderHalftone(standalone, scale);
  console.log(`Exported clean SVG + preview; mainbody.png with halftone letters and clean details (${meta.width} x ${meta.height}, transparent).`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node mainbody.mjs [--scale NUMBER]\nExport the current mainbody.svg + mainbody.css; the source is never rewritten.\nOnly large letters are screened for the final PNG. Rules, small copy and logo stay clean.\n--scale: PNG scale, 1 to 8; default 2 (dot spacing follows scale).\n--build: accepted as a legacy alias for the same export-only operation.');
    return;
  }
  let scale = 2;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--build') continue;
    else if (args[i] === '--scale' && args[i + 1]) scale = Number(args[++i]);
    else throw new Error(`Unknown or incomplete option: ${args[i]}`);
  }
  if (!Number.isFinite(scale) || scale < 1 || scale > 8) throw new Error('--scale must be between 1 and 8.');
  await render(scale);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
