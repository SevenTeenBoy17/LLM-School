import assert from "node:assert/strict";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const BASE = process.env.BASE || "http://127.0.0.1:4921";
const OUT = "tests/artifacts/skill-library";
const ASSET_DIR = fileURLToPath(new URL("../public/art/skills-v3/", import.meta.url));
const SECTION_IDS = ["directories", "repositories", "education", "curriculum"];
const EXPECTED_ARTWORK_FILES = [
  "category-curriculum-design.webp",
  "category-discovery.webp",
  "category-source-audit.webp",
  "category-teaching-research.webp",
  "scene-code-audit.webp",
  "scene-curriculum-crosswalk.webp",
  "scene-curriculum-route.webp",
  "scene-differentiation.webp",
  "scene-directory-network.webp",
  "scene-lesson-plan.webp",
  "scene-panel-review.webp",
  "scene-portal-directory.webp",
  "scene-repository-branch.webp",
  "scene-research-lab.webp",
  "scene-review-checklist.webp",
  "scene-rubric-evaluation.webp",
  "scene-search-catalog.webp",
  "scene-skill-collection.webp",
  "scene-source-toolbox.webp",
  "scene-teacher-assistant.webp",
].sort();
const EXPECTED_ARTWORK_KEYS = EXPECTED_ARTWORK_FILES
  .map((file) => `/art/skills-v3/${file}`)
  .sort();
const REQUIRED_URLS = [
  "https://skillsmp.com/zh",
  "https://agent-skills.md/",
  "https://www.skills.sh/",
  "https://skillstore.io/zh-hans",
  "https://www.skillsdirectory.com/",
  "https://agentskills.me/",
  "https://github.com/anthropics/skills",
  "https://github.com/vercel-labs/agent-skills",
  "https://github.com/JackyST0/awesome-agent-skills",
  "https://github.com/antfu/skills",
  "https://github.com/ZhanlinCui/Agent-Skills-Hunter",
  "https://github.com/GarethManning/education-agent-skills",
  "https://github.com/anthropics/k12-teacher-skills",
  "https://github.com/YujxZJCN/teaching-skills-codex",
];

mkdirSync(OUT, { recursive: true });

const artworkFiles = readdirSync(ASSET_DIR).filter((name) => name.endsWith(".webp"));
assert.deepEqual(
  artworkFiles.sort(),
  EXPECTED_ARTWORK_FILES,
  "the Skill library artwork set must contain the four category and sixteen resource scenes",
);
for (const file of artworkFiles) {
  const assetPath = join(ASSET_DIR, file);
  const metadata = await sharp(assetPath).metadata();
  assert.equal(metadata.hasAlpha, true, `${file} must preserve an alpha channel`);
  assert.ok(metadata.width >= 384 && metadata.height >= 384, `${file} is undersized`);

  const { data, info } = await sharp(assetPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentPixels = 0;
  let visiblePixels = 0;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] <= 5) transparentPixels += 1;
    if (data[index] >= 24) visiblePixels += 1;
  }
  const pixelCount = info.width * info.height;
  assert.ok(transparentPixels / pixelCount >= 0.22, `${file} still contains an opaque rectangular matte`);
  assert.ok(visiblePixels / pixelCount >= 0.12, `${file} lost too much foreground during background extraction`);

  const cornerAlpha = [
    data[3],
    data[(info.width - 1) * info.channels + 3],
    data[((info.height - 1) * info.width) * info.channels + 3],
    data[((info.height * info.width) - 1) * info.channels + 3],
  ];
  assert.equal(cornerAlpha.every((alpha) => alpha <= 5), true, `${file} has a non-transparent corner`);
}

const browser = await chromium.launch();

async function login(context, username = "teacher", password = "Teacher@123") {
  const response = await context.request.post(`${BASE}/api/auth/login`, {
    data: { username, password },
  });
  assert.equal(response.ok(), true, `${username} login failed: ${response.status()}`);
}

async function dismissOnboarding(page) {
  const dismiss = page.getByRole("button", { name: "关闭引导，稍后再看" });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.locator('.onboarding-experience[role="dialog"]').waitFor({ state: "detached" });
  }
}

async function setSection(page, id, expanded) {
  const button = page.getByTestId(`skill-category-${id}`);
  const current = await button.getAttribute("aria-expanded");
  if ((current === "true") !== expanded) await button.click();
  await assert.doesNotReject(async () => {
    assert.equal(await button.getAttribute("aria-expanded"), String(expanded));
  });
  await page.locator(`#skill-section-panel-${id}`).waitFor({
    state: expanded ? "visible" : "detached",
  });
}

async function waitForCardCount(page, count) {
  await page.waitForFunction(
    (expected) => document.querySelectorAll('[data-testid="skill-resource-card"]').length === expected,
    count,
  );
}

async function waitForMatchingCards(page, count, terms) {
  await page.waitForFunction(
    ({ minimum, acceptedTerms }) => {
      const cards = [...document.querySelectorAll('[data-testid="skill-resource-card"]')];
      return cards.length >= minimum && cards.every((card) =>
        acceptedTerms.some((term) => card.textContent?.includes(term)),
      );
    },
    { minimum: count, acceptedTerms: terms },
  );
}

async function assertNoOverflow(page) {
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
    "skill library has unexpected horizontal overflow",
  );
}

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await login(context);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/skills`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.getByRole("heading", { name: "技能库", level: 1 }).waitFor({ state: "visible" });

  assert.equal(await page.getByTestId("skill-category-directories").getAttribute("aria-expanded"), "true");
  for (const id of SECTION_IDS.slice(1)) {
    assert.equal(await page.getByTestId(`skill-category-${id}`).getAttribute("aria-expanded"), "false");
  }
  assert.equal(await page.locator('[data-testid="skill-resource-link"]:visible').count(), 6);

  await setSection(page, "education", true);
  assert.equal(await page.locator('[data-testid="skill-resource-link"]:visible').count(), 12);
  await setSection(page, "directories", false);
  assert.equal(await page.locator('[data-testid="skill-resource-link"]:visible').count(), 6);

  const search = page.getByLabel("搜索技能资源");
  await search.fill("量规");
  await page.getByText(/当前显示 \d+ 个资源/).waitFor({ state: "visible" });
  await waitForMatchingCards(page, 2, ["量规", "Rubric"]);
  assert.equal(await page.locator('[data-testid^="skill-category-"]').count(), 4, "search must not remove section wayfinding");
  const visibleSearchCards = page.locator('[data-testid="skill-resource-card"]:visible');
  assert.ok(await visibleSearchCards.count() >= 2, "rubric search returned too few resources");
  const searchText = await visibleSearchCards.allTextContents();
  assert.equal(searchText.every((text) => text.includes("量规") || text.includes("Rubric")), true);

  await page.getByRole("button", { name: "清空搜索", exact: true }).click();
  for (const id of SECTION_IDS) await setSection(page, id, true);

  const links = page.locator('[data-testid="skill-resource-link"]');
  assert.equal(await links.count(), 25, "registered Skill resource count drifted");
  const linkData = await links.evaluateAll((nodes) => nodes.map((node) => ({
    href: node.getAttribute("href"),
    target: node.getAttribute("target"),
    rel: node.getAttribute("rel"),
  })));
  assert.equal(linkData.every((item) => item.href?.startsWith("https://")), true);
  assert.equal(linkData.every((item) => item.target === "_blank"), true);
  assert.equal(linkData.every((item) => item.rel?.includes("noopener") && item.rel?.includes("noreferrer")), true);
  const hrefs = new Set(linkData.map((item) => item.href));
  for (const url of REQUIRED_URLS) assert.ok(hrefs.has(url), `required external resource is missing: ${url}`);

  const skillsMpSelect = page.getByTestId("skill-select-skillsmp");
  const lessonPlanSelect = page.getByTestId("skill-select-k12-lesson-plan-creation");
  await skillsMpSelect.click();
  assert.equal(await skillsMpSelect.getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator('[data-testid="skill-resource-card"][data-resource-id="skillsmp"]').getAttribute("data-selected"), "true");
  await page.getByText("SkillsMP 已加入考察清单", { exact: true }).waitFor();
  assert.match(await page.getByTestId("skill-selection-count").textContent(), /1 项/);

  await lessonPlanSelect.click();
  assert.equal(await lessonPlanSelect.getAttribute("aria-pressed"), "true");
  assert.match(await page.getByTestId("skill-selection-count").textContent(), /2 项/);

  const selectedOnly = page.getByRole("button", { name: "仅看已选", exact: true });
  await selectedOnly.click();
  assert.equal(await selectedOnly.getAttribute("aria-pressed"), "true");
  await waitForCardCount(page, 2);
  assert.equal(await page.locator('[data-testid^="skill-category-"]').count(), 4, "selected-only mode must not remove section wayfinding");
  assert.equal(await page.locator('[data-testid="skill-resource-card"]:visible').count(), 2);

  await search.fill("不存在的量规资源");
  await waitForCardCount(page, 0);
  await page.getByRole("heading", { name: "没有匹配的资源", exact: true }).waitFor({ state: "visible" });
  assert.equal(await selectedOnly.getAttribute("aria-pressed"), "true");
  await page.getByRole("region", { name: "无筛选结果" }).getByRole("button", { name: "清空搜索", exact: true }).click();
  await waitForCardCount(page, 2);
  assert.equal(await selectedOnly.getAttribute("aria-pressed"), "true");

  await page.getByTestId("skill-select-skillsmp").click();
  await page.getByText("SkillsMP 已从考察清单移除", { exact: true }).waitFor();
  await waitForCardCount(page, 1);
  assert.equal(await page.locator('[data-testid="skill-resource-card"]:visible').count(), 1);
  assert.match(await page.getByTestId("skill-selection-count").textContent(), /1 项/);

  await page.getByRole("button", { name: "全部", exact: true }).click();
  await waitForCardCount(page, 25);
  assert.equal(await page.locator('[data-testid="skill-resource-card"]:visible').count(), 25);
  const artwork = page.locator("img[data-skill-artwork]");
  await page.waitForFunction(() => [...document.querySelectorAll("img[data-skill-artwork]")]
    .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0));
  assert.equal(await artwork.count(), 33, "category, disclosure, and resource artwork count drifted");
  const artworkMetrics = await artwork.evaluateAll((images) => images.map((image) => ({
    key: image.getAttribute("data-skill-artwork"),
    width: image.naturalWidth,
    height: image.naturalHeight,
    boxWidth: image.getBoundingClientRect().width,
    boxHeight: image.getBoundingClientRect().height,
  })));
  assert.equal(artworkMetrics.every((item) => item.width > 0 && item.height > 0), true, "3D artwork failed to load");
  assert.equal(artworkMetrics.every((item) => item.boxWidth > 0 && item.boxHeight > 0), true, "3D artwork collapsed in layout");
  assert.deepEqual(
    [...new Set(artworkMetrics.map((item) => item.key))].sort(),
    EXPECTED_ARTWORK_KEYS,
    "rendered artwork keys do not match the complete semantic scene set",
  );
  await page.screenshot({ path: `${OUT}/skill-library-1440-selected.png`, fullPage: true, animations: "disabled" });

  const [externalPage] = await Promise.all([
    page.waitForEvent("popup"),
    page.locator('[data-testid="skill-resource-link"][data-resource-id="skillsmp"]').click(),
  ]);
  await externalPage.waitForURL(/^https:\/\/skillsmp\.com\/zh/, { timeout: 20_000 });
  assert.match(externalPage.url(), /^https:\/\/skillsmp\.com\/zh/);
  await externalPage.close();

  const sidebarLink = page.locator('.app-sidebar a[href="/skills"]');
  await sidebarLink.waitFor({ state: "visible" });
  assert.equal(await sidebarLink.getAttribute("aria-current"), "page");
  assert.ok(await sidebarLink.locator('[data-teacher-nav-icon="skills"]').count(), "3D Skill navigation icon is missing");
  await assertNoOverflow(page);
  await page.screenshot({ path: `${OUT}/skill-library-1440.png`, fullPage: true, animations: "disabled" });
  assert.deepEqual(errors, []);
  await context.close();
}

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
]) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await login(context);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${BASE}/skills`, { waitUntil: "networkidle" });
  await dismissOnboarding(page);
  await page.getByRole("heading", { name: "技能库", level: 1 }).waitFor({ state: "visible" });
  await setSection(page, "education", true);
  await page.getByTestId("skill-select-skillsmp").click();
  assert.equal(await page.getByTestId("skill-select-skillsmp").getAttribute("aria-pressed"), "true");
  await assertNoOverflow(page);
  const categoryButtons = page.locator('[data-testid^="skill-category-"]');
  assert.equal(await categoryButtons.count(), 4);
  const categoryMetrics = await categoryButtons.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assert.equal(categoryMetrics.every((item) => item.width > 0 && item.height >= 44), true);
  await page.screenshot({
    path: `${OUT}/skill-library-${viewport.width}.png`,
    fullPage: true,
    animations: "disabled",
  });
  assert.deepEqual(errors, []);
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await login(context, "student", "Student@123");
  const page = await context.newPage();
  await page.goto(`${BASE}/skills`, { waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/student/home", "student direct access was not denied");
  assert.equal(await page.getByRole("heading", { name: "技能库", level: 1 }).count(), 0);
  await context.close();
}

await browser.close();
console.log(JSON.stringify({
  ok: true,
  sections: SECTION_IDS.length,
  resources: 25,
  requiredLinks: REQUIRED_URLS.length,
  viewports: [1440, 1024, 768, 390],
  studentGuard: true,
}, null, 2));
