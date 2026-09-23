import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { chromium } from 'playwright';

const mode = process.argv[2];
const base = new URL(process.argv[3] || 'http://127.0.0.1:4972');
assert.ok(['demo', 'production'].includes(mode));
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname), 'Use an isolated local test server only');
assert.equal(process.env.EDUAI_RUN_RELEASE_SMOKE, '1', 'Explicit isolated-test opt-in required');
const root = path.resolve(import.meta.dirname, '..');
const env = parseEnv(readFileSync(path.join(root, '.env.local'), 'utf8'));
const output = path.join(root, 'test-results/source-release', mode);
mkdirSync(output, { recursive: true });
const cases = mode === 'production' ? [{ role: 'admin', username: env.EDUAI_BOOTSTRAP_ADMIN_USERNAME,
  password: env.EDUAI_BOOTSTRAP_ADMIN_PASSWORD, route: '/admin/permissions' }] : [
  { role: 'student', username: 'student', password: 'Student@123', route: '/student/manor' },
  { role: 'teacher', username: 'teacher', password: 'Teacher@123', route: '/knowledge/resources' },
  { role: 'admin', username: 'admin', password: 'Admin@123', route: '/admin/permissions' },
];
const result = { mode, ok: false, cases: [], pageErrors: [], assets: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const ready = await context.request.get(new URL('/api/health/ready', base).href);
  assert.equal(ready.status(), 200);
  assert.equal((await ready.json()).ok, true);
  assert.equal((await context.request.get(new URL('/api/auth/me', base).href)).status(), 401);
  for (const asset of ['/art/manor-v7/decorations.webp', '/3d/globe.glb', '/login-bg.mp4']) {
    const response = await context.request.head(new URL(asset, base).href);
    assert.equal(response.status(), 200, asset);
    result.assets.push({ path: asset, status: response.status() });
  }
  assert.equal((await context.request.get(new URL('/art/qq-farm/sprites/warehouse-chest.png', base).href)).status(), 404);
  await context.close();
  for (const account of cases) {
    assert.ok(account.username && account.password);
    const session = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await session.newPage();
    page.on('pageerror', error => result.pageErrors.push({ role: account.role, message: error.message }));
    await page.goto(new URL('/login', base).href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!(await page.getByPlaceholder('账号', { exact: true }).isVisible())) {
      await page.getByRole('button', { name: '登录', exact: true }).click();
    }
    await page.getByPlaceholder('账号', { exact: true }).fill(account.username);
    await page.getByPlaceholder('密码', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: '进入平台', exact: true }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 });
    // Read through Chrome: its loopback Secure-cookie policy differs from APIRequestContext.
    const me = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me');
      return { status: response.status, body: await response.json() };
    });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.role, account.role);
    const response = await page.goto(new URL(account.route, base).href, { waitUntil: 'networkidle', timeout: 90000 });
    assert.equal(response.status(), 200);
    assert.equal(new URL(page.url()).pathname, account.route);
    assert.ok((await page.locator('body').innerText()).length > 80);
    if (account.role === 'student') {
      const status = await page.evaluate(async () => (await fetch('/api/v2/manor/bootstrap')).status);
      assert.equal(status, 200);
    }
    await page.screenshot({ path: path.join(output, `${account.role}.png`), fullPage: true });
    result.cases.push({ role: account.role, login: 200, route: account.route, status: response.status() });
    await session.close();
  }
  assert.deepEqual(result.pageErrors, []);
  result.ok = true;
} finally {
  await browser.close();
  writeFileSync(path.join(output, 'report.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
