import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const rawQrPath = path.join(scriptDir, "raw_qrcode.jpg");
export const styledQrPath = path.join(scriptDir, "qrcode-java-styled.png");

// This is the dominant blue sampled from the poster frame and type.
const posterBlue = [9, 84, 187];
const foregroundSearch = {
  leftRatio: 0.08,
  rightRatio: 0.92,
  topRatio: 0.32,
  bottomRatio: 0.78,
};

function isColoredQrPixel(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  return maximum > 100 && b > r + 10 && b > g + 4 && maximum - minimum > 20;
}

function clamp(value, minimum = 0, maximum = 1) {
  return Math.max(minimum, Math.min(maximum, value));
}

export async function processQrCode() {
  const sourceMetadata = await sharp(rawQrPath).metadata();
  const { data: source, info } = await sharp(rawQrPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const searchLeft = Math.floor(info.width * foregroundSearch.leftRatio);
  const searchRight = Math.ceil(info.width * foregroundSearch.rightRatio);
  const searchTop = Math.floor(info.height * foregroundSearch.topRatio);
  const searchBottom = Math.ceil(info.height * foregroundSearch.bottomRatio);
  const bounds = {
    minX: info.width,
    minY: info.height,
    maxX: -1,
    maxY: -1,
  };

  for (let y = searchTop; y < searchBottom; y += 1) {
    for (let x = searchLeft; x < searchRight; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const r = source[offset];
      const g = source[offset + 1];
      const b = source[offset + 2];
      if (!isColoredQrPixel(r, g, b)) continue;
      bounds.minX = Math.min(bounds.minX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }

  if (bounds.maxX === -1) throw new Error("Could not locate the colored QR matrix.");
  const matrixWidth = bounds.maxX - bounds.minX + 1;
  const matrixHeight = bounds.maxY - bounds.minY + 1;
  if (Math.abs(matrixWidth - matrixHeight) > 4) {
    throw new Error(`Detected QR matrix is not square: ${matrixWidth} x ${matrixHeight}`);
  }

  // The source card leaves roughly 96 px around its 852 px matrix. Preserve it
  // as a transparent quiet zone so the QR remains reliable on the white poster.
  const quietZone = Math.round(Math.max(matrixWidth, matrixHeight) * 0.113);
  const cropSize = Math.max(matrixWidth, matrixHeight) + quietZone * 2;
  const crop = {
    left: Math.round((bounds.minX + bounds.maxX + 1 - cropSize) / 2),
    top: Math.round((bounds.minY + bounds.maxY + 1 - cropSize) / 2),
    width: cropSize,
    height: cropSize,
  };
  if (
    crop.left < 0 ||
    crop.top < 0 ||
    crop.left + crop.width > info.width ||
    crop.top + crop.height > info.height
  ) {
    throw new Error(`QR crop falls outside the source: ${JSON.stringify(crop)}`);
  }

  // Estimate the dark card color from the four crop corners. It is only used to
  // preserve antialiasing coverage; the dark card itself becomes transparent.
  const cornerSamples = [
    [crop.left, crop.top],
    [crop.left + crop.width - 1, crop.top],
    [crop.left, crop.top + crop.height - 1],
    [crop.left + crop.width - 1, crop.top + crop.height - 1],
  ];
  const cardColor = [0, 1, 2].map((channel) => Math.round(
    cornerSamples.reduce((sum, [x, y]) => (
      sum + source[(y * info.width + x) * info.channels + channel]
    ), 0) / cornerSamples.length,
  ));

  const output = Buffer.alloc(crop.width * crop.height * 4);
  const matrixCenterX = (bounds.minX + bounds.maxX) / 2;
  const matrixCenterY = (bounds.minY + bounds.maxY) / 2;
  const logoHalfSize = Math.max(matrixWidth, matrixHeight) * 0.135;
  let bluePixels = 0;
  let whiteLogoPixels = 0;

  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const sourceX = crop.left + x;
      const sourceY = crop.top + y;
      const sourceOffset = (sourceY * info.width + sourceX) * info.channels;
      const outputOffset = (y * crop.width + x) * 4;
      const r = source[sourceOffset];
      const g = source[sourceOffset + 1];
      const b = source[sourceOffset + 2];
      const sourceAlpha = source[sourceOffset + 3] / 255;
      const saturation = Math.max(r, g, b) - Math.min(r, g, b);
      const blueLift = b - cardColor[2];

      if (isColoredQrPixel(r, g, b) || (b > r + 6 && b > g + 2 && blueLift > 8)) {
        const coverage = clamp(Math.max((saturation - 4) / 36, (blueLift - 5) / 80));
        output[outputOffset] = posterBlue[0];
        output[outputOffset + 1] = posterBlue[1];
        output[outputOffset + 2] = posterBlue[2];
        output[outputOffset + 3] = Math.round(255 * coverage * sourceAlpha);
        if (output[outputOffset + 3] > 0) bluePixels += 1;
        continue;
      }

      const insideCenterLogo =
        Math.abs(sourceX - matrixCenterX) <= logoHalfSize &&
        Math.abs(sourceY - matrixCenterY) <= logoHalfSize;
      const luminance = (r + 2 * g + b) / 4;
      const cardLuminance = (cardColor[0] + 2 * cardColor[1] + cardColor[2]) / 4;
      if (insideCenterLogo && luminance < cardLuminance - 5) {
        const coverage = clamp((cardLuminance - luminance - 3) / 22);
        output[outputOffset] = 255;
        output[outputOffset + 1] = 255;
        output[outputOffset + 2] = 255;
        output[outputOffset + 3] = Math.round(255 * coverage * sourceAlpha);
        if (output[outputOffset + 3] > 0) whiteLogoPixels += 1;
      }
    }
  }

  await sharp(output, {
    raw: { width: crop.width, height: crop.height, channels: 4 },
  })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(styledQrPath);

  const result = {
    sourcePath: rawQrPath,
    outputPath: styledQrPath,
    sourceEncoding: sourceMetadata.format,
    detectedMatrix: {
      x: bounds.minX,
      y: bounds.minY,
      width: matrixWidth,
      height: matrixHeight,
    },
    crop,
    transparentQuietZone: quietZone,
    cardColor,
    replacementColor: `#${posterBlue.map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`,
    bluePixels,
    whiteLogoPixels,
    sha256: createHash("sha256").update(fs.readFileSync(styledQrPath)).digest("hex"),
  };
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await processQrCode(), null, 2));
}
