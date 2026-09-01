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
const styledQrPath = path.join(scriptDir, "qrcode-java-styled.png");
const posterPath = path.join(scriptDir, "output", "png", "java-recruitment.png");
const qrPlacement = { x: 82, y: 992, size: 376 };

async function toLuminance(filePath, extract) {
  let pipeline = sharp(filePath).flatten({ background: "#ffffff" });
  if (extract) pipeline = pipeline.extract(extract);
  const { data, info } = await pipeline.greyscale().raw().toBuffer({ resolveWithObject: true });
  return { luminance: new Uint8ClampedArray(data), width: info.width, height: info.height };
}

function decode({ luminance, width, height }) {
  const source = new RGBLuminanceSource(luminance, width, height);
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

if (!fs.existsSync(styledQrPath) || !fs.existsSync(posterPath)) {
  throw new Error("Missing generated assets. Run npm run render first.");
}

const posterMetadata = await sharp(posterPath).metadata();
const scaleX = posterMetadata.width / 1024;
const scaleY = posterMetadata.height / 1536;
const posterQrCrop = {
  left: Math.round(qrPlacement.x * scaleX),
  top: Math.round(qrPlacement.y * scaleY),
  width: Math.round(qrPlacement.size * scaleX),
  height: Math.round(qrPlacement.size * scaleY),
};
const styledText = decode(await toLuminance(styledQrPath));
const posterText = decode(await toLuminance(posterPath, posterQrCrop));
const valid = styledText === posterText;
if (!valid) throw new Error("Styled QR and exported poster decoded to different values.");

console.log(JSON.stringify({
  valid,
  decodedText: styledText,
  styledQrPath,
  posterPath,
  posterQrCrop,
}, null, 2));
