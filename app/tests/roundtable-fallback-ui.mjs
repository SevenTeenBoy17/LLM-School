import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { groupFixture } from './research-groups-fixture.mjs';
import { launchManorBrowser, RESULTS_DIR, assertNoHorizontalOverflow } from './manor-v5-helpers.mjs';

const dir = join(RESULTS_DIR, 'roundtable-pixel');
mkdirSync(dir, { recursive: true });
const report = { checks: [], screenshots: [], pageErrors: [], startedAt: new Date().toISOString() };
let f, browser;
const pass = message => { report.checks.push(message); console.log(`PASS ${message}`); };
async function open(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  page.on('pageerror', error => report.pageErrors.push(error.message));
  assert.ok((await page.request.post(`${f.base}/api/auth/login`, { data: { username: 'teacher', password: 'Teacher@123' } })).ok());
  await page.goto(`${f.base}/research/prep`, { waitUntil: 'networkidle' });
  await page.getByTestId('prep-workspace').getByRole('button', { name: '教研组', exact: true }).click();
  await page.getByRole('heading', { name: '像素圆桌验收组', exact: true }).waitFor();
  return page;
}
async function screenshot(page, name) {
  const path = join(dir, `${name}.png`);
  await page.getByRole('region', { name: '教研组成员星球', exact: true }).screenshot({ path });
  report.screenshots.push(path);
}
async function verifyFallback(page, reason) {
  const scene = page.getByTestId('research-group-scene');
  await scene.scrollIntoViewIfNeeded();
  await scene.locator('img[src$="planet-poster.webp"]').waitFor();
  await page.getByText('当前使用静态星球视图，成员与任务操作不受影响。', { exact: true }).waitFor();
  assert.equal(await scene.getAttribute('data-model-state'), 'fallback');
  assert.ok(await page.getByRole('button', { name: /暂停星球动效|播放星球动效/ }).isDisabled());
  const image = scene.locator('img[src$="planet-poster.webp"]');
  assert.ok(await image.evaluate(el => el.complete && el.naturalWidth > 0));
  await screenshot(page, reason);
  await page.getByRole('button', { name: '查看王思远的任务，组长', exact: true }).click();
  await page.getByRole('dialog').getByRole('heading', { name: '王思远的任务', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  pass(`${reason}: explicit fallback, disabled 3D view and operable member dialog`);
}
try {
  f = await groupFixture();
  const created = await f.owner('/api/research-groups', 'POST', { name: '像素圆桌验收组', subject: '科学' });
  assert.equal(created.status, 200);
  browser = await launchManorBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' });
  const page = await open(context);
  await page.getByTestId('research-group-scene').scrollIntoViewIfNeeded();
  await page.getByTestId('research-group-scene').locator('canvas').waitFor();
  await page.getByRole('button', { name: '暂停星球动效', exact: true }).waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="research-group-scene"]')?.dataset.modelState === 'ready');
  assert.ok(await page.getByRole('button', { name: '暂停星球动效', exact: true }).isEnabled(), 'Motion control is enabled before a WebGL fault');
  await screenshot(page, '01-single-owner');
  pass('Single owner anchored north with real sphere ready');

  // Trigger the browser's actual context-loss extension, not a mocked business API.
  await page.getByTestId('research-group-scene').locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context loss extension unavailable');
    extension.loseContext();
  });
  await verifyFallback(page, '02-webgl-context-lost');
  await context.close();

  const unavailable = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await unavailable.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).includes('webgl')) return null;
      return original.call(this, type, ...args);
    };
  });
  const unavailablePage = await open(unavailable);
  await verifyFallback(unavailablePage, '03-webgl-unavailable-mobile');
  await assertNoHorizontalOverflow(unavailablePage, 'WebGL fallback mobile');
  await unavailable.close();

  const rejected = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await rejected.route('**/art/research-groups/planet-surface.webp', route => route.fulfill({ status: 503, body: 'Material unavailable' }));
  const rejectedPage = await open(rejected);
  await verifyFallback(rejectedPage, '04-model-unavailable');
  await rejected.close();
  assert.deepEqual(report.pageErrors, []);
  pass('No unhandled browser errors across supported and degraded render paths');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error); throw error;
} finally {
  await browser?.close(); await f?.cleanup();
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(dir, 'fallback-report.json'), JSON.stringify(report, null, 2));
}
