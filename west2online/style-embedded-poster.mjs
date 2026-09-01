import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const svgPath = path.join(scriptDir, "west2-online-a4.svg");
const backgroundSourcePath = "bg/ai-hero-background.png";
const avatarSourcePath = "logo/west2-online-avatar.png";
const styledQrSourcePath = "qrcode/qrcode-west2-styled.png";
const backgroundPath = path.join(scriptDir, backgroundSourcePath);
const avatarPath = path.join(scriptDir, avatarSourcePath);
const styledQrPath = path.join(scriptDir, styledQrSourcePath);
const pngDir = path.join(scriptDir, "output", "png");
const pdfDir = path.join(scriptDir, "output", "pdf");
const exportDpi = 300;
const bleedMillimeters = 3;
const pointsPerMillimeter = 72 / 25.4;

const exportSizes = [
  {
    name: "a4",
    pixels: [2480, 3508],
    points: [595.2756, 841.8898],
    millimeters: [210, 297],
  },
  {
    name: "a3",
    pixels: [3508, 4961],
    points: [841.8898, 1190.5512],
    millimeters: [297, 420],
  },
];

function splitBleedPixels(trimPixels, totalMillimeters) {
  const totalPixels = Math.round((totalMillimeters * exportDpi) / 25.4);
  const extraPixels = totalPixels - trimPixels;
  return [Math.floor(extraPixels / 2), Math.ceil(extraPixels / 2)];
}

async function createPdf(png, pagePoints, trimBox) {
  const doc = await PDFDocument.create();
  const page = doc.addPage(pagePoints);
  const image = await doc.embedPng(png);
  page.drawImage(image, { x: 0, y: 0, width: pagePoints[0], height: pagePoints[1] });
  if (trimBox) {
    page.setTrimBox(trimBox.x, trimBox.y, trimBox.width, trimBox.height);
    page.setBleedBox(0, 0, pagePoints[0], pagePoints[1]);
  }
  return doc.save();
}

function replaceImageInGroup(source, groupId, imageId, sourcePath, dataUri) {
  const groupStart = source.indexOf(`<g id="${groupId}"`);
  if (groupStart === -1) throw new Error(`Missing group: ${groupId}`);
  const imageStart = source.indexOf("<image", groupStart);
  const imageEnd = source.indexOf("/>", imageStart);
  if (imageStart === -1 || imageEnd === -1) throw new Error(`Missing image in group: ${groupId}`);

  let tag = source.slice(imageStart, imageEnd + 2);
  if (/\sid="[^"]*"/.test(tag)) {
    tag = tag.replace(/\sid="[^"]*"/, ` id="${imageId}"`);
  } else {
    tag = tag.replace("<image", `<image id="${imageId}"`);
  }
  if (!/href="[^"]*"/.test(tag)) throw new Error(`Missing href in image: ${imageId}`);
  tag = tag.replace(/href="[^"]*"/, `href="${dataUri}"`);
  if (/\sdata-source-path="[^"]*"/.test(tag)) {
    tag = tag.replace(/\sdata-source-path="[^"]*"/, ` data-source-path="${sourcePath}"`);
  } else {
    tag = tag.replace("<image", `<image data-source-path="${sourcePath}"`);
  }
  return source.slice(0, imageStart) + tag + source.slice(imageEnd + 2);
}

// External raster assets are authoritative; SVG typography and layout remain untouched.
const backgroundPng = fs.readFileSync(backgroundPath);
const avatarPng = fs.readFileSync(avatarPath);
// The manually refined transparent QR is authoritative; never regenerate or flatten it here.
const qrPng = fs.readFileSync(styledQrPath);

const sourceSvg = fs.readFileSync(svgPath, "utf8");
let svg = sourceSvg;
svg = replaceImageInGroup(
  svg,
  "full-bleed-background",
  "full-bleed-background-image",
  backgroundSourcePath,
  `data:image/png;base64,${backgroundPng.toString("base64")}`,
);
svg = replaceImageInGroup(
  svg,
  "identity-block",
  "identity-avatar",
  avatarSourcePath,
  `data:image/png;base64,${avatarPng.toString("base64")}`,
);
svg = replaceImageInGroup(
  svg,
  "contact-qr",
  "group-qrcode",
  styledQrSourcePath,
  `data:image/png;base64,${qrPng.toString("base64")}`,
);
if (svg !== sourceSvg) fs.writeFileSync(svgPath, svg);

fs.mkdirSync(pngDir, { recursive: true });
fs.mkdirSync(pdfDir, { recursive: true });

const exports = [];
for (const size of exportSizes) {
  const pngPath = path.join(pngDir, `west2-online-${size.name}.png`);
  const pdfPath = path.join(pdfDir, `west2-online-${size.name}.pdf`);
  const bleedPngPath = path.join(pngDir, `west2-online-${size.name}-bleed.png`);
  const bleedPdfPath = path.join(pdfDir, `west2-online-${size.name}-bleed.pdf`);
  const [pixelWidth, pixelHeight] = size.pixels;
  const [pointWidth, pointHeight] = size.points;
  const [millimeterWidth, millimeterHeight] = size.millimeters;

  const png = await sharp(Buffer.from(svg))
    .resize(pixelWidth, pixelHeight, { fit: "fill" })
    .withMetadata({ density: exportDpi })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(pngPath, png);

  fs.writeFileSync(pdfPath, await createPdf(png, [pointWidth, pointHeight]));

  const [bleedLeft, bleedRight] = splitBleedPixels(
    pixelWidth,
    millimeterWidth + 2 * bleedMillimeters,
  );
  const [bleedTop, bleedBottom] = splitBleedPixels(
    pixelHeight,
    millimeterHeight + 2 * bleedMillimeters,
  );
  const bleedPng = await sharp(png)
    .extend({
      top: bleedTop,
      bottom: bleedBottom,
      left: bleedLeft,
      right: bleedRight,
      extendWith: "mirror",
    })
    .withMetadata({ density: exportDpi })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  fs.writeFileSync(bleedPngPath, bleedPng);

  const bleedPoints = bleedMillimeters * pointsPerMillimeter;
  const bleedPagePoints = [
    pointWidth + 2 * bleedPoints,
    pointHeight + 2 * bleedPoints,
  ];
  fs.writeFileSync(
    bleedPdfPath,
    await createPdf(bleedPng, bleedPagePoints, {
      x: bleedPoints,
      y: bleedPoints,
      width: pointWidth,
      height: pointHeight,
    }),
  );

  exports.push({
    size: size.name.toUpperCase(),
    trim: {
      pngPath,
      pdfPath,
      pngPixels: size.pixels,
      pdfPoints: size.points,
      pngSha256: createHash("sha256").update(png).digest("hex"),
    },
    bleed: {
      millimetersPerSide: bleedMillimeters,
      pngPath: bleedPngPath,
      pdfPath: bleedPdfPath,
      pngPixels: [
        pixelWidth + bleedLeft + bleedRight,
        pixelHeight + bleedTop + bleedBottom,
      ],
      pngInsets: {
        top: bleedTop,
        right: bleedRight,
        bottom: bleedBottom,
        left: bleedLeft,
      },
      pdfMediaPoints: bleedPagePoints,
      pdfTrimBox: [bleedPoints, bleedPoints, pointWidth, pointHeight],
      pngSha256: createHash("sha256").update(bleedPng).digest("hex"),
    },
  });
}

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  svgPath,
  backgroundPath,
  avatarPath,
  styledQrPath,
  exports,
  svgSha256: createHash("sha256").update(svg).digest("hex"),
  preservedSource: "west2-online-a4.svg typography and layout",
}, null, 2));
