import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const out = fileURLToPath(new URL('../public/art/school-resources/', import.meta.url));
const sources = [
  ['activity', process.argv[2]], ['media', process.argv[3]],
];
const entries = [];
for (const [name, source] of sources) {
  if (!source) throw new Error('Provide the two approved green-background GPT images.');
  const bytes = await readFile(source);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0, cleared = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4;
    const excess = data[i + 1] - Math.max(data[i], data[i + 2]);
    const alpha = data[i + 1] > 125 && excess > 70 ? Math.max(0, 255 - Math.round(excess / 150 * 255)) : 255;
    if (alpha < 255) data[i + 1] = Math.min(data[i + 1], Math.max(data[i], data[i + 2]) + 12);
    data[i + 3] = alpha;
    if (!alpha) cleared++;
    if (alpha > 20) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  if (left >= right || cleared < info.width * info.height * .1) throw new Error('Invalid chroma key.');
  const art = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 }).resize(280, 280, { fit: 'inside' }).png().toBuffer();
  const icon = await sharp({ create: { width: 320, height: 320, channels: 4, background: '#00000000' } })
    .composite([{ input: art, gravity: 'centre' }]).webp({ lossless: true }).toBuffer();
  await writeFile(`${out}${name}-source.png`, bytes);
  await writeFile(`${out}${name}.webp`, icon);
  entries.push({ name, source, sourceSize: [info.width, info.height], sourceSha256: createHash('sha256').update(bytes).digest('hex'), sha256: createHash('sha256').update(icon).digest('hex'), size: icon.length, cleared });
}
await writeFile(`${out}manifest-v2.json`, JSON.stringify({ generatedBy: 'Built-in GPT image generation, one asset per call', processing: 'User-requested green-key cutout, desaturated edge spill, lossless 320px WebP', entries }, null, 2));
console.log(JSON.stringify(entries));
