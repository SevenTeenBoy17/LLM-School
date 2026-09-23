import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ACCEPT, EXAMPLE_RESOURCES, MAX_FILE_BYTES, MAX_BATCH_BYTES, MAX_BATCH_FILES,
  MAX_LIBRARY_BYTES, emptyResourceState, fileExtension, filterResources,
  inferKind, readableBytes, validateResourceFile,
} from "../lib/school-resources/model.ts";

const out = fileURLToPath(new URL("../../.agent-supervisor/resources-v2-20260908/tester/", import.meta.url));
mkdirSync(out, { recursive: true });
const startedAt = new Date().toISOString();
const checks = [];
function check(id, label, run) {
  try { run(); checks.push({ id, label, status: "passed" }); }
  catch (error) { checks.push({ id, label, status: "failed", error: error.stack }); }
  console.log(`${checks.at(-1).status.toUpperCase()} ${id}: ${label}`);
}
const options = { query: "", subject: "", grade: "", kind: "", tab: "all", favoriteIds: [], sort: "recent" };
const filter = (overrides, data = EXAMPLE_RESOURCES) => filterResources(data, { ...options, ...overrides });

check("M01", "Every accepted extension is valid; extension matching is case insensitive", () => {
  for (const ext of ACCEPT.split(",")) {
    assert.equal(validateResourceFile({ name: `lesson${ext.toUpperCase()}`, size: 1, type: "" }), null);
  }
  assert.equal(fileExtension("a.b.PPTX"), "pptx");
  assert.equal(inferKind("lesson.PPTX"), "slides");
  for (const ext of ["doc", "docx", "md", "txt"]) assert.equal(inferKind(`lesson.${ext}`), "lesson");
  assert.equal(inferKind("photo.png"), "other");
});
check("M02", "Reject unsupported extensions, disguised active MIME, empty and over-limit files", () => {
  // V2 accepts HTML only as a bounded opaque-sandbox activity; disguised active types remain rejected.
  for (const name of ["malware.exe", "image.svg", "script.js", "file", "a.md.exe"])
    assert.ok(validateResourceFile({ name, size: 10, type: "" }));
  for (const type of ["text/html", "image/svg+xml", "application/x-msdownload", "application/javascript"])
    assert.ok(validateResourceFile({ name: "disguised.md", size: 10, type }));
  assert.ok(validateResourceFile({ name: "empty.md", size: 0, type: "text/markdown" }));
  assert.equal(validateResourceFile({ name: "limit.pdf", size: MAX_FILE_BYTES, type: "application/pdf" }), null);
  assert.ok(validateResourceFile({ name: "big.pdf", size: MAX_FILE_BYTES + 1, type: "application/pdf" }));
  assert.equal(MAX_FILE_BYTES, 50 * 1024 * 1024);
  assert.equal(MAX_BATCH_BYTES, 100 * 1024 * 1024);
  assert.equal(MAX_BATCH_FILES, 5);
  assert.equal(MAX_LIBRARY_BYTES, 200 * 1024 * 1024);
  assert.equal(validateResourceFile({ name: "activity.html", size: 5 * 1024 * 1024, type: "text/html" }), null);
  assert.ok(validateResourceFile({ name: "activity.html", size: 5 * 1024 * 1024 + 1, type: "text/html" }));
  assert.ok(validateResourceFile({ name: "activity.html", size: 10, type: "application/pdf" }));
});
check("M03", "Built-in examples explicitly identify themselves and preserve actual download byte lengths", () => {
  assert.equal(EXAMPLE_RESOURCES.length, 6);
  assert.equal(new Set(EXAMPLE_RESOURCES.map(r => r.id)).size, 6);
  for (const resource of EXAMPLE_RESOURCES) {
    assert.equal(resource.origin, "example");
    assert.match(resource.body, /示例/);
    assert.match(resource.author, /示例/);
    assert.match(resource.fileName, /\.md$/);
    assert.equal(resource.fileSize, Buffer.byteLength(resource.body, "utf8"));
    assert.equal(resource.blob, undefined);
  }
});
check("M04", "Keyword, subject, grade, type compose and whitespace/case do not defeat search", () => {
  assert.deepEqual(filter({ query: "  OUR SCHOOL  " }).map(r => r.id), ["example-dialogue"]);
  assert.deepEqual(filter({ query: "折纸", subject: "数学", grade: "四年级", kind: "slides" }).map(r => r.id), ["example-fractions"]);
  assert.equal(filter({ subject: "数学", grade: "一年级" }).length, 0);
  assert.equal(filter({ query: "no-such-resource-qa" }).length, 0);
  assert.equal(filter({ query: "教研团队" }).length, 6);
});
check("M05", "Draft/favorite scopes, ordering, and reset do not mutate source records", () => {
  const local = { ...EXAMPLE_RESOURCES[0], id: "qa-local", origin: "local", updatedAt: Date.now(), title: "A regression" };
  const data = [...EXAMPLE_RESOURCES, local];
  const before = structuredClone(data);
  assert.deepEqual(filter({ tab: "drafts" }, data).map(r => r.id), [local.id]);
  assert.deepEqual(filter({ tab: "favorites", favoriteIds: ["example-water", "missing"] }, data).map(r => r.id), ["example-water"]);
  assert.equal(filter({}, data)[0].id, local.id);
  const titles = filter({ sort: "title" }, data).map(r => r.title);
  assert.deepEqual(titles, data.map(r => r.title).sort((a, b) => a.localeCompare(b, "zh-CN")));
  assert.deepEqual(data, before);
  assert.equal(filter({}).length, 6);
});
check("M06", "Fresh account state is unshared and byte display boundaries are stable", () => {
  const first = emptyResourceState();
  first.favoriteIds.push("x");
  assert.deepEqual(emptyResourceState(), { drafts: [], favoriteIds: [] });
  assert.equal(readableBytes(0), "0 B");
  assert.equal(readableBytes(12), "12 B");
  assert.equal(readableBytes(1024), "1 KB");
  assert.equal(readableBytes(1024 * 1024), "1.0 MB");
});
const report = {
  schema: "SchoolResourcesModelRegression/v1", startedAt, endedAt: new Date().toISOString(),
  command: "node tests/school-resources-model.mjs", cwd: process.cwd(), collector: "native-node-assert",
  sourceSha256: createHash("sha256").update(readFileSync(new URL("../lib/school-resources/model.ts", import.meta.url))).digest("hex"),
  checks, passed: checks.filter(c => c.status === "passed").length, failed: checks.filter(c => c.status === "failed").length,
  testLimits: ["Pure model behavior only; IndexedDB persistence and rendered workflows are exercised by school-resources-ui.mjs.", "Local regression evidence, not a signed Supervisor gate."],
};
writeFileSync(`${out}/model-report.json`, `${JSON.stringify(report, null, 2)}\n`);
process.exitCode = report.failed ? 1 : 0;
