import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(SCRIPT_DIR, "..");
const WORKSPACE_DIR = path.resolve(APP_DIR, "..");
const SOURCE_DIR = path.join(WORKSPACE_DIR, ".agent-supervisor", "assets", "teacher-feature-icons-v2");
const OUTPUT_DIR = path.join(APP_DIR, "public", "art", "teacher-feature-icons-v2");
const OUTPUT_SIZE = 320;
const ART_SIZE = 276;

const atlases = [
  {
    id: "atlas-a",
    file: "atlas-a-green.png",
    promptSummary: "Core teacher workspace, agent, model recommendation, dashboard metric, knowledge, and source icons.",
    names: [
      "agent-workspace", "conversations", "verified-quality", "published-toolbox",
      "research-review", "lesson-plan", "document-edit", "courseware-board",
      "lesson-test", "paper-polish", "courseware-art", "source-database",
      "class-mastery", "pending-review", "knowledge-book", "fair-use",
    ],
  },
  {
    id: "atlas-b",
    file: "atlas-b-green.png",
    promptSummary: "Teaching design, courseware, assessment, tutoring, and academic prompt workflow icons.",
    names: [
      "prompt-lesson-plan", "prompt-lesson-hook", "prompt-unit-design", "prompt-pbl",
      "prompt-reading-levels", "prompt-slide-outline", "prompt-study-sheet", "prompt-lecture-script",
      "prompt-tiered-homework", "prompt-test-builder", "prompt-mistake-analysis", "prompt-essay-feedback",
      "prompt-report-comment", "prompt-socratic", "prompt-concept-explain", "prompt-abstract-polish",
    ],
  },
  {
    id: "atlas-c",
    file: "atlas-c-green.png",
    promptSummary: "Research, reflection, family communication, prompt library, model marketplace, and category icons.",
    names: [
      "prompt-literature-review", "prompt-teaching-reflection", "prompt-school-notice", "prompt-parent-meeting",
      "prompt-parent-dialogue", "prompt-class-meeting", "prompt-library", "model-marketplace",
      "category-all", "category-teaching", "category-courseware", "category-assessment",
      "category-research", "category-learning", "category-admin", "category-featured",
    ],
  },
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function generatedAt() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (!sourceDateEpoch) return new Date().toISOString();
  if (!/^\d+$/.test(sourceDateEpoch)) {
    throw new Error("SOURCE_DATE_EPOCH must be a non-negative integer number of seconds");
  }
  const milliseconds = Number(sourceDateEpoch) * 1000;
  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error("SOURCE_DATE_EPOCH is outside the supported date range");
  }
  return new Date(milliseconds).toISOString();
}

function chromaKey(raw, info) {
  const pixels = Buffer.from(raw);
  const pixelCount = info.width * info.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  let removedPixels = 0;
  let edgePixels = 0;

  const isBackdrop = (pixelIndex) => {
    const offset = pixelIndex * info.channels;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const alpha = pixels[offset + 3];
    return alpha > 0 && green >= 90 && green - red >= 35 && green - blue >= 45;
  };
  const enqueue = (pixelIndex) => {
    if (visited[pixelIndex] || !isBackdrop(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail] = pixelIndex;
    tail += 1;
  };

  for (let x = 0; x < info.width; x += 1) {
    enqueue(x);
    enqueue((info.height - 1) * info.width + x);
  }
  for (let y = 0; y < info.height; y += 1) {
    enqueue(y * info.width);
    enqueue(y * info.width + info.width - 1);
  }
  while (head < tail) {
    const pixelIndex = queue[head];
    head += 1;
    const x = pixelIndex % info.width;
    const y = Math.floor(pixelIndex / info.width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < info.width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - info.width);
    if (y + 1 < info.height) enqueue(pixelIndex + info.width);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * info.channels;
    if (visited[pixelIndex]) {
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 0;
      removedPixels += 1;
      continue;
    }
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const alpha = pixels[offset + 3];
    const dominance = green - Math.max(red, blue);
    const brightness = Math.max(0, Math.min(1, (green - 100) / 140));
    const keyStrength = Math.max(0, Math.min(1, (dominance - 18) / 95)) * brightness;

    if ((green >= 135 && dominance >= 55) || keyStrength >= 0.82) {
      pixels[offset] = 0;
      pixels[offset + 1] = 0;
      pixels[offset + 2] = 0;
      pixels[offset + 3] = 0;
      removedPixels += 1;
      continue;
    }

    if (keyStrength > 0.04 && alpha > 0) {
      const nextAlpha = Math.round(alpha * (1 - keyStrength));
      if (nextAlpha < 10) {
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
        pixels[offset + 3] = 0;
      } else {
        pixels[offset + 3] = nextAlpha;
      }
      edgePixels += 1;
    }
  }

  return { pixels, removedPixels, edgePixels };
}

function cleanAlphaArtifacts(raw, info) {
  const pixels = Buffer.from(raw);
  const pixelCount = info.width * info.height;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * info.channels;
    if (pixels[offset + 3] >= 12) continue;
    pixels[offset] = 0;
    pixels[offset + 1] = 0;
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 0;
  }

  return pixels;
}

async function buildIcon(atlasBuffer, atlasMeta, atlas, index) {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const left = Math.floor((column * atlasMeta.width) / 4);
  const top = Math.floor((row * atlasMeta.height) / 4);
  const right = Math.floor(((column + 1) * atlasMeta.width) / 4);
  const bottom = Math.floor(((row + 1) * atlasMeta.height) / 4);
  const inset = Math.max(8, Math.floor(Math.min(right - left, bottom - top) * 0.028));

  const cell = await sharp(atlasBuffer)
    .extract({
      left: left + inset,
      top: top + inset,
      width: right - left - inset * 2,
      height: bottom - top - inset * 2,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const keyed = chromaKey(cell.data, cell.info);
  const transparentPng = await sharp(keyed.pixels, { raw: cell.info }).png().toBuffer();
  const trimmed = await sharp(transparentPng)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 7 })
    .png()
    .toBuffer();
  const normalized = await sharp(trimmed)
    .resize(ART_SIZE, ART_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      kernel: sharp.kernel.lanczos3,
    })
    .extend({
      top: (OUTPUT_SIZE - ART_SIZE) / 2,
      bottom: (OUTPUT_SIZE - ART_SIZE) / 2,
      left: (OUTPUT_SIZE - ART_SIZE) / 2,
      right: (OUTPUT_SIZE - ART_SIZE) / 2,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  const normalizedRaw = await sharp(normalized).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const finalKeyed = chromaKey(normalizedRaw.data, normalizedRaw.info);
  const cleaned = cleanAlphaArtifacts(finalKeyed.pixels, normalizedRaw.info);
  const output = await sharp(cleaned, { raw: normalizedRaw.info })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const outputRaw = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let chromaLeakPixels = 0;
  let cornerAlphaMax = 0;

  for (let offset = 0; offset < outputRaw.data.length; offset += outputRaw.info.channels) {
    const red = outputRaw.data[offset];
    const green = outputRaw.data[offset + 1];
    const blue = outputRaw.data[offset + 2];
    const alpha = outputRaw.data[offset + 3];
    if (alpha > 16) visiblePixels += 1;
    if (alpha > 16 && green > 150 && green - red > 80 && green - blue > 80) chromaLeakPixels += 1;
  }

  const corners = [0, OUTPUT_SIZE - 1, OUTPUT_SIZE * (OUTPUT_SIZE - 1), OUTPUT_SIZE * OUTPUT_SIZE - 1];
  for (const pixelIndex of corners) {
    cornerAlphaMax = Math.max(cornerAlphaMax, outputRaw.data[pixelIndex * outputRaw.info.channels + 3]);
  }

  if (visiblePixels < 3_000) throw new Error(`${atlas.names[index]} has too little visible artwork`);
  if (chromaLeakPixels > 24) throw new Error(`${atlas.names[index]} retained ${chromaLeakPixels} chroma-green pixels`);
  if (cornerAlphaMax !== 0) throw new Error(`${atlas.names[index]} retained an opaque corner`);

  const filename = `${atlas.names[index]}.png`;
  await writeFile(path.join(OUTPUT_DIR, filename), output);
  return {
    id: atlas.names[index],
    file: filename,
    atlas: atlas.id,
    cell: { row, column },
    width: OUTPUT_SIZE,
    height: OUTPUT_SIZE,
    alpha: true,
    visiblePixels,
    chromaLeakPixels,
    sha256: sha256(output),
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
for (const filename of await readdir(OUTPUT_DIR)) {
  if (filename.endsWith(".webp")) await unlink(path.join(OUTPUT_DIR, filename));
}
const assets = [];
const sources = [];

for (const atlas of atlases) {
  const sourcePath = path.join(SOURCE_DIR, atlas.file);
  const atlasBuffer = await readFile(sourcePath);
  const atlasMeta = await sharp(atlasBuffer).metadata();
  if (!atlasMeta.width || !atlasMeta.height) throw new Error(`${atlas.file} has no dimensions`);
  if (Math.abs(atlasMeta.width - atlasMeta.height) > 2) throw new Error(`${atlas.file} is not square`);

  sources.push({
    id: atlas.id,
    file: path.relative(WORKSPACE_DIR, sourcePath).replaceAll("\\", "/"),
    width: atlasMeta.width,
    height: atlasMeta.height,
    sha256: sha256(atlasBuffer),
    promptSummary: atlas.promptSummary,
  });

  for (let index = 0; index < atlas.names.length; index += 1) {
    assets.push(await buildIcon(atlasBuffer, atlasMeta, atlas, index));
  }
}

const manifest = {
  schemaVersion: 1,
  collection: "teacher-feature-icons-v2",
  version: "2.0.0",
  generatedAt: generatedAt(),
  origin: "OpenAI built-in image generation, original prompts derived from user-supplied style references",
  extraction: "4x4 equal-cell crop, edge-connected chroma-key alpha removal, optical normalization to 320x320 lossless PNG",
  runtimeUse: "Static project assets only; no model call occurs in the student or teacher application",
  sources,
  assets,
};

await writeFile(path.join(OUTPUT_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Built ${assets.length} transparent feature icons in ${OUTPUT_DIR}`);
