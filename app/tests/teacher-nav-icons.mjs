import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = "tests/artifacts/teacher-nav-icons";
const EXPECTED = [
  "dashboard", "class", "manor-evidence", "chat", "prompts", "knowledge",
  "research-center", "research-paper", "research-prep", "research-courseware",
  "research-artifacts", "hub", "agent", "skills",
];
const EXPECTED_CELL = new Map([
  ["dashboard", { column: 0, row: 0 }],
  ["class", { column: 1, row: 0 }],
  ["manor-evidence", { column: 2, row: 0 }],
  ["chat", { column: 3, row: 0 }],
  ["prompts", { column: 0, row: 1 }],
  ["knowledge", { column: 1, row: 1 }],
  ["research-center", { column: 2, row: 1 }],
  ["research-paper", { column: 3, row: 1 }],
  ["research-prep", { column: 0, row: 2 }],
  ["research-courseware", { column: 1, row: 2 }],
  ["research-artifacts", { column: 2, row: 2 }],
  ["hub", { column: 3, row: 2 }],
  ["agent", { column: 0, row: 3 }],
  ["skills", { column: 2, row: 3 }],
]);

mkdirSync(OUT, { recursive: true });

const metadata = await sharp("public/art/icons/teacher-nav-atlas-v2.webp").metadata();
assert.equal(metadata.width, 896);
assert.equal(metadata.height, 896);
assert.equal(metadata.hasAlpha, true, "teacher icon atlas must preserve transparency");

// Alpha-channel presence alone would still allow a baked white rounded tile. Check
// each used atlas cell for broad transparency and clean outer/corner margins.
const atlasPixels = await sharp("public/art/icons/teacher-nav-atlas-v2.webp")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const ATLAS_CELL_SIZE = 224;
for (const name of EXPECTED) {
  const { column, row } = EXPECTED_CELL.get(name);
  let opaque = 0;
  let edgeOpaque = 0;
  let edgeTotal = 0;
  let cornerOpaque = 0;
  let cornerTotal = 0;
  let minOpaqueX = ATLAS_CELL_SIZE;
  let maxOpaqueX = -1;
  let minOpaqueY = ATLAS_CELL_SIZE;
  let maxOpaqueY = -1;
  for (let y = 0; y < ATLAS_CELL_SIZE; y += 1) {
    for (let x = 0; x < ATLAS_CELL_SIZE; x += 1) {
      const alpha = atlasPixels.data[
        (((row * ATLAS_CELL_SIZE) + y) * atlasPixels.info.width + (column * ATLAS_CELL_SIZE) + x) * 4 + 3
      ];
      const isOpaque = alpha > 24;
      if (isOpaque) {
        opaque += 1;
        minOpaqueX = Math.min(minOpaqueX, x);
        maxOpaqueX = Math.max(maxOpaqueX, x);
        minOpaqueY = Math.min(minOpaqueY, y);
        maxOpaqueY = Math.max(maxOpaqueY, y);
      }
      const isEdge = x < 8 || x >= ATLAS_CELL_SIZE - 8 || y < 8 || y >= ATLAS_CELL_SIZE - 8;
      if (isEdge) {
        edgeTotal += 1;
        if (isOpaque) edgeOpaque += 1;
      }
      const isCorner = (x < 20 || x >= ATLAS_CELL_SIZE - 20) && (y < 20 || y >= ATLAS_CELL_SIZE - 20);
      if (isCorner) {
        cornerTotal += 1;
        if (isOpaque) cornerOpaque += 1;
      }
    }
  }
  const cellArea = ATLAS_CELL_SIZE * ATLAS_CELL_SIZE;
  assert.ok(opaque / cellArea < 0.65, `${name} appears to contain an opaque backing tile`);
  assert.ok(edgeOpaque / edgeTotal < 0.25, `${name} spills across its atlas cell boundary`);
  assert.ok(cornerOpaque / cornerTotal < 0.1, `${name} has opaque corner remnants`);
  assert.ok(maxOpaqueX >= minOpaqueX && maxOpaqueY >= minOpaqueY, `${name} has no visible pixels`);
  const visualCenterX = (minOpaqueX + maxOpaqueX) / 2;
  const visualCenterY = (minOpaqueY + maxOpaqueY) / 2;
  const cellCenter = (ATLAS_CELL_SIZE - 1) / 2;
  assert.ok(Math.abs(visualCenterX - cellCenter) <= 1, `${name} is not horizontally centered`);
  assert.ok(Math.abs(visualCenterY - cellCenter) <= 1, `${name} is not vertically centered`);
}

const browser = await chromium.launch();

async function login(context, username = "teacher", password = "Teacher@123") {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username, password },
  });
  assert.equal(response.ok(), true, `teacher login failed: ${response.status()}`);
}

async function expandDesktopGroups(page) {
  for (const name of ["教学", "教研", "更多工具"]) {
    const group = page.getByRole("button", { name, exact: true });
    if (await group.isVisible().catch(() => false)) {
      const expanded = await group.getAttribute("aria-expanded");
      if (expanded !== "true") await group.click();
    }
  }
}

async function dismissOnboarding(page) {
  const dismiss = page.getByRole("button", { name: "关闭引导，稍后再看" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.locator('.onboarding-experience[role="dialog"]').waitFor({ state: "detached" });
  }
}

async function assertIconSet(page, scope) {
  const icons = page.locator(`${scope} [data-teacher-nav-icon]`);
  await icons.first().waitFor({ state: "visible", timeout: 15_000 });
  const names = await icons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-teacher-nav-icon")));
  assert.deepEqual([...names].sort(), [...EXPECTED].sort());

  const metrics = await icons.evaluateAll((nodes) => nodes.map((node) => {
    const box = node.getBoundingClientRect();
    const image = node.querySelector("img");
    const atlas = node.querySelector(".teacher-nav-icon-atlas");
    const atlasBox = atlas?.getBoundingClientRect();
    const styles = getComputedStyle(node);
    const beforeStyles = getComputedStyle(node, "::before");
    const afterStyles = getComputedStyle(node, "::after");
    const background = styles.backgroundColor;
    const backgroundAlpha = background === "transparent"
      ? 0
      : background.startsWith("rgba(")
        ? Number.parseFloat(background.slice(5, -1).split(",").at(-1))
        : 1;
    return {
      name: node.getAttribute("data-teacher-nav-icon"),
      width: box.width,
      height: box.height,
      source: image?.getAttribute("src") || "",
      naturalWidth: image?.naturalWidth || 0,
      left: Number.parseFloat(atlas?.style.left || "NaN"),
      top: Number.parseFloat(atlas?.style.top || "NaN"),
      atlasWidth: atlasBox?.width || 0,
      atlasHeight: atlasBox?.height || 0,
      backgroundAlpha,
      backgroundImage: styles.backgroundImage,
      borderWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
      beforeSurface: beforeStyles.content !== "none"
        && (beforeStyles.backgroundImage !== "none" || beforeStyles.backgroundColor !== "rgba(0, 0, 0, 0)"),
      afterSurface: afterStyles.content !== "none"
        && (afterStyles.backgroundImage !== "none" || afterStyles.backgroundColor !== "rgba(0, 0, 0, 0)"),
    };
  }));
  assert.equal(metrics.every((item) => item.width >= 30 && item.height >= 30), true, "teacher icons are too small");
  assert.equal(metrics.every((item) => item.source.includes("teacher-nav-atlas-v2.webp")), true, "teacher icon atlas was not used");
  assert.equal(metrics.every((item) => item.naturalWidth > 0), true, "one or more teacher icons failed to load");
  assert.equal(metrics.every((item) => item.backgroundAlpha === 0), true, "teacher icons regained an opaque tile background");
  assert.equal(metrics.every((item) => item.backgroundImage === "none"), true, "teacher icons regained a background image");
  assert.equal(metrics.every((item) => item.borderWidth === "0px"), true, "teacher icons regained a visible frame");
  assert.equal(metrics.every((item) => item.boxShadow === "none"), true, "teacher icons regained a rectangular shadow");
  assert.equal(metrics.every((item) => !item.beforeSurface && !item.afterSurface), true, "teacher icons regained a pseudo-element tile");
  for (const item of metrics) {
    const cell = EXPECTED_CELL.get(item.name);
    assert.ok(cell, `unexpected teacher icon id: ${item.name}`);
    const expectedLeft = cell.column === 0 ? 0 : -cell.column * item.width;
    const expectedTop = cell.row === 0 ? 0 : -cell.row * item.height;
    assert.equal(item.left, expectedLeft, `${item.name} uses the wrong atlas column`);
    assert.equal(item.top, expectedTop, `${item.name} uses the wrong atlas row`);
    assert.equal(item.atlasWidth, item.width * 4, `${item.name} atlas width drifted from the four-column grid`);
    assert.equal(item.atlasHeight, item.height * 4, `${item.name} atlas height drifted from the four-row grid`);
  }
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await expandDesktopGroups(page);
  await assertIconSet(page, ".app-sidebar");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.screenshot({ path: `${OUT}/teacher-nav-light-1440.png`, fullPage: true, animations: "disabled" });

  await page.evaluate(() => localStorage.setItem("eduai-theme", "dark"));
  await page.reload({ waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await expandDesktopGroups(page);
  await assertIconSet(page, ".app-sidebar");
  const activeIconReady = await page.locator('.app-sidebar [aria-current="page"] .teacher-nav-icon-active').count();
  assert.equal(activeIconReady, 1, "active teacher icon lost its selected state");
  const reducedMotion = await page.locator(".app-sidebar [data-teacher-nav-icon]").first().evaluate((node) => ({
    transform: getComputedStyle(node).transform,
    transitionDuration: getComputedStyle(node).transitionDuration,
  }));
  assert.equal(reducedMotion.transform, "none");
  assert.ok(Number.parseFloat(reducedMotion.transitionDuration) <= 0.0001, "reduced-motion transition is not effectively disabled");
  await page.screenshot({ path: `${OUT}/teacher-nav-dark-1440.png`, fullPage: true, animations: "disabled" });
  assert.deepEqual(errors, []);
  await context.close();
}

// The same atlas is available to researchers, while student and console roles retain
// their purpose-built play/linear icon systems.
for (const actor of [
  { username: "research", password: "Research@123", path: "/research", expected: 13 },
  { username: "admin", password: "Admin@123", path: "/admin/analytics", expected: 0 },
  { username: "student", password: "Student@123", path: "/student/home", expected: 0 },
]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await login(context, actor.username, actor.password);
  const page = await context.newPage();
  await page.goto(`${BASE}${actor.path}`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await expandDesktopGroups(page);
  assert.equal(await page.locator(".app-sidebar [data-teacher-nav-icon]").count(), actor.expected, `${actor.username} icon scope drifted`);
  assert.equal(await page.locator('.app-sidebar img[src*="teacher-nav-atlas-v2.webp"]').count(), actor.expected, `${actor.username} loaded the wrong atlas`);
  if (actor.username === "student") {
    assert.ok(await page.locator('.app-sidebar img[src*="/art/icons/"]:not([src*="teacher-nav-atlas-v2.webp"])').count() > 0, "student play icons disappeared");
  }
  await context.close();
}

// A failed atlas request must produce a complete Lucide fallback set. The selected
// fallback inherits the link color while retaining the same transparent cutout shell.
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark" });
  await login(context);
  const page = await context.newPage();
  await page.route("**/art/icons/teacher-nav-atlas-v2.webp", (route) => route.abort());
  await page.addInitScript(() => localStorage.setItem("eduai-theme", "dark"));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await expandDesktopGroups(page);
  const fallbacks = page.locator(".app-sidebar .teacher-nav-icon-fallback");
  await fallbacks.first().waitFor({ state: "visible", timeout: 15_000 });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(
    (expected) => document.querySelectorAll(".app-sidebar .teacher-nav-icon-fallback").length === expected,
    EXPECTED.length,
  );
  assert.equal(await fallbacks.count(), EXPECTED.length, "atlas failure did not fall back for every teacher destination");
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), true, "fallback coverage did not enter the actual dark theme");
  const fallbackMetrics = await fallbacks.evaluateAll((nodes) => nodes.map((node) => {
    const styles = getComputedStyle(node);
    return {
      background: styles.backgroundColor,
      backgroundImage: styles.backgroundImage,
      borderWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
    };
  }));
  assert.equal(fallbackMetrics.every((item) => item.background === "rgba(0, 0, 0, 0)"), true, "fallback icons regained an opaque tile background");
  assert.equal(fallbackMetrics.every((item) => item.backgroundImage === "none"), true, "fallback icons regained a background image");
  assert.equal(fallbackMetrics.every((item) => item.borderWidth === "0px"), true, "fallback icons regained a visible frame");
  assert.equal(fallbackMetrics.every((item) => item.boxShadow === "none"), true, "fallback icons regained a rectangular shadow");
  const fallbackSurface = await page.locator('.app-sidebar [aria-current="page"] .teacher-nav-icon-fallback.teacher-nav-icon-active').evaluate((node) => {
    const styles = getComputedStyle(node);
    const parentStyles = getComputedStyle(node.parentElement);
    return {
      background: styles.backgroundColor,
      borderWidth: styles.borderTopWidth,
      boxShadow: styles.boxShadow,
      color: styles.color,
      parentColor: parentStyles.color,
    };
  });
  assert.equal(fallbackSurface.background, "rgba(0, 0, 0, 0)", "active fallback regained an opaque tile background");
  assert.equal(fallbackSurface.borderWidth, "0px", "active fallback regained a visible frame");
  assert.equal(fallbackSurface.boxShadow, "none", "active fallback regained a rectangular shadow");
  assert.equal(fallbackSurface.color, fallbackSurface.parentColor, "active fallback no longer inherits selected-link contrast");
  await page.screenshot({ path: `${OUT}/teacher-nav-fallback-dark-1440.png`, fullPage: true, animations: "disabled" });
  await context.close();
}

// Resource failure must stay usable in the mobile drawer as well as on desktop.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  await page.route("**/art/icons/teacher-nav-atlas-v2.webp", (route) => route.abort());
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.getByRole("button", { name: "打开导航" }).click();
  const fallbacks = page.locator('[role="dialog"] .teacher-nav-icon-fallback');
  await fallbacks.first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[role="dialog"] .teacher-nav-icon-fallback').length === expected,
    EXPECTED.length,
  );
  assert.equal(await fallbacks.count(), EXPECTED.length, "mobile atlas failure did not fall back for every teacher destination");
  await fallbacks.last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/teacher-nav-fallback-mobile-390.png`, animations: "disabled" });
  await context.close();
}

for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.getByRole("button", { name: "打开导航" }).click();
  await assertIconSet(page, '[role="dialog"]');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.screenshot({ path: `${OUT}/teacher-nav-mobile-${viewport.width}.png`, animations: "disabled" });
  await page.locator('[role="dialog"] [data-teacher-nav-icon]').last().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/teacher-nav-mobile-${viewport.width}-bottom.png`, animations: "disabled" });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ ok: true, icons: EXPECTED.length, atlas: metadata.format, alpha: metadata.hasAlpha, viewports: [1440, 768, 390] }, null, 2));
