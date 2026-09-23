import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'playwright/test';
import { launchManorBrowser, assertNoHorizontalOverflow } from './manor-v5-helpers.mjs';

const base = process.env.SCHOOL_RESOURCES_BASE_URL || 'http://127.0.0.1:4921';
const run = new Date().toISOString().replace(/[:.]/g, '-');
const root = fileURLToPath(new URL('../../.agent-supervisor/resources-v2-20260908/activity-ui/', import.meta.url));
const out = join(root, run); mkdirSync(out, { recursive: true });
const report = { schema: 'ResourceActivityFlow/v1', at: new Date().toISOString(), base, checks: [], screenshots: [], pageErrors: [], blockedMutations: [], limits: ['Chrome desktop/mobile emulation only', 'Local file handoff, not server delivery', 'Learning note is learner-authored, not a verified grade'] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceFiles = ['lib/school-resources/model.ts', 'lib/school-resources/localRepository.ts', 'lib/school-resources/activityPackage.ts', 'lib/school-resources/activityExamples.ts', 'lib/school-resources/htmlRuntime.ts', 'lib/school-resources/documentPreview.ts', 'components/school-resources/SchoolResourceLibrary.tsx', 'components/school-resources/UploadResourceDialog.tsx', 'components/school-resources/ResourceDetail.tsx', 'components/school-resources/ActivityDistribution.tsx', 'components/school-resources/StudentResourceCenter.tsx', 'components/school-resources/HtmlActivityPlayer.tsx', 'components/school-resources/DocumentMediaPreview.tsx', 'components/school-resources/resource-player.module.css', 'components/school-resources/school-resources.module.css', 'app/(shell)/student/resources/page.tsx', 'next.config.ts', 'public/resource-runtime.html', 'tests/resource-activity-ui.mjs'];
const sourceHashes = () => Object.fromEntries(sourceFiles.map(file => [file, hash(readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url))))]));
report.sourceHashesBefore = sourceHashes();
const flush = () => { report.passed = report.checks.filter(x => x.status === 'passed').length; report.failed = report.checks.filter(x => x.status === 'failed').length; writeFileSync(join(root, 'latest.json'), JSON.stringify(report, null, 2)); writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2)); };
async function shot(page, name) { const path = join(out, `${name}.png`); await page.screenshot({ path, animations: 'disabled' }); report.screenshots.push({ name, path, sha256: hash(readFileSync(path)), viewport: page.viewportSize() }); }
async function check(id, page, fn) { try { const actual = await fn(); report.checks.push({ id, status: 'passed', actual }); console.log('PASS', id); } catch (e) { report.checks.push({ id, status: 'failed', error: e.stack }); console.log('FAIL', id, e.stack); await shot(page, `${id}-failed`).catch(() => {}); } flush(); }
const chrome = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean).map(p => join(p, 'Google/Chrome/Application/chrome.exe')).find(existsSync);
if (chrome) process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chrome;
const browser = await launchManorBrowser();
const contexts = [];
async function pageFor(role, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport, acceptDownloads: true, reducedMotion: 'reduce' }); contexts.push(context);
  const login = await context.request.post(`${base}/api/auth/login`, { data: { username: role, password: role === 'teacher' ? 'Teacher@123' : 'Student@123' } });
  assert.equal(login.status(), 200);
  await context.route('**/*', async route => {
    const req = route.request(); const url = new URL(req.url());
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) { report.blockedMutations.push({ path: url.pathname, method: req.method() }); await route.abort(); } else await route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.pageErrors.push(e.message));
  return page;
}
const fixture = Buffer.from('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{font:18px system-ui;padding:24px;background:#f3f8fa;color:#21343c}button{min-height:48px;padding:12px;font:inherit}output{display:block;font-size:28px;margin:18px}</style><h1>QA 课堂实验</h1><p>每次增加一份，观察数量。</p><button id="add">增加一份</button><output id="value">0</output><script>let n=0;document.getElementById("add").onclick=()=>document.getElementById("value").textContent=String(++n)</script></html>');
const title = 'QA 课堂互动实验';
const dialog = page => page.getByRole('dialog');
const player = page => page.getByTestId('html-activity-player');
const inner = page => page.frameLocator('iframe[src="/resource-runtime.html"]').frameLocator('iframe');
async function start(page) { await player(page).getByRole('button', { name: '开始活动', exact: true }).click(); await expect(player(page).getByRole('status')).toContainText('活动已加载'); }
async function download(page, button, filename) { const event = page.waitForEvent('download'); await button.click(); const result = await event; assert.equal(await result.failure(), null); const path = join(out, filename); await result.saveAs(path); return path; }
let packPath;
try {
  const teacher = await pageFor('teacher');
  await teacher.goto(`${base}/knowledge/resources`, { waitUntil: 'networkidle' });
  await check('F01-upload-actual-HTML-and-persist-byte-hash', teacher, async () => {
    await teacher.getByRole('button', { name: '上传资源', exact: true }).click();
    await teacher.getByTestId('resource-file-input').setInputFiles({ name: `${title}.html`, mimeType: 'text/html', buffer: fixture });
    await expect(dialog(teacher).getByRole('combobox', { name: '资源类型 1' })).toHaveValue('activity');
    await dialog(teacher).getByRole('combobox', { name: '资源类型 1' }).selectOption('lesson');
    await teacher.getByRole('combobox', { name: '上传资源学科' }).selectOption('数学'); await teacher.getByRole('combobox', { name: '上传资源年级' }).selectOption('四年级');
    await dialog(teacher).getByRole('checkbox').check(); await dialog(teacher).getByRole('button', { name: '保存本机草稿', exact: true }).click();
    await expect(dialog(teacher)).toHaveCount(0); await teacher.reload({ waitUntil: 'networkidle' });
    await teacher.getByRole('button', { name: `查看 ${title}`, exact: true }).click();
    await expect(dialog(teacher)).toContainText(hash(fixture));
    const path = await download(teacher, dialog(teacher).getByRole('button', { name: '下载 HTML', exact: true }), 'original.html');
    await expect(teacher.getByTestId('school-resource-library').getByRole('status').filter({ hasText: '离开平台后不再受隔离保护' })).toHaveCount(1);
    assert.deepEqual(readFileSync(path), fixture); return { hash: hash(fixture), bytes: fixture.length };
  });
  await check('F02-runtime-click-output-restart-stop', teacher, async () => {
    await start(teacher); await inner(teacher).getByRole('button', { name: '增加一份' }).click(); await expect(inner(teacher).locator('#value')).toHaveText('1');
    await shot(teacher, 'teacher-running-desktop');
    await player(teacher).getByRole('button', { name: '重新开始活动', exact: true }).click(); await expect(inner(teacher).locator('#value')).toHaveText('0');
    await player(teacher).getByRole('button', { name: '停止活动', exact: true }).click(); await expect(teacher.locator('iframe[src="/resource-runtime.html"]')).toHaveCount(0);
    await expect(player(teacher).getByRole('status')).toContainText('已停止');
  });
  await check('F03-teacher-package-export-real-content-no-send-claim', teacher, async () => {
    await dialog(teacher).getByRole('button', { name: '分享给学生', exact: true }).click();
    await teacher.getByRole('button', { name: '保存布置草稿', exact: true }).click(); await expect(dialog(teacher).getByRole('alert')).toContainText('活动任务');
    await teacher.getByRole('textbox', { name: '活动任务', exact: true }).fill('点击两次增加按钮，比较变化。');
    await teacher.getByRole('textbox', { name: '观察与反思问题', exact: true }).fill('数字变化说明了什么？请给出自己的依据。');
    await teacher.getByRole('button', { name: '保存布置草稿', exact: true }).click(); await expect(dialog(teacher).getByRole('status').filter({ hasText: '布置草稿' })).toContainText('尚未发送');
    packPath = await download(teacher, teacher.getByRole('button', { name: '导出活动包', exact: true }), 'lesson.eduactivity');
    const pack = JSON.parse(readFileSync(packPath, 'utf8')); assert.equal(pack.sha256, hash(fixture)); assert.deepEqual(Buffer.from(pack.base64, 'base64'), fixture);
    assert.equal(pack.brief.instructions, '点击两次增加按钮，比较变化。'); assert.equal(pack.studentId, undefined);
    await shot(teacher, 'teacher-distribution-draft');
    return { sha256: pack.sha256, exported: true, serverSent: false };
  });
  const student = await pageFor('student'); await student.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
  await check('F04-student-import-and-actual-interaction', student, async () => {
    assert.ok(packPath); await student.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await expect(student.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(student.getByTestId('student-resource-center')).toContainText('点击两次增加按钮');
    await expect(student.getByTestId('student-resource-center')).toContainText('发布者身份未由平台验证');
    await start(student); await inner(student).getByRole('button', { name: '增加一份' }).click(); await inner(student).getByRole('button', { name: '增加一份' }).click();
    await expect(inner(student).locator('#value')).toHaveText('2'); await shot(student, 'student-activity-desktop');
  });
  await check('F05-student-authored-note-persists-and-downloads', student, async () => {
    await student.getByRole('button', { name: '保存本机笔记' }).click(); await expect(student.getByTestId('student-resource-center').getByRole('alert')).toContainText('请先写下');
    await student.getByRole('textbox', { name: '我的观察与依据', exact: true }).fill('点击两次后显示 2，每次只增加 1。');
    await student.getByRole('textbox', { name: '我仍想弄懂的问题', exact: true }).fill('初始数量改变时会怎样？');
    await student.getByRole('button', { name: '保存本机笔记' }).click(); await expect(student.getByRole('status').filter({ hasText: '尚未提交给教师' })).toBeVisible();
    const recordPath = await download(student, student.getByRole('button', { name: '导出学习记录' }), 'student-note.md');
    const record = readFileSync(recordPath, 'utf8'); assert.ok(record.includes(hash(fixture))); assert.ok(record.includes('点击两次后显示 2')); assert.ok(record.includes('未获教师评价'));
    await student.reload({ waitUntil: 'networkidle' }); await student.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await expect(student.getByRole('textbox', { name: '我的观察与依据', exact: true })).toHaveValue('点击两次后显示 2，每次只增加 1。');
    return { bytes: Buffer.byteLength(record), sourceHash: hash(fixture) };
  });
  await check('F06-corrupted-package-is-rejected-no-runtime', student, async () => {
    await student.getByRole('button', { name: '关闭材料' }).click();
    const pack = JSON.parse(readFileSync(packPath, 'utf8')); pack.sha256 = '0'.repeat(64);
    await student.getByTestId('student-resource-file-input').setInputFiles({ name: 'tampered.eduactivity', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) });
    await expect(student.getByTestId('student-resource-center').getByRole('alert')).toContainText('校验不一致'); await expect(player(student)).toHaveCount(0);
  });
  await check('F07-missing-CSP-fails-closed', student, async () => {
    await student.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await student.route('**/resource-runtime.html', route => route.fulfill({ status: 200, body: '<html>no policy</html>', contentType: 'text/html' }));
    await player(student).getByRole('button', { name: '开始活动', exact: true }).click(); await expect(player(student).getByRole('status')).toContainText('安全配置缺失');
    await expect(student.locator('iframe')).toHaveCount(0); await student.unroute('**/resource-runtime.html');
  });
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const mobile = await pageFor('student', viewport); await mobile.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
    await check(`F08-student-layout-${viewport.width}`, mobile, async () => {
      await mobile.getByTestId('student-resource-file-input').setInputFiles(packPath); await start(mobile);
      await inner(mobile).getByRole('button', { name: '增加一份' }).click(); await expect(inner(mobile).locator('#value')).toHaveText('1');
      await assertNoHorizontalOverflow(mobile, 'student-resource'); await shot(mobile, `student-${viewport.width}`);
      await mobile.getByRole('textbox', { name: '我的观察与依据', exact: true }).fill('小屏幕也能完成活动。'); await mobile.getByRole('button', { name: '保存本机笔记' }).click();
      await expect(mobile.getByRole('status').filter({ hasText: '尚未提交给教师' })).toBeVisible();
    });
  }
  await check('F09-no-resource-server-mutations-or-uncaught-app-errors', student, async () => { assert.deepEqual(report.blockedMutations, []); assert.deepEqual(report.pageErrors, []); });
  const legacy = await pageFor('student');
  await legacy.addInitScript(() => { Object.defineProperty(AbortSignal, 'any', { value: undefined }); Object.defineProperty(AbortSignal, 'timeout', { value: undefined }); });
  await legacy.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
  await check('F10-compatible-cancellation-and-bounded-timeout', legacy, async () => {
    await legacy.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await start(legacy); await inner(legacy).getByRole('button', { name: '增加一份' }).click(); await expect(inner(legacy).locator('#value')).toHaveText('1');
    await player(legacy).getByRole('button', { name: '停止活动', exact: true }).click();
    await legacy.route('**/resource-runtime.html', () => {});
    await player(legacy).getByRole('button', { name: '开始活动', exact: true }).click();
    await expect(player(legacy).getByRole('status')).toContainText('正在检查');
    await player(legacy).getByRole('button', { name: '停止活动', exact: true }).click();
    await expect(player(legacy).getByRole('status')).toContainText('已停止');
    await player(legacy).getByRole('button', { name: '开始活动', exact: true }).click();
    await expect(player(legacy).getByRole('status')).toContainText('检查超时', { timeout: 12000 });
    await expect(legacy.locator('iframe[src="/resource-runtime.html"]')).toHaveCount(0);
    await legacy.unroute('**/resource-runtime.html');
    await start(legacy); await expect(inner(legacy).locator('#value')).toHaveText('0');
    assert.deepEqual(report.pageErrors, []);
  });
  const sample = await pageFor('student', { width: 390, height: 844 });
  await sample.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
  await check('F11-built-in-fractions-and-bottom-note-actions', sample, async () => {
    await sample.getByRole('button', { name: '试用分数互动示例' }).click(); await start(sample);
    await inner(sample).getByRole('button', { name: '第 1 份', exact: true }).click();
    await inner(sample).getByRole('button', { name: '第 2 份', exact: true }).click(); await expect(inner(sample).locator('#result')).toHaveText('2 / 4');
    await shot(sample, 'student-fractions-mobile');
    await inner(sample).getByRole('combobox', { name: '平均分成几份' }).selectOption('2');
    await inner(sample).getByRole('button', { name: '第 1 份', exact: true }).click(); await expect(inner(sample).locator('#result')).toHaveText('1 / 2');
    await sample.getByRole('textbox', { name: '我的观察与依据' }).fill('同一个整体，涂色 2/4 和 1/2 的面积相同。');
    await sample.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    const remove = sample.getByRole('button', { name: '移除本机笔记', exact: true }); await remove.scrollIntoViewIfNeeded();
    assert.equal(await remove.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), true);
    await shot(sample, 'student-note-actions-mobile');
  });
  await check('F12-missing-secure-crypto-clear-error-no-inert-buttons', sample, async () => {
    await sample.getByRole('button', { name: '关闭材料', exact: true }).click();
    await sample.evaluate(() => Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true }));
    await sample.getByRole('button', { name: '试用分数互动示例' }).click();
    await expect(sample.getByTestId('student-resource-center').getByRole('alert')).toContainText('HTTPS'); await expect(player(sample)).toHaveCount(0);
    await sample.getByTestId('student-resource-file-input').setInputFiles({ name: 'secure-check.html', mimeType: 'text/html', buffer: fixture });
    await expect(sample.getByTestId('student-resource-center').getByRole('alert')).toContainText('HTTPS');
    const insecureTeacher = await pageFor('teacher'); await insecureTeacher.goto(`${base}/knowledge/resources`, { waitUntil: 'networkidle' });
    await insecureTeacher.evaluate(() => Object.defineProperty(crypto, 'subtle', { value: undefined, configurable: true }));
    await insecureTeacher.getByRole('button', { name: '上传资源', exact: true }).click();
    await insecureTeacher.getByTestId('resource-file-input').setInputFiles({ name: 'secure-check.html', mimeType: 'text/html', buffer: fixture });
    await expect(dialog(insecureTeacher).getByRole('alert')).toContainText('HTTPS');
    await expect(dialog(insecureTeacher).getByRole('combobox', { name: '资源类型 1' })).toHaveCount(0); assert.deepEqual(report.pageErrors, []);
  });
  const tasks = await pageFor('student'); await tasks.goto(`${base}/student/resources`, { waitUntil: 'networkidle' });
  await check('F13-same-HTML-different-tasks-keep-separate-notes', tasks, async () => {
    const original = JSON.parse(readFileSync(packPath, 'utf8'));
    const changed = { ...original, id: crypto.randomUUID(), brief: { ...original.brief, instructions: '任务 B：比较不同初始值。' } };
    await tasks.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await tasks.getByRole('textbox', { name: '我的观察与依据' }).fill('任务 A 的观察'); await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click();
    await tasks.getByTestId('student-resource-file-input').setInputFiles({ name: 'second.eduactivity', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(changed)) });
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('');
    await tasks.getByRole('textbox', { name: '我的观察与依据' }).fill('任务 B 的观察'); await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click(); await tasks.reload({ waitUntil: 'networkidle' });
    await tasks.getByTestId('student-resource-file-input').setInputFiles(packPath); await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('任务 A 的观察');
  });
  await check('F14-dirty-note-link-and-reload-warning', tasks, async () => {
    await tasks.getByRole('textbox', { name: '我的观察与依据' }).fill('还没保存的想法');
    const firstDialog = tasks.waitForEvent('dialog'); const click = tasks.getByTestId('student-resource-center').getByRole('link', { name: '项目活动', exact: true }).click();
    const warning = await firstDialog; assert.equal(warning.type(), 'confirm'); assert.match(warning.message(), /尚未保存/); await warning.dismiss(); await click;
    assert.ok(tasks.url().endsWith('/student/resources')); await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('还没保存的想法');
    const beforeUnload = tasks.waitForEvent('dialog'); const reload = tasks.reload().catch(e => e);
    const reloadWarning = await beforeUnload; assert.equal(reloadWarning.type(), 'beforeunload'); await reloadWarning.dismiss(); await reload;
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('还没保存的想法');
    await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    await tasks.reload({ waitUntil: 'networkidle' }); await tasks.getByTestId('student-resource-file-input').setInputFiles(packPath);
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('还没保存的想法'); assert.deepEqual(report.pageErrors, []);
  });
  await check('F15-file-package-discriminant-prevents-overwrite', tasks, async () => {
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click();
    const pack = { ...JSON.parse(readFileSync(packPath, 'utf8')), id: 'file' };
    const raw = { name: 'same-file.html', mimeType: 'text/html', buffer: fixture };
    const namedFile = { name: 'named-file.eduactivity', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) };
    await tasks.getByTestId('student-resource-file-input').setInputFiles(raw);
    await tasks.getByRole('textbox', { name: '我的观察与依据' }).fill('普通文件笔记'); await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click(); await tasks.getByTestId('student-resource-file-input').setInputFiles(namedFile);
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('');
    await tasks.getByRole('textbox', { name: '我的观察与依据' }).fill('file 活动包笔记'); await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click();
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click(); await tasks.getByTestId('student-resource-file-input').setInputFiles(raw);
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('普通文件笔记');
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click(); await tasks.getByTestId('student-resource-file-input').setInputFiles(namedFile);
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('file 活动包笔记');
  });
  await check('F16-legacy-notes-restore-only-matching-task-and-upgrade', tasks, async () => {
    await tasks.getByRole('button', { name: '关闭材料', exact: true }).click();
    const pack = { ...JSON.parse(readFileSync(packPath, 'utf8')), id: 'legacy-task' };
    await tasks.evaluate(({ hash }) => {
      const key = Object.keys(localStorage).find(key => key.startsWith('eduai-resource-note-v3:') && key.endsWith(`:${hash}:file`));
      if (!key) throw new Error('Missing isolated test account key');
      const account = key.slice('eduai-resource-note-v3:'.length, -(`:${hash}:file`.length));
      localStorage.setItem(`eduai-resource-note-v1:${account}:${hash}`, JSON.stringify({ resourceHash: hash, packageId: 'legacy-task', observation: '旧版正确任务记录', question: '保留问题' }));
      localStorage.setItem(`eduai-resource-note-v2:${account}:${hash}:legacy-task`, JSON.stringify({ resourceHash: hash, packageId: 'different-task', observation: '不能串用', question: '' }));
    }, { hash: hash(fixture) });
    const legacyFile = { name: 'legacy.eduactivity', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) };
    await tasks.getByTestId('student-resource-file-input').setInputFiles(legacyFile);
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('旧版正确任务记录'); await expect(tasks.getByRole('textbox', { name: '我仍想弄懂的问题' })).toHaveValue('保留问题');
    await tasks.getByRole('button', { name: '保存本机笔记', exact: true }).click(); await tasks.getByRole('button', { name: '关闭材料', exact: true }).click();
    await tasks.evaluate(() => { for (const key of Object.keys(localStorage)) if (/^eduai-resource-note-v[12]:/.test(key)) localStorage.removeItem(key); });
    await tasks.getByTestId('student-resource-file-input').setInputFiles(legacyFile); await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue('旧版正确任务记录');
    tasks.once('dialog', dialog => dialog.accept()); await tasks.getByRole('button', { name: '移除本机笔记', exact: true }).click();
    await expect(tasks.getByRole('textbox', { name: '我的观察与依据' })).toHaveValue(''); assert.deepEqual(report.pageErrors, []);
  });
} finally { for (const context of contexts) await context.close(); await browser.close(); report.sourceHashesAfter = sourceHashes(); report.sourceChangedDuringRun = sourceFiles.filter(file => report.sourceHashesBefore[file] !== report.sourceHashesAfter[file]); flush(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, sourceChangedDuringRun: report.sourceChangedDuringRun, out })); }
process.exitCode = report.failed || report.sourceChangedDuringRun.length ? 1 : 0;
