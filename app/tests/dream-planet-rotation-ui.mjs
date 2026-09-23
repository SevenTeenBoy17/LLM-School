import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { groupFixture } from './research-groups-fixture.mjs';
import { APP_ROOT, RESULTS_DIR, launchManorBrowser } from './manor-v5-helpers.mjs';

const dir = join(RESULTS_DIR, 'dream-planet', 'rotation');
const tau = Math.PI * 2;
const protectedSuite = 'tests/dream-planet-ui.mjs';
const expectedSuiteHash = '628fd4bab883ff87f64fbed6dd429023d27f608c2a7e498f5c68d64d0c96a682';
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const report = { startedAt: new Date().toISOString(), status: 'running', captures: [], samples: [],
  errors: [], consoleErrors: [], diagnostics: [], sourceHashes: {},
  environment: { viewport: { width: 1440, height: 1000 }, node: process.version,
    executable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? null,
    timing: 'Normal production animation speed, no clock manipulation, CPU load or renderer mutation',
    visualReview: 'Nonblank/geometry checks are automated; inspect saved images separately for longitude seam continuity' } };
let fixture, browser, page, context;
mkdirSync(dir, { recursive: true });
const scene = () => page.getByTestId('research-group-scene');
const canvas = () => scene().locator('canvas');

async function setupContext() {
  context = await browser.newContext({ viewport: report.environment.viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  await context.addInitScript(() => {
    window.__planetRotationDraws = new WeakMap();
    const names = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'];
    const originals = [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)
      .flatMap(Type => names.filter(name => typeof Type.prototype[name] === 'function')
        .map(name => ({ proto: Type.prototype, name, original: Type.prototype[name] })));
    for (const { proto, name, original } of originals) proto[name] = function (...args) {
      const value = Reflect.apply(original, this, args);
      window.__planetRotationDraws.set(this.canvas, (window.__planetRotationDraws.get(this.canvas) ?? 0) + 1);
      return value;
    };
  });
  // The source snapshot is fixed; suppress dev-only reload messages, never fixture API traffic.
  await context.routeWebSocket(/\/_next\/hmr(?:\?|$)/, socket => {
    const server = socket.connectToServer();
    let initialHash;
    server.onMessage(raw => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { socket.send(raw); return; }
      if (['reloadPage', 'serverComponentChanges'].includes(message.type)) {
        report.diagnostics.push({ devReloadSuppressed: message.type }); return;
      }
      if (message.type === 'sync' && message.hash) {
        initialHash ??= message.hash; message.hash = initialHash;
        socket.send(JSON.stringify(message)); return;
      }
      socket.send(raw);
    });
    socket.onMessage(raw => server.send(raw));
  });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/api/') && url.origin !== fixture.base) {
      report.errors.push({ safety: 'Blocked API outside disposable fixture', url: url.href });
      await route.abort('blockedbyclient'); return;
    }
    await route.fallback();
  });
  page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.errors.push({ type: 'pageerror', message: error.message }));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
}

async function metrics() {
  const data = await canvas().evaluate(el => {
    const scene = el.closest('[data-testid="research-group-scene"]');
    const r = el.getBoundingClientRect();
    return { at: performance.now(), frames: el.dataset.frames, rotation: el.dataset.rotation,
      drawCalls: el.dataset.drawCalls, triangles: el.dataset.triangles, points: el.dataset.points, quality: el.dataset.quality,
      nativeDraws: window.__planetRotationDraws.get(el) ?? 0, motion: scene.dataset.motion, model: scene.dataset.modelState,
      diameter: parseFloat(getComputedStyle(scene).getPropertyValue('--planet-size')),
      x: r.x, y: r.y, width: r.width, height: r.height, bufferWidth: el.width, bufferHeight: el.height,
      viewportWidth: innerWidth, viewportHeight: innerHeight, visibility: document.visibilityState };
  });
  for (const name of ['frames', 'rotation', 'drawCalls', 'triangles', 'points']) {
    assert.ok(data[name] !== undefined && data[name] !== '', `Missing actual renderer ${name}`);
    data[name] = Number(data[name]);
    assert.ok(Number.isFinite(data[name]), `Finite ${name}`);
  }
  assert.equal(data.model, 'ready'); assert.equal(data.motion, 'running'); assert.equal(data.visibility, 'visible');
  assert.ok(data.frames > 0 && data.nativeDraws > 0);
  assert.equal(data.drawCalls, 3, 'Three actual draws per sphere/atmosphere/stars frame');
  assert.ok(data.triangles > 0 && data.triangles <= 15000);
  assert.ok(data.points > 0 && data.points <= 150);
  assert.ok(['high', 'low'].includes(data.quality));
  assert.ok(Number.isFinite(data.diameter) && data.diameter > 0);
  assert.ok(data.bufferWidth / data.width <= 1.5 + 1 / data.width);
  assert.ok(data.bufferHeight / data.height <= 1.5 + 1 / data.height);
  const radius = data.diameter * 0.62, x = data.x + data.width / 2, y = data.y + data.height / 2;
  assert.ok(x - radius >= 0 && x + radius <= data.viewportWidth && y - radius >= 0 && y + radius <= data.viewportHeight,
    'Complete sphere and reserved star footprint remain in viewport');
  return data;
}

async function capture(label, targetRotation) {
  const before = await metrics();
  const canvasPath = join(dir, `${label}-canvas.png`);
  await canvas().screenshot({ path: canvasPath, animations: 'allow' });
  const box = await canvas().boundingBox();
  const side = Math.ceil(before.diameter * 1.3);
  const planetPath = join(dir, `${label}-planet.png`);
  const png = await page.screenshot({ path: planetPath, animations: 'allow', clip: {
    x: box.x + (box.width - side) / 2, y: box.y + (box.height - side) / 2, width: side, height: side,
  } });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = new Set();
  let colorful = 0, counted = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (Math.hypot(x - info.width / 2, y - info.height / 2) > before.diameter * 0.4) continue;
    const i = (y * info.width + x) * info.channels, rgb = [data[i], data[i + 1], data[i + 2]];
    counted++;
    colors.add(rgb.map(value => value >> 4).join(','));
    if (Math.max(...rgb) - Math.min(...rgb) >= 16) colorful++;
  }
  const row = Math.floor(info.height / 2), steps = [];
  for (let x = Math.floor(info.width / 2 - before.diameter * 0.3); x < info.width / 2 + before.diameter * 0.3; x++) {
    const i = (row * info.width + x) * info.channels;
    steps.push({ x: x - info.width / 2, rgbStep: (Math.abs(data[i] - data[i + info.channels])
      + Math.abs(data[i + 1] - data[i + info.channels + 1]) + Math.abs(data[i + 2] - data[i + info.channels + 2])) / 3 });
  }
  assert.ok(colors.size >= 12 && colorful / counted > 0.1, `${label}: nonblank colorful sphere interior`);
  const after = await metrics();
  const result = { label, targetRotation, beforeRotation: before.rotation, afterRotation: after.rotation,
    canvasPath, planetPath, canvasSha256: sha(canvasPath), planetSha256: sha(planetPath),
    captureElapsedMs: after.at - before.at, diameter: before.diameter,
    interiorColors: colors.size, colorfulFraction: colorful / counted,
    centerRowGradient: steps, metrics: after };
  report.captures.push(result);
  console.log(`CAPTURE ${label}: rotation ${before.rotation.toFixed(4)} -> ${after.rotation.toFixed(4)}; ${planetPath}`);
  return result;
}

try {
  assert.equal(sha(join(APP_ROOT, protectedSuite)), expectedSuiteHash, 'Preserve the previously measured 13-case test');
  for (const path of [protectedSuite, 'tests/dream-planet-rotation-ui.mjs',
    'components/research/group-workspace/GroupScene.tsx', 'components/research/group-workspace/PlanetScene.tsx',
    'components/research/group-workspace/planetModel.ts', 'components/research/group-workspace/group-workspace.module.css',
    'public/art/research-groups/planet-surface.webp']) report.sourceHashes[path] = sha(join(APP_ROOT, path));
  fixture = await groupFixture();
  assert.equal(new URL(fixture.base).hostname, '127.0.0.1');
  assert.notEqual(new URL(fixture.base).port, '4921');
  assert.ok(resolve(fixture.dbPath).startsWith(`${resolve(APP_ROOT, '../.agent-supervisor/research-snapshots')}${sep}`));
  report.environment.fixtureBase = fixture.base;
  const created = await fixture.owner('/api/research-groups', 'POST', { name: '星球整圈材质检查', subject: '科学' });
  assert.equal(created.status, 200);
  for (const member of fixture.members.slice(0, 7)) assert.equal((await member('/api/research-groups/join', 'POST', {
    inviteCode: created.body.inviteCode,
  })).status, 200);
  browser = await launchManorBrowser(); report.environment.browserVersion = browser.version();
  await setupContext();
  assert.equal((await page.request.post(`${fixture.base}/api/auth/login`, {
    data: { username: 'teacher', password: 'Teacher@123' },
  })).status(), 200);
  await page.goto(`${fixture.base}/research/prep`, { waitUntil: 'networkidle' });
  await page.getByTestId('prep-workspace').getByRole('button', { name: '教研组', exact: true }).click();
  await page.getByRole('region', { name: '教研组成员星球', exact: true }).waitFor();
  await scene().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const scene = document.querySelector('[data-testid="research-group-scene"]');
    return scene?.dataset.modelState === 'ready' && scene.dataset.motion === 'running'
      && Number(scene.querySelector('canvas')?.dataset.drawCalls) > 0;
  });
  const start = await metrics();
  report.samples.push(start);
  await capture('00-start', start.rotation);
  const targets = [1, 2, 3, 4].map(quarter => ({ label: `quarter-${quarter}`, rotation: start.rotation + quarter * Math.PI / 2 }));
  for (const [label, angle] of [['seam-pi-over-2', Math.PI / 2], ['seam-3pi-over-2', Math.PI * 1.5]]) {
    let front = angle;
    while (front <= start.rotation + 0.12) front += tau;
    for (const [suffix, offset] of [['approach', -0.12], ['front', 0], ['depart', 0.12]]) {
      if (front + offset <= start.rotation + tau) targets.push({ label: `${label}-${suffix}`, rotation: front + offset });
    }
  }
  targets.sort((a, b) => a.rotation - b.rotation);
  report.targets = targets;
  let previous = start;
  while (targets.length) {
    await page.waitForTimeout(500);
    const current = await metrics();
    assert.ok(current.rotation >= previous.rotation, 'Actual rotation never resets or moves backward');
    assert.ok(current.frames >= previous.frames && current.nativeDraws > previous.nativeDraws, 'Actual renderer stays continuously active');
    assert.equal(current.width, start.width); assert.equal(current.height, start.height); assert.equal(current.diameter, start.diameter);
    assert.ok(current.at - start.at <= 160000, 'Full real-time rotation completes within bounded wait');
    report.samples.push(current); previous = current;
    if (current.rotation >= targets[0].rotation) {
      const target = targets.shift();
      assert.ok(current.rotation - target.rotation < 0.12, `${target.label}: capture near requested longitude`);
      await capture(target.label, target.rotation);
    }
  }
  const end = await metrics();
  report.samples.push(end);
  const elapsedMs = end.at - start.at;
  report.rotation = { start: start.rotation, end: end.rotation, radians: end.rotation - start.rotation,
    turns: (end.rotation - start.rotation) / tau, elapsedMs,
    observedRadiansPerSecond: (end.rotation - start.rotation) / (elapsedMs / 1000),
    actualNativeDraws: end.nativeDraws - start.nativeDraws,
    observedNativeFps: (end.nativeDraws - start.nativeDraws) / 3 / (elapsedMs / 1000) };
  assert.ok(report.rotation.radians >= tau, 'Actual dataset proves at least one complete rotation');
  assert.ok(elapsedMs >= 75000, 'No accelerated clock/rotation used');
  assert.ok(report.rotation.observedRadiansPerSecond >= 0.06 && report.rotation.observedRadiansPerSecond <= 0.085,
    'Observed angular speed agrees with normal 0.075rad/s animation');
  assert.ok(report.rotation.observedNativeFps <= 65, 'Normal rendering remains bounded over complete rotation');
  assert.notEqual(report.captures[0].planetSha256, report.captures.find(c => c.label === 'quarter-2').planetSha256,
    'Opposite hemisphere changes actual captured pixels');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.consoleErrors, []);
  assert.equal(sha(join(APP_ROOT, protectedSuite)), expectedSuiteHash, 'Protected suite hash is unchanged');
  report.status = 'passed';
  console.log(`PASS actual full rotation: ${report.rotation.turns.toFixed(4)} turns in ${(elapsedMs / 1000).toFixed(2)}s; ${report.rotation.observedNativeFps.toFixed(2)} native fps`);
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error); process.exitCode = 1;
  console.error(report.error);
  if (page) await page.screenshot({ path: join(dir, 'failure.png'), fullPage: false }).catch(() => {});
} finally {
  try { await browser?.close(); } catch (error) { report.errors.push({ cleanup: 'browser', message: String(error) }); process.exitCode = 1; }
  try { await fixture?.cleanup(); } catch (error) { report.errors.push({ cleanup: 'fixture', message: String(error) }); process.exitCode = 1; }
  if (process.exitCode) report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(dir, 'rotation-report.json'), JSON.stringify(report, null, 2));
  console.log(`Rotation check ${report.status}: ${join(dir, 'rotation-report.json')}`);
}
