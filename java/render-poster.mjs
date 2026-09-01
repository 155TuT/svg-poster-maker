import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { processQrCode, styledQrPath } from "./qrcode/process-qrcode.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backgroundSourcePath = "poster_without_qrcode.png";
const styledQrSourcePath = "qrcode/qrcode-java-styled.png";
const backgroundPath = path.join(scriptDir, backgroundSourcePath);
const svgPath = path.join(scriptDir, "java-recruitment.svg");
const previewPath = path.join(scriptDir, "output", "png", "java-recruitment-preview.png");
const pngPath = path.join(scriptDir, "output", "png", "java-recruitment.png");
const pdfPath = path.join(scriptDir, "output", "pdf", "java-recruitment.pdf");

const canvas = { width: 1024, height: 1536 };
export const qrPlacement = { x: 82, y: 992, size: 376 };
const exportPixels = { width: 2480, height: 3720 };
const exportDpi = 300;
const pagePoints = {
  // 210 x 315 mm keeps the source poster's exact 2:3 composition.
  width: 210 * 72 / 25.4,
  height: 315 * 72 / 25.4,
};

function imageDataUri(filePath, mediaType) {
  return `data:${mediaType};base64,${fs.readFileSync(filePath).toString("base64")}`;
}

const qrResult = await processQrCode();
const backgroundMetadata = await sharp(backgroundPath).metadata();
if (backgroundMetadata.width !== canvas.width || backgroundMetadata.height !== canvas.height) {
  throw new Error(
    `Background must be ${canvas.width} x ${canvas.height}; received ` +
    `${backgroundMetadata.width} x ${backgroundMetadata.height}`,
  );
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <title>西二在线 Java 组纳新海报</title>
  <desc>自包含的海报底图与经过裁切、改色的 QQ 群二维码</desc>
  <g id="full-bleed-background">
    <image data-source-path="${backgroundSourcePath}" id="full-bleed-background-image" x="0" y="0"
      width="${canvas.width}" height="${canvas.height}" preserveAspectRatio="none"
      href="${imageDataUri(backgroundPath, "image/png")}" />
  </g>
  <g id="contact-qr">
    <image data-source-path="${styledQrSourcePath}" id="java-group-qrcode" x="${qrPlacement.x}" y="${qrPlacement.y}"
      width="${qrPlacement.size}" height="${qrPlacement.size}" preserveAspectRatio="xMidYMid meet"
      href="${imageDataUri(styledQrPath, "image/png")}" />
  </g>
</svg>
`;

fs.writeFileSync(svgPath, svg);
fs.mkdirSync(path.dirname(pngPath), { recursive: true });
fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

const preview = await sharp(Buffer.from(svg))
  .resize(canvas.width, canvas.height, { fit: "fill" })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
fs.writeFileSync(previewPath, preview);

const png = await sharp(Buffer.from(svg))
  .resize(exportPixels.width, exportPixels.height, { fit: "fill" })
  .withMetadata({ density: exportDpi })
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toBuffer();
fs.writeFileSync(pngPath, png);

const pdf = await PDFDocument.create();
const page = pdf.addPage([pagePoints.width, pagePoints.height]);
const embeddedPng = await pdf.embedPng(png);
page.drawImage(embeddedPng, {
  x: 0,
  y: 0,
  width: pagePoints.width,
  height: pagePoints.height,
});
fs.writeFileSync(pdfPath, await pdf.save());

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  backgroundPath,
  styledQrPath,
  svgPath,
  qrPlacement,
  qrProcessing: qrResult,
  exports: {
    preview: {
      path: previewPath,
      pixels: [canvas.width, canvas.height],
      sha256: createHash("sha256").update(preview).digest("hex"),
    },
    png: {
      path: pngPath,
      pixels: [exportPixels.width, exportPixels.height],
      density: exportDpi,
      sha256: createHash("sha256").update(png).digest("hex"),
    },
    pdf: {
      path: pdfPath,
      pageMillimeters: [210, 315],
      pagePoints: [pagePoints.width, pagePoints.height],
    },
  },
  svgSha256: createHash("sha256").update(svg).digest("hex"),
}, null, 2));
