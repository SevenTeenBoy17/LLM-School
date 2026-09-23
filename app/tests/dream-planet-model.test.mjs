import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createPlanetGeometry, createStarField, PLANET, shouldAnimate } from '../components/research/group-workspace/planetModel.ts';
import { tableDimensions } from '../components/research/group-workspace/roundtableLayout.ts';

test('True 3D sphere has unit-radius vertices, UVs and bounded topology in both quality tiers', () => {
  for (const low of [false, true]) {
    const geometry = createPlanetGeometry(low);
    const p = geometry.getAttribute('position');
    assert.ok(geometry.index.count / 3 < 6000);
    for (let i = 0; i < p.count; i++) assert.ok(Math.abs(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) - 1) < 1e-6);
    assert.equal(geometry.getAttribute('uv').count, p.count);
    geometry.computeBoundingBox();
    assert.ok(geometry.boundingBox.max.z - geometry.boundingBox.min.z > 1.99, 'Not a flat billboard');
    geometry.dispose();
  }
});

test('Generated surface is provenance-bound and portable GLB embeds its image material', async () => {
  const root = new URL('../public/art/research-groups/', import.meta.url);
  const provenance = JSON.parse(readFileSync(new URL('planet-provenance.json', root)));
  const source = readFileSync(new URL('planet-surface-source.png', root));
  assert.equal(createHash('sha256').update(source).digest('hex'), provenance.sourceSha256);
  const texture = readFileSync(new URL('planet-surface.webp', root));
  const metadata = await sharp(texture).metadata();
  assert.equal(metadata.width, 2048); assert.equal(metadata.height, 1024);
  assert.ok(texture.length < 500000);
  const poster = await sharp(readFileSync(new URL('planet-poster.webp', root))).metadata();
  assert.ok(poster.hasAlpha, 'Transparent fallback keeps actual generated alpha');
  const glb = readFileSync(new URL('planet-model.glb', root));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF'); assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.length, glb.readUInt32LE(8));
  const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)).trim());
  assert.equal(json.meshes.length, 1); assert.equal(json.images.length, 1);
  const primitive = json.meshes[0].primitives[0];
  const position = json.accessors[primitive.attributes.POSITION];
  assert.ok(position.max.every((n, i) => n - position.min[i] > 1.99));
  assert.equal(json.materials[0].pbrMetallicRoughness.baseColorTexture.index, 0);
  assert.ok(glb.length < 800000);
});

test('Sparse deterministic stars remain inside member-clearance radius', () => {
  const stars = createStarField();
  assert.deepEqual(stars, createStarField());
  assert.equal(stars.positions.length, PLANET.stars * 3);
  for (let i = 0; i < PLANET.stars; i++) {
    const r = Math.hypot(stars.positions[i * 3], stars.positions[i * 3 + 1]);
    assert.ok(r >= 1.05 && r <= PLANET.starRadius);
  }
  for (const width of [240, 280, 320, 390, 619, 620, 800, 1200]) {
    const d = tableDimensions(width, width < 620);
    assert.ok(d.radius - d.portrait / 2 - d.diameter / 2 * PLANET.starRadius >= 13.9, `${width}: star/portrait clearance`);
  }
});

test('Pause, reduced motion, and hidden page independently stop animation', () => {
  for (const paused of [false, true]) for (const reduced of [false, true]) for (const visible of [false, true]) {
    assert.equal(shouldAnimate(paused, reduced, visible), !paused && !reduced && visible);
  }
});
