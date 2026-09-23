import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function readTs(path) {
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(require, compiled, compiled.exports);
  return compiled.exports;
}
const { TEMPLATES, PHASES, RESEARCH_SKILLS, SEARCH_PORTALS } = readTs("../lib/paper/catalog.ts");
const { buildResearchPrompt, EMPTY_BRIEF, parseResearchProject, safeSourceUrl, exportResearchRecord, emptyResearchProject, replaceMaterial, copyResearchOutput } = readTs("../lib/paper/workspace.ts");
assert.equal(PHASES.length, 6);
assert.equal(TEMPLATES.length, 14);
assert.equal(new Set(TEMPLATES.map(t => t.id)).size, TEMPLATES.length);
for (const phase of PHASES) assert.ok(TEMPLATES.filter(t => t.phase === phase.id).length >= 2);
for (const skill of RESEARCH_SKILLS) {
  assert.ok(TEMPLATES.some(t => t.skill === skill.id));
  assert.equal(skill.steps.length, 3);
  if (skill.kind === "本地 Skill 提炼") assert.equal(skill.installUrl, undefined);
  else assert.ok(safeSourceUrl(skill.installUrl) && safeSourceUrl(skill.sourceUrl));
}
for (const t of TEMPLATES) {
  const prompt = buildResearchPrompt(t, { ...EMPTY_BRIEF, topic: "合作学习", material: "待核实的观察，不代表结论" });
  assert.ok(prompt.length < 2000);
  for (const required of ["不得编造", "相关与因果", "计划状态不得输出实际研究结论", "待核验", "未附证据"]) assert.ok(prompt.includes(required));
}
const item = { id: "E-1234", title: "实地观察", url: "https://example.org/paper", claim: "课堂讨论分工存在差异", locator: "第3页，观察不支持因果解释", status: "checked", selected: true };
const prompt = buildResearchPrompt(TEMPLATES[0], EMPTY_BRIEF, [item]);
assert.ok(prompt.includes("[E-1234]") && prompt.includes(item.locator));
assert.ok(!buildResearchPrompt(TEMPLATES[0], EMPTY_BRIEF, [{ ...item, selected: false }]).includes(item.id));
const project = { version: 1, brief: EMPTY_BRIEF, evidence: [item], outputs: { question: { title: "选题", text: "待核验建议", source: "模型生成", prompt, checks: [true, true] } } };
const parsed = parseResearchProject(JSON.stringify(project));
assert.equal(parsed.evidence[0].status, "unverified");
assert.equal(parsed.evidence[0].selected, false);
assert.deepEqual(parsed.outputs.question.checks, [false, false]);
assert.ok(parsed.outputs.question.source.includes("未经本次核验"));
for (const raw of ["broken", JSON.stringify({ ...project, version: 99 }), JSON.stringify({ ...project, evidence: [item, item] }), JSON.stringify({ ...project, evidence: [{ ...item, url: "javascript:alert(1)" }] })]) assert.throws(() => parseResearchProject(raw));
for (const url of ["javascript:alert(1)", "data:text/html,a", "file:///private", "https://user:password@example.org/a", "not a url"]) assert.equal(safeSourceUrl(url), null);
assert.ok(safeSourceUrl("https://doi.org/10.1234/5678"));
const record = exportResearchRecord(EMPTY_BRIEF, [item], Object.values(project.outputs));
for (const expected of [item.id, item.locator, "本次提示词快照", "使用边界"]) assert.ok(record.includes(expected));
for (const portal of SEARCH_PORTALS) assert.ok(safeSourceUrl(portal.url));
const latestMaterial = { ...emptyResearchProject(), brief: { ...EMPTY_BRIEF, material: "最新输入 B，不是生成时的 A" } };
const handed = replaceMaterial(latestMaterial, "AI 草稿");
assert.deepEqual(handed.materialHistory, [latestMaterial.brief.material]);
assert.equal(latestMaterial.brief.material, "最新输入 B，不是生成时的 A");
assert.throws(() => replaceMaterial(handed, "文".repeat(20001)));
const withHistory = { ...handed, outputs: project.outputs, outputHistory: [project.outputs.question], evidenceDraft: { editing: "E-old", title: "未提交的来源", url: "待补链接", claim: "尚未核验", locator: "第 2 页" } };
const recovered = parseResearchProject(JSON.stringify(withHistory));
assert.deepEqual(recovered.materialHistory, handed.materialHistory);
assert.equal(recovered.evidenceDraft.title, "未提交的来源");
assert.equal(recovered.evidenceDraft.editing, null);
const editProject = { ...withHistory, evidence: [item], evidenceDraft: { ...withHistory.evidenceDraft, editing: item.id, title: "更新后的原记录" } };
assert.equal(parseResearchProject(JSON.stringify(editProject)).evidenceDraft.editing, item.id);
assert.deepEqual(recovered.outputHistory[0].checks, [false, false]);
assert.ok(copyResearchOutput(project.outputs.question).includes(item.locator));
assert.ok(copyResearchOutput(project.outputs.question).includes("[E-1234]"));
const historicalRecord = exportResearchRecord(handed.brief, [], recovered.outputHistory, recovered.materialHistory, recovered.evidenceDraft);
for (const text of ["最新输入 B", "未提交的来源", item.locator]) assert.ok(historicalRecord.includes(text));
const versions = exportResearchRecord(EMPTY_BRIEF, [], [project.outputs.question], [], undefined, [project.outputs.question]);
for (const text of ["当前输出", "历史输出 1（已替代", "研究计划（尚无实际发现）"]) assert.ok(versions.includes(text));
assert.ok(exportResearchRecord({ ...EMPTY_BRIEF, researchState: "findings" }, [], []).includes("已有实际发现"));
console.log("PASS: 14 templates, 6 stages, 7 guides, evidence binding, project roundtrip, fail-closed import, safe URLs and export provenance.");
console.log("PASS: non-destructive handoff, importable material bounds, historical outputs, evidence drafts and copy provenance.");
const { checkPaperIdentity } = readTs("../lib/paper/identity.ts");
const originalFetch = globalThis.fetch;
try {
  for (const sample of [
    { status: 200, body: { user: { id: "A", sessionVersion: 1 } }, result: true },
    { status: 200, body: { user: { id: "B", sessionVersion: 1 } }, result: false },
    { status: 401, body: { user: null }, result: false },
    { status: 503, body: { error: "temporary failure" } },
    { status: 200, body: { user: { id: "A" } } },
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify(sample.body), { status: sample.status });
    if (sample.result === undefined) await assert.rejects(checkPaperIdentity("A:1"));
    else assert.equal(await checkPaperIdentity("A:1"), sample.result);
  }
  globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(checkPaperIdentity("A:1"));
} finally { globalThis.fetch = originalFetch; }
console.log("PASS: identity matching, changed account, expired session and unknown network/server/shape states.");
