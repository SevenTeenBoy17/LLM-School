import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const source = process.argv[2];
if (!source) throw new Error('Supply the GPT-generated green-screen blueprint path.');
const out = resolve('public/art/research-groups');
mkdirSync(out, { recursive: true });
const grid = 32;
const palette = ['#45666b', '#779a98', '#f8fbf9', '#e6f0f1', '#527b83'];
const rgb = palette.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const green = (r, g, b) => g > 150 && g > r * 1.4 && g > b * 1.4;
let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
  const i = (y * info.width + x) * 4;
  if (data[i + 3] > 128 && !green(...data.subarray(i, i + 3))) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
}
if (x1 <= x0 || y1 <= y0) throw new Error('Blueprint silhouette is empty.');
const pixels = await sharp(source).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
  .resize(grid, grid, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer();
const cells = Array.from({ length: grid }, () => Array(grid).fill(-1));
const preview = Buffer.alloc(grid * grid * 4);
for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
  const i = (y * grid + x) * 4, color = [...pixels.subarray(i, i + 3)];
  if (pixels[i + 3] < 128 || green(...color)) continue;
  const distances = rgb.slice(0, 4).map(candidate => candidate.reduce((sum, c, k) => sum + (c - color[k]) ** 2, 0));
  const index = distances.indexOf(Math.min(...distances));
  cells[y][x] = index;
  preview.set([...rgb[index], 255], i);
}

// Merge horizontal runs into solid boxes: the model is geometry, never a texture plane.
const parts = palette.map(() => []);
const pixel = 2 / grid;
for (let y = 0; y < grid; y++) for (let x = 0; x < grid;) {
  const index = cells[y][x];
  if (index < 0) { x++; continue; }
  let end = x + 1;
  while (end < grid && cells[y][end] === index) end++;
  const box = new BoxGeometry((end - x) * pixel, 0.16, pixel);
  box.translate((x + end) / grid - 1, 0.12, (y + 0.5) * pixel - 1);
  parts[index].push(box);
  x = end;
}
const addBox = (w, h, d, x, y, z) => {
  const box = new BoxGeometry(w, h, d); box.translate(x, y, z); parts[4].push(box);
};
addBox(0.375, 0.64, 0.375, 0, -0.28, 0);
addBox(1.125, 0.125, 0.375, 0, -0.6625, 0);
addBox(0.375, 0.125, 1.125, 0, -0.6625, 0);
const model = new Group(); model.name = 'PixelRoundtable';
let triangles = 0;
for (let i = 0; i < parts.length; i++) {
  if (!parts[i].length) continue;
  const geometry = mergeGeometries(parts[i]);
  triangles += geometry.index.count / 3;
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ color: palette[i] }));
  mesh.name = ['Outline', 'TealRim', 'InsetLine', 'MistTop', 'Pedestal'][i];
  model.add(mesh);
  parts[i].forEach(part => part.dispose());
}
// Three's exporter uses the browser FileReader interface for Blob serialization.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const glb = await new GLTFExporter().parseAsync(model, { binary: true });
writeFileSync(join(out, 'roundtable-pixel-v2.glb'), Buffer.from(glb));
copyFileSync(source, join(out, 'roundtable-pixel-source.png'));
await sharp(preview, { raw: { width: grid, height: grid, channels: 4 } })
  .resize(512, 512, { kernel: 'nearest' }).png().toFile(join(out, 'roundtable-pixel-v2.png'));
const report = { sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'), grid, palette,
  occupiedPixels: cells.flat().filter(c => c >= 0).length, triangles, meshes: model.children.length,
  glbBytes: glb.byteLength, dimensions: { x: 2, y: 0.925, z: 2 }, textureCount: 0,
  method: 'GPT blueprint chroma-key, nearest-neighbor sampling, palette quantization, solid run extrusion plus pedestal; Three.js GLTFExporter', cells };
writeFileSync(join(out, 'roundtable-pixel-v2.json'), JSON.stringify(report, null, 2));
model.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
console.log(JSON.stringify({ ...report, cells: undefined }, null, 2));
