import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const options = {
  svg: "Lain-ascii.svg",
  png: "output/png/Lain-ascii.png",
  pngScale: 2,
  density: 300,
};

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!["--svg", "--png", "--png-scale", "--density"].includes(argument)) {
    throw new Error(`Unknown option: ${argument}`);
  }
  const value = process.argv[++index];
  if (!value) throw new Error(`${argument} requires a value.`);
  if (argument === "--png-scale" || argument === "--density") {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error(`${argument} must be a positive number.`);
    options[argument === "--png-scale" ? "pngScale" : "density"] = number;
  } else {
    options[argument.slice(2)] = value;
  }
}

const resolveFromScript = (filePath) => (
  path.isAbsolute(filePath) ? filePath : path.join(scriptDir, filePath)
);
const svgPath = resolveFromScript(options.svg);
const pngPath = resolveFromScript(options.png);
if (!fs.existsSync(svgPath)) throw new Error(`Missing editable SVG: ${svgPath}`);

const svgBuffer = fs.readFileSync(svgPath);
const svgText = svgBuffer.toString("utf8");
if (!svgText.includes('id="ascii-art"') || !svgText.includes("<use")) {
  throw new Error("Editable SVG is missing the ASCII glyph layer.");
}
if (svgText.includes("<image")) throw new Error("Editable SVG unexpectedly contains a raster image.");

const sourceMetadata = await sharp(svgBuffer).metadata();
if (!sourceMetadata.width || !sourceMetadata.height) {
  throw new Error(`Could not read SVG dimensions: ${svgPath}`);
}
const outputWidth = Math.round(sourceMetadata.width * options.pngScale);
const outputHeight = Math.round(sourceMetadata.height * options.pngScale);

fs.mkdirSync(path.dirname(pngPath), { recursive: true });
const png = await sharp(svgBuffer)
  .resize(outputWidth, outputHeight, { fit: "fill" })
  .withMetadata({ density: options.density })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
fs.writeFileSync(pngPath, png);

const pngMetadata = await sharp(png).metadata();
if (pngMetadata.width !== outputWidth || pngMetadata.height !== outputHeight) {
  throw new Error(`Unexpected PNG dimensions: ${pngMetadata.width} x ${pngMetadata.height}.`);
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
console.log(JSON.stringify({
  source: {
    svg: svgPath,
    editable: true,
    units: [sourceMetadata.width, sourceMetadata.height],
    sha256: sha256(svgBuffer),
  },
  export: {
    png: pngPath,
    pixels: [pngMetadata.width, pngMetadata.height],
    density: options.density,
    sha256: sha256(png),
  },
}, null, 2));
