import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const defaults = {
  input: "Lain.webp",
  svg: "output/svg/Lain-ascii.svg",
  png: "output/png/Lain-ascii.png",
  columns: 120,
  sampleSize: null,
  cellWidth: 10,
  cellHeight: 18,
  fontSize: 17,
  pngScale: 2,
  density: 300,
  alphaThreshold: 4,
  gamma: 1,
  // Characters are ordered from visually dense/dark to sparse/light.
  ramp: "@%#*+=-:.",
  invert: false,
};

const help = `
Generate a colored, transparent ASCII-art SVG and PNG from Lain.webp.

Usage:
  node generate-ascii.mjs [options]

Sampling:
  --columns <number>          Horizontal character samples (larger = finer; default 120)
  --sample-size <pixels>      Alternative: approximate source pixels per sample

Appearance:
  --ramp <characters>         Dense-to-light character ramp (default @%#*+=-:.)
  --invert                    Reverse the ramp
  --gamma <number>            Tone mapping; >1 uses denser characters (default 1)
  --alpha-threshold <0-255>   Omit nearly transparent samples (default 4)
  --cell-width <number>       SVG character-cell width (default 10)
  --cell-height <number>      SVG character-cell height (default 18)
  --font-size <number>        SVG font size (default 17)

Files:
  --input <path>              Source image (default Lain.webp)
  --svg <path>                SVG output (default output/svg/Lain-ascii.svg)
  --png <path>                PNG output (default output/png/Lain-ascii.png)
  --png-scale <number>        PNG pixels per SVG unit (default 2)
  --density <number>          PNG DPI metadata (default 300)
  --help                      Show this help
`;

function parseNumber(name, value, { minimum = 0, integer = false } = {}) {
  if (value === undefined) throw new Error(`${name} requires a value.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${name} must be ${integer ? "an integer" : "a number"} >= ${minimum}; received ${value}.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = { ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = () => argv[++index];
    switch (argument) {
      case "--input": options.input = next(); break;
      case "--svg": options.svg = next(); break;
      case "--png": options.png = next(); break;
      case "--columns": options.columns = parseNumber(argument, next(), { minimum: 1, integer: true }); break;
      case "--sample-size": options.sampleSize = parseNumber(argument, next(), { minimum: 0.1 }); break;
      case "--cell-width": options.cellWidth = parseNumber(argument, next(), { minimum: 1 }); break;
      case "--cell-height": options.cellHeight = parseNumber(argument, next(), { minimum: 1 }); break;
      case "--font-size": options.fontSize = parseNumber(argument, next(), { minimum: 1 }); break;
      case "--png-scale": options.pngScale = parseNumber(argument, next(), { minimum: 0.1 }); break;
      case "--density": options.density = parseNumber(argument, next(), { minimum: 1, integer: true }); break;
      case "--alpha-threshold": options.alphaThreshold = parseNumber(argument, next(), { minimum: 0, integer: true }); break;
      case "--gamma": options.gamma = parseNumber(argument, next(), { minimum: 0.01 }); break;
      case "--ramp": options.ramp = next(); break;
      case "--invert": options.invert = true; break;
      case "--help": options.help = true; break;
      default: throw new Error(`Unknown option: ${argument}`);
    }
  }
  if (options.sampleSize !== null && argv.includes("--columns")) {
    throw new Error("Use either --columns or --sample-size, not both.");
  }
  if (options.alphaThreshold > 255) throw new Error("--alpha-threshold must be <= 255.");
  if (!options.input || !options.svg || !options.png) throw new Error("File paths cannot be empty.");
  if (Array.from(options.ramp ?? "").length < 2) throw new Error("--ramp needs at least two characters.");
  return options;
}

function resolveFromScript(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(scriptDir, filePath);
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value, precision = 3) {
  return Number(value.toFixed(precision)).toString();
}

function hexChannel(value) {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function characterForColor(r, g, b, ramp, gamma) {
  // Rec. 709 luma gives a predictable density choice while the glyph fill keeps
  // the original RGB color. Gamma changes density only, never the sampled color.
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const tone = Math.pow(luma, gamma);
  const index = Math.min(ramp.length - 1, Math.round(tone * (ramp.length - 1)));
  return index;
}

export async function generateAscii(userOptions = {}) {
  const options = { ...defaults, ...userOptions };
  const inputPath = resolveFromScript(options.input);
  const svgPath = resolveFromScript(options.svg);
  const pngPath = resolveFromScript(options.png);
  const inputBefore = fs.readFileSync(inputPath);
  const sourceMetadata = await sharp(inputBefore).metadata();

  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error(`Could not read source dimensions: ${inputPath}`);
  }
  if (!sourceMetadata.hasAlpha) {
    throw new Error("The source image has no alpha channel; transparent-background preservation cannot be verified.");
  }

  const columns = options.sampleSize === null
    ? options.columns
    : Math.max(1, Math.ceil(sourceMetadata.width / options.sampleSize));
  // A monospace glyph is taller than it is wide. This formula compensates for
  // that cell ratio so the finished SVG keeps the source image's proportions.
  const rows = Math.max(1, Math.round(
    (sourceMetadata.height / sourceMetadata.width) *
    columns * (options.cellWidth / options.cellHeight),
  ));
  const svgWidth = columns * options.cellWidth;
  const svgHeight = rows * options.cellHeight;
  const pngWidth = Math.round(svgWidth * options.pngScale);
  const pngHeight = Math.round(svgHeight * options.pngScale);

  const { data, info } = await sharp(inputBefore)
    .ensureAlpha()
    .resize(columns, rows, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ramp = Array.from(options.invert ? Array.from(options.ramp).reverse().join("") : options.ramp);
  const glyphs = [];
  const usedCharacterIndexes = new Set();
  let omittedCells = 0;
  let partialAlphaCells = 0;
  let opaqueCells = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const offset = (row * columns + column) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const alpha = data[offset + 3];
      if (alpha <= options.alphaThreshold) {
        omittedCells += 1;
        continue;
      }

      const characterIndex = characterForColor(r, g, b, ramp, options.gamma);
      const character = ramp[characterIndex];
      if (/\s/u.test(character)) {
        omittedCells += 1;
        continue;
      }
      usedCharacterIndexes.add(characterIndex);
      if (alpha < 255) partialAlphaCells += 1;
      else opaqueCells += 1;
      glyphs.push({
        x: column * options.cellWidth,
        y: row * options.cellHeight,
        color: `#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`,
        opacity: alpha / 255,
        characterIndex,
      });
    }
  }

  const baseline = options.fontSize * 0.86;
  const definitions = [...usedCharacterIndexes]
    .sort((a, b) => a - b)
    .map((index) => (
      `    <g id="glyph-${index}"><text x="0" y="${formatNumber(baseline)}">` +
      `${escapeXml(ramp[index])}</text></g>`
    ))
    .join("\n");
  const uses = glyphs
    .map((glyph) => (
      `    <use href="#glyph-${glyph.characterIndex}" xlink:href="#glyph-${glyph.characterIndex}" ` +
      `x="${formatNumber(glyph.x)}" y="${formatNumber(glyph.y)}" ` +
      `fill="${glyph.color}" fill-opacity="${formatNumber(glyph.opacity)}" />`
    ))
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${formatNumber(svgWidth)}" height="${formatNumber(svgHeight)}"
  viewBox="0 0 ${formatNumber(svgWidth)} ${formatNumber(svgHeight)}"
  role="img" aria-labelledby="title description">
  <title id="title">Lain 彩色 ASCII 主视觉</title>
  <desc id="description">由 Lain.webp 采样生成的彩色、透明背景 ASCII 字符图</desc>
  <defs>
    <style>
      text {
        font-family: "DejaVu Sans Mono", Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: ${formatNumber(options.fontSize)}px;
        font-weight: 600;
        font-variant-ligatures: none;
      }
    </style>
${definitions}
  </defs>
  <g id="ascii-art" text-rendering="geometricPrecision">
${uses}
  </g>
</svg>
`;

  fs.mkdirSync(path.dirname(svgPath), { recursive: true });
  fs.mkdirSync(path.dirname(pngPath), { recursive: true });
  fs.writeFileSync(svgPath, svg);
  const png = await sharp(Buffer.from(svg))
    .resize(pngWidth, pngHeight, { fit: "fill" })
    .withMetadata({ density: options.density })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(pngPath, png);

  const inputAfter = fs.readFileSync(inputPath);
  if (!inputBefore.equals(inputAfter)) throw new Error("The source image changed during generation.");

  return {
    source: {
      path: inputPath,
      format: sourceMetadata.format,
      pixels: [sourceMetadata.width, sourceMetadata.height],
      hasAlpha: sourceMetadata.hasAlpha,
      sha256: sha256(inputBefore),
      preserved: true,
    },
    sampling: {
      columns,
      rows,
      totalCells: columns * rows,
      visibleGlyphs: glyphs.length,
      omittedCells,
      partialAlphaCells,
      opaqueCells,
      approximateSourcePixelsPerColumn: sourceMetadata.width / columns,
      ramp: ramp.join(""),
      gamma: options.gamma,
      alphaThreshold: options.alphaThreshold,
    },
    svg: {
      path: svgPath,
      units: [svgWidth, svgHeight],
      sha256: sha256(Buffer.from(svg)),
    },
    png: {
      path: pngPath,
      pixels: [pngWidth, pngHeight],
      density: options.density,
      sha256: sha256(png),
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(help.trim());
    } else {
      console.log(JSON.stringify(await generateAscii(options), null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
