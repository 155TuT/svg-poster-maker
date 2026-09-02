import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const options = {
  svg: "Lain-ascii.svg",
  png: "output/png/Lain-ascii.png",
};
for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (!["--svg", "--png"].includes(argument)) {
    throw new Error(`Unknown option: ${argument}`);
  }
  const value = process.argv[++index];
  if (!value) throw new Error(`${argument} requires a value.`);
  options[argument.slice(2)] = value;
}
const resolveFromScript = (filePath) => (
  path.isAbsolute(filePath) ? filePath : path.join(scriptDir, filePath)
);
const svgPath = resolveFromScript(options.svg);
const pngPath = resolveFromScript(options.png);

const svg = fs.readFileSync(svgPath, "utf8");
const { data, info } = await sharp(pngPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const pngMetadata = await sharp(pngPath).metadata();

if (!pngMetadata.hasAlpha || info.channels !== 4) throw new Error("PNG output has no alpha channel.");
if (svg.includes("<image")) throw new Error("SVG unexpectedly contains a raster image instead of ASCII glyphs.");
if (!svg.includes('id="ascii-art"') || !svg.includes("<use")) {
  throw new Error("SVG ASCII glyph layer is missing.");
}

let transparentPixels = 0;
let partialAlphaPixels = 0;
let opaquePixels = 0;
for (let offset = 3; offset < data.length; offset += info.channels) {
  const alpha = data[offset];
  if (alpha === 0) transparentPixels += 1;
  else if (alpha === 255) opaquePixels += 1;
  else partialAlphaPixels += 1;
}
if (transparentPixels === 0 || opaquePixels === 0 || partialAlphaPixels === 0) {
  throw new Error("Expected transparent, opaque, and antialiased pixels in PNG output.");
}

const corners = [
  [0, 0],
  [info.width - 1, 0],
  [0, info.height - 1],
  [info.width - 1, info.height - 1],
].map(([x, y]) => data[(y * info.width + x) * info.channels + 3]);
if (corners.some((alpha) => alpha !== 0)) {
  throw new Error(`PNG corners should be transparent; received ${corners.join(", ")}.`);
}

console.log(JSON.stringify({
  valid: true,
  svg: {
    path: svgPath,
    editable: true,
    rasterImages: 0,
    glyphUses: (svg.match(/<use\b/g) ?? []).length,
  },
  png: {
    path: pngPath,
    pixels: [info.width, info.height],
    channels: info.channels,
    transparentPixels,
    partialAlphaPixels,
    opaquePixels,
    transparentCorners: true,
  },
}, null, 2));
