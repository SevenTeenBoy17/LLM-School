import sharp from "sharp";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Pass the GPT-generated green-background atlas path.");
const destination = resolve("public/art/research-workspace-v1");
await mkdir(destination, { recursive: true });
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const names = ["prep", "artifacts", "water", "plant", "math", "reading", "worksheet", "folder"];
const manifest = [];
for (let i = 0; i < 8; i++) {
  const x0 = Math.round((i % 4) * info.width / 4), y0 = Math.round(Math.floor(i / 4) * info.height / 2);
  const width = Math.round((i % 4 + 1) * info.width / 4) - x0;
  const height = Math.round((Math.floor(i / 4) + 1) * info.height / 2) - y0;
  const pixels = Buffer.alloc(width * height * 4);
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = ((y + y0) * info.width + x + x0) * 4;
    const dest = (y * width + x) * 4;
    let [r, g, b, a] = data.subarray(at, at + 4);
    // Chroma is deliberately absent from subjects; cyan leaves retain their blue channel.
    const excess = g - Math.max(r, b);
    if (g > 100 && excess > 65) a = 0;
    else if (excess > 12 && g > 90) {
      a = Math.round(a * Math.max(0, 1 - (excess - 12) / 53));
      g = Math.min(g, Math.max(r, b) + 12);
    }
    pixels.set([r, g, b, a], dest);
    if (a > 32) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  }
  if (right <= left || bottom <= top) throw new Error(`Empty asset ${names[i]}`);
  const cropped = await sharp(pixels, { raw: { width, height, channels: 4 } }).extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).resize(240, 240, { fit: "inside" }).png().toBuffer();
  const result = await sharp(cropped).resize(240, 240, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await writeFile(join(destination, `${names[i]}.png`), result);
  manifest.push({ name: names[i], file: `${names[i]}.png`, width: 256, height: 256, sourceBounds: [x0 + left, y0 + top, right - left + 1, bottom - top + 1], bytes: result.length });
}
await writeFile(join(destination, "manifest.json"), JSON.stringify({ generator: "GPT built-in imagegen", atlas: "exec-7fd809df-cc12-44ef-8e5c-f6589e800050.png", processing: "User-authorized green chroma cutout. Uniform optical size, transparent PNG.", assets: manifest }, null, 2));
const evidence = resolve("../开发材料/prep-artifacts-frontend-20260906");
await copyFile(source, join(evidence, "gpt-asset-atlas-green.png"));
const composite = [];
for (let i = 0; i < names.length; i++) composite.push({ input: await sharp(join(destination, `${names[i]}.png`)).resize(160, 160).toBuffer(), left: (i % 4) * 192 + 16, top: Math.floor(i / 4) * 192 + 16 });
await sharp({ create: { width: 768, height: 384, channels: 4, background: "#f4f6fa" } }).composite(composite).png().toFile(join(evidence, "asset-cutout-contact-sheet.png"));
console.log(JSON.stringify(manifest, null, 2));
