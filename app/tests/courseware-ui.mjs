import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const tempDbDir = mkdtempSync(`${tmpdir()}${sep}eduai-courseware-ui-`);
const previousApiKey = process.env.LLM_API_KEY;
process.env.LLM_API_KEY = "";

let serverHandle;
let browser;
try {
  serverHandle = await startIsolatedManorDevServer({ label: "courseware-ui", tempDbDir });
  const { base } = serverHandle;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const login = await context.request.post(`${base}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(login.status(), 200);

  const plannedResponse = await context.request.post(`${base}/api/courseware/plan`, {
    data: {
      operationId: "courseware-ui-plan-0001",
      subject: "信息科技",
      grade: "八年级",
      topic: "移动端冲突恢复验证",
      slideCount: 6,
      objectives: ["检查草稿防丢失", "完成版本冲突选择"],
      style: "clear",
      sourceSummary: "",
      uploadIds: [],
    },
  });
  assert.equal(plannedResponse.status(), 200);
  const planned = await plannedResponse.json();

  await page.goto(`${base}/research/courseware`);
  const planOperationIds = [];
  let abortFirstPlanResponse = true;
  await page.route("**/api/courseware/plan", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    planOperationIds.push(body.operationId);
    if (abortFirstPlanResponse) {
      abortFirstPlanResponse = false;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByLabel("课件主题 *").fill("客户端生成重试");
  await page.getByRole("button", { name: "生成逐页方案" }).click();
  await page.getByRole("button", { name: "生成逐页方案" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "生成逐页方案" }).click();
  await page.getByRole("heading", { name: "客户端生成重试课堂课件" }).waitFor({ state: "visible" });
  await page.unroute("**/api/courseware/plan");
  assert.equal(planOperationIds.length, 2);
  assert.equal(planOperationIds[0], planOperationIds[1], "generation retry changed its idempotency key");
  const generatedItems = (await (await context.request.get(`${base}/api/courseware`)).json()).items;
  assert.equal(generatedItems.filter((item) => item.title === "客户端生成重试课堂课件").length, 1, "ambiguous generation retry created a duplicate deck");

  await page.getByRole("button", { name: new RegExp(planned.authoritativeEntity.title) }).click();
  const titleInput = page.getByLabel("页面标题");
  const originalTitle = await titleInput.inputValue();
  const localTitle = `${originalTitle}（本地草稿）`;
  await page.evaluate(() => {
    window.history.pushState(window.history.state, "", "/research/artifacts");
    window.history.pushState(window.history.state, "", "/research/courseware");
  });
  await titleInput.fill(localTitle);

  await page.locator("#main").getByRole("link", { name: "教学产物" }).click();
  assert.equal(new URL(page.url()).pathname, "/research/courseware");
  const navigationGroup = page.getByRole("group", { name: "未保存导航处理" });
  await navigationGroup.waitFor({ state: "visible" });
  const mobileLayout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    buttonHeights: Array.from(document.querySelectorAll('[role="group"][aria-label="未保存导航处理"] button'))
      .map((button) => Math.round(button.getBoundingClientRect().height)),
  }));
  assert.equal(mobileLayout.clientWidth, 390);
  assert.equal(mobileLayout.scrollWidth, mobileLayout.clientWidth, "navigation recovery panel introduced horizontal overflow");
  assert.equal(mobileLayout.buttonHeights.every((height) => height >= 44), true, "navigation recovery actions are too small for touch");
  await navigationGroup.getByRole("button", { name: "继续编辑" }).click();

  await page.evaluate(() => window.history.back());
  await navigationGroup.waitFor({ state: "visible" });
  assert.equal(new URL(page.url()).pathname, "/research/courseware", "history navigation bypassed the dirty guard");
  await navigationGroup.getByRole("button", { name: "继续编辑" }).click();

  const saveOperationIds = [];
  let abortFirstSaveResponse = true;
  await page.route(`**/api/courseware/${planned.authoritativeEntity.id}`, async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const body = JSON.parse(route.request().postData() ?? "{}");
    saveOperationIds.push(body.operationId);
    if (abortFirstSaveResponse) {
      abortFirstSaveResponse = false;
      await route.fetch();
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: /保存修改/ }).click();
  await page.getByRole("button", { name: /保存修改/ }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: /保存修改/ }).click();
  await page.getByText("已保存服务端版本 v2。").waitFor({ state: "visible" });
  await page.unroute(`**/api/courseware/${planned.authoritativeEntity.id}`);
  assert.equal(saveOperationIds.length, 2);
  assert.equal(saveOperationIds[0], saveOperationIds[1], "save retry changed its idempotency key");

  const conflictLocalTitle = `${localTitle}（冲突草稿）`;
  await titleInput.fill(conflictLocalTitle);

  const serverDeckV1 = (await (await context.request.get(`${base}/api/courseware/${planned.authoritativeEntity.id}`)).json()).deck;
  const externalSaveV3 = await context.request.patch(`${base}/api/courseware/${serverDeckV1.id}`, {
    data: {
      operationId: "courseware-ui-external-save-0002",
      stateVersion: serverDeckV1.stateVersion,
      plan: serverDeckV1.plan,
    },
  });
  assert.equal(externalSaveV3.status(), 200);

  await page.getByRole("button", { name: /保存修改/ }).click();
  const conflictGroup = page.getByRole("group", { name: "版本冲突处理" });
  await conflictGroup.waitFor({ state: "visible" });
  assert.equal(await titleInput.inputValue(), conflictLocalTitle, "version conflict discarded the local draft");
  await conflictGroup.getByRole("button", { name: "保留本地草稿" }).click();
  assert.equal(await titleInput.inputValue(), conflictLocalTitle);
  await page.getByText("已保留本地草稿并基于服务端 v3 继续，请复核后再次保存。").waitFor({ state: "visible" });

  const serverDeckV2 = (await (await context.request.get(`${base}/api/courseware/${planned.authoritativeEntity.id}`)).json()).deck;
  const externalSaveV4 = await context.request.patch(`${base}/api/courseware/${serverDeckV2.id}`, {
    data: {
      operationId: "courseware-ui-external-save-0003",
      stateVersion: serverDeckV2.stateVersion,
      plan: serverDeckV2.plan,
    },
  });
  assert.equal(externalSaveV4.status(), 200);

  await page.getByRole("button", { name: /保存修改/ }).click();
  await conflictGroup.waitFor({ state: "visible" });
  assert.equal(await titleInput.inputValue(), conflictLocalTitle);
  await conflictGroup.getByRole("button", { name: "载入服务端 v4" }).click();
  assert.equal(await titleInput.inputValue(), localTitle);
  assert.equal(await conflictGroup.count(), 0);

  console.log(JSON.stringify({
    ok: true,
    viewport: mobileLayout,
    navigationGuard: true,
    historyGuard: true,
    generationRetryKeyReused: true,
    saveRetryKeyReused: true,
    localDraftPreserved: true,
    conflictChoices: ["keep-local", "load-server"],
  }, null, 2));
} finally {
  if (previousApiKey === undefined) delete process.env.LLM_API_KEY;
  else process.env.LLM_API_KEY = previousApiKey;
  await browser?.close();
  await serverHandle?.cleanup();
  const resolvedTemp = resolve(tempDbDir);
  const tempPrefix = `${resolve(tmpdir())}${sep}`;
  if (!resolvedTemp.startsWith(tempPrefix) || !basename(resolvedTemp).startsWith("eduai-courseware-ui-")) {
    throw new Error(`Refusing to remove unexpected temp path: ${resolvedTemp}`);
  }
  rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
