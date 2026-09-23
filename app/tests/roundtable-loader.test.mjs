import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Keep the lifecycle regression against the replacement texture loader.
const source = ts.createSourceFile('PlanetScene.tsx', readFileSync(new URL('../components/research/group-workspace/PlanetScene.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loader;
const containsLoader = node => (ts.isIdentifier(node) && node.text === 'createImageBitmap') || ts.forEachChild(node, containsLoader);
function visit(node) {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect' && containsLoader(node.arguments[0])) loader = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(loader, 'Exercise the production loader effect, not a test copy');
const effectCode = ts.transpileModule(`(${loader.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));

function harness(ok = true) {
  let resolveParse, rejectParse, signal;
  const timers = new Map();
  const calls = { ready: 0, failed: 0, textureDisposed: 0, bitmapClosed: 0 };
  class Texture { dispose() { calls.textureDisposed++; } }
  const bitmap = { close: () => calls.bitmapClosed++ };
  const effect = vm.runInNewContext(effectCode, {
    AbortController, Texture, SRGBColorSpace: 'srgb', RepeatWrapping: 1000, PLANET: { texture: '/surface.webp' },
    createImageBitmap: () => new Promise((resolve, reject) => { resolveParse = resolve; rejectParse = reject; }),
    fetch: async (_url, options) => { signal = options.signal; return { ok, status: ok ? 200 : 503, blob: async () => ({}) }; },
    setTimeout: (fn, delay) => { assert.equal(delay, 15000, 'Total load timeout stays at 15 seconds'); timers.set(1, fn); return 1; },
    clearTimeout: id => timers.delete(id),
    setTexture: () => calls.ready++, onError: () => calls.failed++,
  });
  const cleanup = effect();
  return { calls, cleanup, pending: () => timers.size,
    expire: () => { const timer = timers.get(1); timers.delete(1); timer?.(); },
    resolve: () => resolveParse(bitmap), reject: () => rejectParse(new Error('Invalid texture')), aborted: () => signal.aborted };
}

test('Timeout while decoding immediately selects fallback and closes a late bitmap', async () => {
  const h = harness();
  await tick();
  assert.equal(h.pending(), 1);
  h.expire();
  assert.equal(h.calls.failed, 1);
  assert.equal(h.aborted(), true);
  h.resolve();
  await tick();
  assert.deepEqual(h.calls, { ready: 0, failed: 1, textureDisposed: 0, bitmapClosed: 1 });
  h.cleanup();
});

test('Unmount aborts transport and closes a late bitmap without updating React', async () => {
  const h = harness();
  await tick();
  h.cleanup();
  assert.equal(h.pending(), 0, 'Unmount cancels the pending timeout');
  h.expire();
  h.resolve();
  await tick();
  assert.equal(h.aborted(), true);
  assert.deepEqual(h.calls, { ready: 0, failed: 0, textureDisposed: 0, bitmapClosed: 1 });
});

test('HTTP/decoder errors select fallback; successful textures and bitmaps are disposed', async () => {
  const transport = harness(false);
  await tick(); assert.equal(transport.calls.failed, 1);
  assert.equal(transport.pending(), 0, 'HTTP error clears the deadline'); transport.cleanup();
  const failed = harness();
  await tick();
  failed.reject();
  await tick();
  assert.equal(failed.calls.failed, 1);
  assert.equal(failed.pending(), 0, 'Decode rejection clears the deadline');
  failed.cleanup();
  const ready = harness();
  await tick();
  ready.resolve();
  await tick();
  assert.equal(ready.calls.ready, 1);
  assert.equal(ready.pending(), 0, 'Successful load cancels the timeout before unmount');
  ready.expire();
  assert.equal(ready.calls.failed, 0, 'A successful scene cannot fail later from the cancelled timer');
  ready.cleanup();
  assert.deepEqual(ready.calls, { ready: 1, failed: 0, textureDisposed: 1, bitmapClosed: 1 });
});
