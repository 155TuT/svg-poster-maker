import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const sourceSvgPath = path.join(scriptDir, "win95-notebook.svg");
const outputDir = path.join(scriptDir, "output");
const outputPngPath = path.join(outputDir, "maintext-with-win95-notebook.png");
const packageLockPath = path.join(scriptDir, "package-lock.json");
const localSharpPath = path.join(scriptDir, "node_modules", "sharp", "package.json");

const canvas = { width: 420, height: 452 };
const outputPixels = { width: 840, height: 904 };
const editorTextArea = { left: 19, top: 88, right: 378, bottom: 406 };
const requiredIds = [
  "win95-notebook-window",
  "notebook-title-bar",
  "notebook-app-icon",
  "window-controls",
  "minimize-button",
  "maximize-button",
  "close-button",
  "notebook-menu-bar",
  "notebook-editor-frame",
  "notebook-editor",
  "notebook-maintext",
  "text-caret",
  "vertical-scrollbar",
  "vertical-scroll-thumb",
  "horizontal-scrollbar",
  "horizontal-scroll-thumb",
  "scrollbar-corner",
];
const requiredPalette = ["#000080", "#C0C0C0", "#FFFFFF", "#808080", "#000000"];

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

if (!fs.existsSync(sourceSvgPath)) throw new Error(`Missing editable SVG: ${sourceSvgPath}`);
if (!fs.existsSync(packageLockPath) || !fs.existsSync(localSharpPath)) {
  throw new Error("Missing local dependency installation. Run npm install in this project directory.");
}
const sourceSvg = fs.readFileSync(sourceSvgPath, "utf8");

if (!sourceSvg.includes(`viewBox="0 0 ${canvas.width} ${canvas.height}"`)) {
  throw new Error(`win95-notebook.svg must keep the ${canvas.width} x ${canvas.height} viewBox.`);
}
if (!sourceSvg.includes(`width="${outputPixels.width}" height="${outputPixels.height}"`)) {
  throw new Error(`win95-notebook.svg must declare ${outputPixels.width} x ${outputPixels.height} display dimensions.`);
}

const scale = {
  x: outputPixels.width / canvas.width,
  y: outputPixels.height / canvas.height,
};
if (Math.abs(scale.x - scale.y) > 1e-12) {
  throw new Error(`Non-uniform SVG scaling would distort controls: x=${scale.x}, y=${scale.y}.`);
}

for (const id of requiredIds) {
  if (!new RegExp(`\\bid="${id}"`).test(sourceSvg)) throw new Error(`Missing semantic layer: ${id}`);
}
for (const color of requiredPalette) {
  if (!sourceSvg.includes(color)) throw new Error(`Missing Windows 95 palette color: ${color}`);
}
if (/<image\b/.test(sourceSvg)) {
  throw new Error("The Notepad interface must remain editable vector artwork without raster images.");
}
if (/\shref="(?!#)/.test(sourceSvg)) {
  throw new Error("The Notepad interface contains an unexpected external reference.");
}
const maintextStart = sourceSvg.indexOf('<g id="notebook-maintext"');
const maintextEnd = sourceSvg.indexOf("</g>", maintextStart);
const maintextSvg = maintextStart >= 0 && maintextEnd > maintextStart
  ? sourceSvg.slice(maintextStart, maintextEnd + 4)
  : "";
if (!/<text\b[\s\S]*?>[\s\S]*?\S[\s\S]*?<\/text>/.test(maintextSvg)) {
  throw new Error("The editable notebook-maintext layer must contain non-empty text.");
}

const styleBlock = sourceSvg.match(/<style\b[^>]*>[\s\S]*?<\/style>/)?.[0];
if (!styleBlock) throw new Error("Missing editable SVG styles.");
const textOnlySvg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${outputPixels.width}" height="${outputPixels.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`,
  `<defs>${styleBlock}</defs>`,
  maintextSvg,
  "</svg>",
].join("");
const { info: trimmedTextInfo } = await sharp(Buffer.from(textOnlySvg))
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer({ resolveWithObject: true });
const textBounds = {
  left: -trimmedTextInfo.trimOffsetLeft / scale.x,
  top: -trimmedTextInfo.trimOffsetTop / scale.y,
  right: (-trimmedTextInfo.trimOffsetLeft + trimmedTextInfo.width) / scale.x,
  bottom: (-trimmedTextInfo.trimOffsetTop + trimmedTextInfo.height) / scale.y,
};
const textPadding = {
  left: textBounds.left - editorTextArea.left,
  top: textBounds.top - editorTextArea.top,
  right: editorTextArea.right - textBounds.right,
  bottom: editorTextArea.bottom - textBounds.bottom,
};
for (const [edge, padding] of Object.entries(textPadding)) {
  if (padding < 12 || padding > 22) {
    throw new Error(`Text ${edge} padding must remain tightly fitted between 12 and 22 units; received ${padding}.`);
  }
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
    controlDistortion: false,
    semanticLayers: requiredIds.length,
    localDependencies: true,
    packageLock: packageLockPath,
    textBounds,
    textPadding,
    sha256: sha256(Buffer.from(sourceSvg)),
  },
  export: {
    png: outputPngPath,
    pixels: [metadata.width, metadata.height],
    density: metadata.density,
    sha256: sha256(png),
  },
}, null, 2));
