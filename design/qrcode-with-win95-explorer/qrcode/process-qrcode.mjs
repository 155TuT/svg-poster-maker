import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  EncodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  QRCodeWriter,
  RGBLuminanceSource,
} = require("@zxing/library");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const rawQrPath = path.join(scriptDir, "raw-qrcode.jpg");
export const outputQrPath = path.join(scriptDir, "qrcode-design-black.png");

const outputModuleSize = 22;
const quietZonePixels = 5;

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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

async function detectColoredQrBounds(filePath) {
  const { data, info } = await sharp(filePath)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const search = {
    left: Math.floor(info.width * 0.1),
    right: Math.ceil(info.width * 0.85),
    top: Math.floor(info.height * 0.32),
    bottom: Math.ceil(info.height * 0.74),
  };
  const bounds = {
    minX: info.width,
    minY: info.height,
    maxX: -1,
    maxY: -1,
  };
  const columnCounts = new Uint32Array(info.width);
  const rowCounts = new Uint32Array(info.height);

  for (let y = search.top; y < search.bottom; y += 1) {
    for (let x = search.left; x < search.right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const maximum = Math.max(r, g, b);
      const minimum = Math.min(r, g, b);
      const isQrColor = maximum > 135 && maximum - minimum > 28 && b > r + 8;
      if (!isQrColor) continue;
      columnCounts[x] += 1;
      rowCounts[y] += 1;
    }
  }

  const minimumColoredPixels = 30;
  for (let x = search.left; x < search.right; x += 1) {
    if (columnCounts[x] < minimumColoredPixels) continue;
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
  }
  for (let y = search.top; y < search.bottom; y += 1) {
    if (rowCounts[y] < minimumColoredPixels) continue;
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
  }

  if (bounds.maxX < 0) throw new Error("Could not locate the colored QR code in the source image.");

  const detectedWidth = bounds.maxX - bounds.minX + 1;
  const detectedHeight = bounds.maxY - bounds.minY + 1;
  const side = Math.max(detectedWidth, detectedHeight);
  if (Math.abs(detectedWidth - detectedHeight) > side * 0.12) {
    throw new Error(`Detected QR bounds are not close to square: ${detectedWidth} x ${detectedHeight}`);
  }

  const padding = Math.round(side * 0.08);
  const cropSide = Math.min(side + padding * 2, info.width, info.height);
  const centerX = (bounds.minX + bounds.maxX + 1) / 2;
  const centerY = (bounds.minY + bounds.maxY + 1) / 2;
  const left = Math.max(0, Math.min(info.width - cropSide, Math.round(centerX - cropSide / 2)));
  const top = Math.max(0, Math.min(info.height - cropSide, Math.round(centerY - cropSide / 2)));

  return {
    left,
    top,
    width: cropSide,
    height: cropSide,
    detectedBounds: {
      x: bounds.minX,
      y: bounds.minY,
      width: detectedWidth,
      height: detectedHeight,
    },
  };
}

async function decodeImage(filePath, crop) {
  let pipeline = sharp(filePath).flatten({ background: "#ffffff" });
  if (crop) {
    pipeline = pipeline.extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height,
    });
  }
  const { data, info } = await pipeline
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return decodeLuminance(data, info.width, info.height);
}

async function decodeSource(filePath, crop) {
  const attempts = [
    { name: "extracted", crop },
    { name: "full-source", crop: undefined },
  ];
  let lastError;

  for (const attempt of attempts) {
    try {
      return {
        text: await decodeImage(filePath, attempt.crop),
        decodedFrom: attempt.name,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Could not decode the source QR code: ${lastError?.message ?? lastError}`);
}

async function writeSquareQrCode(text, filePath) {
  const writer = new QRCodeWriter();
  const hints = new Map([[EncodeHintType.MARGIN, 0]]);
  const matrix = writer.encode(text, BarcodeFormat.QR_CODE, 0, 0, hints);
  const matrixWidth = matrix.getWidth();
  const matrixHeight = matrix.getHeight();
  const width = matrixWidth * outputModuleSize + quietZonePixels * 2;
  const height = matrixHeight * outputModuleSize + quietZonePixels * 2;
  const pixels = Buffer.alloc(width * height * 4);

  for (let moduleY = 0; moduleY < matrixHeight; moduleY += 1) {
    for (let moduleX = 0; moduleX < matrixWidth; moduleX += 1) {
      if (!matrix.get(moduleX, moduleY)) continue;
      const startX = quietZonePixels + moduleX * outputModuleSize;
      const startY = quietZonePixels + moduleY * outputModuleSize;
      for (let y = startY; y < startY + outputModuleSize; y += 1) {
        for (let x = startX; x < startX + outputModuleSize; x += 1) {
          const offset = (y * width + x) * 4;
          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
          pixels[offset + 3] = 255;
        }
      }
    }
  }

  await sharp(pixels, {
    raw: { width, height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(filePath);

  return {
    matrixModules: { width: matrixWidth, height: matrixHeight },
    moduleSize: outputModuleSize,
    quietZonePixels,
    outputPixels: { width, height },
  };
}

async function inspectTransparentBlackQr(filePath) {
  const metadata = await sharp(filePath).metadata();
  const { data, info } = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let opaqueBlackPixels = 0;
  let partialAlphaPixels = 0;
  let nonBlackVisiblePixels = 0;
  const visibleBounds = {
    minX: info.width,
    minY: info.height,
    maxX: -1,
    maxY: -1,
  };

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const alpha = data[offset + 3];
    if (alpha === 0) transparentPixels += 1;
    else if (alpha === 255 && r === 0 && g === 0 && b === 0) {
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
      if (r !== 0 || g !== 0 || b !== 0) nonBlackVisiblePixels += 1;
    }
  }

  const valid = metadata.hasAlpha === true
    && transparentPixels > 0
    && opaqueBlackPixels > 0
    && partialAlphaPixels === 0
    && nonBlackVisiblePixels === 0
    && visibleBounds.minX === quietZonePixels
    && visibleBounds.minY === quietZonePixels
    && visibleBounds.maxX === info.width - quietZonePixels - 1
    && visibleBounds.maxY === info.height - quietZonePixels - 1;
  if (!valid) {
    throw new Error("Generated QR must contain only opaque black modules with an exact 5 px transparent quiet zone.");
  }

  return {
    valid,
    hasAlpha: metadata.hasAlpha,
    transparentPixels,
    opaqueBlackPixels,
    partialAlphaPixels,
    nonBlackVisiblePixels,
    quietZonePixels,
    visibleBounds,
  };
}

export async function processQrCode() {
  if (!fs.existsSync(rawQrPath)) throw new Error(`Missing source QR image: ${rawQrPath}`);

  const sourceMetadata = await sharp(rawQrPath).metadata();
  const extraction = await detectColoredQrBounds(rawQrPath);
  const source = await decodeSource(rawQrPath, extraction);
  const generated = await writeSquareQrCode(source.text, outputQrPath);
  const transparency = await inspectTransparentBlackQr(outputQrPath);
  const outputText = await decodeImage(outputQrPath);
  const decodedTextMatches = source.text === outputText;
  if (!decodedTextMatches) throw new Error("Source and generated QR codes decoded to different values.");

  return {
    valid: transparency.valid && decodedTextMatches,
    sourcePath: rawQrPath,
    outputPath: outputQrPath,
    sourceEncoding: sourceMetadata.format,
    sourcePixels: { width: sourceMetadata.width, height: sourceMetadata.height },
    extraction,
    decodedFrom: source.decodedFrom,
    decodedText: source.text,
    generated,
    transparency,
    decodedTextMatches,
    sourceSha256: sha256(rawQrPath),
    outputSha256: sha256(outputQrPath),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await processQrCode(), null, 2));
}
