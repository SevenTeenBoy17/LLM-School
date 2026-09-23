import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { groupFixture } from "./research-groups-fixture.mjs";
import { launchManorBrowser, assertNoHorizontalOverflow, RESULTS_DIR } from "./manor-v5-helpers.mjs";

const dir = join(RESULTS_DIR, "research-groups"); mkdirSync(dir, { recursive: true });
const report = { checks: [], screenshots: [], pageErrors: [], diagnostics: [], startedAt: new Date().toISOString() };
const pass = s => { console.log(`PASS ${s}`); report.checks.push(s); };
let f, browser, page;
async function shot(name) { const path = join(dir, `${name}.png`); await page.screenshot({ path, fullPage: true }); report.screenshots.push(path); }
async function openGroups(p) {
  await p.goto(`${f.base}/research/prep`, { waitUntil: "networkidle" });
  await p.getByTestId("prep-workspace").getByRole("button", { name: "教研组", exact: true }).click();
  return p.getByTestId("research-group-workspace");
}
async function tablePixels(p) {
  const scene = p.getByTestId("research-group-scene");
  const size = await scene.evaluate(el => Math.ceil(parseFloat(el.style.getPropertyValue('--planet-size')) + 16));
  const png = await scene.locator('canvas').screenshot();
  const metadata = await sharp(png).metadata();
  // Compare the model area only: animated DOM BOTs intentionally keep moving around it.
  const { data, info } = await sharp(png).extract({ left: Math.floor((metadata.width - size) / 2), top: Math.floor((metadata.height - size) / 2), width: size, height: size }).raw().toBuffer({ resolveWithObject: true });
  // Diagonal avatars can enter the crop's corners, but never the table's circular footprint.
  const radius = size / 2 - 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.hypot(x - size / 2, y - size / 2) > radius) data.fill(0, (y * size + x) * info.channels, (y * size + x + 1) * info.channels);
  }
  return data;
}
async function assertSeats(p, label) {
  const metrics = await p.getByTestId('research-group-scene').evaluate(scene => {
    const box = scene.getBoundingClientRect(), rect = el => {
      const r = el.getBoundingClientRect(); return { x: r.x - box.x, y: r.y - box.y, w: r.width, h: r.height };
    };
    return { width: box.width, height: box.height, members: [...scene.querySelectorAll('[data-testid="roundtable-member"]')].map(el => ({
      owner: el.dataset.owner === 'true', portrait: rect(el.querySelector('picture').parentElement),
      label: rect(el.querySelector('[class*="memberText"]')),
    })) };
  });
  const intersects = (a, b) => a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1;
  assert.ok(metrics.members.length > 0, `${label}: radial members exist`);
  assert.ok(metrics.members[0].owner, `${label}: owner stays first`);
  for (const [i, member] of metrics.members.entries()) for (const area of [member.portrait, member.label]) {
    assert.ok(area.x >= -1 && area.y >= -1 && area.x + area.w <= metrics.width + 1 && area.y + area.h <= metrics.height + 1, `${label}: full labels and portraits contained`);
    for (const other of metrics.members.slice(i + 1)) for (const target of [other.portrait, other.label]) assert.ok(!intersects(area, target), `${label}: members do not overlap`);
  }
  report.checks.push(`${label}: ${metrics.members.length} radial seats and full names contained without overlap`);
}
async function nonblankCanvas(p) {
  const canvas = p.getByTestId("research-group-workspace").locator("canvas").first();
  await canvas.waitFor({ state: "visible" });
  await p.waitForTimeout(500);
  const png = await canvas.screenshot();
  const stats = await sharp(png).stats();
  assert.ok(stats.channels.slice(0, 3).some(c => c.stdev > 12), "Canvas must contain visible table pixels");
  return canvas;
}
async function freezeDevReloads(context) {
  await context.routeWebSocket(/\/_next\/hmr\?/, socket => {
    const server = socket.connectToServer();
    let initialHash;
    server.onMessage(raw => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { socket.send(raw); return; }
      if (message.type === "reloadPage" || message.type === "serverComponentChanges") {
        report.diagnostics.push({ developmentOnlyReloadSuppressed: message.type }); return;
      }
      if (message.type === "sync" && message.hash) {
        initialHash ??= message.hash;
        if (message.hash !== initialHash) report.diagnostics.push({ developmentOnlyHashReloadSuppressed: true });
        message.hash = initialHash;
        socket.send(JSON.stringify(message)); return;
      }
      socket.send(raw);
    });
    socket.onMessage(raw => server.send(raw));
  });
}
try {
  f = await groupFixture();
  browser = await launchManorBrowser();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "no-preference" });
  // Source is frozen in this fixture. Disable only Next's dev-only HMR transport;
  // all authentication/group/database traffic remains real and unmodified.
  await freezeDevReloads(context);
  page = await context.newPage(); page.setDefaultTimeout(25000);
  page.on("pageerror", e => report.pageErrors.push(e.message));
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) report.diagnostics.push({ navigation: frame.url(), at: new Date().toISOString() }); });
  page.on("console", msg => { if (/Fast Refresh|reload|identity/i.test(msg.text())) report.diagnostics.push({ console: msg.text(), at: new Date().toISOString() }); });
  page.on("response", async response => { if (response.url().endsWith("/api/auth/me")) { const value = await response.json().catch(() => ({})); report.diagnostics.push({ auth: value.user?.id, version: value.user?.sessionVersion, at: new Date().toISOString() }); } });
  assert.ok((await page.request.post(`${f.base}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" } })).ok());
  let group = await openGroups(page);
  const memberContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await freezeDevReloads(memberContext);
  const memberPage = await memberContext.newPage(); memberPage.setDefaultTimeout(25000);
  memberPage.on("pageerror", e => report.pageErrors.push(e.message));
  assert.ok((await memberPage.request.post(`${f.base}/api/auth/login`, { data: { username: "rgtest0", password: "Teacher@123" } })).ok());
  const memberGroup = await openGroups(memberPage);
  await memberGroup.getByRole("heading", { name: "开始本组的备课协作" }).waitFor();
  // Warm both SSR clients before assertions; dev compilation can refresh an existing page.
  await page.bringToFront();
  await page.getByTestId("prep-workspace").getByRole("button", { name: "教研组", exact: true }).click();
  await group.getByRole("heading", { name: "开始本组的备课协作" }).waitFor();
  await group.getByRole("button", { name: "创建教研组", exact: true }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("教研组名称", { exact: true }).fill("科学教研组 · 校园节水项目");
  await dialog.getByLabel("学科 / 教研主题", { exact: true }).fill("科学与跨学科实践");
  await dialog.getByRole("button", { name: "创建教研组", exact: true }).click();
  await group.getByRole("heading", { name: "科学教研组 · 校园节水项目", exact: true }).waitFor();
  const index = (await f.owner("/api/research-groups")).body;
  const gid = index.groups[0].id, path = `/api/research-groups/${gid}`;
  let snapshot = (await f.owner(path)).body;
  await memberPage.bringToFront();
  await memberGroup.getByRole("button", { name: "加入教研组", exact: true }).click();
  await memberPage.getByRole("dialog").getByLabel("邀请码", { exact: true }).fill(snapshot.inviteCode);
  await memberPage.getByRole("dialog").getByRole("button", { name: "加入教研组", exact: true }).click();
  await memberGroup.getByRole("heading", { name: snapshot.group.name, exact: true }).waitFor();
  assert.equal(await memberGroup.getByRole("button", { name: "邀请教师", exact: true }).count(), 0);
  assert.equal(await memberGroup.getByRole("button", { name: "分配任务", exact: true }).count(), 0);
  for (const member of f.members.slice(1)) assert.equal((await member("/api/research-groups/join", "POST", { inviteCode: snapshot.inviteCode })).status, 200);
  await page.bringToFront();
  report.diagnostics.push({ ownerIdentity: await (await page.request.get(`${f.base}/api/auth/me`)).json(), selectedTab: await page.getByTestId("prep-workspace").locator('nav button[aria-current="page"]').textContent() });
  await group.getByRole("button", { name: "重新同步教研组", exact: true }).click();
  await group.getByText("第 1 组成员 / 共 2 组", { exact: false }).waitFor();
  pass("Two browser identities create/join a real group; member UI cannot invite or assign; ten teachers appear via refresh");

  await group.getByRole("button", { name: "分配任务", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("任务名称", { exact: true }).fill("梳理校园节水的观察证据");
  await dialog.getByLabel("负责人", { exact: true }).selectOption("rg-test-0");
  await dialog.getByLabel("截止日期", { exact: false }).fill("2026-09-30");
  await dialog.getByLabel("检查项", { exact: true }).fill("汇总各小组观察记录\n核对用水单位与异常值\n形成共备讨论的问题清单");
  await shot("03-assign-task");
  await dialog.getByRole("button", { name: "分配任务", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  snapshot = (await f.owner(path)).body;
  const task = snapshot.tasks[0]; assert.equal(task.total, 3); assert.equal(task.completed, 0);
  for (let i = 1; i < 5; i++) assert.equal((await f.owner(path, "POST", { action: "create-task", title: ["", "设计探究活动与分组支架", "收集课堂观察量规", "准备试教材料与学习单", "整理共识与下一轮改进"][i], assigneeId: `rg-test-${i}`, dueDate: "2026-09-30", items: ["准备初稿", "完成组内核对"] })).status, 200);
  await group.getByRole("button", { name: "重新同步教研组", exact: true }).click();
  await group.getByRole("button", { name: /查看林清和的任务/ }).waitFor();
  await assertNoHorizontalOverflow(page, "group desktop");
  await nonblankCanvas(page);
  await assertSeats(page, 'Desktop');
  await shot("01-roundtable-desktop");
  assert.equal(await group.getByTestId("research-group-scene").getAttribute("data-model-state"), "ready");
  const before = await tablePixels(page);
  await page.waitForTimeout(800);
  assert.notEqual(Buffer.compare(before, await tablePixels(page)), 0, "Real sphere rotates visibly");
  await group.getByRole("button", { name: "暂停星球动效", exact: true }).click();
  await page.waitForTimeout(150);
  const paused = await tablePixels(page);
  await page.waitForTimeout(400);
  assert.equal(Buffer.compare(paused, await tablePixels(page)), 0, "Pause holds exact central sphere pixels");
  await shot("11-dream-planet-paused");
  await group.getByRole("button", { name: "播放星球动效", exact: true }).click();
  assert.ok(await group.locator('img[src*="/bots/"]').evaluateAll(nodes => nodes.every(n => n.complete && n.naturalWidth > 0)));
  pass("Actual task assignment, nonblank real sphere, rotation and exact pause; all BOT assets render");

  const memberButton = group.getByRole("button", { name: /查看林清和的任务/ });
  await memberButton.hover();
  assert.ok(await memberButton.getByText("查看任务", { exact: true }).isVisible());
  await memberButton.focus(); await page.keyboard.press("Enter");
  dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "林清和的任务", exact: true }).waitFor();
  await dialog.getByLabel("汇总各小组观察记录", { exact: true }).check();
  assert.equal((await f.owner(path)).body.tasks.find(t => t.id === task.id).completed, 0);
  await dialog.getByRole("button", { name: "保存进度", exact: true }).click();
  await dialog.getByText("已保存 1/3 项", { exact: true }).waitFor();
  assert.equal(await dialog.getByRole("progressbar", { name: "林清和已保存的任务进度" }).getAttribute("aria-valuenow"), "1");
  await shot("02-member-task-dialog");
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  assert.ok(await memberButton.evaluate(el => document.activeElement === el));
  pass("Hover detail, keyboard open, centered full-name dialog, explicit saved progress and Escape focus restoration");

  await memberButton.click(); dialog = page.getByRole("dialog");
  await dialog.getByLabel("核对用水单位与异常值", { exact: true }).check();
  await memberPage.bringToFront();
  await memberGroup.getByRole("button", { name: "重新同步教研组", exact: true }).click();
  await memberGroup.getByRole("button", { name: /查看林清和的任务/ }).click();
  const memberDialog = memberPage.getByRole("dialog");
  await memberDialog.getByLabel("核对用水单位与异常值", { exact: true }).check();
  await memberDialog.getByLabel("形成共备讨论的问题清单", { exact: true }).check();
  await memberDialog.getByRole("button", { name: "保存进度", exact: true }).click();
  await memberDialog.getByText("已保存 3/3 项", { exact: true }).waitFor();
  await memberPage.keyboard.press("Escape");
  await page.bringToFront();
  await dialog.getByText(/服务器已有 v/).waitFor({ timeout: 12000 });
  assert.ok(await dialog.getByRole("button", { name: "保存进度", exact: true }).isDisabled());
  await shot("04-version-conflict");
  await dialog.getByRole("button", { name: "放弃本次勾选，载入最新版本", exact: true }).click();
  await dialog.getByText("已保存 3/3 项", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  pass("Second teacher saves progress through real browser UI; focused owner receives update; stale drafts are protected");

  await group.getByRole("button", { name: "下一桌成员", exact: true }).click();
  await group.getByRole("button", { name: /查看欧阳墨言长姓名测试的任务/ }).waitFor();
  await assertSeats(page, 'Long names');
  await shot("05-second-table-long-name");
  await group.getByRole("button", { name: "上一桌成员", exact: true }).click();
  await group.getByRole("button", { name: "邀请教师", exact: true }).click();
  dialog = page.getByRole("dialog");
  const inviteBefore = await dialog.getByLabel("本组邀请码", { exact: true }).inputValue();
  await dialog.getByRole("button", { name: "更新邀请码", exact: true }).click();
  await shot("06-invite-confirm");
  await dialog.getByRole("button", { name: "确认更新", exact: true }).click();
  await page.waitForFunction(old => document.querySelector('input[aria-label="本组邀请码"]')?.value !== old, inviteBefore);
  await page.keyboard.press("Escape");
  pass("Member pagination keeps full long names; invite dialog confirmation rotates real token");

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200); await assertSeats(page, 'Compact desktop');
  await assertNoHorizontalOverflow(page, "group compact desktop"); await shot("07-roundtable-compact");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(500);
  await assertSeats(page, 'Mobile');
  await assertNoHorizontalOverflow(page, "group mobile"); await shot("08-roundtable-mobile");
  await group.getByTestId('research-group-scene').scrollIntoViewIfNeeded();
  const mobileScenePath = join(dir, '12-mobile-seats.png');
  await group.getByRole('region', { name: '教研组成员星球', exact: true }).screenshot({ path: mobileScenePath });
  report.screenshots.push(mobileScenePath);
  assert.ok(await group.locator('img[src*="/bots/"]').evaluateAll(nodes => nodes.every(n => n.currentSrc.endsWith("main.png"))));
  await nonblankCanvas(page);
  await group.getByRole("button", { name: /查看林清和的任务/ }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "林清和的任务", exact: true }).waitFor();
  await assertNoHorizontalOverflow(page, "mobile member dialog"); await shot("09-member-mobile");
  await page.keyboard.press("Escape");
  pass("Compact/mobile layout, mobile table pixels, reduced-motion stills and touch-accessible member modal");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(200); await assertSeats(page, 'Small mobile');
  const smallWidth = await group.evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: el.scrollWidth, viewport: innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(smallWidth.scroll <= smallWidth.width + 1 && smallWidth.width <= smallWidth.viewport, 'Small mobile group has no horizontal overflow');
  report.diagnostics.push({ smallMobileGlobalShellOverflow: smallWidth.document - smallWidth.viewport, scope: 'Existing shared header is outside the roundtable change scope' });
  await group.getByTestId('research-group-scene').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const smallScenePath = join(dir, '13-small-mobile-seats.png');
  await group.getByTestId('research-group-scene').screenshot({ path: smallScenePath });
  report.screenshots.push(smallScenePath);
  const smallPixels = await tablePixels(page);
  assert.ok(smallPixels.some(value => value > 0 && value < 250), 'Small mobile model renders within the table footprint');
  while (await group.getByRole('button', { name: '下一桌成员', exact: true }).isEnabled()) await group.getByRole('button', { name: '下一桌成员', exact: true }).click();
  await group.getByRole('button', { name: /查看欧阳墨言长姓名测试的任务/ }).waitFor();
  await assertSeats(page, 'Small mobile long name');
  while (await group.getByRole('button', { name: '上一桌成员', exact: true }).isEnabled()) await group.getByRole('button', { name: '上一桌成员', exact: true }).click();

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.route("**/api/research-groups**", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "GROUP_UNAVAILABLE", message: "测试网络不可用" } }) }));
  await group.getByRole("button", { name: "重新同步教研组", exact: true }).click();
  await group.getByText(/^同步中断/).waitFor(); await shot("10-sync-error");
  await page.unroute("**/api/research-groups**");
  await group.getByRole("button", { name: "重试", exact: true }).click();
  await group.getByText(/^同步中断/).waitFor({ state: "hidden" });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByTestId("prep-workspace").getByRole("button", { name: "教研组", exact: true }).click();
  group = page.getByTestId("research-group-workspace");
  await group.getByRole("heading", { name: "科学教研组 · 校园节水项目", exact: true }).waitFor();
  assert.equal((await f.owner(path)).body.tasks.find(t => t.id === task.id).completed, 3);
  pass("Explicit sync failure and retry recovery; browser reload preserves real group and task completion");

  await memberPage.bringToFront();
  await memberGroup.getByRole("button", { name: "退出教研组", exact: true }).click();
  await memberPage.getByRole("dialog").getByRole("button", { name: "确认退出", exact: true }).click();
  await memberGroup.getByRole("heading", { name: "开始本组的备课协作" }).waitFor();
  assert.equal((await f.members[0](path)).status, 404);
  pass("Teacher can confirm leaving through UI; server immediately revokes group access");

  assert.ok((await page.request.post(`${f.base}/api/auth/switch-role`, { data: { role: "teacher" } })).ok());
  await page.bringToFront(); group = await openGroups(page);
  await group.getByText(/当前为只读会话/).waitFor();
  assert.ok(await group.getByRole("button", { name: "创建教研组", exact: true }).first().isDisabled());
  assert.ok(await group.getByRole("button", { name: "分配任务", exact: true }).isDisabled());
  await group.getByRole("button", { name: /查看沈知行的任务/ }).click();
  assert.ok(await page.getByRole("dialog").getByLabel("准备初稿", { exact: true }).isDisabled());
  pass("Read-only demo session can inspect members but cannot create, assign or modify saved progress");
  assert.deepEqual(report.pageErrors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = String(error.stack ?? error);
  if (page) await shot("failure").catch(() => {});
  throw error;
} finally {
  await browser?.close(); await f?.cleanup();
  report.finishedAt = new Date().toISOString(); writeFileSync(join(dir, "ui-report.json"), JSON.stringify(report, null, 2));
}
