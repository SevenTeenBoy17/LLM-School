import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import sharp from 'sharp';
import { groupFixture } from './research-groups-fixture.mjs';
import { APP_ROOT, RESULTS_DIR, assertNoHorizontalOverflow, launchManorBrowser } from './manor-v5-helpers.mjs';

const dir = join(RESULTS_DIR, 'dream-planet');
const texturePath = '/art/research-groups/planet-surface.webp';
const posterPath = '/art/research-groups/planet-poster.webp';
const groupName = '星球真实数据验收组';
const sampleMs = 3000;
const report = {
  startedAt: new Date().toISOString(), status: 'running', cases: [], checks: [], screenshots: [],
  samples: [], layouts: [], videos: [], errors: [], consoleErrors: [], requestFailures: [], diagnostics: [],
  sourceHashes: {}, environment: { node: process.version, platform: process.platform,
    executableOverride: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? null,
    browserPath: 'Existing isolated-fixture Playwright suite; Browser plugin skill not available',
    timingScope: 'Local headless browser observations, not cross-device or zero-drop guarantees', sampleMs,
    nativeFrameRate: { formula: 'nativeDrawsDelta / 3 / elapsedSeconds', highUpperFps: 65, lowUpperFps: 35,
      tolerance: '5fps above the nominal 60/30fps scheduler budgets' } },
};
let fixture, browser, snapshot, groupPath, taskId;
mkdirSync(dir, { recursive: true });
const sceneOf = page => page.getByTestId('research-group-scene');
const regionOf = page => page.getByRole('region', { name: '教研组成员星球', exact: true });
const pass = message => { report.checks.push(message); console.log(`PASS ${message}`); };

async function state(page, key, value) {
  await page.waitForFunction(({ key, value }) =>
    document.querySelector('[data-testid="research-group-scene"]')?.dataset[key] === value,
  { key, value }, { timeout: 25000 });
}

async function screenshot(page, name, region = false) {
  const path = join(dir, `${name}.png`);
  if (region) await regionOf(page).screenshot({ path, animations: 'allow' });
  else await page.screenshot({ path, fullPage: false, animations: 'allow' });
  report.screenshots.push(path);
}

async function instrument(context) {
  // Count actual GL submissions independently of the renderer's public diagnostics.
  await context.addInitScript(() => {
    window.__dreamPlanetQaDraws = new WeakMap();
    const methods = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'];
    const originals = [window.WebGLRenderingContext, window.WebGL2RenderingContext]
      .filter(Boolean).flatMap(Type => methods.filter(name => typeof Type.prototype[name] === 'function')
        .map(name => ({ proto: Type.prototype, name, original: Type.prototype[name] })));
    for (const { proto, name, original } of originals) proto[name] = function (...args) {
      const result = Reflect.apply(original, this, args);
      window.__dreamPlanetQaDraws.set(this.canvas, (window.__dreamPlanetQaDraws.get(this.canvas) ?? 0) + 1);
      return result;
    };
  });
  // The fixture source is immutable. Only dev HMR reloads are suppressed; API traffic stays real.
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
        initialHash ??= message.hash;
        message.hash = initialHash;
        socket.send(JSON.stringify(message)); return;
      }
      socket.send(raw);
    });
    socket.onMessage(raw => server.send(raw));
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    const businessApi = url.pathname.startsWith('/api/');
    if (businessApi && url.origin !== fixture.base) {
      report.errors.push({ safety: 'Non-fixture API request blocked', method: request.method(), url: request.url() });
      await route.abort('blockedbyclient'); return;
    }
    await route.fallback();
  });
}

async function open(page, { username = 'teacher', readOnly = false } = {}) {
  const login = await page.request.post(`${fixture.base}/api/auth/login`, {
    data: { username, password: 'Teacher@123' },
  });
  assert.equal(login.status(), 200, 'Real fixture login succeeds');
  if (readOnly) assert.equal((await page.request.post(`${fixture.base}/api/auth/switch-role`, {
    data: { role: 'teacher' },
  })).status(), 200);
  const started = performance.now();
  await page.goto(`${fixture.base}/research/prep`, { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/research/prep');
  await page.getByTestId('prep-workspace').getByRole('button', { name: '教研组', exact: true }).click();
  await page.getByRole('heading', { name: groupName, exact: true }).waitFor();
  await regionOf(page).waitFor();
  report.diagnostics.push({ pageTitle: await page.title(), openMs: performance.now() - started });
}

async function ready(page) {
  await sceneOf(page).scrollIntoViewIfNeeded();
  await state(page, 'modelState', 'ready');
  await sceneOf(page).locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="research-group-scene"] canvas');
    return canvas && Number(canvas.dataset.frames) > 0 && Number(canvas.dataset.drawCalls) > 0;
  });
  const framing = await sceneOf(page).evaluate(scene => {
    const box = scene.getBoundingClientRect();
    const diameter = parseFloat(getComputedStyle(scene).getPropertyValue('--planet-size'));
    return { diameter, width: box.width, height: box.height, viewportWidth: innerWidth, viewportHeight: innerHeight,
      centerX: box.x + box.width / 2, centerY: box.y + box.height / 2 };
  });
  assert.ok(Number.isFinite(framing.diameter) && framing.diameter > 0, 'Existing central diameter contract');
  const radius = framing.diameter * 0.62;
  assert.ok(framing.centerX - radius >= 0 && framing.centerX + radius <= framing.viewportWidth
    && framing.centerY - radius >= 0 && framing.centerY + radius <= framing.viewportHeight,
  `Full sphere and reserved star radius framed in viewport: ${JSON.stringify(framing)}`);
  report.diagnostics.push({ framing });
}

async function metrics(page) {
  const value = await sceneOf(page).locator('canvas').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    return { at: performance.now(), frames: canvas.dataset.frames, rotation: canvas.dataset.rotation,
      drawCalls: canvas.dataset.drawCalls, triangles: canvas.dataset.triangles, quality: canvas.dataset.quality, points: canvas.dataset.points,
      nativeDraws: window.__dreamPlanetQaDraws?.get(canvas) ?? 0,
      pixelWidth: canvas.width, pixelHeight: canvas.height, cssWidth: rect.width, cssHeight: rect.height,
      visibility: document.visibilityState };
  });
  for (const key of ['frames', 'rotation', 'drawCalls', 'triangles', 'points']) {
    assert.ok(value[key] !== undefined && value[key] !== '', `Canvas exposes ${key}`);
    value[key] = Number(value[key]);
    assert.ok(Number.isFinite(value[key]), `Finite renderer ${key}`);
  }
  assert.ok(Number.isInteger(value.frames) && value.frames > 0, 'Real rendered frame count');
  assert.ok(Number.isInteger(value.drawCalls) && value.drawCalls > 0 && value.drawCalls <= 12, `Draw budget: ${value.drawCalls}`);
  assert.ok(Number.isInteger(value.triangles) && value.triangles > 0 && value.triangles <= 15000, `Triangle budget: ${value.triangles}`);
  assert.ok(Number.isInteger(value.points) && value.points > 0 && value.points <= 150, `Star budget: ${value.points}`);
  assert.ok(['high', 'low'].includes(value.quality), `Known quality: ${value.quality}`);
  assert.ok(value.nativeDraws > 0, 'Instrumented native GL calls occurred');
  assert.ok(value.pixelWidth / value.cssWidth <= 1.5 + 1 / value.cssWidth, 'DPR width <= 1.5');
  assert.ok(value.pixelHeight / value.cssHeight <= 1.5 + 1 / value.cssHeight, 'DPR height <= 1.5');
  return value;
}

async function pixels(page, name) {
  const path = join(dir, `${name}-canvas.png`);
  const png = await sceneOf(page).locator('canvas').screenshot({ path, animations: 'allow' });
  report.screenshots.push(path);
  const meta = await sharp(png).metadata();
  // Interior disk excludes animated DOM portraits and peripheral stars from freeze comparisons.
  const size = Math.max(16, Math.floor(Math.min(meta.width, meta.height) * 0.3));
  const { data, info } = await sharp(png).extract({ left: Math.floor((meta.width - size) / 2),
    top: Math.floor((meta.height - size) / 2), width: size, height: size }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const values = [], colors = new Set();
  let colorful = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) > size * 0.46) continue;
    const offset = (y * size + x) * info.channels;
    const rgb = [...data.subarray(offset, offset + 3)];
    values.push(...rgb);
    colors.add(rgb.map(v => v >> 4).join(','));
    if (Math.max(...rgb) - Math.min(...rgb) >= 16) colorful++;
  }
  const mean = values.reduce((sum, n) => sum + n, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length);
  const stats = { colors: colors.size, colorfulFraction: colorful / (values.length / 3), deviation, cropSize: size };
  assert.ok(stats.colors >= 12 && stats.deviation > 8 && stats.colorfulFraction > 0.1,
    `Nonblank varied planet interior: ${JSON.stringify(stats)}`);
  return { data: Buffer.from(values), stats };
}

async function sample(page, label, moving, withPixels = true, upperFps = 65) {
  const beforePixels = withPixels ? await pixels(page, `${label}-before`) : null;
  const samples = [await metrics(page)];
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(sampleMs / 3);
    samples.push(await metrics(page));
  }
  const last = samples.at(-1), first = samples[0];
  const measured = { label, moving, elapsedMs: last.at - first.at, framesDelta: last.frames - first.frames,
    rotationDelta: last.rotation - first.rotation, nativeDrawsDelta: last.nativeDraws - first.nativeDraws,
    rendererSamples: samples, beforePixels: beforePixels?.stats };
  report.samples.push(measured);
  if (withPixels) {
    const after = await pixels(page, `${label}-after`);
    assert.equal(after.data.length, beforePixels.data.length, `${label}: stable planet dimensions`);
    let changed = 0, difference = 0;
    for (let i = 0; i < after.data.length; i++) {
      const delta = Math.abs(after.data[i] - beforePixels.data[i]);
      difference += delta;
      if (delta > 2) changed++;
    }
    measured.afterPixels = after.stats;
    measured.changedChannelFraction = changed / after.data.length;
    measured.meanAbsoluteDifference = difference / after.data.length;
    if (moving) assert.ok(measured.changedChannelFraction > 0.001, `${label}: actual planet pixels change`);
    else assert.equal(Buffer.compare(beforePixels.data, after.data), 0, `${label}: planet pixels freeze exactly`);
  }
  if (moving) {
    assert.ok(samples.every(entry => entry.drawCalls === 3), `${label}: three actual draw calls per frame for native-rate calculation`);
    measured.observedNativeFps = measured.nativeDrawsDelta / 3 / (measured.elapsedMs / 1000);
    measured.upperFps = upperFps;
    assert.ok(measured.observedNativeFps <= upperFps, `${label}: measured ${measured.observedNativeFps.toFixed(2)}fps <= ${upperFps}fps`);
    assert.ok(measured.framesDelta > 1, `${label}: rendered frames advance`);
    assert.notEqual(measured.rotationDelta, 0, `${label}: sphere rotation advances`);
    assert.ok(measured.nativeDrawsDelta > 1, `${label}: actual GL submissions advance`);
  } else {
    for (const observation of samples) {
      assert.equal(observation.frames, first.frames, `${label}: rendered frames freeze`);
      assert.equal(observation.rotation, first.rotation, `${label}: sphere rotation freezes`);
      assert.equal(observation.nativeDraws, first.nativeDraws, `${label}: native GL submissions freeze`);
    }
  }
  pass(`${label}: ${moving ? `moving at ${measured.observedNativeFps.toFixed(2)} native fps` : 'frozen'} in measured ${Math.round(measured.elapsedMs)}ms sample`);
}

async function layout(page, label) {
  const geometry = await sceneOf(page).evaluate(scene => {
    const box = scene.getBoundingClientRect();
    const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x - box.x, y: r.y - box.y, w: r.width, h: r.height }; };
    return { width: box.width, height: box.height,
      diameter: parseFloat(getComputedStyle(scene).getPropertyValue('--planet-size')),
      members: [...scene.querySelectorAll('[data-testid="roundtable-member"]')].map(el => {
      const name = el.querySelector('[class*="memberName"]');
      const label = el.querySelector('[class*="memberText"]');
      const portrait = el.querySelector('picture')?.parentElement;
      if (!name || !label || !portrait) throw new Error('Existing member selectors changed; confirm contract before editing tests');
      const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
      const textRects = [];
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(walker.currentNode);
        for (const r of range.getClientRects()) textRects.push({ x: r.x - box.x, y: r.y - box.y, w: r.width, h: r.height });
      }
      return { owner: el.dataset.owner === 'true', name: name.textContent, aria: el.getAttribute('aria-label'),
        portrait: rect(portrait), label: rect(label), nameBox: rect(name), textRects,
        clipped: name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1,
        tag: el.tagName, imageReady: [...el.querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0) };
    }) };
  });
  report.layouts.push({ label, ...geometry });
  const intersects = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
  const owner = geometry.members[0];
  assert.ok(owner?.owner && geometry.members.filter(m => m.owner).length === 1, `${label}: one owner is first`);
  assert.ok(Math.abs(owner.portrait.x + owner.portrait.w / 2 - geometry.width / 2) < 2, `${label}: owner centered north`);
  assert.ok(owner.portrait.y + owner.portrait.h / 2 < geometry.height / 2, `${label}: owner is above planet`);
  for (const [i, member] of geometry.members.entries()) {
    assert.equal(member.tag, 'BUTTON', `${label}: native member button`);
    assert.ok(snapshot.members.some(m => m.name === member.name), `${label}: real API full name`);
    assert.ok(member.aria.includes(member.name) && !member.clipped && member.imageReady, `${label}: complete name and portrait`);
    for (const area of [member.portrait, member.label]) {
      assert.ok(area.x >= -1 && area.y >= -1 && area.x + area.w <= geometry.width + 1
        && area.y + area.h <= geometry.height + 1, `${label}: members contained in scene`);
      for (const other of geometry.members.slice(i + 1)) for (const target of [other.portrait, other.label]) {
        assert.ok(!intersects(area, target), `${label}: portraits and labels do not overlap`);
      }
    }
    // Fixed-width label containers include transparent padding, so test painted text extents here.
    for (const area of [member.portrait, ...member.textRects]) {
      const nearestX = Math.max(area.x, Math.min(geometry.width / 2, area.x + area.w));
      const nearestY = Math.max(area.y, Math.min(geometry.height / 2, area.y + area.h));
      assert.ok(Math.hypot(nearestX - geometry.width / 2, nearestY - geometry.height / 2) >= geometry.diameter * 0.62 - 1,
        `${label}: reserved planet/star footprint stays clear of ${member.name}'s portrait and text`);
    }
  }
  await assertNoHorizontalOverflow(page, label);
  return geometry.members.map(m => m.name);
}

async function allMemberPages(page, label) {
  const previous = regionOf(page).getByRole('button', { name: '上一桌成员', exact: true });
  const next = regionOf(page).getByRole('button', { name: '下一桌成员', exact: true });
  const names = new Set();
  assert.ok(await previous.isDisabled(), `${label}: starts at first member page`);
  const width = await sceneOf(page).evaluate(el => el.getBoundingClientRect().width);
  assert.equal(await sceneOf(page).getByTestId('roundtable-member').count(), Math.min(width < 620 ? 4 : 8, snapshot.members.length),
    `${label}: four narrow or eight desktop seats`);
  for (let index = 0; index < snapshot.members.length; index++) {
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="roundtable-member"] img')]
      .every(img => img.complete && img.naturalWidth > 0));
    for (const name of await layout(page, `${label}-members-${index + 1}`)) names.add(name);
    if (names.has(fixture.names.at(-1))) await screenshot(page, `${label}-long-name`, true);
    if (await next.isDisabled()) break;
    await next.click();
  }
  assert.deepEqual([...names].sort(), snapshot.members.map(m => m.name).sort(), `${label}: every real member visible across pages`);
  for (let i = 0; i < snapshot.members.length && await previous.isEnabled(); i++) await previous.click();
  assert.ok(await previous.isDisabled());
  pass(`${label}: owner north, full names, pagination, image assets and no overlap/overflow`);
}

async function memberModal(page, name, { save = false, readOnly = false, label = 'member' } = {}) {
  const button = regionOf(page).getByRole('button', { name: `查看${name}的任务${name === snapshot.members.find(m => m.isOwner).name ? '，组长' : ''}`, exact: true });
  await button.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: `${name}的任务`, exact: true }).waitFor();
  await assertNoHorizontalOverflow(page, `${label}-dialog`);
  if (save || readOnly) {
    const checkbox = dialog.getByLabel('核对星球测试观察记录', { exact: true });
    if (readOnly) assert.ok(await checkbox.isDisabled(), 'Read-only task checkbox stays disabled');
    else {
      const prior = (await fixture.owner(groupPath)).body.tasks.find(t => t.id === taskId);
      await checkbox.setChecked(!prior.items[0].done);
      assert.equal((await fixture.owner(groupPath)).body.tasks.find(t => t.id === taskId).revision, prior.revision,
        'Unsaved checkbox does not mutate real API data');
      await dialog.getByRole('button', { name: '保存进度', exact: true }).click();
      const completed = prior.items[0].done ? 0 : 1;
      await dialog.getByText(`已保存 ${completed}/2 项`, { exact: true }).waitFor();
      assert.equal((await fixture.owner(groupPath)).body.tasks.find(t => t.id === taskId).completed, completed);
      assert.equal(await dialog.getByRole('progressbar', { name: `${name}已保存的任务进度` }).getAttribute('aria-valuenow'), String(completed));
    }
  }
  await screenshot(page, `${label}-dialog`);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden' });
  assert.ok(await button.evaluate(el => document.activeElement === el), 'Escape restores member focus');
  pass(`${label}: native keyboard member dialog, Escape focus restoration${save ? ' and real saved progress' : ''}`);
}

async function offscreen(page) {
  // Add only test-page scroll runway, then use real scrolling/IntersectionObserver (no visibility spoof).
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.id = 'dream-planet-qa-scroll-runway';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.height = `${innerHeight * 2}px`;
    document.body.prepend(spacer);
  });
  try {
    await sceneOf(page).scrollIntoViewIfNeeded();
    await state(page, 'motion', 'running');
    await page.locator('#dream-planet-qa-scroll-runway').evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
    assert.ok(await sceneOf(page).evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= innerHeight || r.bottom <= 0; }), 'Planet genuinely outside viewport');
    await state(page, 'motion', 'hidden');
    await page.waitForTimeout(1200);
    await sample(page, 'desktop-offscreen', false, false);
    await sceneOf(page).scrollIntoViewIfNeeded();
    await state(page, 'motion', 'running');
    const before = await metrics(page);
    await page.waitForFunction(frames => Number(document.querySelector('[data-testid="research-group-scene"] canvas')?.dataset.frames) > frames,
      before.frames);
    pass('Real offscreen scroll stops native draws and returning resumes renderer frames');
  } finally {
    await page.locator('#dream-planet-qa-scroll-runway').evaluate(el => el.remove());
  }
}

async function fallback(page, label) {
  await state(page, 'modelState', 'fallback');
  const poster = sceneOf(page).locator(`img[src="${posterPath}"]`);
  await poster.waitFor({ state: 'visible' });
  await poster.evaluate(image => image.decode());
  assert.ok(await poster.evaluate(image => image.complete && image.naturalWidth > 0), 'Fallback poster really loaded');
  await screenshot(page, label, true);
  await memberModal(page, fixture.names[0], { save: true, label });
  pass(`${label}: real poster and member progress still operable`);
}

async function runCase(name, options, check) {
  const started = performance.now(), context = await browser.newContext({ deviceScaleFactor: 1,
    reducedMotion: 'no-preference', ...options });
  let page;
  const result = { name, viewport: options.viewport, status: 'running' };
  report.cases.push(result);
  try {
    await instrument(context);
    page = await context.newPage();
    page.setDefaultTimeout(25000);
    page.on('pageerror', error => report.errors.push({ case: name, type: 'pageerror', message: error.message }));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ case: name, message: message.text() }); });
    page.on('requestfailed', request => report.requestFailures.push({ case: name, method: request.method(),
      path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
    await check(page, context);
    assert.ok(!report.errors.some(error => error.case === name), `${name}: no unhandled page errors`);
    const unexpectedConsoleErrors = report.consoleErrors.filter(error => error.case === name
      && !(name === 'texture-503' && /503/.test(error.message)));
    assert.deepEqual(unexpectedConsoleErrors, [], `${name}: no unexpected browser console errors`);
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.error = String(error.stack ?? error);
    report.errors.push({ case: name, type: 'assertion', message: result.error });
    console.error(`FAIL ${name}: ${error.message}`);
    if (page) await screenshot(page, `${name}-failure`).catch(() => {});
  } finally {
    result.elapsedMs = performance.now() - started;
    await context.close();
    if (options.recordVideo && page?.video()) {
      const rawPath = await page.video().path();
      const path = join(dir, 'planet-runtime-8s.mp4');
      // Trim the final eight seconds of actual browser video; never synthesize frames from screenshots.
      const encoded = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-8',
        '-i', rawPath, '-t', '8', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path],
      { encoding: 'utf8', windowsHide: true, timeout: 60000 });
      const video = { rawPath, path: encoded.status === 0 ? path : null, encodingExitCode: encoded.status,
        error: encoded.error?.message || encoded.stderr || null, source: 'Playwright real browser recording, final 8s of running scene' };
      if (encoded.status === 0) {
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=width,height', '-of', 'json', path],
          { encoding: 'utf8', windowsHide: true, timeout: 15000 });
        if (probe.status === 0) video.metadata = JSON.parse(probe.stdout);
      }
      report.videos.push(video);
    }
  }
}

try {
  for (const path of ['tests/dream-planet-ui.mjs', 'components/research/group-workspace/GroupScene.tsx',
    'components/research/group-workspace/PlanetScene.tsx', 'components/research/group-workspace/planetModel.ts',
    'components/research/group-workspace/group-workspace.module.css', `public${texturePath}`, `public${posterPath}`]) {
    const full = join(APP_ROOT, path);
    report.sourceHashes[path] = existsSync(full) ? createHash('sha256').update(readFileSync(full)).digest('hex') : 'MISSING';
  }
  const fixtureStarted = performance.now();
  fixture = await groupFixture();
  const origin = new URL(fixture.base);
  assert.equal(origin.hostname, '127.0.0.1');
  assert.notEqual(origin.port, '4921', 'Never write to live 4921');
  assert.ok(resolve(fixture.dbPath).startsWith(`${resolve(APP_ROOT, '../.agent-supervisor/research-snapshots')}${sep}`),
    'Only disposable snapshot database is accepted');
  report.environment.fixtureBase = fixture.base;
  report.environment.fixtureStartupMs = performance.now() - fixtureStarted;
  const created = await fixture.owner('/api/research-groups', 'POST', { name: groupName, subject: '科学' });
  assert.equal(created.status, 200);
  groupPath = `/api/research-groups/${created.body.group.id}`;
  for (const member of fixture.members) assert.equal((await member('/api/research-groups/join', 'POST', {
    inviteCode: created.body.inviteCode,
  })).status, 200);
  const assigned = await fixture.owner(groupPath, 'POST', { action: 'create-task', assigneeId: 'rg-test-0',
    title: '星球真实进度回归', dueDate: '', items: ['核对星球测试观察记录', '确认成员姓名完整'] });
  assert.equal(assigned.status, 200);
  snapshot = assigned.body;
  taskId = snapshot.tasks.find(t => t.assigneeId === 'rg-test-0').id;
  browser = await launchManorBrowser();
  report.environment.browserVersion = browser.version();

  await runCase('desktop', { viewport: { width: 1440, height: 1000 } }, async page => {
    await open(page); await screenshot(page, 'desktop-first-viewport'); await ready(page);
    await state(page, 'motion', 'running');
    await sample(page, 'desktop-running', true);
    await allMemberPages(page, 'desktop');
    await memberModal(page, fixture.names[0], { save: true, label: 'desktop' });
  });

  await runCase('desktop-pause', { viewport: { width: 1440, height: 1000 } }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'running');
    const pause = regionOf(page).getByRole('button', { name: '暂停星球动效', exact: true });
    assert.equal(await pause.evaluate(el => el.tagName), 'BUTTON');
    await pause.focus(); await page.keyboard.press('Enter');
    await state(page, 'motion', 'paused');
    await page.waitForTimeout(1200);
    await sample(page, 'desktop-paused', false);
    await regionOf(page).getByRole('button', { name: '播放星球动效', exact: true }).click();
    await state(page, 'motion', 'running');
  });

  await runCase('desktop-offscreen', { viewport: { width: 1440, height: 1000 } }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'running');
    await offscreen(page);
  });

  await runCase('list-mode-offscreen', { viewport: { width: 260, height: 500 } }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'running');
    assert.equal(await sceneOf(page).getByTestId('roundtable-member').count(), 0, 'Narrow layout moves members outside canvas viewport');
    assert.equal(await regionOf(page).getByTestId('roundtable-member').count(), 4, 'Actual narrow list retains member buttons');
    await page.evaluate(() => {
      const spacer = document.createElement('div');
      spacer.id = 'dream-planet-qa-list-runway';
      spacer.setAttribute('aria-hidden', 'true');
      spacer.style.height = `${innerHeight * 2}px`;
      document.body.append(spacer);
    });
    try {
      await regionOf(page).getByTestId('roundtable-member').last().evaluate(el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
      assert.ok(await sceneOf(page).evaluate(el => el.getBoundingClientRect().bottom <= 0), 'List-mode planet viewport genuinely offscreen');
      assert.ok(await regionOf(page).evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }),
        'Member region still intersects while its planet viewport is hidden');
      await state(page, 'motion', 'hidden'); await page.waitForTimeout(1200);
      await sample(page, 'list-mode-offscreen', false, false);
      await sceneOf(page).scrollIntoViewIfNeeded(); await state(page, 'motion', 'running');
      await sample(page, 'list-mode-resumed', true);
    } finally { await page.locator('#dream-planet-qa-list-runway').evaluate(el => el.remove()); }
  });

  await runCase('adaptive-low-quality', { viewport: { width: 1440, height: 1000 } }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'running');
    const workload = await page.evaluate(() => {
      const workload = { ticks: 0, stopped: false, raf: 0, startedAt: performance.now() };
      const tick = () => {
        if (workload.stopped || performance.now() - workload.startedAt > 12000) return;
        const until = performance.now() + 40;
        while (performance.now() < until) { /* Deliberate bounded CPU load, not fabricated renderer counters. */ }
        workload.ticks++;
        workload.raf = requestAnimationFrame(tick);
      };
      workload.raf = requestAnimationFrame(tick);
      window.__dreamPlanetQaLoad = workload;
      return { startedAt: workload.startedAt, maxMs: 12000, busyMsPerTick: 40 };
    });
    try {
      await page.waitForFunction(() => document.querySelector('[data-testid="research-group-scene"] canvas')?.dataset.quality === 'low',
        undefined, { timeout: 15000 });
    } finally {
      const stopped = await page.evaluate(() => {
        const load = window.__dreamPlanetQaLoad;
        load.stopped = true; cancelAnimationFrame(load.raf);
        return { ticks: load.ticks, elapsedMs: performance.now() - load.startedAt };
      });
      report.diagnostics.push({ adaptiveQualityCpuFault: { ...workload, ...stopped } });
    }
    await page.waitForTimeout(1200);
    assert.equal((await metrics(page)).quality, 'low', 'Renderer really selected low quality');
    await sample(page, 'adaptive-low-running', true, true, 35);
  });

  for (const [name, viewport] of [['mobile', { width: 390, height: 844 }], ['short', { width: 1440, height: 640 }]]) {
    await runCase(name, { viewport }, async page => {
      await open(page); await screenshot(page, `${name}-first-viewport`); await ready(page);
      await state(page, 'motion', 'running');
      await sample(page, `${name}-running`, true);
      await screenshot(page, `${name}-scene`, true);
      await allMemberPages(page, name);
      await memberModal(page, fixture.names[0], { label: name });
    });
  }

  await runCase('reduced-motion', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'reduced');
    const control = regionOf(page).getByRole('button', { name: /^(暂停|播放)星球动效$/ });
    assert.equal(await control.evaluate(el => el.tagName), 'BUTTON');
    assert.ok(await control.isDisabled(), 'Reduced-motion control is disabled');
    await page.waitForTimeout(1200);
    await sample(page, 'mobile-reduced', false);
    await memberModal(page, fixture.names[0], { label: 'reduced-motion' });
  });

  await runCase('context-loss', { viewport: { width: 1440, height: 1000 } }, async page => {
    await open(page); await ready(page);
    await sceneOf(page).locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('Real WEBGL_lose_context extension unavailable');
      extension.loseContext();
    });
    await fallback(page, 'context-loss');
  });

  await runCase('texture-503', { viewport: { width: 390, height: 844 } }, async (page, context) => {
    let requested = 0, release;
    const blocked = new Promise(done => { release = done; });
    await context.route(`**${texturePath}`, async route => {
      requested++;
      await blocked;
      await route.fulfill({ status: 503, contentType: 'text/plain', body: 'Planet texture unavailable (QA fault)' });
    });
    try {
      // Do not wait for networkidle while intentionally holding the texture request.
      assert.equal((await page.request.post(`${fixture.base}/api/auth/login`, {
        data: { username: 'teacher', password: 'Teacher@123' },
      })).status(), 200);
      await page.goto(`${fixture.base}/research/prep`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('prep-workspace').getByRole('button', { name: '教研组', exact: true }).click();
      await state(page, 'modelState', 'loading');
      await sceneOf(page).scrollIntoViewIfNeeded();
      await screenshot(page, 'texture-loading', true);
      await memberModal(page, fixture.names[0], { label: 'texture-loading' });
    } finally { release(); }
    await fallback(page, 'texture-503');
    assert.ok(requested > 0, '503 fault reached the actual texture request');
  });

  await runCase('member-permissions', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, async page => {
    await open(page, { username: 'rgtest0' }); await ready(page);
    assert.equal(await page.getByRole('button', { name: '邀请教师', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '分配任务', exact: true }).count(), 0);
    await memberModal(page, fixture.names[0], { save: true, label: 'member-permissions' });
  });

  await runCase('read-only', { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, async page => {
    await open(page, { readOnly: true }); await ready(page);
    await page.getByText(/当前为只读会话/).waitFor();
    assert.ok(await page.getByRole('button', { name: '分配任务', exact: true }).isDisabled());
    await memberModal(page, fixture.names[0], { readOnly: true, label: 'read-only' });
  });

  await runCase('runtime-video', { viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: join(dir, 'video-raw'), size: { width: 1440, height: 1000 } } }, async page => {
    await open(page); await ready(page); await state(page, 'motion', 'running');
    await screenshot(page, 'runtime-video-start', true);
    await page.waitForTimeout(8500);
    pass('Recorded 8.5 seconds of the real running fixture scene for an 8-second runtime video');
  });
  assert.deepEqual(report.errors, [], 'Every browser case must pass');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch (error) { report.errors.push({ cleanup: 'browser', message: String(error) }); process.exitCode = 1; }
  try { await fixture?.cleanup(); } catch (error) { report.errors.push({ cleanup: 'fixture', message: String(error) }); process.exitCode = 1; }
  if (process.exitCode) report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(dir, 'ui-report.json'), JSON.stringify(report, null, 2));
  console.log(`Dream planet UI: ${report.status}; report: ${join(dir, 'ui-report.json')}`);
}
