import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import * as fontkit from "fontkit";
import OpenCC from "opencc-js";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(scriptDir, "design.html");
const pngPath = path.join(scriptDir, "output", "png", "design-poster.png");
const pdfPath = path.join(scriptDir, "output", "pdf", "design-poster.pdf");

const canvas = { width: 842, height: 1191 };
const layoutViewBox = { width: 595, height: 842 };
const exportPixels = { width: 3508, height: 4961 };
const exportDpi = 300;
const pagePoints = { width: 841.8898, height: 1190.5512 };
const evaTitleEffects = {
  blurScale: 1.4,
  blurSigma: 0.3,
  noiseAmplitude: 18,
  noiseSeed: 18,
};

const matisseFontCandidates = [
  process.env.MATISSE_FONT_PATH,
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts", "FOT-MatissePro-EB.otf")
    : null,
  process.env.WINDIR
    ? path.join(process.env.WINDIR, "Fonts", "FOT-MatissePro-EB.otf")
    : null,
].filter(Boolean);

// eva-title first converts unmatched Simplified Chinese glyphs to Traditional
// Chinese. OpenCC supplies the candidate; fontkit verifies that Matisse EB can
// actually render it before the visible SVG text is changed.
const toTraditional = OpenCC.Converter({ from: "cn", to: "t" });

const assets = [
  {
    id: "app-icon-source",
    source: "apple-app-icon-develop/apple-app-icon-develop.png",
    filePath: path.join(scriptDir, "apple-app-icon-develop", "apple-app-icon-develop.png"),
    convertToPng: false,
  },
  {
    id: "lain-portrait-source",
    source: "lain/Lain.webp",
    filePath: path.join(scriptDir, "lain", "Lain.webp"),
    // Keep the editable source as WebP, but embed PNG for reliable SVG rendering.
    convertToPng: true,
  },
  {
    id: "lain-ascii-source",
    source: "lain/output/png/Lain-ascii-fine.png",
    filePath: path.join(scriptDir, "lain", "output", "png", "Lain-ascii-fine.png"),
    convertToPng: false,
  },
  {
    id: "win95-qrcode-source",
    source: "qrcode-with-win95-explorer/output/qrcode-with-win95-explorer.png",
    filePath: path.join(
      scriptDir,
      "qrcode-with-win95-explorer",
      "output",
      "qrcode-with-win95-explorer.png",
    ),
    convertToPng: false,
  },
  {
    id: "win95-paint-title-source",
    source: "title-with-win95-paint/output/title-with-win95-paint.png",
    filePath: path.join(
      scriptDir,
      "title-with-win95-paint",
      "output",
      "title-with-win95-paint.png",
    ),
    convertToPng: false,
  },
  {
    id: "win95-notebook-maintext-source",
    source: "maintext-with-win95-notebook/output/maintext-with-win95-notebook.png",
    filePath: path.join(
      scriptDir,
      "maintext-with-win95-notebook",
      "output",
      "maintext-with-win95-notebook.png",
    ),
    convertToPng: false,
  },
];

const requiredSemanticIds = [
  "poster-artwork",
  "background-artwork",
  "layout-guides",
  "lain-hero-artwork",
  "app-icon-background",
  "lain-portrait-ghost",
  "lain-ascii-foreground",
  "join-qr-code",
  "win95-qrcode-pattern",
  "win95-qrcode-source",
  "win95-explorer-qrcode",
  "title-with-win95-paint",
  "win95-paint-title-pattern",
  "win95-paint-title-source",
  "win95-paint-title",
  "maintext-with-win95-notebook",
  "win95-notebook-maintext-pattern",
  "win95-notebook-maintext-source",
  "win95-notebook-maintext",
  "poster-copy",
  "design-philosophy-title-upper-right-corner",
  "design-philosophy-title-bottom-left-corner",
  "editorial-caption-top-left",
  "editorial-caption-bottom-right",
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function embedImageForRender(svg, asset, dataUri) {
  const imagePattern = new RegExp(`<image\\b(?=[^>]*\\bid="${asset.id}")[^>]*\\/>`, "s");
  const match = svg.match(imagePattern);
  if (!match) throw new Error(`Missing image element: ${asset.id}`);

  const image = match[0];
  const dataSource = image.match(/\sdata-source="([^"]+)"/)?.[1];
  if (dataSource !== asset.source) {
    throw new Error(`${asset.id} data-source must be ${asset.source}; received ${dataSource}`);
  }
  const href = image.match(/\shref="([^"]+)"/)?.[1];
  if (href !== asset.source) {
    throw new Error(`${asset.id} href must be the external asset ${asset.source}; received ${href}`);
  }

  const embeddedImage = image.replace(/\shref="[^"]+"/, ` href="${dataUri}"`);
  return svg.replace(match[0], embeddedImage);
}

function extractPosterSvg(html) {
  const match = html.match(/<svg\b(?=[^>]*\bid="poster-editor")[\s\S]*?<\/svg>/);
  if (!match) throw new Error('design.html must contain one inline SVG with id="poster-editor".');
  return match[0];
}

function normalizeSvgStructure(svg) {
  const defsMatch = svg.match(/\n  <defs>[\s\S]*?\n  <\/defs>/);
  const artworkIndex = svg.indexOf('\n  <g id="poster-artwork"');
  if (!defsMatch || artworkIndex === -1 || defsMatch.index < artworkIndex) return svg;

  const withoutDefs = svg.replace(defsMatch[0], "");
  const normalizedArtworkIndex = withoutDefs.indexOf('\n  <g id="poster-artwork"');
  return `${withoutDefs.slice(0, normalizedArtworkIndex)}${defsMatch[0]}\n${withoutDefs.slice(normalizedArtworkIndex)}`;
}

function decodeXmlText(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function encodeXmlText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function countOccurrence(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function elementHasClass(element, className) {
  const openTag = element.match(/^<[^>]+>/)?.[0];
  const classValue = openTag?.match(/\bclass="([^"]*)"/)?.[1] ?? "";
  return classValue.split(/\s+/).includes(className);
}

function openMatisseFont() {
  for (const fontPath of matisseFontCandidates) {
    if (!fs.existsSync(fontPath)) continue;
    try {
      return { font: fontkit.openSync(fontPath), path: fontPath };
    } catch (error) {
      console.warn(`Could not inspect Matisse EB at ${fontPath}: ${error.message}`);
    }
  }
  return { font: null, path: null };
}

function renderMatisseTypography(svg) {
  const { font, path: fontPath } = openMatisseFont();
  const substitutions = new Map();
  const fallbacks = new Map();
  let trackedTextElements = 0;
  let trackedSpans = 0;

  const renderedSvg = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, (textElement) => {
    if (!elementHasClass(textElement, "font-display")) return textElement;

    trackedTextElements += 1;
    return textElement.replace(/>([^<]+)</g, (match, encodedSource) => {
      if (encodedSource.trim() === "") return match;

      trackedSpans += 1;
      const source = decodeXmlText(encodedSource);
      let rendered = "";
      for (const character of source) {
        const codePoint = character.codePointAt(0);
        if (!font || font.hasGlyphForCodePoint(codePoint)) {
          rendered += character;
          continue;
        }

        const candidate = toTraditional(character);
        const candidateCharacters = Array.from(candidate);
        if (
          candidate !== character
          && candidateCharacters.length === 1
          && font.hasGlyphForCodePoint(candidateCharacters[0].codePointAt(0))
        ) {
          rendered += candidateCharacters[0];
          countOccurrence(substitutions, `${character}\u2192${candidateCharacters[0]}`);
        } else {
          rendered += character;
          countOccurrence(fallbacks, character);
        }
      }

      return `>${encodeXmlText(rendered)}<`;
    });
  });

  if (trackedTextElements === 0 || trackedSpans === 0) {
    throw new Error("Missing editable text using the global font-display class.");
  }

  return {
    svg: renderedSvg,
    report: {
      policy: "Matisse EB -> verified Traditional glyph -> Source Han Serif Heavy fallback",
      matisseFont: { available: Boolean(font), path: fontPath },
      trackedTextElements,
      trackedSpans,
      substitutions: Array.from(substitutions, ([pair, count]) => ({ pair, count })),
      fallbackCharacters: Array.from(fallbacks, ([character, count]) => ({ character, count })),
    },
  };
}

function splitFontDisplayLayer(svg) {
  const displayTextElements = [];
  const baseSvg = svg.replace(/<text\b[^>]*>[\s\S]*?<\/text>/g, (textElement) => {
    if (!elementHasClass(textElement, "font-display")) return textElement;
    displayTextElements.push(textElement);
    return "";
  });

  if (displayTextElements.length === 0) {
    throw new Error("Missing font-display text for EVA title effects.");
  }

  const globalStyle = svg.match(/<style\b[^>]*>[\s\S]*?<\/style>/)?.[0] ?? "";
  const copyGroupOpenTag = svg.match(/<g\b(?=[^>]*\bid="poster-copy")[^>]*>/)?.[0] ?? "<g>";
  const textSvg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${layoutViewBox.width} ${layoutViewBox.height}" fill="none">`,
    globalStyle ? `<defs>${globalStyle}</defs>` : "",
    copyGroupOpenTag,
    ...displayTextElements,
    "</g>",
    "</svg>",
  ].join("\n");

  return { baseSvg, textSvg };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function renderEvaTitleTextLayer(textSvg) {
  const textLayer = await sharp(Buffer.from(textSvg), { density: exportDpi })
    .resize(exportPixels.width, exportPixels.height, { fit: "fill" })
    .png()
    .toBuffer();

  const reducedPixels = {
    width: Math.round(exportPixels.width / evaTitleEffects.blurScale),
    height: Math.round(exportPixels.height / evaTitleEffects.blurScale),
  };
  const softenedText = await sharp(textLayer)
    .resize(reducedPixels.width, reducedPixels.height, { fit: "fill", kernel: "linear" })
    .resize(exportPixels.width, exportPixels.height, { fit: "fill", kernel: "linear" })
    .blur(evaTitleEffects.blurSigma)
    .png()
    .toBuffer();

  const { data, info } = await sharp(softenedText)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const random = seededRandom(evaTitleEffects.noiseSeed);
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index + 3] === 0) continue;
    const luminance = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const randomNoise = Math.round((random() * 2 - 1) * evaTitleEffects.noiseAmplitude);
    const adjustment = Math.floor(randomNoise * (luminance / 255 - 0.5));
    data[index] = Math.max(0, Math.min(255, data[index] + adjustment));
    data[index + 1] = Math.max(0, Math.min(255, data[index + 1] + adjustment));
    data[index + 2] = Math.max(0, Math.min(255, data[index + 2] + adjustment));
  }

  return sharp(data, { raw: info }).png().toBuffer();
}

const sourceHtml = fs.readFileSync(htmlPath, "utf8");
const editableSvg = normalizeSvgStructure(extractPosterSvg(sourceHtml));
if (
  !editableSvg.includes(`width="${canvas.width}" height="${canvas.height}"`)
  || !editableSvg.includes(`viewBox="0 0 ${layoutViewBox.width} ${layoutViewBox.height}"`)
) {
  throw new Error(
    `design.html must keep the fixed ${canvas.width} x ${canvas.height} A3 canvas and ${layoutViewBox.width} x ${layoutViewBox.height} layout viewBox.`,
  );
}
for (const id of requiredSemanticIds) {
  const idPattern = new RegExp(`\\bid="${id.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"`);
  if (!idPattern.test(editableSvg)) throw new Error(`Missing semantic layer: ${id}`);
}

let renderSourceSvg = editableSvg;
const synchronizedAssets = [];
for (const asset of assets) {
  const sourceBuffer = fs.readFileSync(asset.filePath);
  const sourceMetadata = await sharp(sourceBuffer).metadata();
  const embeddedBuffer = asset.convertToPng
    ? await sharp(sourceBuffer).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : sourceBuffer;
  renderSourceSvg = embedImageForRender(
    renderSourceSvg,
    asset,
    `data:image/png;base64,${embeddedBuffer.toString("base64")}`,
  );
  synchronizedAssets.push({
    id: asset.id,
    source: asset.source,
    sourceFormat: sourceMetadata.format,
    sourcePixels: [sourceMetadata.width, sourceMetadata.height],
    sourceSha256: sha256(sourceBuffer),
    embeddedBytes: embeddedBuffer.length,
    embeddedSha256: sha256(embeddedBuffer),
  });
}

// design.html keeps editable copy and external image paths. Base64 data and
// Traditional substitutions exist only in the in-memory SVG used for exports.
const typographyRender = renderMatisseTypography(renderSourceSvg);
const renderSvg = typographyRender.svg;
const typographyLayers = splitFontDisplayLayer(renderSvg);

fs.mkdirSync(path.dirname(pngPath), { recursive: true });
fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

const basePng = await sharp(Buffer.from(typographyLayers.baseSvg), { density: exportDpi })
  .resize(exportPixels.width, exportPixels.height, { fit: "fill" })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
const texturedTextLayer = await renderEvaTitleTextLayer(typographyLayers.textSvg);
const png = await sharp(basePng)
  .composite([{ input: texturedTextLayer, left: 0, top: 0 }])
  .withMetadata({ density: exportDpi })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
fs.writeFileSync(pngPath, png);

const pdf = await PDFDocument.create();
const page = pdf.addPage([pagePoints.width, pagePoints.height]);
const embeddedPng = await pdf.embedPng(png);
page.drawImage(embeddedPng, {
  x: 0,
  y: 0,
  width: pagePoints.width,
  height: pagePoints.height,
});
const pdfBytes = await pdf.save();
fs.writeFileSync(pdfPath, pdfBytes);

// Keep the essential integrity checks beside the processing that can break them.
const outputPngMetadata = await sharp(png).metadata();
const outputPdf = await PDFDocument.load(pdfBytes);
const outputPdfSize = outputPdf.getPage(0).getSize();
if (outputPngMetadata.width !== exportPixels.width || outputPngMetadata.height !== exportPixels.height) {
  throw new Error(`Unexpected PNG dimensions: ${outputPngMetadata.width} x ${outputPngMetadata.height}`);
}
if (
  outputPdf.getPageCount() !== 1 ||
  Math.abs(outputPdfSize.width - pagePoints.width) > 0.01 ||
  Math.abs(outputPdfSize.height - pagePoints.height) > 0.01
) {
  throw new Error("Unexpected PDF page count or A3 page dimensions.");
}

console.log(JSON.stringify({
  processedAt: new Date().toISOString(),
  html: {
    path: htmlPath,
    authoritative: true,
    fixedCanvas: [canvas.width, canvas.height],
    layoutViewBox: [layoutViewBox.width, layoutViewBox.height],
    externalAssets: true,
    sourceBytes: Buffer.byteLength(sourceHtml),
    sourceSha256: sha256(Buffer.from(sourceHtml)),
    editableSvgSha256: sha256(Buffer.from(editableSvg)),
  },
  render: {
    format: "in-memory SVG",
    synchronizedAssets,
    typography: typographyRender.report,
    typographyEffects: {
      scope: ".font-display",
      blur: {
        downsampleScale: evaTitleEffects.blurScale,
        sigma: evaTitleEffects.blurSigma,
      },
      noise: {
        amplitude: evaTitleEffects.noiseAmplitude,
        seed: evaTitleEffects.noiseSeed,
        luminanceWeighted: true,
      },
    },
    embeddedSourceSha256: sha256(Buffer.from(renderSourceSvg)),
    exportRenderSha256: sha256(Buffer.from(renderSvg)),
  },
  exports: {
    png: {
      path: pngPath,
      pixels: [exportPixels.width, exportPixels.height],
      density: exportDpi,
      sha256: sha256(png),
    },
    pdf: {
      path: pdfPath,
      pages: outputPdf.getPageCount(),
      pagePoints: [outputPdfSize.width, outputPdfSize.height],
      pageMillimeters: [297, 420],
      sha256: sha256(pdfBytes),
    },
  },
}, null, 2));
