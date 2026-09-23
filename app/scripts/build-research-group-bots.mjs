import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = "D:/VB/jiedui-code-platform/CX/gif";
const outputRoot = join(appRoot, "public/art/research-groups/bots");
const qaRoot = join(outputRoot, "qa");
const shapes = ["circle", "cloud", "droplet", "egg", "hexagon", "panda", "pill", "squircle", "triangle"];
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const sourcePath = (entry) => join(sourceRoot, entry.source);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function inventory() {
  const entries = [];
  assert.deepEqual((await readdir(sourceRoot, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort(), shapes);
  for (const shape of shapes) {
    const files = (await readdir(join(sourceRoot, shape))).filter((name) => /\.gif$/i.test(name)).sort();
    assert(files.includes("main.gif"), `Missing main.gif: ${shape}`);
    files.sort((a, b) => Number(b === "main.gif") - Number(a === "main.gif") || a.localeCompare(b));
    for (const file of files) {
      const buffer = await readFile(join(sourceRoot, shape, file));
      const meta = await sharp(buffer, { animated: true }).metadata();
      assert(meta.pages > 1 && meta.delay?.length === meta.pages, `Incomplete animation metadata: ${shape}/${file}`);
      entries.push({ shape, name: file.slice(0, -4), source: `${shape}/${file}`, sourceSha256: sha256(buffer), sourceBytes: buffer.length,
        width: meta.width, height: meta.pageHeight, frames: meta.pages, delayMs: meta.delay,
        durationMs: meta.delay.reduce((a, b) => a + b, 0), loop: meta.loop });
    }
  }
  assert.equal(entries.length, 71, "Expected the bounded 71-GIF source inventory");
  return entries;
}

async function checkSources(entries) {
  const current = await inventory();
  assert.deepEqual(current, entries, "Source inventory/content changed; never write to CX source files");
}

async function label(text, width = 192, height = 36) {
  const lines = text.match(/.{1,28}/g) ?? [""];
  return sharp(Buffer.from(`<svg width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/>${lines.slice(0, 2).map((line, i) => `<text x="6" y="${14 + i * 14}" font-family="Arial" font-size="11" fill="#182023">${line}</text>`).join("")}</svg>`)).png().toBuffer();
}

async function contactSheet(entries, kind, frame) {
  const cell = 192, rowHeight = 228;
  const layers = [];
  for (const entry of entries) {
    const row = shapes.indexOf(entry.shape);
    const col = entries.filter((e) => e.shape === entry.shape).indexOf(entry);
    const input = kind === "source" ? sourcePath(entry) : join(outputRoot, entry.shape, `${entry.name}.webp`);
    const background = kind === "source" ? "white" : (col % 2 ? "#20262c" : "#ffffff");
    layers.push({ input: await sharp(input, { page: Math.min(frame, entry.frames - 1), pages: 1 }).resize(cell, cell).flatten({ background }).png().toBuffer(), left: col * cell, top: row * rowHeight });
    layers.push({ input: await label(`${entry.shape}/${entry.name}`), left: col * cell, top: row * rowHeight + cell });
  }
  const file = `${kind}-frame-${String(frame).padStart(2, "0")}.png`;
  await sharp({ create: { width: cell * 8, height: rowHeight * 9, channels: 3, background: "#edf0f3" } }).composite(layers).png().toFile(join(qaRoot, file));
  return `qa/${file}`;
}

async function edgeSheet(entries) {
  const layers = [], size = 256;
  for (const [index, entry] of entries.filter((e) => e.name === "main").entries()) {
    for (let variant = 0; variant < 3; variant++) {
      const input = variant === 0 ? sourcePath(entry) : join(outputRoot, entry.shape, "main.png");
      const frame = await sharp(input).extract({ left: 64, top: 64, width: 384, height: 384 }).resize(size, size)
        .flatten({ background: variant === 2 ? "#20262c" : "white" }).png().toBuffer();
      const left = (index % 3) * size * 3 + variant * size, top = Math.floor(index / 3) * (size + 36);
      layers.push({ input: frame, left, top });
      layers.push({ input: await label(`${entry.shape}: ${["source", "white", "dark"][variant]}`, size), left, top: top + size });
    }
  }
  const path = "qa/main-edge-comparison.png";
  await sharp({ create: { width: size * 9, height: (size + 36) * 3, channels: 3, background: "white" } }).composite(layers).png().toFile(join(outputRoot, path));
  return path;
}

function keyPixel(data, i) {
  return data[i + 3] === 0 || (data[i] === 0 && data[i + 1] >= 250 && data[i + 2] === 0);
}

function foregroundReference(source) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < source.length; i += 4) {
    if (keyPixel(source, i) || source[i + 1] >= 230 || source[i] + source[i + 2] < 60) continue;
    for (let c = 0; c < 3; c++) sum[c] += source[i + c];
    count++;
  }
  assert(count > 1000, "Expected a full first-frame subject for this fixed source set");
  return sum.map((value) => value / count);
}

function unmixPixel(source, output, i, [fr, fg, fb]) {
  const coverage = Math.max(1 / 255, Math.min(1, (source[i] * fr + source[i + 2] * fb) / (fr * fr + fb * fb)));
  output[i] = Math.min(255, Math.round(source[i] / coverage));
  output[i + 1] = Math.max(0, Math.round(Math.min(fg, (source[i + 1] - 252 * (1 - coverage)) / coverage)));
  output[i + 2] = Math.min(255, Math.round(source[i + 2] / coverage));
  output[i + 3] = Math.max(1, Math.round(source[i + 3] * coverage));
}

function extractFrame(source, width, height, reference) {
  const output = Buffer.from(source);
  let keyed = 0, edgeAdjusted = 0, spillAdjusted = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (keyPixel(source, i)) {
      output.fill(0, i, i + 4);
      keyed++;
      continue;
    }
    // Later source frames contain green-baked highlights/fading dots wider than the edge.
    // Calibrate against this expression's full first-frame body, keeping teal green intact.
    if (source[i + 1] > reference[1] + 45) {
      unmixPixel(source, output, i, reference);
      spillAdjusted++;
      continue;
    }
    if (source[i + 1] < 130) continue;
    let touchesKey = false;
    for (let dy = -2; dy <= 2 && !touchesKey; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && keyPixel(source, (ny * width + nx) * 4)) { touchesKey = true; break; }
    }
    if (!touchesKey) continue;
    // Average nearby palette samples instead of copying one dithered edge colour.
    let red = 0, green = 0, blue = 0, weight = 0;
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const nx = x + dx, ny = y + dy, distance = dx * dx + dy * dy;
      if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1 || distance === 0) continue;
      const candidate = (ny * width + nx) * 4;
      if (keyPixel(source, candidate) || source[candidate + 1] > 225) continue;
      if (source[candidate] + source[candidate + 2] < 60) continue;
      if (keyPixel(source, candidate - 4) || keyPixel(source, candidate + 4) || keyPixel(source, candidate - width * 4) || keyPixel(source, candidate + width * 4)) continue;
      const w = 1 / distance;
      red += source[candidate] * w; green += source[candidate + 1] * w; blue += source[candidate + 2] * w; weight += w;
    }
    if (!weight || source[i + 1] <= green / weight + 12) continue;
    unmixPixel(source, output, i, [red / weight, green / weight, blue / weight]);
    edgeAdjusted++;
  }
  return { data: output, keyed, edgeAdjusted, spillAdjusted };
}

function alphaMetrics(data, width, height) {
  let transparent = 0, opaque = 0, partial = 0, remainingKey = 0;
  let left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (!a) { transparent++; continue; }
    if (a === 255) opaque++; else partial++;
    if (keyPixel(data, i)) remainingKey++;
    const p = i / 4, x = p % width, y = Math.floor(p / width);
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  assert(opaque + partial > 0 && transparent > 0, "Expected nonblank subject and transparent background in each frame");
  assert.equal(remainingKey, 0, "Pure-green key remains");
  return { transparent, opaque, partial, remainingKey, bounds: [left, top, right - left + 1, bottom - top + 1] };
}

function visibleHash(data) {
  const canonical = Buffer.from(data);
  for (let i = 0; i < canonical.length; i += 4) if (canonical[i + 3] === 0) canonical.fill(0, i, i + 4);
  return sha256(canonical);
}

async function verifyAsset(entry, record) {
  const buffer = await readFile(join(outputRoot, record.animation.path));
  assert.equal(sha256(buffer), record.animation.sha256, `Output hash differs: ${entry.source}`);
  const metadata = await sharp(buffer, { animated: true }).metadata();
  assert.equal(metadata.width, entry.width);
  assert.equal(metadata.pageHeight, entry.height);
  assert.equal(metadata.pages, entry.frames, `Frame count differs: ${entry.source}`);
  assert.deepEqual(metadata.delay, entry.delayMs, `Frame delays differ: ${entry.source}`);
  assert.equal(metadata.loop, entry.loop, `Loop differs: ${entry.source}`);
  const decoded = await sharp(buffer, { animated: true }).ensureAlpha().raw().toBuffer();
  const stride = entry.width * entry.height * 4;
  assert.equal(decoded.length, stride * entry.frames);
  const frameMetrics = [];
  for (let f = 0; f < entry.frames; f++) {
    const frame = decoded.subarray(f * stride, (f + 1) * stride);
    assert.equal(visibleHash(frame), record.frames[f].rgbaSha256, `Lossless frame roundtrip differs: ${entry.source}#${f}`);
    frameMetrics.push(alphaMetrics(frame, entry.width, entry.height));
  }
  const still = await readFile(join(outputRoot, record.still.path));
  assert.equal(sha256(still), record.still.sha256);
  const stillMetadata = await sharp(still).metadata();
  assert.equal(stillMetadata.width, entry.width);
  assert.equal(stillMetadata.height, entry.height);
  assert.equal(visibleHash(await sharp(still).ensureAlpha().raw().toBuffer()), record.frames[0].rgbaSha256);
  return { source: entry.source, frames: entry.frames, width: entry.width, height: entry.height, durationMs: entry.durationMs,
    exactExtractedFramePixels: true, exactTimingAndLoop: true, nonblankAllFrames: true,
    minSubjectPixels: Math.min(...frameMetrics.map((m) => m.opaque + m.partial)),
    minTransparentPixels: Math.min(...frameMetrics.map((m) => m.transparent)) };
}

async function buildAsset(entry) {
  const input = await readFile(sourcePath(entry));
  assert.equal(sha256(input), entry.sourceSha256);
  const { data, info } = await sharp(input, { animated: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const stride = entry.width * entry.height * 4;
  assert.equal(info.width, entry.width);
  assert.equal(data.length, stride * entry.frames);
  const reference = foregroundReference(data.subarray(0, stride));
  const extracted = Buffer.alloc(data.length), frames = [];
  for (let f = 0; f < entry.frames; f++) {
    const source = data.subarray(f * stride, (f + 1) * stride);
    const frame = extractFrame(source, entry.width, entry.height, reference);
    frame.data.copy(extracted, f * stride);
    const metrics = alphaMetrics(frame.data, entry.width, entry.height);
    assert.equal(metrics.transparent, frame.keyed, "Extraction must retain every non-key source pixel");
    frames.push({ index: f, sourceRgbaSha256: visibleHash(source), rgbaSha256: visibleHash(frame.data), keyedPixels: frame.keyed,
      edgeAdjustedPixels: frame.edgeAdjusted, spillAdjustedPixels: frame.spillAdjusted, ...metrics });
  }
  const webp = await sharp(extracted, { raw: { width: entry.width, height: entry.height * entry.frames, channels: 4, pageHeight: entry.height } })
    .webp({ lossless: true, exact: true, effort: 4, loop: entry.loop, delay: entry.delayMs }).toBuffer();
  const png = await sharp(extracted.subarray(0, stride), { raw: { width: entry.width, height: entry.height, channels: 4 } }).png().toBuffer();
  const animationPath = `${entry.shape}/${entry.name}.webp`, stillPath = `${entry.shape}/${entry.name}.png`;
  await mkdir(join(outputRoot, entry.shape), { recursive: true });
  await writeFile(join(outputRoot, animationPath), webp);
  await writeFile(join(outputRoot, stillPath), png);
  const record = { ...entry, frameCount: entry.frames, foregroundReference: reference, animation: { path: animationPath, url: `/art/research-groups/bots/${animationPath}`, bytes: webp.length, sha256: sha256(webp) },
    still: { path: stillPath, url: `/art/research-groups/bots/${stillPath}`, frame: 0, bytes: png.length, sha256: sha256(png) }, frames };
  record.verification = await verifyAsset(entry, record);
  return record;
}

async function main() {
  const mode = process.argv[2] ?? "--build";
  assert(["--inspect", "--build", "--verify", "--preview"].includes(mode), "Usage: node scripts/build-research-group-bots.mjs [--inspect|--build|--verify|--preview]");
  const entries = await inventory();
  await mkdir(qaRoot, { recursive: true });
  const baselinePath = join(qaRoot, "source-inventory.json");
  let baseline;
  try { baseline = JSON.parse(await readFile(baselinePath, "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (baseline) assert.deepEqual(entries, baseline, "Sources differ from the recorded preflight hashes");
  else await writeFile(baselinePath, json(entries));
  if (mode === "--verify") {
    const manifest = JSON.parse(await readFile(join(outputRoot, "manifest.json"), "utf8"));
    assert.deepEqual(manifest.assets.map(({ shape, name, source, sourceSha256, sourceBytes, width, height, frames: frameRecords, delayMs, durationMs, loop }) =>
      ({ shape, name, source, sourceSha256, sourceBytes, width, height, frames: frameRecords.length, delayMs, durationMs, loop })), entries);
    for (let i = 0; i < entries.length; i++) await verifyAsset(entries[i], manifest.assets[i]);
    await checkSources(entries);
    console.log(json({ mode, assets: entries.length, frames: entries.reduce((n, e) => n + e.frames, 0), sourceUnchanged: true, allChecksPassed: true }));
    return;
  }
  const sheets = [], assets = [];
  if (mode === "--inspect") {
    for (const frame of [0, 10, 19]) sheets.push(await contactSheet(entries, "source", frame));
  } else {
    const selected = mode === "--preview" ? entries.filter((e) => e.name === "main") : entries;
    for (const entry of selected) {
      assets.push(await buildAsset(entry));
      console.log(`Verified ${entry.source}: ${entry.frames} frames, ${entry.durationMs}ms`);
    }
    for (const frame of [0, 10, 19]) sheets.push(await contactSheet(selected, "extracted", frame));
    sheets.push(await edgeSheet(selected));
    await checkSources(entries);
    if (mode === "--build") await writeFile(join(outputRoot, "manifest.json"), json({ schemaVersion: 1, sourceRoot, createdAt: new Date().toISOString(),
      generator: "User-authorized local green-screen extraction; no image generation", versions: sharp.versions,
      scriptSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
      processing: { key: "RGB 0,250..255,0 and pre-existing alpha zero", edge: "First-frame body-calibrated green spill unmix plus local two-pixel edge averaging; only alpha-zero pixels are exact key; non-key subject pixels retained",
        canvas: "Original dimensions, no crop or resize", format: "Lossless animated WebP and first-frame transparent PNG for every expression",
        limitations: ["Source green eye cutouts become transparent; original eye colors cannot be recovered.", "Original symbol-only animation phases are retained, not repaired or redrawn.", "GIF palette quantization is irreversible; matte-edge color reconstruction is approximate."] },
      shapes: shapes.map((shape) => ({ shape, main: `${shape}/main.webp`, still: `${shape}/main.png`, expressions: assets.filter((a) => a.shape === shape).map((a) => a.name) })),
      sourceCount: entries.length, frameCount: entries.reduce((n, e) => n + e.frames, 0), sourceUnchanged: true, sheets, assets }));
  }
  await checkSources(entries);
  console.log(json({ mode, sourceCount: entries.length, sourceFrames: entries.reduce((n, e) => n + e.frames, 0),
    builtAssets: assets.length, verifiedOutputFrames: assets.reduce((n, e) => n + e.frameCount, 0), sourceUnchanged: true, sheets }));
}

await main();
