import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceSvgPath = path.join(scriptDir, "win95-paint.svg");
const outputDir = path.join(scriptDir, "output");
const outputPngPath = path.join(outputDir, "title-with-win95-paint.png");

const canvas = { width: 936.1363636363636, height: 630 };
const outputPixels = { width: 1373, height: 924 };
const requiredIds = [
  "win95-paint-window",
  "paint-title-bar",
  "paint-app-icon",
  "window-controls",
  "paint-menu-bar",
  "paint-workspace",
  "paint-toolbox",
  "free-select-tool",
  "text-tool",
  "paint-canvas-frame",
  "paint-canvas",
  "canvas-vertical-scrollbar",
  "canvas-vertical-thumb",
  "canvas-horizontal-scrollbar",
  "canvas-horizontal-thumb",
  "paint-color-palette",
  "active-colors",
  "palette-swatches",
];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

if (!fs.existsSync(sourceSvgPath)) throw new Error(`Missing editable SVG: ${sourceSvgPath}`);
const sourceSvg = fs.readFileSync(sourceSvgPath, "utf8");
if (!sourceSvg.includes(`viewBox="0 0 ${canvas.width} ${canvas.height}"`)) {
  throw new Error(`win95-paint.svg must keep the ${canvas.width} x ${canvas.height} viewBox.`);
}
if (!sourceSvg.includes(`width="${outputPixels.width}" height="${outputPixels.height}"`)) {
  throw new Error(`win95-paint.svg must declare ${outputPixels.width} x ${outputPixels.height} display dimensions.`);
}
const scale = {
  x: outputPixels.width / canvas.width,
  y: outputPixels.height / canvas.height,
};
if (Math.abs(scale.x - scale.y) > 1e-12) {
  throw new Error(`Non-uniform SVG scaling would distort icons: x=${scale.x}, y=${scale.y}.`);
}
for (const id of requiredIds) {
  if (!new RegExp(`\\bid="${id}"`).test(sourceSvg)) throw new Error(`Missing semantic layer: ${id}`);
}
if (/<image\b/.test(sourceSvg)) {
  throw new Error("The Paint interface must remain editable vector artwork without raster images.");
}
if (/\shref="(?!#)/.test(sourceSvg)) {
  throw new Error("The Paint interface contains an unexpected external reference.");
}

fs.mkdirSync(outputDir, { recursive: true });
const png = await sharp(Buffer.from(sourceSvg))
  .resize(outputPixels.width, outputPixels.height, { fit: "fill", kernel: "nearest" })
  .withMetadata({ density: 192 })
  .png({ compressionLevel: 9, adaptiveFiltering: false })
  .toBuffer();
fs.writeFileSync(outputPngPath, png);

const metadata = await sharp(png).metadata();
if (metadata.width !== outputPixels.width || metadata.height !== outputPixels.height) {
  throw new Error(`Unexpected PNG dimensions: ${metadata.width} x ${metadata.height}.`);
}

console.log(JSON.stringify({
  processedAt: new Date().toISOString(),
  source: {
    svg: sourceSvgPath,
    editable: true,
    selfContained: true,
    rasterImages: 0,
    viewBox: [canvas.width, canvas.height],
    uniformScale: scale.x,
    iconDistortion: false,
    sha256: sha256(Buffer.from(sourceSvg)),
  },
  export: {
    png: outputPngPath,
    pixels: [metadata.width, metadata.height],
    density: metadata.density,
    sha256: sha256(png),
  },
}, null, 2));
