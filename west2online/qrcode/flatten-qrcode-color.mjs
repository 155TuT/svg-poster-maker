import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const qrPath = path.join(scriptDir, "qrcode-west2-styled.png");
const backupPath = path.join(scriptDir, "qrcode-west2-styled-gradient-original.png");
const tempPath = path.join(scriptDir, "qrcode-west2-styled-flat.tmp.png");
const target = [0x5a, 0x2f, 0x14];

if (!fs.existsSync(backupPath)) fs.copyFileSync(qrPath, backupPath);
const sourcePath = backupPath;
const { data: source, info } = await sharp(sourcePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixelCount = info.width * info.height;
const output = Buffer.from(source);
const colorCountsByDiagonal = Array.from(
  { length: info.width + info.height - 1 },
  () => new Map(),
);

function isCenterLogoOrange(r, g, b) {
  return r >= 180 && g >= 75 && g <= 190 && b <= 80;
}

// Recover the original diagonal gradient's opaque base color at each x+y position.
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * 4;
    const [r, g, b, a] = source.subarray(offset, offset + 4);
    if (
      a === 255 &&
      r > g + 5 &&
      g >= b + 2 &&
      r - b >= 14 &&
      r < 225 &&
      !isCenterLogoOrange(r, g, b)
    ) {
      const key = (r << 16) | (g << 8) | b;
      const counts = colorCountsByDiagonal[x + y];
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
}

const baseColors = colorCountsByDiagonal.map((counts) => {
  let selected = null;
  let selectedCount = -1;
  for (const [key, count] of counts) {
    if (count > selectedCount) {
      selected = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
      selectedCount = count;
    }
  }
  return selected;
});

const known = baseColors
  .map((color, diagonal) => ({ color, diagonal }))
  .filter(({ color }) => color !== null);
for (let diagonal = 0; diagonal < baseColors.length; diagonal += 1) {
  if (baseColors[diagonal]) continue;
  let nearest = known[0];
  for (const candidate of known) {
    if (Math.abs(candidate.diagonal - diagonal) < Math.abs(nearest.diagonal - diagonal)) {
      nearest = candidate;
    }
  }
  baseColors[diagonal] = nearest.color;
}

let changedPixels = 0;
let alphaDifferences = 0;
let unchangedPixelDifferences = 0;
for (let y = 0; y < info.height; y += 1) {
  for (let x = 0; x < info.width; x += 1) {
    const offset = (y * info.width + x) * 4;
    const [r, g, b, a] = source.subarray(offset, offset + 4);
    const base = baseColors[x + y];
    if (
      a > 0 &&
      r > g &&
      g >= b &&
      r - b >= 2 &&
      !isCenterLogoOrange(r, g, b)
    ) {
      const coverages = [
        (255 - r) / Math.max(1, 255 - base[0]),
        (255 - g) / Math.max(1, 255 - base[1]),
        (255 - b) / Math.max(1, 255 - base[2]),
      ].sort((left, right) => left - right);
      const coverage = Math.max(0, Math.min(1, coverages[1]));
      const predicted = base.map((channel) => Math.round(coverage * channel + (1 - coverage) * 255));
      const residual = Math.max(
        Math.abs(predicted[0] - r),
        Math.abs(predicted[1] - g),
        Math.abs(predicted[2] - b),
      );
      if (coverage >= 0.015 && residual <= 18) {
        output[offset] = Math.round(coverage * target[0] + (1 - coverage) * 255);
        output[offset + 1] = Math.round(coverage * target[1] + (1 - coverage) * 255);
        output[offset + 2] = Math.round(coverage * target[2] + (1 - coverage) * 255);
        changedPixels += 1;
      }
    }
    if (output[offset + 3] !== a) alphaDifferences += 1;
    if (
      output[offset] === r &&
      output[offset + 1] === g &&
      output[offset + 2] === b &&
      output[offset + 3] !== a
    ) {
      unchangedPixelDifferences += 1;
    }
  }
}

if (alphaDifferences !== 0 || unchangedPixelDifferences !== 0) {
  throw new Error("Unexpected change outside the intended RGB channels.");
}

await sharp(output, {
  raw: { width: info.width, height: info.height, channels: 4 },
}).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(tempPath);
fs.copyFileSync(tempPath, qrPath);
fs.unlinkSync(tempPath);

console.log(JSON.stringify({
  sourcePath,
  outputPath: qrPath,
  target: "#A94D00",
  size: [info.width, info.height],
  pixelCount,
  changedPixels,
  alphaDifferences,
}, null, 2));
