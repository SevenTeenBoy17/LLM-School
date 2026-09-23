import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { chromium } from "playwright";

const APP_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE = (process.env.BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const outputDir = join(APP_ROOT, "test-results");
const outputPath = join(outputDir, "export-smoke.pptx");
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const login = await page.request.post(`${BASE}/api/auth/login`, {
    data: { username: "teacher", password: "Teacher@123" },
  });
  assert.equal(login.status(), 200, `teacher login failed: ${login.status()}`);

  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  const assistant = page.locator('[data-chat-role="assistant"][data-chat-streaming="false"]:visible');
  const before = await assistant.count();
  await page.locator('textarea[aria-label="输入消息"]:visible').fill("请用标题和三个要点解释为什么植物需要阳光。只需简短回答。");
  await page.locator('button[aria-label="发送"]:visible').click();
  await page.waitForFunction(
    (count) => Array.from(document.querySelectorAll('[data-chat-role="assistant"][data-chat-streaming="false"]')).filter((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length > count,
    before,
    { timeout: 90_000 },
  );

  const latest = assistant.last();
  await latest.locator('summary[aria-label="更多操作"]').click();
  const menuItem = latest.getByRole("menuitem", { name: "导出 PPT 大纲 (.pptx)" });
  await menuItem.waitFor({ state: "visible" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    menuItem.click(),
  ]);
  await download.saveAs(outputPath);
  await latest.getByRole("status").getByText(/已导出为 PPTX 文件/).waitFor({ state: "visible" });

  const bytes = readFileSync(outputPath);
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK", "PPTX is not a ZIP package");
  const zip = await JSZip.loadAsync(bytes);
  const required = [
    "[Content_Types].xml",
    "_rels/.rels",
    "ppt/presentation.xml",
    "ppt/_rels/presentation.xml.rels",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/theme/theme1.xml",
    "ppt/slides/slide1.xml",
    "ppt/slides/slide2.xml",
  ];
  for (const name of required) assert.ok(zip.file(name), `missing OOXML part: ${name}`);
  const contentTypes = await zip.file("[Content_Types].xml").async("string");
  const presentation = await zip.file("ppt/presentation.xml").async("string");
  const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  const slideText = (await Promise.all(slides.map((name) => zip.file(name).async("string")))).join("\n");
  assert.match(contentTypes, /presentationml\.presentation\.main\+xml/);
  assert.match(presentation, /<p:sldIdLst>/);
  assert.match(slideText, /EduAI Prism|植物|阳光/);

  console.log(JSON.stringify({
    ok: true,
    download: outputPath,
    bytes: bytes.length,
    slides: slides.length,
    requiredParts: required.length,
  }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
