import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { tablePage, tableDimensions, seatPosition } from '../components/research/group-workspace/roundtableLayout.ts';

const members = count => Array.from({ length: count }, (_, i) => ({ userId: `teacher-${i}`, isOwner: i === count - 1, joinedAt: i, name: `Teacher ${i}` }));

test('Every member is reachable once, with owner pinned north on every page', () => {
  for (const count of [0, 1, 2, 4, 8, 11, 64]) for (const compact of [false, true]) {
    const all = members(count), first = tablePage(all, 0, compact), found = [];
    for (let page = 0; page < first.pages; page++) {
      const result = tablePage(all, page, compact);
      assert.ok(result.displayed.length <= result.capacity);
      if (count) assert.equal(result.displayed[0].userId, all.at(-1).userId);
      found.push(...result.displayed.filter(m => !m.isOwner).map(m => m.userId));
    }
    assert.equal(new Set(found).size, Math.max(0, count - 1));
    assert.equal(found.length, Math.max(0, count - 1));
    assert.equal(tablePage(all, 999, compact).page, first.pages - 1);
    assert.equal(tablePage(all, -3, compact).page, 0);
  }
});

test('Radial BOT positions clear the round edge and neighboring sprites at narrow and wide sizes', () => {
  for (const width of [240, 280, 320, 390, 619, 620, 800, 1200]) {
    const compact = width < 620, d = tableDimensions(width, compact);
    for (let count = 1; count <= (compact ? 4 : 8); count++) {
      const seats = Array.from({ length: count }, (_, i) => seatPosition(i, count, width, compact));
      assert.ok(Math.abs(seats[0].left - width / 2) < 0.01);
      assert.ok(seats[0].top < d.height / 2);
      for (const [i, s] of seats.entries()) {
        assert.ok(s.left - d.portrait / 2 >= 0 && s.left + d.portrait / 2 <= width);
        const distance = Math.hypot(s.left - width / 2, s.top - d.height / 2);
        assert.ok(distance - d.diameter / 2 - d.portrait / 2 >= 0, `${width}px table edge`);
        for (const other of seats.slice(i + 1)) assert.ok(Math.hypot(s.left - other.left, s.top - other.top) >= d.portrait + 8);
      }
    }
  }
});

test('GLB contains a solid tabletop and pedestal, no raster texture plane', () => {
  const glb = readFileSync(new URL('../public/art/research-groups/roundtable-pixel-v2.glb', import.meta.url));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  assert.equal(glb.readUInt32LE(4), 2);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)).trim());
  assert.equal(json.textures?.length ?? 0, 0);
  assert.equal(json.images?.length ?? 0, 0);
  assert.equal(json.meshes.length, 5);
  assert.ok(json.nodes.some(n => n.name === 'Pedestal'));
  const positions = json.meshes.flatMap(m => m.primitives.map(p => json.accessors[p.attributes.POSITION]));
  assert.ok(positions.every(a => a.max[1] > a.min[1]), 'Each mesh has actual Y thickness');
  const depth = Math.max(...positions.map(a => a.max[1])) - Math.min(...positions.map(a => a.min[1]));
  assert.ok(depth > 0.9);
  assert.ok(glb.length < 150000, 'Compact local geometry budget');
  const provenance = JSON.parse(readFileSync(new URL('../public/art/research-groups/roundtable-pixel-v2.json', import.meta.url)));
  assert.equal(provenance.grid, 32);
  assert.equal(provenance.palette.length, 5);
  assert.notEqual(provenance.cells[16][16], -1, 'Tabletop center is solid, not a hole');
});
