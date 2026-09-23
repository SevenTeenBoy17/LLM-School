import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const ASSET_DIR = path.resolve("public/art/teacher-feature-icons-v2");
const OUT = path.resolve("tests/artifacts/teacher-feature-icons-v2");
const ROUTES = [
  {
    path: "/agent",
    names: ["agent-workspace", "conversations", "verified-quality", "published-toolbox", "research-review", "lesson-plan", "paper-polish"],
  },
  {
    path: "/hub",
    names: ["model-marketplace", "lesson-test", "paper-polish", "courseware-art"],
  },
  {
    path: "/prompts",
    names: ["prompt-library", "category-all", "category-teaching", "category-courseware", "prompt-lesson-plan", "prompt-tiered-homework"],
  },
  {
    path: "/dashboard",
    names: ["conversations", "agent-workspace", "class-mastery", "pending-review", "knowledge-book", "fair-use", "source-database"],
  },
];

function digest(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function inspectAssets() {
  const manifest = JSON.parse(await readFile(path.join(ASSET_DIR, "manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.collection, "teacher-feature-icons-v2");
  assert.equal(manifest.assets.length, 48, "feature icon inventory drifted");
  assert.equal(new Set(manifest.assets.map((asset) => asset.id)).size, 48, "feature icon ids are not unique");

  for (const asset of manifest.assets) {
    assert.match(asset.file, /^[a-z0-9-]+\.png$/, `${asset.id} is not a transparent PNG asset`);
    const buffer = await readFile(path.join(ASSET_DIR, asset.file));
    assert.equal(digest(buffer), asset.sha256, `${asset.id} hash differs from the manifest`);
    const image = sharp(buffer).ensureAlpha();
    const metadata = await image.metadata();
    assert.equal(metadata.width, 320, `${asset.id} width drifted`);
    assert.equal(metadata.height, 320, `${asset.id} height drifted`);
    assert.equal(metadata.hasAlpha, true, `${asset.id} has no alpha channel`);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    let visible = 0;
    let transparent = 0;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const alpha = data[offset + 3];
      if (alpha > 16) visible += 1;
      if (alpha === 0) transparent += 1;
    }
    assert.ok(visible > 3_000, `${asset.id} lost too much foreground art`);
    assert.ok(transparent > 20_000, `${asset.id} appears to contain an opaque backing tile`);
    const corners = [0, 319, 320 * 319, 320 * 320 - 1];
    assert.equal(corners.every((pixel) => data[pixel * info.channels + 3] === 0), true, `${asset.id} retained an opaque corner`);
  }
}

async function login(context) {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(response.ok(), true, `teacher login failed: ${response.status()}`);
}

async function dismissOnboarding(page) {
  const dismiss = page.getByRole("button", { name: "关闭引导，稍后再看" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.locator('.onboarding-experience[role="dialog"]').waitFor({ state: "detached" });
  }
}

async function waitForGlyphs(page, names) {
  await page.waitForLoadState("networkidle");
  for (const name of names) {
    await page.locator(`[data-teacher-feature-glyph="${name}"]`).first().waitFor({ state: "attached", timeout: 15_000 });
  }
  await page.locator("[data-teacher-feature-glyph] img").evaluateAll((images) => {
    for (const image of images) image.loading = "eager";
  });
  await page.waitForFunction((required) => required.every((name) => {
    const image = document.querySelector(`[data-teacher-feature-glyph="${name}"] img`);
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
  }), names);
}

async function inspectGlyphs(page, requiredNames) {
  const metrics = await page.locator("[data-teacher-feature-glyph]").evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    const image = node.querySelector("img");
    const styles = getComputedStyle(node);
    const before = getComputedStyle(node, "::before");
    const after = getComputedStyle(node, "::after");
    return {
      name: node.getAttribute("data-teacher-feature-glyph"),
      width: box.width,
      height: box.height,
      source: image?.getAttribute("src") || "",
      naturalWidth: image?.naturalWidth || 0,
      background: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      borderWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
      fallback: node.getAttribute("data-fallback") === "true",
      beforeSurface: before.content !== "none" && (before.backgroundImage !== "none" || before.backgroundColor !== "rgba(0, 0, 0, 0)"),
      afterSurface: after.content !== "none" && (after.backgroundImage !== "none" || after.backgroundColor !== "rgba(0, 0, 0, 0)"),
    };
  }));

  const names = new Set(metrics.map((item) => item.name));
  for (const name of requiredNames) assert.ok(names.has(name), `missing feature glyph: ${name}`);
  assert.equal(metrics.every((item) => item.width >= 26 && item.width <= 60 && item.height === item.width), true, "feature glyph sizing drifted");
  assert.equal(metrics.every((item) => item.source.includes("/art/teacher-feature-icons-v2/") && item.source.endsWith(".png")), true, "feature glyph used an unexpected source");
  assert.equal(metrics.every((item) => item.naturalWidth > 0), true, "one or more feature glyphs failed to load");
  assert.equal(metrics.every((item) => item.background === "rgba(0, 0, 0, 0)"), true, "feature glyph has an opaque wrapper");
  assert.equal(metrics.every((item) => item.backgroundImage === "none"), true, "feature glyph has a CSS backing image");
  assert.equal(metrics.every((item) => item.borderWidth === "0px"), true, "feature glyph has a visible frame");
  assert.equal(metrics.every((item) => item.boxShadow === "none"), true, "feature glyph has a rectangular shadow");
  assert.equal(metrics.every((item) => !item.fallback), true, "feature glyph unexpectedly fell back to a line icon");
  assert.equal(metrics.every((item) => !item.beforeSurface && !item.afterSurface), true, "feature glyph has a pseudo-element backing tile");
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `${label} overflows horizontally by ${overflow}px`);
}

async function exerciseInteractions(page, route) {
  if (route === "/agent") {
    await page.getByRole("tab", { name: "科研" }).click();
    await page.getByText("论文润色与翻译助手", { exact: true }).waitFor({ state: "visible" });
  }
  if (route === "/hub") {
    const href = await page.getByRole("link", { name: /教案与试题/ }).getAttribute("href");
    assert.match(href || "", /^\/chat\?model=chatgpt&seed=/, "model recommendation link lost its action payload");
  }
  if (route === "/prompts") {
    const teaching = page.locator("aside button[aria-pressed]").filter({ hasText: "教学设计" }).first();
    await teaching.click();
    assert.equal(await teaching.getAttribute("aria-pressed"), "true", "prompt category did not become selected");
    await page.getByText("结构化教案·课标锚定版", { exact: true }).first().waitFor({ state: "visible" });
  }
  if (route === "/dashboard") {
    const disclosure = page.getByTestId("dashboard-source-readback").getByRole("button", { name: /后端来源回读/ });
    await disclosure.click();
    assert.equal(await disclosure.getAttribute("aria-expanded"), "true", "source readback did not expand");
  }
}

await mkdir(OUT, { recursive: true });
await inspectAssets();

const browser = await chromium.launch();

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(context);
  for (const route of ROUTES) {
    const page = await context.newPage();
    const pageErrors = [];
    const consoleIssues = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
    await dismissOnboarding(page);
    await waitForGlyphs(page, route.names);
    await dismissOnboarding(page);
    await inspectGlyphs(page, route.names);
    await assertNoOverflow(page, `${route.path} at 1440px`);
    await exerciseInteractions(page, route.path);
    await page.screenshot({ path: path.join(OUT, `${route.path.slice(1)}-1440.png`), fullPage: true, animations: "disabled" });
    assert.deepEqual(pageErrors, [], `${route.path} emitted page errors`);
    assert.deepEqual(consoleIssues, [], `${route.path} emitted console issues`);
    await page.close();
  }
  await context.close();
}

for (const width of [1024, 768, 390]) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, reducedMotion: "reduce" });
  await login(context);
  for (const route of ROUTES) {
    const page = await context.newPage();
    const consoleIssues = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleIssues.push(`${message.type()}: ${message.text()}`);
    });
    await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded" });
    await dismissOnboarding(page);
    await waitForGlyphs(page, route.names.slice(0, 1));
    await dismissOnboarding(page);
    await assertNoOverflow(page, `${route.path} at ${width}px`);
    if (width === 390) {
      await page.screenshot({ path: path.join(OUT, `${route.path.slice(1)}-390.png`), fullPage: true, animations: "disabled" });
    }
    assert.deepEqual(consoleIssues, [], `${route.path} at ${width}px emitted console issues`);
    await page.close();
  }
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/hub`, { waitUntil: "domcontentloaded" });
  await dismissOnboarding(page);
  await waitForGlyphs(page, ROUTES.find((route) => route.path === "/hub").names);
  const reducedMotion = await page.locator("[data-teacher-feature-glyph]").first().evaluate((node) => ({
    transform: getComputedStyle(node).transform,
    duration: getComputedStyle(node).transitionDuration,
  }));
  assert.equal(reducedMotion.transform, "none");
  assert.ok(Number.parseFloat(reducedMotion.duration) <= 0.0001, "reduced-motion transition is not disabled");
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(context);
  const page = await context.newPage();
  await page.route("**/art/teacher-feature-icons-v2/*.png", (route) => route.abort());
  await page.goto(`${BASE}/hub`, { waitUntil: "domcontentloaded" });
  await dismissOnboarding(page);
  const fallbacks = page.locator(".teacher-feature-glyph-fallback");
  await fallbacks.first().waitFor({ state: "visible", timeout: 15_000 });
  assert.equal(await fallbacks.count(), 4, "asset failure did not render all visible hub fallbacks");
  const fallbackMetrics = await fallbacks.evaluateAll((nodes) => nodes.map((node) => {
    const styles = getComputedStyle(node);
    return {
      background: styles.backgroundColor,
      borderWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
    };
  }));
  assert.equal(fallbackMetrics.every((item) => item.background === "rgba(0, 0, 0, 0)"), true, "fallback has an opaque wrapper");
  assert.equal(fallbackMetrics.every((item) => item.borderWidth === "0px"), true, "fallback has a visible frame");
  assert.equal(fallbackMetrics.every((item) => item.boxShadow === "none"), true, "fallback has a rectangular shadow");
  await context.close();
}

await browser.close();
console.log(`teacher feature glyph checks passed for 48 assets and ${ROUTES.length} routes`);
