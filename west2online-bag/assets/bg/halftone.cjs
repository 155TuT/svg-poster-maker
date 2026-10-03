#!/usr/bin/env node
'use strict';

// Rebuild the image with a single screen and locally coloured ink dots.
// Source RGB determines local ink colour and coverage; no original image underneath.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const HELP = `Usage: node halftone.cjs [options]

Defaults: bg/image.png -> bg/output/image-halftone.png
          also exports the complete print as image-halftone-ink.png

  --input FILE       Source image (default: image.png beside this script)
  --output DIR       Export directory (default: output beside this script)
  --spacing PX       Distance between adjacent dots (default: 7.1 * width / 927)
  --mode MODE        color (native-colour dots) or mono (default: color)
  --dot-scale N      Dot gain: scales ink area by N squared, 0.1..2 (default: 1)
  --opacity N        Print opacity on paper, 0..1 (default: 1)
  --angle DEG        Screen angle, -360..360 (default: 45)
  --ink HEX          Black ink colour, #RRGGBB (default: #302d28)
  --paper HEX        Paper colour, #RRGGBB (default: #f0e2cc)
  --gamma N          Coverage curve, 0.2..3; higher is lighter (default: 1.2)
  --grain N          Ink edge roughness, 0..0.1 (default: 0.018)
  --samples N        Antialias samples per axis, 1..4 (default: 3)
  --seed N           Texture seed, 0..4294967295 (default: 2026)
  --help             Show this help

Paths passed as options are relative to the current working directory.
Default paths are relative to this script, regardless of working directory.
`;

function optionsFrom(args) {
  const options = {
    input: path.join(__dirname, 'image.png'),
    output: path.join(__dirname, 'output'),
    spacing: null,
    mode: 'color',
    dotScale: 1,
    opacity: 1,
    angle: 45,
    ink: '#302d28',
    paper: '#f0e2cc',
    gamma: 1.2,
    grain: 0.018,
    samples: 3,
    seed: 2026,
  };
  const keys = {
    '--input': 'input', '--output': 'output', '--spacing': 'spacing',
    '--dot-scale': 'dotScale', '--opacity': 'opacity', '--angle': 'angle',
    '--ink': 'ink', '--seed': 'seed',
    '--paper': 'paper', '--mode': 'mode', '--gamma': 'gamma',
    '--grain': 'grain', '--samples': 'samples',
  };
  for (let i = 0; i < args.length; i++) {
    const key = keys[args[i]];
    if (!key) throw new Error(`Unknown option: ${args[i]}. Use --help.`);
    const value = args[++i];
    if (value === undefined || value === '' || value.startsWith('--')) {
      throw new Error(`Missing value for ${args[i - 1]}.`);
    }
    options[key] = ['input', 'output', 'ink', 'paper', 'mode'].includes(key) ? value : Number(value);
  }
  for (const [key, min, max] of [
    ['spacing', 1, 512], ['dotScale', 0.1, 2], ['opacity', 0, 1],
    ['angle', -360, 360], ['seed', 0, 4294967295],
    ['gamma', 0.2, 3], ['grain', 0, 0.1], ['samples', 1, 4],
  ]) {
    if (key === 'spacing' && options.spacing === null) continue;
    if (!Number.isFinite(options[key]) || options[key] < min || options[key] > max) {
      throw new Error(`${key} must be between ${min} and ${max}.`);
    }
  }
  if (!Number.isInteger(options.seed)) throw new Error('seed must be an integer.');
  if (!Number.isInteger(options.samples)) throw new Error('samples must be an integer.');
  if (!['color', 'mono'].includes(options.mode)) throw new Error('mode must be color or mono.');
  for (const key of ['ink', 'paper']) {
    if (!/^#?[0-9a-f]{6}$/i.test(options[key])) {
      throw new Error(`${key} must be a six-digit hex colour, e.g. #302d28.`);
    }
    options[key] = options[key].replace(/^#/, '');
  }
  options.input = path.resolve(options.input);
  options.output = path.resolve(options.output);
  return options;
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rgbFrom = hex => [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));

function noiseAt(x, y, seed) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function screenRanks() {
  // Rank = area of a centred circle inside one square screen cell. This CDF
  // makes 25% tone cover 25% of a cell, rather than using radius = tone.
  // Above pi/4 coverage the dots join; the remaining gaps shrink to white holes.
  const ranks = new Float64Array(4097);
  for (let i = 0; i < ranks.length; i++) {
    const squared = 0.5 * i / (ranks.length - 1);
    const radius = Math.sqrt(squared);
    let area = Math.PI * squared;
    if (radius > 0.5) {
      area -= 4 * (squared * Math.acos(0.5 / radius) - 0.5 * Math.sqrt(squared - 0.25));
    }
    ranks[i] = clamp(area, 0, 1);
  }
  return ranks;
}

function makeInkLayer(source, cellColours, width, height, options) {
  const layer = Buffer.alloc(width * height * 4);
  const result = Buffer.alloc(source.length);
  const ink = rgbFrom(options.ink), paper = rgbFrom(options.paper);
  if (paper.some((value, channel) => value <= ink[channel])) {
    throw new Error('Each paper colour channel must be lighter than the black ink.');
  }
  const ranks = screenRanks();
  const toneCurve = value => clamp(Math.pow(clamp(value, 0, 1), options.gamma) * options.dotScale ** 2, 0, 1);
  const angle = options.angle * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const phaseU = noiseAt(0, 0, options.seed), phaseV = noiseAt(0, 1, options.seed);
  const dotColours = new Map();
  function colourForDot(cellX, cellY) {
    if (options.mode === 'mono') return ink;
    const key = `${cellX},${cellY}`;
    if (dotColours.has(key)) return dotColours.get(key);
    const u = (cellX - phaseU) * options.spacing;
    const v = (cellY - phaseV) * options.spacing;
    const x = clamp(Math.round(u * cos - v * sin), 0, width - 1);
    const y = clamp(Math.round(u * sin + v * cos), 0, height - 1);
    const index = (y * width + x) * 4;
    const rgb = paper.map((value, channel) => clamp(cellColours[index + channel], ink[channel], value));
    const area = Math.max(...rgb.map((value, channel) => (paper[channel] - value) / (paper[channel] - ink[channel])));
    // Lift the cell's mean RGB into a full-density native-colour ink. The
    // mean is reconstructed by that coloured ink's AREA, not RGB under a mask.
    const colour = area > 0.00001 ? rgb.map((value, channel) => Math.round(paper[channel] - (paper[channel] - value) / area)) : ink;
    dotColours.set(key, colour);
    return colour;
  }
  const sampleCount = options.samples ** 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let totalR = 0, totalG = 0, totalB = 0, inkSamples = 0;
      for (let sy = 0; sy < options.samples; sy++) {
        for (let sx = 0; sx < options.samples; sx++) {
          const sampleX = x + (sx + 0.5) / options.samples;
          const sampleY = y + (sy + 0.5) / options.samples;
          const u = (sampleX * cos + sampleY * sin) / options.spacing + phaseU;
          const v = (-sampleX * sin + sampleY * cos) / options.spacing + phaseV;
          const cellX = Math.floor(u + 0.5), cellY = Math.floor(v + 0.5);
          const colour = colourForDot(cellX, cellY);
          // Project the source pixel onto paper -> this dot's ink. This keeps
          // fine contours while every dot has one constant colour sampled locally.
          let numerator = 0, denominator = 0;
          for (let channel = 0; channel < 3; channel++) {
            const difference = paper[channel] - colour[channel];
            const weight = [0.2126, 0.7152, 0.0722][channel];
            numerator += weight * (paper[channel] - source[index + channel]) * difference;
            denominator += weight * difference * difference;
          }
          const coverage = toneCurve(numerator / denominator);
          const jitterU = (noiseAt(cellX, cellY, options.seed) - 0.5) * options.grain;
          const jitterV = (noiseAt(cellY, cellX, options.seed + 17) - 0.5) * options.grain;
          const du = u - cellX - jitterU, dv = v - cellY - jitterV;
          const rankIndex = Math.min(4096, Math.round((du * du + dv * dv) * 8192));
          // One grid, one native-colour ink per dot. No CMYK/RGB colour screens.
          if (coverage < 1 && (coverage <= 0 || coverage <= ranks[rankIndex])) continue;
          inkSamples++;
          totalR += colour[0];
          totalG += colour[1];
          totalB += colour[2];
        }
      }
      const inkFraction = inkSamples / sampleCount;
      const alpha = inkFraction * options.opacity;
      const inkRGB = inkSamples ? [totalR / inkSamples, totalG / inkSamples, totalB / inkSamples] : [0, 0, 0];
      for (let channel = 0; channel < 3; channel++) {
        layer[index + channel] = Math.round(inkRGB[channel]);
        result[index + channel] = Math.round(paper[channel] * (1 - alpha) + inkRGB[channel] * alpha);
      }
      layer[index + 3] = Math.round(source[index + 3] * alpha);
      result[index + 3] = source[index + 3];
    }
  }
  return { layer, result };
}

async function main() {
  if (process.argv.slice(2).includes('--help')) {
    process.stdout.write(HELP);
    return;
  }
  const options = optionsFrom(process.argv.slice(2));
  const outputImage = path.join(options.output, 'image-halftone.png');
  const outputLayer = path.join(options.output, 'image-halftone-ink.png');
  const realInput = await fs.realpath(options.input);
  await fs.mkdir(options.output, { recursive: true });
  // Resolve symlinks too, so custom paths cannot accidentally overwrite the input.
  for (const output of [outputImage, outputLayer]) {
    const realOutput = await fs.realpath(output).catch(error => {
      if (error.code === 'ENOENT') return output;
      throw error;
    });
    if (realOutput.toLowerCase() === realInput.toLowerCase()) {
      throw new Error('Output would overwrite the source image. Choose another --output directory.');
    }
  }

  const metadata = await sharp(options.input).metadata();
  const { data: source, info } = await sharp(options.input)
    .rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  // The reference is 927 px wide; its background grid repeats diagonally at
  // approximately (5, 5) px, i.e. a 7.1 px nearest-neighbour dot pitch.
  options.spacing ??= Math.max(1, 7.1 * width / 927);
  const raw = { width, height, channels: 4 };
  const cellColours = options.mode === 'color' ? await sharp(source, { raw })
    .blur(Math.max(0.3, options.spacing * 0.35)).raw().toBuffer() : source;
  const { layer, result } = makeInkLayer(source, cellColours, width, height, options);

  // Store both the finished background and a separately reusable transparent layer.
  await sharp(result, { raw }).withMetadata({ density: metadata.density || 72 })
    .png().toFile(outputImage);
  await sharp(layer, { raw }).withMetadata({ density: metadata.density || 72 })
    .png().toFile(outputLayer);
  console.log(`Re-screened ${width} x ${height}; mode=${options.mode}; spacing=${options.spacing.toFixed(2)} px; dot-gain=${options.dotScale}; opacity=${options.opacity}`);
  console.log(outputImage);
  console.log(outputLayer);
}

main().catch(error => {
  console.error(`Halftone export failed: ${error.message}`);
  process.exitCode = 1;
});
