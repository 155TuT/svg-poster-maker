import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} = require("@zxing/library");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceSvgPath = path.join(scriptDir, "win95-explorer-qrcode.svg");
const qrPath = path.join(scriptDir, "qrcode", "qrcode-design-black.png");
const outputDir = path.join(scriptDir, "output");
const outputPngPath = path.join(outputDir, "qrcode-with-win95-explorer.png");
const embeddedAssets = [
  {
    id: "browser-icon-source",
    source: "icon/west2-online-avatar.png",
    filePath: path.join(scriptDir, "icon", "west2-online-avatar.png"),
  },
  {
    id: "address-icon-source",
    source: "icon/qq-2006-avatar.png",
    filePath: path.join(scriptDir, "icon", "qq-2006-avatar.png"),
  },
  {
    id: "qrcode-artwork",
    source: "qrcode/qrcode-design-black.png",
    filePath: qrPath,
  },
];

const canvas = { width: 648, height: 695 };
const qrPlacement = { x: 35, y: 109, width: 560, height: 560 };
const qrQuietZonePixels = 5;
const exportScale = 2;
const requiredIds = [
  "windows-95-browser-window",
  "title-bar",
  "browser-icon-source",
  "browser-icon",
  "menu-bar",
  "address-bar",
  "address-icon-source",
  "address-icon",
  "browser-page-frame",
  "browser-page",
  "qrcode-artwork",
  "vertical-scrollbar",
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function synchronizeImage(svg, asset, dataUri) {
  const imagePattern = new RegExp(`<image\\b(?=[^>]*\\bid="${asset.id}")[^>]*\\/>`, "s");
  const match = svg.match(imagePattern);
  if (!match) throw new Error(`Missing image element: ${asset.id}.`);

  const source = match[0].match(/\sdata-source="([^"]+)"/)?.[1];
  if (source !== asset.source) {
    throw new Error(`${asset.id} data-source must be ${asset.source}; received ${source}`);
  }
  if (!/\shref="[^"]+"/.test(match[0])) throw new Error(`${asset.id} is missing href.`);

  const synchronizedImage = match[0].replace(/\shref="[^"]+"/, ` href="${dataUri}"`);
  return svg.replace(match[0], synchronizedImage);
}

async function inspectQr(filePath) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== metadata.height) {
    throw new Error(`QR artwork must remain square; received ${metadata.width} x ${metadata.height}.`);
  }
  if (metadata.width !== qrPlacement.width) {
    throw new Error(`QR artwork must remain ${qrPlacement.width} px; received ${metadata.width} px.`);
  }

  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let opaqueBlackPixels = 0;
  let invalidVisiblePixels = 0;
  let partialAlphaPixels = 0;
  const visibleBounds = {
    minX: info.width,
    minY: info.height,
    maxX: -1,
    maxY: -1,
  };
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha === 0) transparentPixels += 1;
    else if (alpha === 255 && red === 0 && green === 0 && blue === 0) {
      opaqueBlackPixels += 1;
      const pixelIndex = offset / info.channels;
      const x = pixelIndex % info.width;
      const y = Math.floor(pixelIndex / info.width);
      visibleBounds.minX = Math.min(visibleBounds.minX, x);
      visibleBounds.minY = Math.min(visibleBounds.minY, y);
      visibleBounds.maxX = Math.max(visibleBounds.maxX, x);
      visibleBounds.maxY = Math.max(visibleBounds.maxY, y);
    }
    else {
      if (alpha !== 255) partialAlphaPixels += 1;
      if (red !== 0 || green !== 0 || blue !== 0) invalidVisiblePixels += 1;
    }
  }
  const valid = metadata.hasAlpha === true
    && transparentPixels > 0
    && opaqueBlackPixels > 0
    && partialAlphaPixels === 0
    && invalidVisiblePixels === 0
    && visibleBounds.minX === qrQuietZonePixels
    && visibleBounds.minY === qrQuietZonePixels
    && visibleBounds.maxX === info.width - qrQuietZonePixels - 1
    && visibleBounds.maxY === info.height - qrQuietZonePixels - 1;
  if (!valid) throw new Error("QR artwork must contain opaque black modules with an exact 5 px transparent quiet zone.");

  return {
    valid,
    pixels: [metadata.width, metadata.height],
    hasAlpha: metadata.hasAlpha,
    transparentPixels,
    opaqueBlackPixels,
    partialAlphaPixels,
    invalidVisiblePixels,
    quietZonePixels: qrQuietZonePixels,
    visibleBounds,
  };
}

function decodeLuminance(luminance, width, height) {
  const source = new RGBLuminanceSource(new Uint8ClampedArray(luminance), width, height);
  const hints = new Map([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  const attempts = [
    new HybridBinarizer(source),
    new GlobalHistogramBinarizer(source),
    new HybridBinarizer(source.invert()),
    new GlobalHistogramBinarizer(source.invert()),
  ];
  let lastError;
  for (const binarizer of attempts) {
    try {
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      return reader.decodeWithState(new BinaryBitmap(binarizer)).getText();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function decodeQr(input, crop) {
  let pipeline = sharp(input).flatten({ background: "#ffffff" });
  if (crop) pipeline = pipeline.extract(crop);
  const { data, info } = await pipeline.greyscale().normalise().raw().toBuffer({ resolveWithObject: true });
  return decodeLuminance(data, info.width, info.height);
}

if (!fs.existsSync(sourceSvgPath)) throw new Error(`Missing source SVG: ${sourceSvgPath}`);
for (const asset of embeddedAssets) {
  if (!fs.existsSync(asset.filePath)) throw new Error(`Missing source image: ${asset.filePath}`);
}

const sourceSvg = fs.readFileSync(sourceSvgPath, "utf8");
if (!sourceSvg.includes(`viewBox="0 0 ${canvas.width} ${canvas.height}"`)) {
  throw new Error(`Source SVG must keep the ${canvas.width} x ${canvas.height} viewBox.`);
}
for (const id of requiredIds) {
  if (!new RegExp(`\\bid="${id}"`).test(sourceSvg)) throw new Error(`Missing semantic layer: ${id}`);
}
const defsEndIndex = sourceSvg.indexOf("</defs>");
for (const id of ["browser-icon-source", "address-icon-source"]) {
  const sourceIndex = sourceSvg.indexOf(`id="${id}"`);
  if (defsEndIndex === -1 || sourceIndex === -1 || sourceIndex > defsEndIndex) {
    throw new Error(`${id} must be defined inside the leading defs block.`);
  }
}

const qrBuffer = fs.readFileSync(qrPath);
const qrIntegrity = await inspectQr(qrPath);
let embeddedSvg = sourceSvg;
const synchronizedAssets = [];
for (const asset of embeddedAssets) {
  const buffer = fs.readFileSync(asset.filePath);
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== "png") throw new Error(`${asset.source} must remain a PNG file.`);
  embeddedSvg = synchronizeImage(embeddedSvg, asset, `data:image/png;base64,${buffer.toString("base64")}`);
  synchronizedAssets.push({
    id: asset.id,
    source: asset.source,
    pixels: [metadata.width, metadata.height],
    hasAlpha: metadata.hasAlpha,
    sha256: sha256(buffer),
  });
}
if ((embeddedSvg.match(/data:image\/png;base64,/g) ?? []).length < embeddedAssets.length) {
  throw new Error("Editable SVG is missing one or more embedded PNG images.");
}
if (/href="(?:icon|qrcode)\//.test(embeddedSvg)) {
  throw new Error("Editable SVG still references an external source image.");
}

fs.mkdirSync(outputDir, { recursive: true });
if (embeddedSvg !== sourceSvg) fs.writeFileSync(sourceSvgPath, embeddedSvg);

const outputPixels = {
  width: canvas.width * exportScale,
  height: canvas.height * exportScale,
};
const outputPng = await sharp(Buffer.from(embeddedSvg))
  .resize(outputPixels.width, outputPixels.height, { fit: "fill", kernel: "nearest" })
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toBuffer();
fs.writeFileSync(outputPngPath, outputPng);

const outputMetadata = await sharp(outputPng).metadata();
if (outputMetadata.width !== outputPixels.width || outputMetadata.height !== outputPixels.height) {
  throw new Error(`Unexpected PNG dimensions: ${outputMetadata.width} x ${outputMetadata.height}.`);
}

const sourceQrText = await decodeQr(qrBuffer);
const renderedQrText = await decodeQr(outputPng, {
  left: qrPlacement.x * exportScale,
  top: qrPlacement.y * exportScale,
  width: qrPlacement.width * exportScale,
  height: qrPlacement.height * exportScale,
});
if (sourceQrText !== renderedQrText) {
  throw new Error("Rendered browser frame changed the QR code payload.");
}

console.log(JSON.stringify({
  processedAt: new Date().toISOString(),
  source: {
    svg: sourceSvgPath,
    svgSelfContained: true,
    svgSha256: sha256(Buffer.from(embeddedSvg)),
    synchronizedAssets,
    qr: qrPath,
    qrSha256: sha256(qrBuffer),
    qrIntegrity,
  },
  layout: {
    viewBox: [canvas.width, canvas.height],
    browserPageRatio: "near-square",
    qrPlacement,
  },
  exports: {
    png: {
      path: outputPngPath,
      pixels: [outputMetadata.width, outputMetadata.height],
      sha256: sha256(outputPng),
    },
  },
  qrVerification: {
    valid: true,
    decodedText: renderedQrText,
    sourceMatchesRendered: sourceQrText === renderedQrText,
  },
}, null, 2));
