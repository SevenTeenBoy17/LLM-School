import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { Scene, Mesh, MeshStandardMaterial } from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createPlanetGeometry, PLANET } from '../components/research/group-workspace/planetModel.ts';

const [source, poster] = process.argv.slice(2);
if (!source || !poster) throw new Error('Pass the GPT surface-map and transparent poster paths');
const out = resolve('public/art/research-groups');
await mkdir(out, { recursive: true });
await copyFile(source, resolve(out, 'planet-surface-source.png'));
await copyFile(poster, resolve(out, 'planet-poster-source.png'));
await sharp(source).resize(2048, 1024, { fit: 'fill' }).webp({ quality: 90, effort: 6 }).toFile(resolve(out, 'planet-surface.webp'));
await sharp(poster).resize(640, 640, { fit: 'contain', background: '#00000000' }).webp({ quality: 88, alphaQuality: 100, effort: 6 }).toFile(resolve(out, 'planet-poster.webp'));

// Export the same sphere used by R3F. Embed the generated material in a portable GLB.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.(); }); }
};
const scene = new Scene();
const body = new Mesh(createPlanetGeometry(), new MeshStandardMaterial({ roughness: 0.78, metalness: 0 }));
body.name = 'DreamPlanet';
scene.add(body);
const raw = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true }));
const jsonLength = raw.readUInt32LE(12);
const json = JSON.parse(raw.toString('utf8', 20, 20 + jsonLength));
const bin = raw.subarray(28 + jsonLength);
const texture = await sharp(source).resize(2048, 1024, { fit: 'fill' }).jpeg({ quality: 90 }).toBuffer();
const offset = Math.ceil(bin.length / 4) * 4;
const binary = Buffer.alloc(Math.ceil((offset + texture.length) / 4) * 4);
bin.copy(binary); texture.copy(binary, offset);
json.buffers[0].byteLength = binary.length;
json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: texture.length });
json.images = [{ bufferView: json.bufferViews.length - 1, mimeType: 'image/jpeg' }];
json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 }];
json.textures = [{ sampler: 0, source: 0 }];
json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
json.asset.extras = { source: 'Built-in GPT image generation', runtime: 'Same SphereGeometry + separate atmospheric and Points shaders', stars: PLANET.stars };
const jsonBuffer = Buffer.from(JSON.stringify(json));
const padded = Buffer.alloc(Math.ceil(jsonBuffer.length / 4) * 4, 32);
jsonBuffer.copy(padded);
const glb = Buffer.alloc(28 + padded.length + binary.length);
glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); padded.copy(glb, 20);
glb.writeUInt32LE(binary.length, 20 + padded.length); glb.writeUInt32LE(0x004e4942, 24 + padded.length); binary.copy(glb, 28 + padded.length);
await writeFile(resolve(out, 'planet-model.glb'), glb);
const bytes = await readFile(resolve(out, 'planet-surface.webp'));
const metadata = {
  generatedBy: 'GPT built-in imagegen', sourceSha256: createHash('sha256').update(await readFile(source)).digest('hex'),
  posterSha256: createHash('sha256').update(await readFile(poster)).digest('hex'),
  texture: { width: 2048, height: 1024, bytes: bytes.length },
  sphere: { widthSegments: 64, heightSegments: 40, triangles: body.geometry.index.count / 3, radius: 1 },
  modelBytes: glb.length, runtime: { meshes: 2, points: PLANET.stars, postprocessing: false, maxDpr: PLANET.maxDpr },
};
await writeFile(resolve(out, 'planet-provenance.json'), JSON.stringify(metadata, null, 2));
body.geometry.dispose(); body.material.dispose();
console.log(JSON.stringify(metadata, null, 2));
