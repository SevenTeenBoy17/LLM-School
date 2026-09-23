import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { DOMParser as XmlDomParser } from "@xmldom/xmldom";
import { PREVIEW_LIMITS, documentPreviewFormat, loadDocumentPreview } from "../lib/school-resources/documentPreview.ts";

const APP = fileURLToPath(new URL("../", import.meta.url));
const OUT = path.resolve(APP, "../.agent-supervisor/resources-v2-20260908/media");
const FIXTURES = path.join(OUT, "fixtures");
const BASE = process.env.SCHOOL_RESOURCES_BASE_URL || "http://127.0.0.1:4921";
const browserMode = process.argv.includes("--browser");
const report = { startedAt: new Date().toISOString(), processId: process.pid, mode: browserMode ? "browser" : "pure", checks: [], fixtures: [], screenshots: [], limits: ["Local audit evidence only; no signed formal gate."] };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceFiles = ["components/school-resources/DocumentMediaPreview.tsx", "components/school-resources/document-media-preview.module.css", "lib/school-resources/documentPreview.ts", "tests/resource-document-preview.mjs"];
report.sourceHashesBefore = {};
for (const file of sourceFiles) report.sourceHashesBefore[file] = sha(await fs.readFile(path.join(APP, file)));
await fs.mkdir(FIXTURES, { recursive: true });
globalThis.DOMParser = class {
  parseFromString(text, type) {
    const errors = [];
    const document = new XmlDomParser({ errorHandler: { warning: message => errors.push(message), error: message => errors.push(message), fatalError: message => errors.push(message) } }).parseFromString(text, type);
    if (errors.length) throw new Error("Malformed test XML");
    return document;
  }
};
const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PRESENTATION = "http://schemas.openxmlformats.org/presentationml/2006/main";
const mime = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
const xmlEscape = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const fixedDate = new Date("2020-01-01T00:00:00Z");
const zipFile = (zip, name, text) => zip.file(name, text, { date: fixedDate, createFolders: false });
const zipBytes = zip => zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
const resource = (name, bytes, type = "") => ({ origin: "local", fileName: name, mimeType: type, blob: new Blob([bytes], { type }) });
async function fixture(name, bytes, type) {
  const file = path.join(FIXTURES, name);
  await fs.writeFile(file, bytes);
  report.fixtures.push({ name, file, bytes: bytes.length, sha256: sha(bytes), mimeType: type });
  return { name, bytes, type, file };
}
async function check(name, run) {
  const start = Date.now();
  try { await run(); report.checks.push({ name, pass: true, milliseconds: Date.now() - start }); }
  catch (error) { report.checks.push({ name, pass: false, error: error.stack }); }
  console.log(`${report.checks.at(-1).pass ? "PASS" : "FAIL"} ${name}`);
}
function docxZip(text) {
  const zip = new JSZip();
  zipFile(zip, "[Content_Types].xml", `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zipFile(zip, "_rels/.rels", `${XML}<Relationships xmlns="${REL}"><Relationship Id="r1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/></Relationships>`);
  zipFile(zip, "word/document.xml", `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="${OFFICE}"><w:body><w:p><w:r><w:t>${xmlEscape(text)}</w:t></w:r></w:p><w:p><w:hyperlink r:id="external"><w:r><w:t>External link text only</w:t></w:r></w:hyperlink></w:p></w:body></w:document>`);
  zipFile(zip, "word/_rels/document.xml.rels", `${XML}<Relationships xmlns="${REL}"><Relationship Id="external" Type="${OFFICE}/hyperlink" TargetMode="External" Target="https://blocked.invalid/docx-link"/></Relationships>`);
  return zip;
}
function pptxZip(order = [2, 1]) {
  const zip = new JSZip();
  zipFile(zip, "ppt/presentation.xml", `${XML}<p:presentation xmlns:p="${PRESENTATION}" xmlns:r="${OFFICE}"><p:sldIdLst>${order.map(number => `<p:sldId id="${256 + number}" r:id="slide-${number}"/>`).join("")}</p:sldIdLst></p:presentation>`);
  zipFile(zip, "ppt/_rels/presentation.xml.rels", `${XML}<Relationships xmlns="${REL}">${order.map(number => `<Relationship Id="slide-${number}" Type="${OFFICE}/slide" Target="slides/slide${number}.xml"/>`).join("")}</Relationships>`);
  for (const number of order) zipFile(zip, `ppt/slides/slide${number}.xml`, `${XML}<p:sld xmlns:p="${PRESENTATION}" xmlns:a="${DRAWING}"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Slide ${number} first paragraph</a:t></a:r></a:p><a:p><a:r><a:t>${xmlEscape('<script>window.previewInjected=true</script>')}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
  return zip;
}
function pdfBytes(pages = ["PDF local page one", "PDF local page two"]) {
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] >>`, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"];
  pages.forEach((text, index) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    const stream = `BT /F1 16 Tf 20 100 Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(Buffer.byteLength(output)); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(output);
}
function wavBytes() {
  const count = 16_000;
  const bytes = Buffer.alloc(44 + count * 2);
  bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) bytes.writeInt16LE(Math.round(1000 * Math.sin(i * Math.PI / 20)), 44 + i * 2);
  return bytes;
}
const docx = await fixture("local-text.docx", await zipBytes(docxZip("Hello local DOCX <script>not executable</script>")), mime.docx);
const pptx = await fixture("ordered-slides.pptx", await zipBytes(pptxZip()), mime.pptx);
const pdf = await fixture("two-pages.pdf", pdfBytes(), "application/pdf");
const text = await fixture("literal-text.md", Buffer.from("# Plain text\r\n<script>window.previewInjected=true</script>\r\n"), "text/markdown");
const wav = await fixture("local-tone.wav", wavBytes(), "audio/wav");

if (!browserMode) {
  await check("plain UTF-8 exactly preserves CRLF and literal markup", async () => {
    const value = await loadDocumentPreview(resource(text.name, text.bytes, text.type));
    assert.equal(value.kind, "text"); assert.equal(value.text, text.bytes.toString()); assert.equal(value.truncated, false);
  });
  await check("20,000-byte truncation omits incomplete UTF-8 tail", async () => {
    const value = await loadDocumentPreview(resource("long.txt", "a".repeat(19999) + "\u4e2dmore", "text/plain"));
    assert.equal(value.text, "a".repeat(19999)); assert.equal(value.truncated, true);
  });
  await check("empty built-in body remains empty", async () => {
    const value = await loadDocumentPreview({ origin: "example", fileName: "example.md", mimeType: "text/markdown", body: "" });
    assert.equal(value.text, "");
  });
  await check("missing Blob is explicit", () => assert.rejects(loadDocumentPreview({ origin: "local", fileName: "x.pdf", mimeType: "application/pdf" }), error => error.code === "missing"));
  await check("legacy DOC/PPT and HTML/SVG have no active preview", async () => {
    for (const name of ["old.doc", "old.ppt", "unsafe.html", "unsafe.svg"]) assert.equal((await loadDocumentPreview(resource(name, "untrusted"))).kind, "unsupported");
    assert.equal(documentPreviewFormat({ fileName: "MOVIE.MP4" }), "video");
  });
  await check("type spoofing is rejected before rendering", async () => {
    await assert.rejects(loadDocumentPreview(resource("fake.png", "<svg onload='alert(1)'/>", "image/png")), error => error.code === "type");
    await assert.rejects(loadDocumentPreview(resource("fake.txt", "<script/>", "text/html")), error => error.code === "type");
  });
  await check("file and document byte budgets are independent", async () => {
    await assert.rejects(loadDocumentPreview(resource("large.pdf", new Uint8Array(PREVIEW_LIMITS.documentBytes + 1), "application/pdf")), error => error.code === "size");
    await assert.rejects(loadDocumentPreview(resource("large.mp4", new Uint8Array(PREVIEW_LIMITS.fileBytes + 1), "video/mp4")), error => error.code === "size");
  });
  await check("DOCX extracts local raw text, not HTML; external links are inert", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("No parser networking allowed"); };
    try {
      const value = await loadDocumentPreview(resource(docx.name, docx.bytes, docx.type));
      assert.equal(value.format, "docx"); assert.match(value.pages[0].text, /Hello local DOCX <script>not executable<\/script>/);
      assert.match(value.pages[0].text, /External link text only/);
    } finally { globalThis.fetch = original; }
  });
  await check("PPTX follows relationship order and preserves paragraphs", async () => {
    const value = await loadDocumentPreview(resource(pptx.name, pptx.bytes, pptx.type));
    assert.equal(value.pages.length, 2); assert.equal(value.totalPages, 2);
    assert.match(value.pages[0].text, /^Slide 2 first paragraph\n<script>/); assert.match(value.pages[1].text, /^Slide 1/);
  });
  await check("PPTX slide budget retains original total", async () => {
    const bytes = await zipBytes(pptxZip(Array.from({ length: 31 }, (_, index) => index + 1)));
    const value = await loadDocumentPreview(resource("many.pptx", bytes, mime.pptx));
    assert.equal(value.pages.length, 30); assert.equal(value.totalPages, 31); assert.equal(value.truncated, true);
  });
  await check("DOCX and PPTX extracted character budgets truncate explicitly", async () => {
    const longText = "a".repeat(PREVIEW_LIMITS.textCharacters + 1);
    const word = await loadDocumentPreview(resource("long.docx", await zipBytes(docxZip(longText)), mime.docx));
    assert.equal(word.pages[0].text.length, PREVIEW_LIMITS.textCharacters); assert.equal(word.truncated, true);
    const zip = pptxZip([1]);
    zipFile(zip, "ppt/slides/slide1.xml", `${XML}<p:sld xmlns:p="${PRESENTATION}" xmlns:a="${DRAWING}"><a:p><a:r><a:t>${longText}</a:t></a:r></a:p></p:sld>`);
    const slides = await loadDocumentPreview(resource("long.pptx", await zipBytes(zip), mime.pptx));
    assert.equal(slides.pages[0].text.length, PREVIEW_LIMITS.textCharacters); assert.equal(slides.truncated, true);
  });
  await check("external, absolute and traversal slide relationships are rejected", async () => {
    for (const target of ["https://blocked.invalid/slide.xml", "/ppt/slides/slide2.xml", "../ppt/slides/slide2.xml", "%2e%2e/ppt/slides/slide2.xml"]) {
      const zip = pptxZip();
      zipFile(zip, "ppt/_rels/presentation.xml.rels", `${XML}<Relationships xmlns="${REL}"><Relationship Id="slide-2" Type="${OFFICE}/slide" Target="${target}"/></Relationships>`);
      await assert.rejects(loadDocumentPreview(resource("bad.pptx", await zipBytes(zip), mime.pptx)), error => error.code === "xml");
    }
  });
  await check("malformed ZIP and traversal entry reject", async () => {
    await assert.rejects(loadDocumentPreview(resource("bad.docx", Buffer.from([80, 75, 3, 4, 0]), mime.docx)), error => error.code === "archive");
    const zip = docxZip("hello"); zipFile(zip, "../escape.xml", "<x/>");
    await assert.rejects(loadDocumentPreview(resource("bad.docx", await zipBytes(zip), mime.docx)), error => error.code === "archive");
  });
  await check("DTD, malformed XML and excessive XML depth reject", async () => {
    for (const xml of ['<!DOCTYPE x [<!ENTITY a SYSTEM "https://blocked.invalid/entity">]><x>&a;</x>', "<x><y></x>", "<x>".repeat(110) + "</x>".repeat(110)]) {
      const zip = docxZip("hello"); zipFile(zip, "word/document.xml", xml);
      await assert.rejects(loadDocumentPreview(resource("bad.docx", await zipBytes(zip), mime.docx)));
    }
  });
  await check("actual inflated XML budget rejects compact archive bomb", async () => {
    const zip = docxZip("hello"); zipFile(zip, "word/document.xml", `<x>${"a".repeat(PREVIEW_LIMITS.xmlBytes)}</x>`);
    const bytes = await zipBytes(zip); assert.ok(bytes.length < 10000);
    await assert.rejects(loadDocumentPreview(resource("bomb.docx", bytes, mime.docx)), error => error.code === "size");
  });
  await check("ZIP entry count capped", async () => {
    const zip = docxZip("hello");
    for (let index = 0; index < PREVIEW_LIMITS.archiveEntries; index++) zipFile(zip, `unused/${index}`, "a");
    await assert.rejects(loadDocumentPreview(resource("many.docx", await zipBytes(zip), mime.docx)), error => error.code === "size");
  });
  await check("aggregate inflated bytes capped before Mammoth", async () => {
    const zip = docxZip("hello");
    for (let index = 0; index < 5; index++) zipFile(zip, `media/${index}.bin`, "a".repeat(7 * 1024 * 1024));
    await assert.rejects(loadDocumentPreview(resource("large.docx", await zipBytes(zip), mime.docx)), error => error.code === "size");
  });
  await check("single binary ZIP entry has an independent inflation cap", async () => {
    const zip = docxZip("hello");
    zipFile(zip, "word/media/large.bin", "a".repeat(PREVIEW_LIMITS.archiveEntryBytes + 1));
    await assert.rejects(loadDocumentPreview(resource("entry.docx", await zipBytes(zip), mime.docx)), error => error.code === "size");
  });
  await check("PDF text is local, page-separated and sequentially bounded", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = () => { throw new Error("No parser networking allowed"); };
    try {
      const value = await loadDocumentPreview(resource(pdf.name, pdf.bytes, pdf.type));
      assert.equal(value.totalPages, 2); assert.match(value.pages[0].text, /PDF local page one/); assert.match(value.pages[1].text, /PDF local page two/);
      const bounded = await loadDocumentPreview(resource("many.pdf", pdfBytes(Array.from({ length: 31 }, (_, index) => `Page ${index + 1}`)), pdf.type));
      assert.equal(bounded.pages.length, 30); assert.equal(bounded.totalPages, 31); assert.equal(bounded.truncated, true);
    } finally { globalThis.fetch = original; }
  });
  await check("corrupt PDF has honest parse error", () => assert.rejects(loadDocumentPreview(resource("bad.pdf", "%PDF-1.4\ninvalid", "application/pdf")), error => error.code === "parse"));
  await check("aborted requests never resolve as successful previews", async () => {
    const controller = new AbortController(); controller.abort();
    await assert.rejects(loadDocumentPreview(resource("x.txt", "x"), { signal: controller.signal }), error => error.name === "AbortError");
  });
  await check("cancellation during real ZIP streaming rejects without stale success", async () => {
    const controller = new AbortController();
    const prototype = Object.getPrototypeOf(docxZip("probe").file("word/document.xml"));
    const original = prototype.internalStream;
    prototype.internalStream = function (...args) {
      const stream = original.apply(this, args);
      stream.on("data", () => controller.abort());
      return stream;
    };
    try { await assert.rejects(loadDocumentPreview(resource(docx.name, docx.bytes, docx.type), { signal: controller.signal }), error => error.name === "AbortError"); }
    finally { prototype.internalStream = original; }
  });
  await check("hanging reads have a real 15-second timeout", async () => {
    class HangingBlob extends Blob {
      slice() { return this; }
      arrayBuffer() { return new Promise(() => {}); }
    }
    const input = { ...resource("slow.txt", "x", "text/plain"), blob: new HangingBlob(["x"], { type: "text/plain" }) };
    await assert.rejects(loadDocumentPreview(input), error => error.code === "timeout");
  });
  await check("audio yields only a local typed Blob", async () => {
    const value = await loadDocumentPreview(resource(wav.name, wav.bytes, wav.type));
    assert.equal(value.kind, "audio"); assert.equal(value.blob.type, "audio/wav"); assert.deepEqual(new Uint8Array(await value.blob.arrayBuffer()), new Uint8Array(wav.bytes));
  });
} else {
  report.limits.push("Browser integration is required: root must mount DocumentMediaPreview in ResourceDetail.");
  const { chromium } = await import("playwright");
  const { default: sharp } = await import("sharp");
  const png = await fixture("local-raster.png", await sharp({ create: { width: 96, height: 64, channels: 4, background: "#238b78" } }).png().toBuffer(), "image/png");
  const video = await fixture("local-video.webm", execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=teal:s=160x90:r=10", "-t", "2", "-c:v", "libvpx", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-an", "-f", "webm", "pipe:1"], { maxBuffer: 2 * 1024 * 1024 }), "video/webm");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
    const login = await context.request.post(`${BASE}/api/auth/login`, { data: { username: "teacher", password: "Teacher@123" } });
    assert.equal(login.status(), 200);
    report.browser = browser.version(); report.externalRequests = []; report.errors = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (!["blob:", "data:"].includes(url.protocol) && url.origin !== new URL(BASE).origin) { report.externalRequests.push(url.href); return route.abort(); }
      if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method()) && url.pathname !== "/api/auth/login" && url.pathname !== "/__nextjs_original-stack-frames") return route.abort();
      return route.continue();
    });
    await context.addInitScript(() => {
      const create = URL.createObjectURL; const revoke = URL.revokeObjectURL;
      window.previewUrls = { created: [], revoked: [] };
      URL.createObjectURL = blob => { const url = create(blob); window.previewUrls.created.push(url); return url; };
      URL.revokeObjectURL = url => { window.previewUrls.revoked.push(url); return revoke(url); };
    });
    const page = await context.newPage(); page.setDefaultTimeout(20_000);
    page.on("pageerror", error => report.errors.push(error.message));
    await page.goto(`${BASE}/knowledge/resources`, { waitUntil: "networkidle" });
    const library = page.getByTestId("school-resource-library");
    await library.waitFor({ state: "visible" });
    const uploadAndOpen = async (item) => {
      await library.getByRole("button", { name: "\u4e0a\u4f20\u8d44\u6e90", exact: true }).click();
      await page.getByTestId("resource-file-input").setInputFiles({ name: item.name, mimeType: item.type, buffer: Buffer.from(item.bytes) });
      let dialog = page.getByRole("dialog");
      await dialog.getByRole("textbox", { name: /^\u8d44\u6e90\u540d\u79f0 1/ }).fill(item.name);
      await dialog.getByLabel("\u4e0a\u4f20\u8d44\u6e90\u5b66\u79d1").selectOption("\u8bed\u6587");
      await dialog.getByLabel("\u4e0a\u4f20\u8d44\u6e90\u5e74\u7ea7").selectOption("\u516d\u5e74\u7ea7");
      await dialog.getByRole("checkbox").check();
      await dialog.getByRole("button", { name: "\u4fdd\u5b58\u672c\u673a\u8349\u7a3f", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      await library.getByRole("button", { name: `\u67e5\u770b ${item.name}`, exact: true }).click();
      dialog = page.getByRole("dialog");
      const preview = dialog.getByTestId("document-media-preview");
      await preview.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.querySelector('[data-testid="document-media-preview"]')?.getAttribute("data-preview-kind") !== "loading");
      return { dialog, preview };
    };
    const close = () => page.getByRole("button", { name: "\u5173\u95ed\u8d44\u6e90\u8be6\u60c5" }).click();
    const shot = async name => {
      const file = path.join(OUT, `${name}.png`); const bytes = await page.screenshot({ path: file });
      report.screenshots.push({ file, sha256: sha(bytes), viewport: page.viewportSize() });
    };
    for (const item of [text, docx, pptx, pdf, png, wav, video]) {
      await check(`actual app preview ${item.name}`, async () => {
        const { preview } = await uploadAndOpen(item);
        let mediaHandle;
        assert.notEqual(await preview.getAttribute("data-preview-kind"), "error", await preview.innerText());
        if (item === text) assert.equal(await preview.locator("pre").textContent(), text.bytes.toString());
        if (item === docx) assert.match(await preview.innerText(), /Hello local DOCX/);
        if (item === pptx || item === pdf) {
          assert.match(await preview.getByTestId("document-preview-text").innerText(), item === pptx ? /Slide 2/ : /page one/);
          await preview.getByRole("button", { name: item === pptx ? "\u4e0b\u4e00\u5e7b\u706f\u7247" : "\u4e0b\u4e00\u9875" }).click();
          assert.match(await preview.getByTestId("document-preview-text").innerText(), item === pptx ? /Slide 1/ : /page two/);
        }
        if (item === png) await page.waitForFunction(() => document.querySelector('[data-testid="document-media-preview"] img')?.naturalWidth === 96);
        if (item === wav || item === video) {
          const media = preview.locator(item === wav ? "audio" : "video");
          assert.equal(await media.getAttribute("controls"), ""); assert.equal(await media.getAttribute("autoplay"), null);
          assert.equal(await media.evaluate(element => element.paused && element.currentTime === 0), true);
          mediaHandle = await media.elementHandle();
          await media.evaluate(async element => { await element.play(); });
          await page.waitForFunction(() => document.querySelector('[data-testid="document-media-preview"] audio, [data-testid="document-media-preview"] video')?.currentTime > 0.1);
          if (item === video) assert.equal(await media.evaluate(element => element.videoWidth), 160);
        }
        assert.equal(await preview.locator("script, iframe, object, embed").count(), 0);
        assert.equal(await page.evaluate(() => window.previewInjected), undefined);
        await shot(`preview-${item.name.replaceAll(".", "-")}`);
        if (item === pptx) {
          await page.setViewportSize({ width: 390, height: 844 });
          await page.waitForFunction(() => {
            const box = document.querySelector('[data-testid="document-media-preview"]')?.getBoundingClientRect();
            return box && box.x >= 0 && box.right <= innerWidth + 1;
          }, null, { timeout: 5000 });
          await shot("preview-pptx-mobile");
          const box = await preview.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= 391, `mobile preview fits viewport: ${JSON.stringify(box)}`);
          await page.setViewportSize({ width: 1366, height: 900 });
        }
        const urls = await page.evaluate(() => [...window.previewUrls.created]);
        await close();
        if (mediaHandle) {
          assert.equal(await mediaHandle.evaluate(element => !element.isConnected && element.paused && !element.getAttribute("src")), true, "closing pauses and detaches the original native media element");
          await mediaHandle.dispose();
        }
        if (item === png || item === wav || item === video) for (const url of urls) assert.ok(await page.evaluate(url => window.previewUrls.revoked.includes(url), url), "preview Blob URLs revoked on close");
      });
      await page.setViewportSize({ width: 1366, height: 900 });
      if (await page.getByRole("button", { name: "\u5173\u95ed\u8d44\u6e90\u8be6\u60c5" }).isVisible()) await close();
    }
    await check("actual browser text preserves the 20 KB UTF-8 boundary", async () => {
      const item = await fixture("long-utf8.txt", Buffer.from("a".repeat(19999) + "\u4e2dmore"), "text/plain");
      const { preview } = await uploadAndOpen(item);
      assert.equal(await preview.getByTestId("document-preview-text").textContent(), "a".repeat(19999));
      assert.match(await preview.innerText(), /20 KB/);
      await close();
    });
    const emptyWord = docxZip("");
    zipFile(emptyWord, "word/document.xml", `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>`);
    const emptyDocuments = [
      await fixture("empty-text.docx", await zipBytes(emptyWord), mime.docx),
      await fixture("empty-text.pdf", pdfBytes([""]), "application/pdf"),
    ];
    for (const item of emptyDocuments) await check(`actual browser empty-text state ${item.name}`, async () => {
      const { preview } = await uploadAndOpen(item);
      assert.equal(await preview.getAttribute("data-preview-kind"), "document");
      assert.match(await preview.innerText(), /\u6ca1\u6709\u53ef\u63d0\u53d6\u7684\u6587\u5b57/);
      assert.equal(await preview.getByTestId("document-preview-text").count(), 0);
      await close();
    });
    const dtdZip = docxZip("safe");
    zipFile(dtdZip, "word/document.xml", '<!DOCTYPE x [<!ENTITY a SYSTEM "https://blocked.invalid/entity">]><x>&a;</x>');
    const bombZip = docxZip("safe");
    zipFile(bombZip, "word/document.xml", `<x>${"a".repeat(PREVIEW_LIMITS.xmlBytes)}</x>`);
    const externalSlides = pptxZip([1]);
    zipFile(externalSlides, "ppt/_rels/presentation.xml.rels", `${XML}<Relationships xmlns="${REL}"><Relationship Id="slide-1" Type="${OFFICE}/slide" TargetMode="External" Target="https://blocked.invalid/slide.xml"/></Relationships>`);
    const negative = [
      await fixture("blocked-dtd.docx", await zipBytes(dtdZip), mime.docx),
      await fixture("bounded-bomb.docx", await zipBytes(bombZip), mime.docx),
      await fixture("corrupt.pdf", Buffer.from("%PDF-1.4\ncorrupt fixture"), "application/pdf"),
      await fixture("external-slide.pptx", await zipBytes(externalSlides), mime.pptx),
    ];
    for (const item of negative) await check(`actual DOM parser rejects ${item.name}`, async () => {
      const { preview } = await uploadAndOpen(item);
      assert.equal(await preview.getAttribute("data-preview-kind"), "error");
      assert.match(await preview.innerText(), /\u65e0\u6cd5|\u8d85\u8fc7/);
      await close();
    });
    await check("corrupt media has an explicit decode-error state", async () => {
      const item = await fixture("unplayable.webm", Buffer.from([26, 69, 223, 163, 1, 2, 3, 4]), "video/webm");
      const { preview } = await uploadAndOpen(item);
      await preview.locator('[data-media-state="error"]').waitFor({ state: "visible" });
      assert.match(await preview.innerText(), /\u65e0\u6cd5\u89e3\u7801/);
      await shot("expected-media-decode-error");
      await close();
    });
    for (const ext of ["doc", "ppt"]) await check(`legacy ${ext} fallback downloads exact original bytes`, async () => {
      const item = await fixture(`legacy.${ext}`, Buffer.concat([Buffer.from([208, 207, 17, 224, 161, 177, 26, 225]), Buffer.from(`unsupported legacy ${ext} fixture`)]), ext === "doc" ? "application/msword" : "application/vnd.ms-powerpoint");
      const { dialog, preview } = await uploadAndOpen(item);
      assert.equal(await preview.getAttribute("data-preview-kind"), "unsupported");
      const downloadPromise = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "\u4e0b\u8f7d\u539f\u6587\u4ef6", exact: true }).click();
      const download = await downloadPromise;
      const downloaded = path.join(OUT, `downloaded-legacy.${ext}`);
      await download.saveAs(downloaded);
      assert.equal(sha(await fs.readFile(downloaded)), sha(item.bytes));
      await close();
    });
    await check("no external request or page errors", () => { assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.errors, []); });
    await context.close();
  } finally { await browser.close(); report.browserClosed = !browser.isConnected(); }
}
report.sourceHashes = {};
for (const file of sourceFiles) report.sourceHashes[file] = sha(await fs.readFile(path.join(APP, file)));
await check("owned sources unchanged during run", () => assert.deepEqual(report.sourceHashes, report.sourceHashesBefore));
report.endedAt = new Date().toISOString();
report.pass = report.checks.every(check => check.pass);
await fs.writeFile(path.join(OUT, `${report.mode}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, failed: report.checks.filter(check => !check.pass), output: OUT }, null, 2));
if (!report.pass) process.exitCode = 1;
