import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'playwright/test';
import { launchManorBrowser, assertNoHorizontalOverflow } from './manor-v5-helpers.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const base = process.env.SCHOOL_RESOURCES_BASE_URL || 'http://127.0.0.1:4921';
const out = join(root, '.agent-supervisor/resources-v2-20260908/student-media'); mkdirSync(out, { recursive: true });
const fixtureReport = JSON.parse(readFileSync(join(root, '.agent-supervisor/resources-v2-20260908/media/browser-report.json')));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sources = ['components/school-resources/StudentResourceCenter.tsx', 'components/school-resources/DocumentMediaPreview.tsx', 'components/school-resources/document-media-preview.module.css', 'components/school-resources/school-resources.module.css', 'lib/school-resources/model.ts', 'lib/school-resources/documentPreview.ts', 'lib/school-resources/activityPackage.ts', 'app/(shell)/student/resources/page.tsx', 'tests/student-resource-media-ui.mjs'];
const hashes = () => Object.fromEntries(sources.map(file => [file, digest(readFileSync(join(root, 'app', file)))]));
const report = { startedAt: new Date().toISOString(), cwd: process.cwd(), command: 'node tests/student-resource-media-ui.mjs', collector: 'local-Playwright-student-integration', sourceBefore: hashes(), checks: [], fixtures: [], screenshots: [], errors: [], blockedMutations: [], externalRequests: [], limits: ['Requires the fixture-producing resource-document-preview.mjs --browser run first', 'Media playback uses actual native play() and currentTime, not a fabricated state', 'Local frontend, not server sharing or formal acceptance'] };
const chrome = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(p => join(p, 'Google/Chrome/Application/chrome.exe')).find(existsSync);
if (chrome) process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chrome;
let browser, context, page, center, preview;
async function setup() {
browser = await launchManorBrowser();
context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, reducedMotion: 'reduce' });
const login = await context.request.post(`${base}/api/auth/login`, { data: { username: 'student', password: 'Student@123' } }); assert.equal(login.status(), 200);
await context.route('**/*', route => {
  const request = route.request(), url = new URL(request.url());
  if (url.origin !== new URL(base).origin && ['http:', 'https:'].includes(url.protocol)) { report.externalRequests.push(url.origin); return route.abort(); }
  if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) { report.blockedMutations.push(url.pathname); return route.abort(); }
  return route.continue();
});
page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', error => report.errors.push(error.message));
center = page.getByTestId('student-resource-center');
preview = page.getByTestId('document-media-preview');
}
async function open(name) {
  const item = fixtureReport.fixtures.find(file => file.name === name); assert.ok(item, `Fixture missing: ${name}`);
  const bytes = readFileSync(item.file); assert.equal(digest(bytes), item.sha256); report.fixtures.push({ name, sha256: item.sha256 });
  await page.getByTestId('student-resource-file-input').setInputFiles({ name, mimeType: item.mimeType, buffer: bytes });
  await expect(center.getByRole('heading', { name, exact: true })).toBeVisible(); return bytes;
}
async function shot(name) { const path = join(out, `${name}.png`); await page.screenshot({ path, animations: 'disabled' }); report.screenshots.push({ path, sha256: digest(readFileSync(path)) }); }
async function check(id, run) { try { await run(); report.checks.push({ id, pass: true }); console.log('PASS', id); } catch (e) { report.checks.push({ id, pass: false, error: e.stack }); console.log('FAIL', id, e.stack); await shot(`${id}-failed`); } finally { if (await center.getByRole('button', { name: '关闭材料', exact: true }).count()) await center.getByRole('button', { name: '关闭材料', exact: true }).click(); } }
try {
  await setup();
  await page.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
  for (const [name, text, next] of [['local-text.docx', 'Hello local DOCX', null], ['ordered-slides.pptx', 'Slide 2 first paragraph', '下一幻灯片'], ['two-pages.pdf', 'PDF local page one', '下一页']]) {
    await check(name, async () => {
      await open(name); await expect(preview.getByTestId('document-preview-text')).toContainText(text);
      if (next) { await preview.getByRole('button', { name: next, exact: true }).click(); await expect(preview.getByTestId('document-preview-text')).toContainText(name.endsWith('pdf') ? 'PDF local page two' : 'Slide 1 first paragraph'); }
      await assertNoHorizontalOverflow(page, name); await shot(`student-${name}`); assert.equal(await page.evaluate(() => window.previewInjected), undefined);
    });
  }
  await check('student-raster-decoded', async () => { await open('local-raster.png'); const image = preview.locator('img'); await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(el => el.naturalWidth)).toBeGreaterThan(0); });
  for (const [name, tag] of [['local-tone.wav', 'audio'], ['local-video.webm', 'video']]) {
    await check(`student-${tag}-plays-and-closes`, async () => {
      await open(name); const media = preview.locator(tag); await expect(media).toBeVisible();
      assert.deepEqual(await media.evaluate(el => ({ controls: el.controls, autoplay: el.autoplay, paused: el.paused })), { controls: true, autoplay: false, paused: true });
      const handle = await media.elementHandle(); await media.evaluate(el => el.play()); await expect.poll(() => media.evaluate(el => el.currentTime)).toBeGreaterThan(0.05);
      await shot(`student-${tag}`); await center.getByRole('button', { name: '关闭材料', exact: true }).click();
      assert.deepEqual(await handle.evaluate(el => ({ connected: el.isConnected, paused: el.paused, src: el.getAttribute('src') })), { connected: false, paused: true, src: null }); await handle.dispose();
    });
  }
  for (const name of ['legacy.doc', 'legacy.ppt']) {
    await check(`student-${name}-fallback-download`, async () => {
      const bytes = await open(name); await expect(preview).toHaveAttribute('data-preview-kind', 'unsupported');
      const download = page.waitForEvent('download'); await center.getByRole('button', { name: '下载原文件', exact: true }).click(); const file = await download;
      assert.equal(await file.failure(), null); const path = join(out, name); await file.saveAs(path); assert.deepEqual(readFileSync(path), bytes);
      await expect(center.getByRole('status').filter({ hasText: '已生成原文件下载' })).toBeVisible(); await assertNoHorizontalOverflow(page, name);
    });
  }
  await check('student-corrupt-file-explicit-error', async () => { await open('corrupt.pdf'); await expect(preview).toHaveAttribute('data-preview-kind', 'error'); await expect(preview.getByRole('status')).toHaveText('无法读取文档内容，请核对文件格式；原文件仍可下载。'); });
  await check('student-no-remote-side-effects', async () => { assert.deepEqual(report.errors, []); assert.deepEqual(report.blockedMutations, []); assert.deepEqual(report.externalRequests, []); });
} catch (error) {
  report.checks.push({ id: 'setup-or-harness', pass: false, error: error.stack });
} finally {
  try { await context?.close(); } finally { await browser?.close(); }
  report.endedAt = new Date().toISOString(); report.sourceAfter = hashes(); report.sourceChanged = sources.filter(file => report.sourceBefore[file] !== report.sourceAfter[file]);
  report.passed = report.checks.filter(c => c.pass).length; report.failed = report.checks.filter(c => !c.pass).length;
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, sourceChanged: report.sourceChanged, out }));
}
process.exitCode = report.failed || report.sourceChanged.length ? 1 : 0;
