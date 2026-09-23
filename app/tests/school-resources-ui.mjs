import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "playwright/test";
import { launchManorBrowser, assertNoHorizontalOverflow } from "./manor-v5-helpers.mjs";

const BASE = (process.env.SCHOOL_RESOURCES_BASE_URL || "http://127.0.0.1:4921").replace(/\/$/, "");
const OUT = fileURLToPath(new URL("../../.agent-supervisor/resources-v2-20260908/tester/", import.meta.url));
const RUN = new Date().toISOString().replace(/[:.]/g, "-");
const RUN_DIR = join(OUT, RUN);
const RESOURCE_PATH = "/knowledge/resources";
const FILE_NAME = "qa-school-lesson.md";
const TITLE = "QA school resource original";
const EDITED_TITLE = "QA school resource edited";
const BYTES = Buffer.from("# Focused regression lesson\r\n\r\n学校教学资料，保留原始字节。\r\n<script>window.resourceInjected = true</script>\r\n", "utf8");
const HASH = createHash("sha256").update(BYTES).digest("hex");
mkdirSync(RUN_DIR, { recursive: true });
const fixture = join(RUN_DIR, FILE_NAME);
writeFileSync(fixture, BYTES);
const report = {
  schema: "SchoolResourcesBrowserRegression/v1", startedAt: new Date().toISOString(),
  base: BASE, cwd: process.cwd(), command: "node tests/school-resources-ui.mjs",
  collector: "installed-playwright-independent-Chrome-contexts", checks: [], screenshots: [], diagnostics: [],
  fixtures: [{ name: FILE_NAME, sha256: HASH, bytes: BYTES.length }], sourceHashesBefore: {},
  testLimits: [
    "Runs against existing development server, not a production build; no broad build or other tests run.",
    "Only login is allowed to mutate server data. Other HTTP mutations are blocked; the Next dev stack-frame lookup POST is recorded separately as a read-only diagnostic.",
    "Fresh browser contexts isolate cookies/storage from the user's browser. Auth cookies remain in memory only.",
    "Injected storage faults exercise UI failure handling; delayed completion callback is after real IndexedDB commit, not artificial disk latency.",
    "50 MB boundary validated by pure model tests; browser uploads use small real files, no actual disk exhaustion.",
    "Chrome only; no screen-reader, Firefox/WebKit or formal contrast audit; screenshots are local QA evidence, not signed acceptance.",
  ],
};
const sourceFiles = [
  "app/lib/school-resources/model.ts", "app/lib/school-resources/localRepository.ts",
  "app/lib/school-resources/activityExamples.ts", "app/lib/school-resources/documentPreview.ts",
  "app/components/school-resources/DocumentMediaPreview.tsx", "app/components/school-resources/HtmlActivityPlayer.tsx",
  "app/lib/school-resources/htmlRuntime.ts", "app/public/resource-runtime.html", "app/next.config.ts",
  "app/components/school-resources/SchoolResourceLibrary.tsx", "app/components/school-resources/UploadResourceDialog.tsx",
  "app/components/school-resources/ResourceDetail.tsx", "app/components/school-resources/school-resources.module.css",
  "app/components/school-resources/dialogFocus.ts",
  "app/components/shell/Sidebar.tsx", "app/app/(shell)/knowledge/resources/page.tsx",
  "app/app/(shell)/knowledge/page.tsx", "app/components/common/SchoolResourceIcon.tsx", "app/lib/nav.ts",
  ...["library", "upload", "slides", "lesson", "worksheet", "folder", "activity", "media"].map(name => `app/public/art/school-resources/${name}.webp`),
];
const root = fileURLToPath(new URL("../../", import.meta.url));
const hashFile = path => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const path of sourceFiles) report.sourceHashesBefore[path] = hashFile(resolve(root, path));
const flush = () => {
  report.passed = report.checks.filter(c => c.status === "passed").length;
  report.failed = report.checks.filter(c => c.status === "failed").length;
  report.endedAt = new Date().toISOString();
  for (const path of [join(RUN_DIR, "ui-report.json"), join(OUT, "ui-report.json")]) writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`);
};
async function shot(page, label) {
  const path = join(RUN_DIR, `${label}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled" });
  report.screenshots.push({ label, path, sha256: hashFile(path), viewport: page.viewportSize(), url: page.url() });
  return path;
}
async function check(id, label, page, run) {
  const record = { id, label, startedAt: new Date().toISOString() };
  try { record.actual = await run(); record.status = "passed"; }
  catch (error) {
    record.status = "failed"; record.error = error.stack;
    if (page && !page.isClosed()) {
      record.screenshot = await shot(page, `${id}-failure`).catch(e => String(e));
      const path = join(RUN_DIR, `${id}-failure-dom.txt`);
      writeFileSync(path, await page.locator("body").innerText().catch(e => String(e)));
      record.domArtifact = path;
      // Keep a failed assertion intact but dismiss its UI so independent checks can still run.
      record.recovery = await (async () => {
        await page.evaluate(() => window.__resourceTest?.release?.());
        const uploadClose = dialog(page).getByRole("button", { name: "关闭上传窗口" });
        const detailClose = dialog(page).getByRole("button", { name: "关闭资源详情" });
        if (await uploadClose.isVisible() && await uploadClose.isEnabled()) await closeUpload(page);
        else if (await detailClose.isVisible() && await detailClose.isEnabled()) await detailClose.click();
        return "dismissed failed-case dialog when closable";
      })().catch(e => String(e));
    }
  }
  record.endedAt = new Date().toISOString(); report.checks.push(record); flush();
  console.log(`${record.status.toUpperCase()} ${id}: ${label}${record.error ? `\n${record.error}` : ""}`);
  return record.status === "passed";
}

// Intercept only our isolated page's IndexedDB boundary. Real transactions/Blob storage still run.
function installStorageProbe() {
  window.__resourceTest = { holdNextComplete: false, held: false, released: false, abortNextWrite: false, aborted: 0, failOpen: false };
  const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, "oncomplete");
  Object.defineProperty(IDBTransaction.prototype, "oncomplete", {
    configurable: true, get: descriptor.get,
    set(handler) {
      descriptor.set.call(this, function (event) {
        const probe = window.__resourceTest;
        if (this.mode === "readwrite" && probe.holdNextComplete) {
          probe.holdNextComplete = false; probe.held = true; probe.released = false;
          probe.release = () => { probe.released = true; probe.held = false; handler?.call(this, event); };
        } else handler?.call(this, event);
      });
    },
  });
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    const request = put.apply(this, args);
    if (window.__resourceTest.abortNextWrite || window.__resourceAbortAllWrites) {
      window.__resourceTest.abortNextWrite = false; window.__resourceTest.aborted++;
      this.transaction.abort();
    }
    return request;
  };
  const open = IDBFactory.prototype.open;
  IDBFactory.prototype.open = function (...args) {
    if (window.__resourceTest.failOpen) throw new DOMException("QA: browser storage unavailable", "SecurityError");
    return open.apply(this, args);
  };
}
const contexts = [];
let browser;
let auth;
let teacherAccountId;
async function newPage(label, { authenticated = true, viewport = { width: 1366, height: 900 }, dark = false, unavailable = false } = {}) {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: dark ? "dark" : "light",
    ...(authenticated ? { storageState: auth } : {}), acceptDownloads: true,
  });
  contexts.push(context);
  const diagnostics = { label, api: [], devDiagnostics: [], blockedMutations: [], errors: [], pageErrors: [], failedResponses: [] };
  report.diagnostics.push(diagnostics);
  await context.addInitScript(installStorageProbe);
  await context.addInitScript(({ dark, unavailable, origin }) => {
    // Next's diagnostic overlay can create opaque frames; preferences apply only to the app origin.
    if (location.origin !== origin) return;
    localStorage.setItem("eduai-theme", dark ? "dark" : "light");
    if (unavailable) Object.defineProperty(window, "indexedDB", { value: undefined, configurable: true });
  }, { dark, unavailable, origin: new URL(BASE).origin });
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) diagnostics.api.push({ path: url.pathname, method: request.method() });
    if (request.method() === "POST" && url.pathname === "/__nextjs_original-stack-frames") {
      diagnostics.devDiagnostics.push({ path: url.pathname, method: request.method() }); await route.continue();
    } else if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && url.pathname !== "/api/auth/login") {
      diagnostics.blockedMutations.push({ path: url.pathname, method: request.method() });
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
  context.on("page", page => {
    page.setDefaultTimeout(12_000);
    page.on("console", m => { if (m.type() === "error") diagnostics.errors.push(m.text()); });
    page.on("pageerror", e => diagnostics.pageErrors.push(e.message));
    page.on("response", r => { if (r.status() >= 400) diagnostics.failedResponses.push({ url: r.url(), status: r.status() }); });
  });
  const page = await context.newPage();
  return page;
}
const lib = page => page.getByTestId("school-resource-library");
const dialog = page => page.getByRole("dialog");
const rows = page => lib(page).locator('tbody tr');
async function openLibrary(page) {
  await page.goto(`${BASE}${RESOURCE_PATH}`, { waitUntil: "networkidle", timeout: 60_000 });
  const dismiss = page.getByRole("button", { name: "关闭引导，稍后再看" });
  if (await dismiss.isVisible()) await dismiss.click();
  await expect(lib(page)).toBeVisible();
  await expect(lib(page)).not.toContainText("正在读取本机草稿");
}
async function metadata(page) {
  await dialog(page).getByLabel("上传资源学科").selectOption("语文");
  await dialog(page).getByLabel("上传资源年级").selectOption("六年级");
  await dialog(page).getByLabel("内容简介").fill("Focused browser regression. Local-only original bytes.");
}
async function startUpload(page, { name = FILE_NAME, title = TITLE, bytes = BYTES } = {}) {
  await lib(page).getByRole("button", { name: "上传资源", exact: true }).click();
  if (name === FILE_NAME && bytes === BYTES) await page.getByTestId("resource-file-input").setInputFiles(fixture);
  else await page.getByTestId("resource-file-input").setInputFiles({ name, mimeType: "text/markdown", buffer: bytes });
  await dialog(page).getByRole("textbox", { name: /^资源名称 1/ }).fill(title);
  await metadata(page);
  await dialog(page).getByRole("checkbox").check();
}
async function save(page) {
  await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(lib(page).getByRole("status")).toContainText("已保存 1 份本机草稿");
}
async function closeUpload(page) {
  await dialog(page).getByRole("button", { name: "关闭上传窗口" }).click();
  if (await dialog(page).getByRole("button", { name: "放弃未保存内容" }).isVisible())
    await dialog(page).getByRole("button", { name: "放弃未保存内容" }).click();
  await expect(dialog(page)).toHaveCount(0);
}
async function database(page) {
  return page.evaluate(async () => {
    const records = await new Promise((resolve, reject) => {
      const req = indexedDB.open("eduai-school-resources-v1");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result; const tx = db.transaction("accounts", "readonly");
        const get = tx.objectStore("accounts").getAll();
        tx.oncomplete = () => { const values = get.result; db.close(); resolve(values); };
        tx.onerror = () => reject(tx.error);
      };
    });
    return Promise.all(records.map(async state => ({ favoriteIds: state.favoriteIds, drafts: await Promise.all(state.drafts.map(async r => ({
      id: r.id, title: r.title, fileName: r.fileName, sha256: r.sha256, fileSize: r.fileSize,
      subject: r.subject, grade: r.grade, revision: r.revision, blobIsBlob: r.blob instanceof Blob, bytes: [...new Uint8Array(await r.blob.arrayBuffer())],
    }))) })));
  });
}
async function accountInventory(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const open = indexedDB.open("eduai-school-resources-v1");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result; const tx = db.transaction("accounts", "readonly");
      const store = tx.objectStore("accounts"); const keys = store.getAllKeys(); const all = store.getAll();
      tx.oncomplete = () => {
        db.close(); resolve(all.result.map((state, index) => ({ key: keys.result[index], favoriteIds: state.favoriteIds,
          drafts: state.drafts.map(draft => ({ id: draft.id, title: draft.title, revision: draft.revision, sha256: draft.sha256,
            blobIsBlob: draft.blob instanceof Blob, fileSize: draft.fileSize, blobSize: draft.blob?.size })) })));
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
}
async function openDraft(page, title = TITLE) {
  await lib(page).getByRole("button", { name: /我的草稿/ }).click();
  await lib(page).getByRole("button", { name: `查看 ${title}`, exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: title, exact: true })).toBeVisible();
}
async function downloadBytes(page, button, expected, label) {
  const event = page.waitForEvent("download"); await button.click();
  const download = await event;
  assert.equal(await download.failure(), null);
  const path = join(RUN_DIR, `${label}-${download.suggestedFilename()}`);
  await download.saveAs(path);
  assert.deepEqual(readFileSync(path), expected, "Downloaded file must retain exact original bytes");
  return { filename: download.suggestedFilename(), bytes: expected.length, sha256: hashFile(path), path };
}
async function closeNotice(page) {
  const button = lib(page).getByRole("button", { name: "关闭操作提示" });
  if (await button.isVisible()) await button.click();
}
async function assertButtonHit(button) {
  await button.scrollIntoViewIfNeeded();
  const hits = await button.evaluate(el => {
    const box = el.getBoundingClientRect();
    return [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5]].map(([dx, dy]) => {
      const x = box.left + box.width * dx, y = box.top + box.height * dy;
      const hit = document.elementFromPoint(x, y);
      return { x, y, target: el.getAttribute("aria-label") || el.textContent?.trim(),
        hitsButton: !!hit && (hit === el || el.contains(hit)), actualTarget: hit?.getAttribute("aria-label") || hit?.textContent?.trim().slice(0, 100) };
    });
  });
  assert.ok(hits.every(point => point.hitsButton), `Control is obscured: ${JSON.stringify(hits)}`);
  return hits;
}

try {
  // This Windows checkout's downloaded Chromium cannot spawn; use installed Chrome through the shared helper.
  const chrome = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]
    .filter(Boolean).map(base => join(base, "Google", "Chrome", "Application", "chrome.exe")).find(existsSync);
  if (!process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && chrome) process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = chrome;
  report.browserExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "shared helper discovery";
  browser = await launchManorBrowser();
  const loginPage = await newPage("teacher-login", { authenticated: false });
  const loggedIn = await check("U01", "Teacher role-tab login reaches resource library", loginPage, async () => {
    await loginPage.goto(`${BASE}/login?from=%2Fknowledge%2Fresources`, { waitUntil: "networkidle", timeout: 60_000 });
    const teacher = loginPage.getByRole("tab", { name: "教师 · 教职工", exact: true });
    if (!(await teacher.isVisible())) await loginPage.getByRole("button", { name: "登录", exact: true }).click();
    await teacher.click(); await expect(teacher).toHaveAttribute("aria-selected", "true");
    await loginPage.getByLabel("账号", { exact: true }).fill("teacher");
    await loginPage.getByLabel("密码", { exact: true }).fill("Teacher@123");
    const response = loginPage.waitForResponse(r => r.url().endsWith("/api/auth/login") && r.request().method() === "POST");
    await loginPage.getByRole("button", { name: "进入平台", exact: true }).click();
    const loginResponse = await response;
    assert.equal(loginResponse.status(), 200);
    teacherAccountId = String((await loginResponse.json()).user.id);
    await loginPage.waitForURL(`**${RESOURCE_PATH}`, { timeout: 30_000 });
    await openLibrary(loginPage);
    auth = await loginPage.context().storageState();
    return { path: new URL(loginPage.url()).pathname, roleTab: "teacher", cookieValuesPersisted: false };
  });
  if (!loggedIn) throw new Error("Cannot run authenticated workflow tests because teacher UI login failed");

  const page = await newPage("main-workflow");
  await openLibrary(page);
  await check("U00", "First real upload click opens a functional dialog", page, async () => {
    await lib(page).getByRole("button", { name: "上传资源", exact: true }).click();
    await expect(dialog(page).getByRole("heading", { name: "上传教学资源", exact: true })).toBeVisible();
    await expect(page.getByTestId("resource-file-input")).toHaveCount(1);
    await shot(page, "first-upload-click");
    await dialog(page).getByRole("button", { name: "关闭上传窗口" }).click();
    await expect(dialog(page)).toHaveCount(0);
  });
  await check("U02", "Seven clearly labelled examples including HTML; detail and original outline download work", page, async () => {
    await expect(page.getByRole("heading", { name: "校内资源库", exact: true })).toBeVisible();
    assert.ok((await page.title()).length > 0);
    await expect(rows(page)).toHaveCount(7);
    await expect(lib(page)).toContainText("学校共享服务器尚未接入");
    await lib(page).getByRole("button", { name: "查看 分数的意义：从一张纸开始", exact: true }).click();
    await expect(dialog(page)).toContainText("非真实校内共享文件");
    const body = await dialog(page).locator("pre").innerText();
    const result = await downloadBytes(page, dialog(page).getByRole("button", { name: "下载示例提纲" }), Buffer.from(body), "example");
    await dialog(page).getByRole("button", { name: "关闭资源详情" }).click();
    return result;
  });
  await check("U03", "Search, subject/grade/type intersection, empty reset and grid/list toggle", page, async () => {
    await lib(page).getByLabel("搜索校内资源").fill("折纸");
    await lib(page).getByLabel("资源学科筛选").selectOption("数学");
    await lib(page).getByLabel("资源年级筛选").selectOption("四年级");
    await lib(page).getByRole("button", { name: /^课件 1 份示例/ }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("分数的意义");
    await lib(page).getByLabel("资源年级筛选").selectOption("一年级");
    await expect(lib(page).getByRole("heading", { name: "没有找到匹配的资源" })).toBeVisible();
    await shot(page, "empty-filter");
    await lib(page).getByRole("button", { name: "清除筛选", exact: true }).first().click();
    await expect(rows(page)).toHaveCount(7);
    await expect(lib(page).getByLabel("搜索校内资源")).toHaveValue("");
    await expect(lib(page).getByLabel("资源学科筛选")).toHaveValue("");
    await expect(lib(page).getByLabel("资源年级筛选")).toHaveValue("");
    await lib(page).getByLabel("资源排序").selectOption("title");
    const names = await rows(page).locator("td:first-child strong").allTextContents();
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b, "zh-CN")));
    await lib(page).getByRole("button", { name: "网格视图", exact: true }).click();
    await expect(lib(page).locator("article")).toHaveCount(7);
    await shot(page, "desktop-grid-1366");
    await lib(page).getByRole("button", { name: "列表视图", exact: true }).click();
    return { examples: 7, filtered: 1, empty: 0, grid: 7 };
  });
  await check("U04", "Invalid files, empty file, required metadata and explicit consent are rejected", page, async () => {
    await lib(page).getByRole("button", { name: "上传资源", exact: true }).click();
    await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    for (const text of ["请先选择文件", "请选择学科", "请选择年级", "请确认本机保存及资料使用权限"])
      await expect(dialog(page).getByRole("alert")).toContainText(text);
    for (const [name, mimeType, buffer, message] of [
      ["unsafe.exe", "application/octet-stream", Buffer.from("blocked"), "不支持此格式"],
      ["empty.md", "text/markdown", Buffer.alloc(0), "文件为空"],
      ["disguised.md", "text/html", Buffer.from("<html>blocked</html>"), "HTML 文件必须使用 .html 或 .htm 扩展名"],
    ]) {
      await page.getByTestId("resource-file-input").setInputFiles({ name, mimeType, buffer });
      await expect(dialog(page).getByRole("alert")).toContainText(message);
      await expect(dialog(page).getByRole("textbox", { name: /^资源名称 1/ })).toHaveCount(0);
    }
    await page.getByTestId("resource-file-input").setInputFiles(fixture);
    await dialog(page).getByRole("textbox", { name: /^资源名称 1/ }).fill("   ");
    await metadata(page);
    await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("资源名称需要");
    await dialog(page).getByRole("textbox", { name: /^资源名称 1/ }).fill(TITLE);
    await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(page).getByRole("alert")).toContainText("请确认本机保存及资料使用权限");
    assert.deepEqual(await database(page), []);
    await shot(page, "required-consent");
    await closeUpload(page);
  });
  await check("U05", "Unsaved close prompts; continue preserves edits; discard leaves zero drafts", page, async () => {
    await startUpload(page);
    await dialog(page).getByRole("button", { name: "关闭上传窗口" }).click();
    await expect(dialog(page).getByRole("heading", { name: "保留尚未保存的内容？" })).toBeVisible();
    await shot(page, "unsaved-confirmation");
    await dialog(page).getByRole("button", { name: "继续编辑", exact: true }).click();
    await expect(dialog(page).getByRole("textbox", { name: /^资源名称 1/ })).toHaveValue(TITLE);
    await page.keyboard.press("Escape");
    await dialog(page).getByRole("button", { name: "放弃未保存内容" }).click();
    assert.deepEqual(await database(page), []);
  });
  let saved = false;
  saved = await check("U06", "No success or modal close until real IndexedDB completion is delivered", page, async () => {
    await closeNotice(page); await startUpload(page);
    await page.evaluate(() => { window.__resourceTest.holdNextComplete = true; });
    await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await page.waitForFunction(() => window.__resourceTest.held);
    try {
      await expect(dialog(page)).toBeVisible();
      await expect(dialog(page).getByRole("button", { name: "保存中", exact: true })).toBeDisabled();
      await expect(dialog(page).getByRole("button", { name: "关闭上传窗口" })).toBeDisabled();
      await expect(lib(page)).not.toContainText("已保存 1 份本机草稿");
      await page.keyboard.press("Escape"); await expect(dialog(page)).toBeVisible();
      await shot(page, "commit-callback-held");
    } finally { await page.evaluate(() => window.__resourceTest.release?.()); }
    await expect(dialog(page)).toHaveCount(0);
    await expect(lib(page).getByRole("status")).toContainText("已保存 1 份本机草稿");
    const state = await database(page);
    assert.equal(state.length, 1); assert.equal(state[0].drafts.length, 1);
    const record = state[0].drafts[0];
    assert.equal(record.blobIsBlob, true); assert.equal(record.sha256, HASH);
    assert.deepEqual(Buffer.from(record.bytes), BYTES);
    return { completionHeldThenReleased: true, sha256: record.sha256, blobIsBlob: record.blobIsBlob };
  });
  if (saved) {
    await check("U07", "Reload retains original Blob, inert text preview and byte-identical download", page, async () => {
      await openLibrary(page); await openDraft(page);
      await expect(dialog(page).locator("pre")).toContainText("学校教学资料");
      assert.equal(await page.evaluate(() => window.resourceInjected), undefined);
      const result = await downloadBytes(page, dialog(page).getByRole("button", { name: "下载原文件" }), BYTES, "original");
      assert.equal(result.filename, FILE_NAME); assert.equal(result.sha256, HASH);
      await shot(page, "persisted-original-detail");
      await dialog(page).getByRole("button", { name: "关闭资源详情" }).click(); return result;
    });
    await check("U08", "Same bytes with different filename fail hash dedupe without replacing original", page, async () => {
      await startUpload(page, { name: "different-name.md", title: "Renamed duplicate" });
      await dialog(page).getByRole("button", { name: "保存本机草稿", exact: true }).click();
      await expect(dialog(page).getByRole("alert")).toContainText("与已有草稿内容重复");
      await expect(dialog(page).getByRole("button", { name: "关闭上传窗口" })).toBeEnabled();
      const state = await database(page); assert.equal(state[0].drafts.length, 1);
      assert.equal(state[0].drafts[0].title, TITLE);
      await shot(page, "duplicate-hash-rejected"); await closeUpload(page);
    });
    await check("U09", "Edit persists metadata without changing file bytes; favorite persists after reload", page, async () => {
      await openDraft(page); await dialog(page).getByRole("button", { name: "编辑信息" }).click();
      await expect(dialog(page).getByRole("heading", { name: "编辑本机草稿" })).toBeVisible();
      await dialog(page).getByRole("textbox", { name: /^资源名称 1/ }).fill(EDITED_TITLE);
      await dialog(page).getByLabel("上传资源学科").selectOption("科学");
      await dialog(page).getByRole("checkbox").check(); await save(page);
      await openDraft(page, EDITED_TITLE);
      await dialog(page).getByRole("button", { name: "收藏", exact: true }).click();
      await expect(dialog(page).getByRole("button", { name: "已收藏", exact: true })).toHaveAttribute("aria-pressed", "true");
      await dialog(page).getByRole("button", { name: "关闭资源详情" }).click();
      await openLibrary(page); await lib(page).getByRole("button", { name: /我的收藏/ }).click();
      await expect(rows(page)).toHaveCount(1); await expect(rows(page)).toContainText(EDITED_TITLE);
      const state = await database(page); const draft = state[0].drafts[0];
      assert.equal(draft.subject, "科学"); assert.equal(draft.sha256, HASH);
      assert.deepEqual(Buffer.from(draft.bytes), BYTES); assert.deepEqual(state[0].favoriteIds, [draft.id]);
    });
    await check("U10", "Removal requires confirmation; abort remains honest; retry removes Blob and favorite", page, async () => {
      await openDraft(page, EDITED_TITLE);
      await dialog(page).getByRole("button", { name: "移除本机草稿", exact: true }).click();
      await dialog(page).getByRole("button", { name: "保留草稿", exact: true }).click();
      assert.equal((await database(page))[0].drafts.length, 1);
      await dialog(page).getByRole("button", { name: "移除本机草稿", exact: true }).click();
      await page.evaluate(() => { window.__resourceTest.abortNextWrite = true; });
      await dialog(page).getByRole("button", { name: "确认移除本机副本" }).click();
      await expect(dialog(page).getByRole("alert")).toContainText("保存未完成");
      await expect(dialog(page).getByRole("button", { name: "关闭资源详情" })).toBeEnabled();
      assert.equal((await database(page))[0].drafts.length, 1);
      await shot(page, "remove-aborted");
      await dialog(page).getByRole("button", { name: "确认移除本机副本" }).click();
      await expect(dialog(page)).toHaveCount(0);
      await expect(lib(page)).toContainText("本机副本已移除");
      assert.deepEqual(await database(page), [{ drafts: [], favoriteIds: [] }]);
      await openLibrary(page); await lib(page).getByRole("button", { name: /我的草稿/ }).click();
      await expect(lib(page).getByRole("heading", { name: "从第一份教学资料开始" })).toBeVisible();
    });
  } else report.testLimits.push("Dependent persisted-draft checks U07-U10 unavailable after U06 failure.");

  const fault = await newPage("write-failure"); await openLibrary(fault);
  await check("U11", "Aborted upload keeps modal/file editable, shows error and permits successful retry", fault, async () => {
    await startUpload(fault); await fault.evaluate(() => { window.__resourceTest.abortNextWrite = true; });
    await dialog(fault).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(fault).getByRole("alert")).toContainText("保存未完成");
    await expect(dialog(fault).getByRole("button", { name: "关闭上传窗口" })).toBeEnabled();
    await expect(dialog(fault).getByRole("textbox", { name: /^资源名称 1/ })).toHaveValue(TITLE);
    await expect(lib(fault)).not.toContainText("已保存 1 份本机草稿");
    assert.deepEqual(await database(fault), []); await shot(fault, "upload-aborted");
    await save(fault); assert.equal((await database(fault))[0].drafts.length, 1);
  });
  await check("U12", "Favorite write failure uses alert, never claims success, remains closable", fault, async () => {
    await closeNotice(fault); await openDraft(fault);
    await fault.evaluate(() => { window.__resourceTest.abortNextWrite = true; });
    await dialog(fault).getByRole("button", { name: "收藏", exact: true }).click();
    await expect(lib(fault).getByRole("alert")).toContainText("保存未完成");
    await expect(dialog(fault).getByRole("button", { name: "收藏", exact: true })).toHaveAttribute("aria-pressed", "false");
    assert.deepEqual((await database(fault))[0].favoriteIds, []);
    await dialog(fault).getByRole("button", { name: "关闭资源详情" }).click(); await expect(dialog(fault)).toHaveCount(0);
  });
  await check("U13", "Detail cannot close during pending mutation, becomes closable when committed", fault, async () => {
    await closeNotice(fault); await openDraft(fault);
    await fault.evaluate(() => { window.__resourceTest.holdNextComplete = true; });
    await dialog(fault).getByRole("button", { name: "收藏", exact: true }).click();
    await fault.waitForFunction(() => window.__resourceTest.held);
    try {
      await expect(dialog(fault).getByRole("button", { name: "关闭资源详情" })).toBeDisabled();
      await fault.keyboard.press("Escape"); await expect(dialog(fault)).toBeVisible();
    } finally { await fault.evaluate(() => window.__resourceTest.release?.()); }
    await expect(dialog(fault).getByRole("button", { name: "已收藏", exact: true })).toBeEnabled();
    await dialog(fault).getByRole("button", { name: "关闭资源详情" }).click(); await expect(dialog(fault)).toHaveCount(0);
  });
  const unavailable = await newPage("storage-unavailable", { unavailable: true }); await openLibrary(unavailable);
  await check("U14", "Unavailable storage leaves examples/download usable and detail/upload closable", unavailable, async () => {
    await expect(lib(unavailable).getByRole("alert")).toContainText("无法保存草稿");
    await expect(rows(unavailable)).toHaveCount(7);
    await lib(unavailable).getByRole("button", { name: "查看 分数的意义：从一张纸开始", exact: true }).click();
    await expect(dialog(unavailable).getByRole("button", { name: "收藏", exact: true })).toBeDisabled();
    await expect(dialog(unavailable).getByRole("button", { name: "关闭资源详情" })).toBeEnabled();
    await expect(dialog(unavailable).getByRole("button", { name: "下载示例提纲" })).toBeEnabled();
    await dialog(unavailable).getByRole("button", { name: "关闭资源详情" }).click();
    await startUpload(unavailable);
    await dialog(unavailable).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(unavailable).getByRole("alert")).toContainText("本机存储尚未就绪");
    await expect(dialog(unavailable).getByRole("button", { name: "关闭上传窗口" })).toBeEnabled();
    await shot(unavailable, "storage-unavailable-upload"); await closeUpload(unavailable);
  });
  const readFailure = await newPage("read-failure");
  await readFailure.addInitScript(() => { window.__resourceTest.failOpen = true; });
  await openLibrary(readFailure);
  await check("U15", "Storage-open failure offers honest retry and recovers after permission returns", readFailure, async () => {
    await expect(lib(readFailure).getByRole("alert")).toContainText("QA: browser storage unavailable");
    await readFailure.evaluate(() => { window.__resourceTest.failOpen = false; });
    await lib(readFailure).getByRole("button", { name: "重试读取本机草稿" }).click();
    await expect(lib(readFailure).getByRole("alert")).toHaveCount(0);
    await expect(lib(readFailure).getByRole("button", { name: "收藏 分数的意义：从一张纸开始", exact: true })).toBeEnabled();
  });
  const anonymous = await newPage("anonymous-guard", { authenticated: false });
  await check("U16", "Anonymous route guard redirects without resource content", anonymous, async () => {
    await anonymous.goto(`${BASE}${RESOURCE_PATH}`, { waitUntil: "networkidle" });
    assert.equal(new URL(anonymous.url()).pathname, "/login");
    assert.equal(new URL(anonymous.url()).searchParams.get("from"), RESOURCE_PATH);
    await expect(lib(anonymous)).toHaveCount(0);
  });
  const student = await newPage("student-guard", { authenticated: false });
  await check("U17", "Default student credential in independent context cannot access resources", student, async () => {
    const response = await student.context().request.post(`${BASE}/api/auth/login`, { data: { username: "student", password: "Student@123" } });
    assert.equal(response.status(), 200, "Existing demo student credentials must work; no account mutation attempted");
    await student.goto(`${BASE}${RESOURCE_PATH}`, { waitUntil: "networkidle", timeout: 60_000 });
    assert.equal(new URL(student.url()).pathname, "/student/home");
    await expect(lib(student)).toHaveCount(0);
    return { redirectedTo: "/student/home", loginStatus: response.status() };
  });

  const desktop = await newPage("desktop-layout"); await openLibrary(desktop);
  await check("U18", "1366 desktop sidebar account anchors at bottom with independent navigation scrolling", desktop, async () => {
    const sidebar = desktop.locator("#primary-app-sidebar");
    for (const name of ["教学", "教研", "更多工具"]) {
      const button = sidebar.getByRole("button", { name, exact: true });
      if (await button.isVisible() && await button.getAttribute("aria-expanded") !== "true") await button.click();
    }
    const account = sidebar.locator('nav + div button[aria-haspopup="menu"]');
    await expect(account).toBeVisible();
    const geometry = await sidebar.evaluate(el => {
      const nav = el.querySelector("nav").getBoundingClientRect();
      const footer = el.querySelector("nav").nextElementSibling.getBoundingClientRect();
      const account = el.querySelector('nav + div button[aria-haspopup="menu"]').getBoundingClientRect();
      return { navBottom: nav.bottom, footerTop: footer.top, gap: footer.top - nav.bottom, accountTop: account.top, accountBottom: account.bottom, viewportHeight: innerHeight };
    });
    assert.ok(geometry.gap >= 0 && geometry.gap <= 24, `Unbounded nav/account gap: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.accountTop >= 0 && geometry.accountBottom <= geometry.viewportHeight, JSON.stringify(geometry));
    assert.ok(geometry.viewportHeight - geometry.accountBottom <= 20, `Account not anchored at bottom: ${JSON.stringify(geometry)}`);
    await account.click(); await expect(desktop.getByRole("menuitem", { name: "个人中心" })).toBeVisible(); await desktop.keyboard.press("Escape");
    await assertNoHorizontalOverflow(desktop, "desktop-1366");
    await shot(desktop, "desktop-list-1366"); return geometry;
  });
  const mobile = await newPage("mobile-layout", { viewport: { width: 390, height: 844 } }); await openLibrary(mobile);
  await check("U19", "390 mobile list/grid, upload/detail and navigation remain usable without page overflow", mobile, async () => {
    await assertNoHorizontalOverflow(mobile, "mobile-list"); await shot(mobile, "mobile-list-390");
    await lib(mobile).getByRole("button", { name: "网格视图", exact: true }).click();
    await expect(lib(mobile).locator("article")).toHaveCount(7); await assertNoHorizontalOverflow(mobile, "mobile-grid");
    await shot(mobile, "mobile-grid-390");
    await lib(mobile).getByRole("button", { name: "分数的意义：从一张纸开始", exact: true }).click();
    await expect(dialog(mobile)).toBeVisible(); await assertNoHorizontalOverflow(mobile, "mobile-detail");
    const box = await dialog(mobile).boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= 391 && box.y >= 0 && box.y + box.height <= 845, JSON.stringify(box));
    await shot(mobile, "mobile-detail-390"); await dialog(mobile).getByRole("button", { name: "关闭资源详情" }).click();
    await startUpload(mobile); await assertNoHorizontalOverflow(mobile, "mobile-upload");
    await dialog(mobile).getByRole("button", { name: "保存本机草稿", exact: true }).scrollIntoViewIfNeeded();
    await shot(mobile, "mobile-upload-390"); await closeUpload(mobile);
    await mobile.getByRole("button", { name: "打开导航" }).click();
    await expect(dialog(mobile).getByRole("link", { name: "校内资源库", exact: true })).toBeVisible();
    await shot(mobile, "mobile-navigation-390"); await mobile.keyboard.press("Escape");
  });
  const dark = await newPage("dark-reduced-motion", { dark: true }); await openLibrary(dark);
  await check("U20", "Actual dark theme, reduced motion and all resource bitmap icons render", dark, async () => {
    assert.equal(await dark.evaluate(() => document.documentElement.classList.contains("dark")), true);
    assert.equal(await dark.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches), true);
    const icons = lib(dark).locator('span[style*="/art/school-resources/"]');
    await expect(icons.first()).toBeVisible();
    const images = await icons.evaluateAll(async nodes => Promise.all(nodes.map(async node => {
      const css = getComputedStyle(node).backgroundImage;
      const src = css.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
      if (!src) throw new Error(`Missing bitmap background: ${css}`);
      const image = new Image(); image.src = src; await image.decode();
      const box = node.getBoundingClientRect();
      return { src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, renderedWidth: box.width, renderedHeight: box.height };
    })));
    assert.ok(images.every(image => image.naturalWidth > 0 && image.renderedWidth > 0 && image.renderedHeight > 0));
    assert.deepEqual([...new Set(images.map(n => n.src.split("/").at(-1)))].sort(), ["activity.webp", "folder.webp", "lesson.webp", "library.webp", "media.webp", "slides.webp", "upload.webp", "worksheet.webp"]);
    await lib(dark).getByRole("button", { name: "网格视图", exact: true }).click();
    await assertNoHorizontalOverflow(dark, "dark-desktop"); await shot(dark, "dark-grid-reduced-motion-1366");
    const animations = await lib(dark).evaluate(el => el.getAnimations({ subtree: true }).filter(a => a.playState === "running").length);
    assert.equal(animations, 0, "No running resource animations with reduced motion");
    return { dark: true, reducedMotion: true, runningAnimations: animations, images };
  });
  const longPreview = await newPage("utf8-preview"); await openLibrary(longPreview);
  await check("U22", "Long UTF8 preview reads 20000-byte prefix without incomplete trailing codepoint", longPreview, async () => {
    const observations = [];
    for (const [name, bytes, expected, truncated] of [
      ["split-utf8.md", Buffer.from(`${"a".repeat(19999)}中\nTAIL-MUST-NOT-PREVIEW`), "a".repeat(19999), true],
      ["exact-utf8.md", Buffer.from(`${"b".repeat(19997)}中`), `${"b".repeat(19997)}中`, false],
    ]) {
      await startUpload(longPreview, { name, title: name, bytes }); await save(longPreview);
      await openDraft(longPreview, name);
      await expect(dialog(longPreview).locator("pre")).toHaveText(expected);
      const actual = await dialog(longPreview).locator("pre").textContent();
      assert.equal(actual, expected); assert.equal(actual.includes("\uFFFD"), false);
      assert.equal(actual.includes("TAIL-MUST-NOT-PREVIEW"), false);
      const truncation = dialog(longPreview).getByText("仅预览前 20 KB；完整内容可下载查看。", { exact: true });
      if (truncated) await expect(truncation).toBeVisible(); else await expect(truncation).toHaveCount(0);
      const download = await downloadBytes(longPreview, dialog(longPreview).getByRole("button", { name: "下载原文件" }), bytes, name);
      observations.push({ name, sourceBytes: bytes.length, previewBytes: Buffer.byteLength(actual), replacementCharacter: false, download });
      await shot(longPreview, `preview-${name}`);
      await dialog(longPreview).getByRole("button", { name: "关闭资源详情" }).click();
    }
    return observations;
  });
  const corrupt = await newPage("corrupt-metadata"); await openLibrary(corrupt);
  await check("U23", "Malformed persisted metadata fails closed, remains unchanged, and example detail closes", corrupt, async () => {
    await startUpload(corrupt); await save(corrupt);
    const observations = [];
    const corruptions = ["title-object", "unknown-kind", "file-size", "invalid-hash", "missing-blob", "invalid-favorite", "unknown-subject", "invalid-revision"];
    const rawSummary = async () => corrupt.evaluate(async () => new Promise((resolve, reject) => {
      const open = indexedDB.open("eduai-school-resources-v1");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result; const tx = db.transaction("accounts", "readonly");
        const get = tx.objectStore("accounts").getAll();
        tx.oncomplete = () => {
          db.close(); resolve(JSON.stringify(get.result, (key, value) => value instanceof Blob ? { blobSize: value.size, blobType: value.type } : value));
        };
        tx.onerror = () => reject(tx.error);
      };
    }));
    for (const corruption of corruptions) {
      await corrupt.evaluate(async ({ corruption, bytes, hash, title }) => new Promise((resolve, reject) => {
        const open = indexedDB.open("eduai-school-resources-v1");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result; const tx = db.transaction("accounts", "readwrite");
          const store = tx.objectStore("accounts"); const cursor = store.openCursor();
          cursor.onsuccess = () => {
            const entry = cursor.result;
            if (!entry) { tx.abort(); return; }
            const state = entry.value; const draft = state.drafts[0];
            Object.assign(draft, { title, kind: "lesson", subject: "语文", sha256: hash, revision: 1,
              fileSize: bytes.length, blob: new Blob([new Uint8Array(bytes)], { type: "text/markdown" }) });
            state.favoriteIds = [];
            if (corruption === "title-object") draft.title = { invalid: true };
            if (corruption === "unknown-kind") draft.kind = "constructor";
            if (corruption === "file-size") draft.fileSize += 1;
            if (corruption === "invalid-hash") draft.sha256 = "not-a-sha256";
            if (corruption === "missing-blob") draft.blob = null;
            if (corruption === "invalid-favorite") state.favoriteIds = [42];
            if (corruption === "unknown-subject") draft.subject = "not-a-subject";
            if (corruption === "invalid-revision") draft.revision = 0;
            entry.update(state);
          };
          tx.oncomplete = () => { db.close(); resolve(); };
          tx.onabort = tx.onerror = () => { db.close(); reject(tx.error ?? new Error("Corruption fixture transaction aborted")); };
        };
      }), { corruption, bytes: [...BYTES], hash: HASH, title: TITLE });
      const before = await rawSummary();
      await openLibrary(corrupt);
      await expect(lib(corrupt).getByRole("alert")).toContainText("本机草稿数据无法读取，未覆盖已有内容");
      await expect(rows(corrupt)).toHaveCount(7);
      await expect(lib(corrupt)).not.toContainText(TITLE);
      await lib(corrupt).getByRole("button", { name: "查看 分数的意义：从一张纸开始", exact: true }).click();
      await expect(dialog(corrupt).getByRole("button", { name: "收藏", exact: true })).toBeDisabled();
      await expect(dialog(corrupt).getByRole("button", { name: "关闭资源详情" })).toBeEnabled();
      await shot(corrupt, `corrupt-${corruption}-detail`);
      await dialog(corrupt).getByRole("button", { name: "关闭资源详情" }).click();
      await expect(dialog(corrupt)).toHaveCount(0);
      await lib(corrupt).getByRole("button", { name: "重试读取本机草稿" }).click();
      await expect(lib(corrupt).getByRole("alert")).toContainText("未覆盖已有内容");
      assert.equal(await rawSummary(), before, "Failed read must not repair, replace or erase corrupt user data");
      observations.push({ corruption, failedClosed: true, dataUnchanged: true, detailClosed: true });
    }
    return observations;
  });
  const knowledge = await newPage("knowledge-header-entry");
  await check("U24", "Knowledge header links teacher to resources; student has no resource entry", knowledge, async () => {
    await knowledge.goto(`${BASE}/knowledge`, { waitUntil: "networkidle", timeout: 60_000 });
    await expect(knowledge.getByRole("heading", { name: "知识库", exact: true })).toBeVisible();
    const entry = knowledge.locator(".teacher-toolbar").getByRole("link", { name: "校内资源库", exact: true });
    await expect(entry).toBeVisible(); await expect(entry).toHaveAttribute("href", RESOURCE_PATH);
    await shot(knowledge, "teacher-knowledge-header-entry"); await entry.click();
    await expect(lib(knowledge)).toBeVisible(); assert.equal(new URL(knowledge.url()).pathname, RESOURCE_PATH);
    await student.goto(`${BASE}/knowledge`, { waitUntil: "networkidle", timeout: 60_000 });
    assert.ok(["/knowledge", "/student/home"].includes(new URL(student.url()).pathname), student.url());
    await expect(student.getByRole("link", { name: "校内资源库", exact: true })).toHaveCount(0);
    await shot(student, "student-no-resource-entry");
    return { teacherEntry: RESOURCE_PATH, studentPath: new URL(student.url()).pathname, studentResourceLinks: 0 };
  });
  const mobileActions = await newPage("mobile-footer-actions", { viewport: { width: 390, height: 844 } });
  await openLibrary(mobileActions);
  await check("U25", "Mobile upload/detail footer controls pass real hit tests and actual clicks", mobileActions, async () => {
    const hits = [];
    await startUpload(mobileActions);
    hits.push(...await assertButtonHit(dialog(mobileActions).getByRole("button", { name: "保存本机草稿", exact: true })));
    await save(mobileActions); await openDraft(mobileActions);
    for (const name of ["下载原文件", "编辑信息", "收藏", "移除本机草稿", "关闭资源详情"])
      hits.push(...await assertButtonHit(dialog(mobileActions).getByRole("button", { name, exact: true })));
    const download = await downloadBytes(mobileActions, dialog(mobileActions).getByRole("button", { name: "下载原文件" }), BYTES, "mobile-original");
    await dialog(mobileActions).getByRole("button", { name: "收藏", exact: true }).click();
    await expect(dialog(mobileActions).getByRole("button", { name: "已收藏", exact: true })).toHaveAttribute("aria-pressed", "true");
    await dialog(mobileActions).getByRole("button", { name: "编辑信息", exact: true }).click();
    await expect(dialog(mobileActions).getByRole("heading", { name: "编辑本机草稿" })).toBeVisible();
    await dialog(mobileActions).getByRole("textbox", { name: /^资源名称 1/ }).fill(EDITED_TITLE);
    await dialog(mobileActions).getByRole("checkbox").check(); await save(mobileActions);
    await openDraft(mobileActions, EDITED_TITLE);
    await dialog(mobileActions).getByRole("button", { name: "移除本机草稿", exact: true }).click();
    await expect(dialog(mobileActions).getByRole("alert")).toContainText("移除这份本机草稿");
    hits.push(...await assertButtonHit(dialog(mobileActions).getByRole("button", { name: "保留草稿", exact: true })));
    await dialog(mobileActions).getByRole("button", { name: "保留草稿", exact: true }).click();
    await shot(mobileActions, "mobile-detail-footer-hit-tested");
    await dialog(mobileActions).getByRole("button", { name: "关闭资源详情" }).click();
    await expect(dialog(mobileActions)).toHaveCount(0); return { hits, download, edited: true, favorite: true, removeCancelled: true };
  });
  await check("U26", "Floating safety control does not visually cover required consent on mobile", mobileActions, async () => {
    await startUpload(mobileActions, { name: "mobile-consent.md", title: "QA mobile consent", bytes: Buffer.from("# Unsaved consent check") });
    await dialog(mobileActions).getByRole("button", { name: "保存本机草稿", exact: true }).scrollIntoViewIfNeeded();
    const overlap = await dialog(mobileActions).getByRole("checkbox").evaluate(input => {
      const consent = input.closest("label"); const label = consent.getBoundingClientRect();
      const help = document.querySelector('button[aria-label="内容安全与求助"]');
      const h = help?.getBoundingClientRect();
      let top = Math.max(0, label.top), bottom = Math.min(innerHeight, label.bottom);
      let left = Math.max(0, label.left), right = Math.min(innerWidth, label.right);
      for (let node = consent.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node), box = node.getBoundingClientRect();
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
      }
      const visible = help && h.width > 0 && h.height > 0 && getComputedStyle(help).visibility !== "hidden" && getComputedStyle(help).opacity !== "0";
      const width = visible ? Math.max(0, Math.min(right, h.right) - Math.max(left, h.left)) : 0;
      const height = visible ? Math.max(0, Math.min(bottom, h.bottom) - Math.max(top, h.top)) : 0;
      return { visibleConsent: { left, right, top, bottom }, help: h?.toJSON(), overlapArea: width * height, width, height };
    });
    await shot(mobileActions, "mobile-consent-safety-overlap");
    assert.equal(overlap.overlapArea, 0, `Required consent visibly overlapped by global SafetyHelp: ${JSON.stringify(overlap)}`);
    await closeUpload(mobileActions); return overlap;
  });
  const stale = await newPage("two-tab-edit-conflict"); await openLibrary(stale);
  await check("U27", "Two real tabs reject stale overwrite and never resurrect a deleted edit target", stale, async () => {
    await startUpload(stale); await save(stale);
    const peer = await stale.context().newPage(); await openLibrary(peer);
    await openDraft(stale); await dialog(stale).getByRole("button", { name: "编辑信息", exact: true }).click();
    await openDraft(peer); await dialog(peer).getByRole("button", { name: "编辑信息", exact: true }).click();
    await dialog(peer).getByRole("textbox", { name: /^资源名称 1/ }).fill("Newest peer edit");
    await dialog(peer).getByRole("checkbox").check(); await save(peer);
    const newer = await database(peer);
    await dialog(stale).getByRole("textbox", { name: /^资源名称 1/ }).fill("Stale edit must not overwrite");
    await dialog(stale).getByRole("checkbox").check();
    await dialog(stale).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(stale).getByRole("alert")).toBeVisible();
    await expect(dialog(stale).getByRole("alert")).toContainText(/修改|更新|更改|过期|冲突/);
    assert.deepEqual(await database(stale), newer, "Stale editor must preserve newer metadata, Blob and revision");
    await shot(stale, "stale-editor-rejected"); await closeUpload(stale);
    await openLibrary(stale); await openDraft(stale, "Newest peer edit");
    await dialog(stale).getByRole("button", { name: "编辑信息", exact: true }).click();
    await openLibrary(peer); await openDraft(peer, "Newest peer edit");
    await dialog(peer).getByRole("button", { name: "移除本机草稿", exact: true }).click();
    await dialog(peer).getByRole("button", { name: "确认移除本机副本" }).click();
    await expect(dialog(peer)).toHaveCount(0); assert.deepEqual((await database(peer))[0].drafts, []);
    await dialog(stale).getByRole("textbox", { name: /^资源名称 1/ }).fill("Deleted draft must not resurrect");
    await dialog(stale).getByRole("checkbox").check();
    await dialog(stale).getByRole("button", { name: "保存本机草稿", exact: true }).click();
    await expect(dialog(stale).getByRole("alert")).toContainText(/移除|删除|不存在/);
    assert.deepEqual((await database(stale))[0].drafts, []);
    await shot(stale, "deleted-editor-rejected"); await closeUpload(stale); await peer.close();
    return { staleOverwriteRejected: true, deletedTargetNotResurrected: true, newerRevision: newer[0].drafts[0].revision };
  });
  const migration = await newPage("legacy-key-migration"); await openLibrary(migration);
  await check("U28", "Legacy session keys migrate atomically to stable account with newest resource and favorites", migration, async () => {
    await startUpload(migration); await save(migration);
    const initial = await accountInventory(migration); assert.equal(initial.length, 1);
    const accountId = initial[0].key;
    assert.equal(/:\d+$/.test(accountId), false, "Current UI must use stable account id, not sessionVersion-suffixed storage key");
    await migration.evaluate(async ({ accountId }) => new Promise((resolve, reject) => {
      const open = indexedDB.open("eduai-school-resources-v1");
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result; const tx = db.transaction("accounts", "readwrite"); const store = tx.objectStore("accounts");
        const get = store.get(accountId);
        get.onsuccess = () => {
          const old = get.result; const newest = structuredClone(old);
          old.favoriteIds = ["example-water"];
          newest.favoriteIds = [old.drafts[0].id, "example-light"];
          newest.drafts[0].title = "Newest migrated legacy lesson";
          newest.drafts[0].updatedAt += 1000;
          newest.drafts[0].revision = (newest.drafts[0].revision ?? 0) + 1;
          store.delete(accountId); store.put(old, `${accountId}:1`); store.put(newest, `${accountId}:2`);
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), { accountId });
    const seeded = await accountInventory(migration); assert.equal(seeded.length, 2);
    // Keep the fault active through React dev-mode duplicate reads until the explicit retry.
    await migration.addInitScript(() => { window.__resourceAbortAllWrites = true; });
    await openLibrary(migration);
    await expect(lib(migration).getByRole("alert")).toBeVisible();
    assert.deepEqual(await accountInventory(migration), seeded, "Aborted migration must retain both legacy keys without partial stable write/deletion");
    await migration.evaluate(() => { window.__resourceAbortAllWrites = false; });
    await lib(migration).getByRole("button", { name: "重试读取本机草稿" }).click();
    await expect(lib(migration).getByRole("alert")).toHaveCount(0);
    await expect(lib(migration)).toContainText("Newest migrated legacy lesson");
    const result = await accountInventory(migration); assert.equal(result.length, 1); assert.equal(result[0].key, accountId);
    assert.equal(result[0].drafts.length, 1); assert.equal(result[0].drafts[0].title, "Newest migrated legacy lesson");
    assert.deepEqual([...result[0].favoriteIds].sort(), [initial[0].drafts[0].id, "example-light", "example-water"].sort());
    assert.equal(result[0].drafts[0].sha256, HASH); assert.equal(result[0].drafts[0].blobIsBlob, true);
    await openDraft(migration, "Newest migrated legacy lesson");
    await downloadBytes(migration, dialog(migration).getByRole("button", { name: "下载原文件" }), BYTES, "migrated-original");
    await shot(migration, "legacy-key-migrated"); await dialog(migration).getByRole("button", { name: "关闭资源详情" }).click();
    return { oldKeyCount: 2, newKeyCount: 1, abortedMigrationAtomic: true, favoriteCount: result[0].favoriteIds.length, blobPreserved: true };
  });
  const isolation = await newPage("same-browser-account-isolation"); await openLibrary(isolation);
  await check("U29", "Same account retains drafts across login; different staff account cannot see or overwrite them", isolation, async () => {
    await startUpload(isolation); await save(isolation);
    const original = await accountInventory(isolation); assert.equal(original.length, 1);
    const teacherLogin = await isolation.context().request.post(`${BASE}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" } });
    assert.equal(teacherLogin.status(), 200); await openLibrary(isolation);
    await lib(isolation).getByRole("button", { name: /我的草稿/ }).click();
    await expect(rows(isolation)).toHaveCount(1); await expect(rows(isolation)).toContainText(TITLE);
    assert.deepEqual(await accountInventory(isolation), original);
    const otherLogin = await isolation.context().request.post(`${BASE}/api/auth/login`, { data: { username: "research", password: "Research@123" } });
    assert.equal(otherLogin.status(), 200, "Existing research demo credential must work without account mutations");
    await openLibrary(isolation); await lib(isolation).getByRole("button", { name: /我的草稿/ }).click();
    await expect(rows(isolation)).toHaveCount(0); await expect(lib(isolation)).not.toContainText(TITLE);
    await startUpload(isolation, { name: "other-account.md", title: "Other account private draft", bytes: Buffer.from("# Different account's file") }); await save(isolation);
    const both = await accountInventory(isolation); assert.equal(both.length, 2);
    assert.deepEqual(both.find(account => account.key === original[0].key), original[0]);
    const restoredLogin = await isolation.context().request.post(`${BASE}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" } });
    assert.equal(restoredLogin.status(), 200); await openLibrary(isolation);
    await lib(isolation).getByRole("button", { name: /我的草稿/ }).click();
    await expect(rows(isolation)).toHaveCount(1); await expect(rows(isolation)).toContainText(TITLE);
    await expect(lib(isolation)).not.toContainText("Other account private draft");
    return { sameAccountStable: true, distinctStoredAccounts: both.length, crossAccountLeak: false, realSessionVersionChange: "not attempted; legacy-key migration covers versioned storage fixtures" };
  });
  const legacy = await newPage("real-v1-upgrade");
  await check("U30", "Actual v1 database upgrades with legacy Blob intact; old v1 clients receive VersionError", legacy, async () => {
    await legacy.route("**/__qa-school-resources-seed__", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Isolated legacy database fixture</title>" }));
    await legacy.goto(`${BASE}/__qa-school-resources-seed__`);
    await legacy.evaluate(async ({ accountId, bytes, hash }) => new Promise((resolve, reject) => {
      const request = indexedDB.open("eduai-school-resources-v1", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("accounts");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction("accounts", "readwrite");
        tx.objectStore("accounts").put({ favoriteIds: ["local-v1-original"], drafts: [{
          id: "local-v1-original", origin: "local", title: "Original schema v1 lesson", kind: "lesson", subject: "语文", grade: "六年级",
          description: "Version 1 fixture deliberately has no revision field.", author: "QA fixture", scope: "private", rights: "own",
          updatedAt: Date.now(), fileName: "v1-original.md", fileSize: bytes.length, mimeType: "text/markdown", sha256: hash,
          blob: new Blob([new Uint8Array(bytes)], { type: "text/markdown" }),
        }] }, `${accountId}:17`);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
      };
    }), { accountId: teacherAccountId, bytes: [...BYTES], hash: HASH });
    await openLibrary(legacy); await openDraft(legacy, "Original schema v1 lesson");
    await downloadBytes(legacy, dialog(legacy).getByRole("button", { name: "下载原文件" }), BYTES, "v1-original");
    await dialog(legacy).getByRole("button", { name: "关闭资源详情" }).click();
    const inventory = await accountInventory(legacy);
    assert.equal(inventory.length, 1); assert.equal(inventory[0].key, teacherAccountId);
    assert.equal(inventory[0].drafts[0].revision, 1);
    const oldClientError = await legacy.evaluate(() => new Promise(resolve => {
      const request = indexedDB.open("eduai-school-resources-v1", 1);
      request.onerror = event => { event.preventDefault(); resolve(request.error.name); };
      request.onsuccess = () => { request.result.close(); resolve("unexpected-success"); };
    }));
    assert.equal(oldClientError, "VersionError");
    return { revision: 1, oldClientError, stableAccountKey: true, migratedBlobUnchanged: true };
  });
  const landscape = await newPage("landscape-footer", { viewport: { width: 844, height: 390 } }); await openLibrary(landscape);
  await check("U31", "844x390 landscape upload/detail keep footer controls hittable and functional", landscape, async () => {
    await assertNoHorizontalOverflow(landscape, "landscape-list");
    await startUpload(landscape);
    const saveHits = await assertButtonHit(dialog(landscape).getByRole("button", { name: "保存本机草稿", exact: true }));
    await shot(landscape, "landscape-upload-844x390"); await save(landscape);
    await openDraft(landscape);
    await assertNoHorizontalOverflow(landscape, "landscape-detail");
    const downloadHits = await assertButtonHit(dialog(landscape).getByRole("button", { name: "下载原文件", exact: true }));
    const closeHits = await assertButtonHit(dialog(landscape).getByRole("button", { name: "关闭资源详情", exact: true }));
    const download = await downloadBytes(landscape, dialog(landscape).getByRole("button", { name: "下载原文件" }), BYTES, "landscape-original");
    await shot(landscape, "landscape-detail-844x390");
    await dialog(landscape).getByRole("button", { name: "关闭资源详情" }).click();
    await expect(dialog(landscape)).toHaveCount(0); return { saveHits, downloadHits, closeHits, download };
  });
  const shortLandscape = await newPage("short-landscape-568x320", { viewport: { width: 568, height: 320 } }); await openLibrary(shortLandscape);
  await check("U32", "568x320 consent/save and detail download/close work with pointer and keyboard without safety overlap", shortLandscape, async () => {
    const observations = [];
    // Keyboard proof must inspect the browser's own focus scrolling, not scroll the target for it.
    const inspect = async (control, label) => {
      const actual = await control.evaluate(el => {
        const box = el.getBoundingClientRect();
        const help = document.querySelector('button[aria-label="内容安全与求助"]');
        const h = help?.getBoundingClientRect();
        const helpVisible = help && h.width > 0 && h.height > 0 && getComputedStyle(help).visibility !== "hidden" && getComputedStyle(help).opacity !== "0";
        const overlapArea = helpVisible ? Math.max(0, Math.min(box.right, h.right) - Math.max(box.left, h.left))
          * Math.max(0, Math.min(box.bottom, h.bottom) - Math.max(box.top, h.top)) : 0;
        const points = [0.2, 0.5, 0.8].map(fraction => {
          const x = box.left + box.width * fraction, y = box.top + box.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { x, y, hitsControl: !!hit && (el === hit || el.contains(hit)), actualTarget: hit?.getAttribute("aria-label") || hit?.textContent?.trim().slice(0, 80) };
        });
        const modal = el.closest('[role="dialog"]');
        const modalBox = modal?.getBoundingClientRect();
        const dialogSafetyOverlapArea = helpVisible && modalBox ? Math.max(0, Math.min(modalBox.right, h.right) - Math.max(modalBox.left, h.left))
          * Math.max(0, Math.min(modalBox.bottom, h.bottom) - Math.max(modalBox.top, h.top)) : 0;
        return { box: box.toJSON(), focused: document.activeElement === el, overlapArea, points,
          dialog: modalBox?.toJSON(), dialogSafetyOverlapArea, dialogScrollTop: modal?.scrollTop, dialogScrollHeight: modal?.scrollHeight };
      });
      observations.push({ label, ...actual });
      writeFileSync(join(RUN_DIR, "U32-interaction-evidence.json"), `${JSON.stringify(observations, null, 2)}\n`);
      assert.ok(actual.box.width > 0 && actual.box.height > 0, `${label}: empty control box`);
      assert.ok(actual.box.left >= 0 && actual.box.right <= 569 && actual.box.top >= 0 && actual.box.bottom <= 321, `${label}: off-screen ${JSON.stringify(actual)}`);
      assert.ok(actual.points.every(point => point.hitsControl), `${label}: focused/control target is clipped or obscured ${JSON.stringify(actual)}`);
      assert.equal(actual.overlapArea, 0, `${label}: SafetyHelp intersects the control`);
      assert.equal(actual.dialogSafetyOverlapArea, 0, `${label}: SafetyHelp overlaps the visible dialog`);
      return actual;
    };
    const tabTo = async control => {
      for (let steps = 0; steps < 40; steps++) {
        if (await control.evaluate(el => document.activeElement === el)) return steps;
        await shortLandscape.keyboard.press("Tab");
        assert.equal(await dialog(shortLandscape).evaluate(el => el.contains(document.activeElement)), true, "Keyboard focus must remain in the active modal");
      }
      throw new Error("Target was not keyboard reachable within one bounded tab traversal");
    };

    await startUpload(shortLandscape);
    const pointerConsent = dialog(shortLandscape).getByRole("checkbox");
    await pointerConsent.uncheck(); await inspect(pointerConsent, "pointer-consent-unchecked");
    await pointerConsent.click(); await expect(pointerConsent).toBeChecked();
    await inspect(pointerConsent, "pointer-consent-checked");
    await shot(shortLandscape, "short-landscape-pointer-consent-568x320");
    const pointerSave = dialog(shortLandscape).getByRole("button", { name: "保存本机草稿", exact: true });
    await assertButtonHit(pointerSave); await inspect(pointerSave, "pointer-save");
    await shot(shortLandscape, "short-landscape-pointer-save-568x320"); await save(shortLandscape);
    await openDraft(shortLandscape);
    const pointerDownload = dialog(shortLandscape).getByRole("button", { name: "下载原文件", exact: true });
    await assertButtonHit(pointerDownload); await inspect(pointerDownload, "pointer-download");
    const pointerFile = await downloadBytes(shortLandscape, pointerDownload, BYTES, "short-landscape-pointer-original");
    await shot(shortLandscape, "short-landscape-pointer-detail-footer-568x320");
    const pointerClose = dialog(shortLandscape).getByRole("button", { name: "关闭资源详情", exact: true });
    await assertButtonHit(pointerClose); await inspect(pointerClose, "pointer-close");
    await pointerClose.click(); await expect(dialog(shortLandscape)).toHaveCount(0);

    const keyboardBytes = Buffer.from("# Short landscape keyboard regression\n\nConsent and save via real keyboard.\n");
    const keyboardTitle = "QA 568 keyboard saved";
    await startUpload(shortLandscape, { name: "short-keyboard.md", title: keyboardTitle, bytes: keyboardBytes });
    const keyboardConsent = dialog(shortLandscape).getByRole("checkbox");
    await keyboardConsent.uncheck();
    await shortLandscape.keyboard.press("Shift+Tab");
    assert.equal(await keyboardConsent.evaluate(el => document.activeElement === el), false, "Shift+Tab must leave the checkbox");
    const consentTabSteps = await tabTo(keyboardConsent);
    await expect(keyboardConsent).toBeFocused(); await inspect(keyboardConsent, "keyboard-consent-focused");
    await shortLandscape.keyboard.press("Space"); await expect(keyboardConsent).toBeChecked();
    await shot(shortLandscape, "short-landscape-keyboard-consent-568x320");
    const keyboardSave = dialog(shortLandscape).getByRole("button", { name: "保存本机草稿", exact: true });
    const saveTabSteps = await tabTo(keyboardSave);
    await expect(keyboardSave).toBeFocused(); await inspect(keyboardSave, "keyboard-save-focused");
    await shot(shortLandscape, "short-landscape-keyboard-save-568x320");
    await shortLandscape.keyboard.press("Enter");
    await expect(dialog(shortLandscape)).toHaveCount(0);
    await expect(lib(shortLandscape).getByRole("status")).toContainText("已保存 1 份本机草稿");
    assert.equal((await database(shortLandscape))[0].drafts.some(draft => draft.title === keyboardTitle), true);
    await openDraft(shortLandscape, keyboardTitle);
    const keyboardDownload = dialog(shortLandscape).getByRole("button", { name: "下载原文件", exact: true });
    const downloadTabSteps = await tabTo(keyboardDownload);
    await expect(keyboardDownload).toBeFocused(); await inspect(keyboardDownload, "keyboard-download-focused");
    await shot(shortLandscape, "short-landscape-keyboard-detail-footer-568x320");
    const keyboardDownloadEvent = shortLandscape.waitForEvent("download");
    await shortLandscape.keyboard.press("Enter");
    const keyboardFile = await keyboardDownloadEvent; assert.equal(await keyboardFile.failure(), null);
    const keyboardPath = join(RUN_DIR, `short-landscape-keyboard-${keyboardFile.suggestedFilename()}`);
    await keyboardFile.saveAs(keyboardPath); assert.deepEqual(readFileSync(keyboardPath), keyboardBytes);
    const keyboardClose = dialog(shortLandscape).getByRole("button", { name: "关闭资源详情", exact: true });
    const closeTabSteps = await tabTo(keyboardClose);
    await expect(keyboardClose).toBeFocused(); await inspect(keyboardClose, "keyboard-close-focused");
    await shortLandscape.keyboard.press("Enter"); await expect(dialog(shortLandscape)).toHaveCount(0);
    await expect(lib(shortLandscape).getByRole("button", { name: `查看 ${keyboardTitle}`, exact: true })).toBeFocused();
    await assertNoHorizontalOverflow(shortLandscape, "short-landscape-final");
    return { observations, consentTabSteps, saveTabSteps, downloadTabSteps, closeTabSteps, pointerFile,
      keyboardDownload: { path: keyboardPath, bytes: keyboardBytes.length, sha256: hashFile(keyboardPath) }, testAssistedKeyboardScrolling: false };
  });
  await check("U21", "No resource network mutations, runtime errors or failed resource assets", desktop, async () => {
    const mutations = report.diagnostics.flatMap(d => d.blockedMutations.map(m => ({ context: d.label, ...m })));
    const errors = report.diagnostics.flatMap(d => d.pageErrors.map(error => ({ context: d.label, error })));
    const assetFailures = report.diagnostics.flatMap(d => d.failedResponses.filter(r => r.url.includes("/art/school-resources/")));
    assert.deepEqual(mutations, []); assert.deepEqual(errors, []); assert.deepEqual(assetFailures, []);
    const consoleErrors = report.diagnostics.flatMap(d => d.errors.map(error => ({ context: d.label, error })));
    assert.deepEqual(consoleErrors, []);
    return { blockedMutations: 0, pageErrors: 0, consoleErrors: 0, failedResourceAssets: 0, api: report.diagnostics.flatMap(d => d.api) };
  });
} catch (error) {
  report.checks.push({ id: "HARNESS", label: "Remaining execution availability", status: "failed", error: error.stack });
  console.error(error);
} finally {
  for (const context of contexts) await context.close().catch(() => undefined);
  if (browser) await browser.close();
  report.sourceHashesAfter = {};
  for (const path of sourceFiles) report.sourceHashesAfter[path] = hashFile(resolve(root, path));
  report.sourceChangedDuringRun = sourceFiles.filter(path => report.sourceHashesBefore[path] !== report.sourceHashesAfter[path]);
  if (report.sourceChangedDuringRun.length) report.testLimits.push("Shared product source changed during execution; rerun against stable source before final acceptance.");
  flush(); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, report: join(RUN_DIR, "ui-report.json"), sourceChangedDuringRun: report.sourceChangedDuringRun }, null, 2));
  process.exitCode = report.failed || report.sourceChangedDuringRun.length ? 1 : 0;
}
