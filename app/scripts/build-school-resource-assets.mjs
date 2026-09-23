import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) throw new Error("Pass the approved GPT-generated green atlas path.");
const output = path.join(app, "public/art/school-resources");
const bytes = await readFile(source);
const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const names = ["library", "upload", "slides", "lesson", "worksheet", "folder"];
const cellWidth = Math.floor(info.width / 3);
const cellHeight = Math.floor(info.height / 2);
const entries = [];
await mkdir(output, { recursive: true });
await writeFile(path.join(output, "source-atlas.png"), bytes);
for (let cell = 0; cell < names.length; cell++) {
  const rgba = Buffer.alloc(cellWidth * cellHeight * 4);
  let left = cellWidth, top = cellHeight, right = 0, bottom = 0, cleared = 0;
  for (let y = 0; y < cellHeight; y++) for (let x = 0; x < cellWidth; x++) {
    const src = (((Math.floor(cell / 3) * cellHeight + y) * info.width) + cell % 3 * cellWidth + x) * 4;
    const target = (y * cellWidth + x) * 4;
    let [r, g, b] = data.subarray(src, src + 3);
    // No green objects in this approved atlas: remove the chroma key and edge spill.
    const excess = Math.max(0, g - Math.max(r, b));
    const alpha = g > 125 && excess > 70 ? Math.max(0, 255 - Math.round(excess / 150 * 255)) : 255;
    if (alpha < 255) g = Math.min(g, Math.max(r, b) + 12);
    rgba.set([r, g, b, alpha], target);
    if (alpha === 0) cleared++;
    if (alpha > 20) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (left >= right || cleared < cellWidth * cellHeight * 0.1) throw new Error(`Bad key or empty icon: ${names[cell]}`);
  const art = await sharp(rgba, { raw: { width: cellWidth, height: cellHeight, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .resize(280, 280, { fit: "inside" }).png().toBuffer();
  const icon = await sharp({ create: { width: 320, height: 320, channels: 4, background: "#00000000" } })
    .composite([{ input: art, gravity: "centre" }]).webp({ lossless: true }).toBuffer();
  await writeFile(path.join(output, `${names[cell]}.webp`), icon);
  entries.push({ name: names[cell], sha256: createHash("sha256").update(icon).digest("hex"), size: icon.length, sourceBounds: { left, top, right, bottom }, transparentPixels: cleared });
}
await writeFile(path.join(output, "manifest.json"), JSON.stringify({
  generatedBy: "GPT image generation tool; corrected to green background in a second generation",
  sourceSha256: createHash("sha256").update(bytes).digest("hex"), sourceSize: [info.width, info.height],
  outputSize: [320, 320], nativeResolutionOnly: true,
  artDirection: "Tactile enamel teaching stationery; teal library/upload, coral slides, blue lesson, amber folder; flat chroma green source; no baked-in labels.",
  processing: "Chroma key, green edge decontamination, per-cell content bounds, lossless transparent WebP; no AI upscaling.",
  entries,
}, null, 2) + "\n");
console.log(JSON.stringify({ output, sourceSize: [info.width, info.height], icons: entries.length, entries }, null, 2));
