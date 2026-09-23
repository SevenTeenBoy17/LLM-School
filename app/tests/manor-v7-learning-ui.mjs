import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";
import { launchManorBrowser } from "./manor-v5-helpers.mjs";

// Source-component browser tests: every API is a fixture, with no app database or real-user submissions.
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), "manor-v7-learning-ui-"));
const checks = [];
const source = "app/(shell)/student/manor";
const mission = { id: "published-math-1", assignmentId: "assignment-1", assignmentVersion: 1, objectiveId: "math", subject: "数学", title: "节水比较", durationMinutes: 8, question: "少用多少水？", prompt: "模拟数据：100升和75升。", choices: [{ id: "A", text: "25升" }, { id: "B", text: "75升" }, { id: "C", text: "100升" }], reward: 0, gradeBand: "middle_school", resourceVersion: "resource-1", datasetVersion: "dataset-1", source: { kind: "assignment", teacherPublished: true, dataKind: "simulated", label: "教师分派 · 模拟数据" } };
const sample = { ...mission, id: "sample-math-1", assignmentId: undefined, source: { kind: "sample", teacherPublished: false, label: "教学示例" } };
function initial() {
  return { schemaVersion: "manor.v2", stateVersion: 1, subject: { id: "student-a", name: "测试学生", department: "", gradeBand: "middle_school" }, daily: { day: 1, completed: false }, profile: { quietUntil: null, endedAt: null, revision: 1 }, missions: [mission], sampleMissions: [sample], assignments: [], plots: [], resources: { growthEnergy: 0, points: 0, harvestedTotal: 0, harvests: {} }, inventory: [], neighbors: [], classBuild: null, reviews: [], artifacts: [], grants: [], evidence: [], taskRuns: [], taskRunHistory: [] };
}
const assignment = { id: "assignment-1", title: "正式节水任务", classId: "class-1", teacherId: "teacher-a", gradeBand: "middle_school", assignmentVersion: 1, resourceVersion: "resource-1", datasetVersion: "dataset-1", missionIds: [mission.id], templateIds: [sample.id], rewardUnits: 0, status: "published", revision: 1, publishedAt: Date.now(), studentIds: null, supersedesId: null };
let state = initial();
let catalog = { ownerId: "teacher-a", classes: [{ id: "class-1", label: "测试班级", students: [{ id: "student-a", name: "测试学生", gradeBand: "middle_school" }] }], templates: [sample, { ...sample, id: "legacy-template", title: "未标学段旧模板", gradeBand: undefined }, { ...sample, id: "upper-template", title: "小学高段模板", gradeBand: "upper_primary" }], assignments: [] };
let authId = "student-a";
let failArtifact = false, failPublish = false, unknownPublish = false;
let failProject = false, unknownProject = false;
let project = { id: "project-1", assignmentId: "assignment-1", projectId: "water", datasetVersion: "dataset-1", status: "incomplete", revision: 0, requiredSubjects: ["数学", "科学", "语文"], contributions: [], draft: null, result: null, completionScope: "required_contributions", evaluationStatus: "not_reviewed" };
const projectCommands = [];
const requests = [], publishCommands = [], errors = [], unexpected = [];
let browser, server, page;
try {
  writeFileSync(join(temp, "loader.cjs"), `const ts = require(${JSON.stringify(require.resolve("typescript"))});
module.exports = function(source) {
 if (this.resourcePath.endsWith('.css')) {
   const prefix = require('node:path').basename(this.resourcePath).replace(/[^a-z]/g, '') + '_';
   const names = {};
   const css = source.replace(/(?<![a-zA-Z0-9_\\/])\\.([a-zA-Z_][\\w-]*)/g, (_, name) => { names[name] = prefix + name; return '.' + prefix + name; });
   return 'const s = document.createElement("style"); s.textContent=' + JSON.stringify(css) + '; document.head.append(s); export default ' + JSON.stringify(names) + ';';
 }
 return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: this.resourcePath }).outputText;
};`);
  writeFileSync(join(temp, "entry.tsx"), `import React, {useState} from "react";
import {createRoot} from "react-dom/client";
import {LearningHub} from ${JSON.stringify(join(appRoot, source, "components/LearningHub.tsx"))};
import {ManorAssignmentsPanel} from ${JSON.stringify(join(appRoot, "components/class/ManorAssignmentsPanel.tsx"))};
const root=createRoot(document.getElementById("root")); let key=0;
function App({mode,initial}) { const [data,setData]=useState(initial); const [panel,setPanel]=useState("mission"); window.fixture.update=setData; window.fixture.open=setPanel;
 return mode==="teacher" ? <ManorAssignmentsPanel/> : <LearningHub panel={panel} studentName={data.subject.name} missions={data.missions} grants={data.grants} initialReviews={data.reviews} initialPortfolio={[]} profileRevision={1} quietUntil={null} initialClassProgress={0} growthEnergy={0} missionProgress={0} onOpen={setPanel} onClose={()=>setPanel(null)} onRefresh={async()=>{}} availablePlotIds={[]} onNurturePlot={async()=>{}} onGrowthEnergy={()=>{}} onProfileRevision={()=>{}} onQuietUntil={()=>{}} onMissionComplete={()=>{}} bootstrap={data}/>;
}
window.fixture={mount:(mode,initial)=>root.render(<App key={++key} mode={mode} initial={initial}/>)};`);
  await new Promise((resolveBuild, reject) => {
    const compiler = webpack({ mode: "development", devtool: false, entry: join(temp, "entry.tsx"), output: { path: temp, filename: "bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], modules: [join(appRoot, "node_modules"), "node_modules"], alias: { "@": appRoot } }, module: { rules: [{ test: /\.(tsx?|css)$/, exclude: /node_modules/, use: join(temp, "loader.cjs") }] } });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolveBuild()));
  });
  server = createServer((request, response) => {
    if (request.url === "/bundle.js") { response.setHeader("content-type", "application/javascript"); response.end(readFileSync(join(temp, "bundle.js"))); }
    else if (request.url?.startsWith("/api/")) { response.writeHead(500); response.end("Unmocked request"); unexpected.push(request.url); }
    else { response.setHeader("content-type", "text/html; charset=utf-8"); response.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#fff;font-family:Arial,sans-serif}#root{max-width:920px;margin:auto;padding:16px}</style><div id="root"></div><script src="/bundle.js"></script></html>'); }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  try { browser = await launchManorBrowser(); }
  catch (failure) {
    const executablePath = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]].filter(Boolean).map((root) => join(root, "Google", "Chrome", "Application", "chrome.exe")).find(existsSync);
    if (!executablePath || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) throw failure;
    browser = await chromium.launch({ executablePath, headless: true });
  }
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.route("**/api/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const input = request.method() === "POST" ? request.postDataJSON() : null;
    requests.push({ path, method: request.method(), input });
    const send = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/auth/me") return send({ user: { id: authId } });
    if (path === "/api/v2/manor/bootstrap") return send(state);
    if (path === "/api/v2/manor/projects") return send({ projects: [project] });
    if (path.startsWith("/api/v2/manor/operations/")) return send({ error: { code: "OPERATION_NOT_FOUND" } }, 404);
    if (path === "/api/v2/manor/projects/project-1" && input) {
      projectCommands.push(input);
      if (unknownProject) { unknownProject = false; return route.abort("failed"); }
      if (failProject) { failProject = false; project.revision += 1; project.draft.content = "服务器端另一份成果草稿"; return send({ error: { code: "MANOR_REVISION_CONFLICT", message: "成果版本冲突，输入已保留。", authoritative: { project } } }, 409); }
      assert.equal(input.expectedRevision, project.revision);
      assert.equal(input.datasetVersion, project.datasetVersion);
      const complete = input.intent === "complete";
      if (complete) assert.equal(input.contributions.length, 3);
      project = { ...project, revision: project.revision + 1, contributions: input.contributions, status: complete ? "complete" : "incomplete", draft: complete ? null : { artifactId: "project-artifact", content: input.content }, result: complete ? { artifactId: "project-artifact", content: input.content, completedAt: Date.now() } : null };
      state.stateVersion += 1;
      return send({ project, artifact: { id: "project-artifact" } });
    }
    if (path === "/api/v2/teacher/manor/assignments") {
      if (!input) return send(catalog);
      publishCommands.push(input);
      if (unknownPublish) { unknownPublish = false; return route.abort("failed"); }
      if (failPublish) { failPublish = false; return send({ error: { message: "发布冲突，内容已保留。" } }, 409); }
      const item = { ...assignment, title: input.title };
      catalog.assignments = [item]; return send({ ok: true, assignment: item });
    }
    if (path === "/api/v2/manor/artifacts" && input) {
      if (failArtifact) {
        failArtifact = false;
        const item = state.artifacts.find((entry) => entry.id === input.artifactId);
        item.revision += 1; item.content = "另一端已保存的内容"; state.stateVersion += 1;
        return send({ error: { code: "MANOR_REVISION_CONFLICT", message: "作品版本冲突，输入已保留。", authoritative: { artifact: item } } }, 409);
      }
      const previous = state.artifacts.find((item) => item.id === input.artifactId);
      if (previous) assert.equal(input.expectedRevision, previous.revision);
      const item = { id: previous?.id ?? `artifact-${state.artifacts.length + 1}`, title: input.title, content: input.content, artifactType: input.artifactType, evidenceId: input.evidenceId, taskRunId: input.taskRunId ?? previous?.taskRunId, status: "draft", revision: (previous?.revision ?? 0) + 1 };
      state.artifacts = [...state.artifacts.filter((entry) => entry.id !== item.id), item]; state.stateVersion += 1;
      return send({ artifact: item, resources: state.resources });
    }
    if (path === "/api/v2/manor/task-runs" && input) {
      const previous = state.taskRuns.find((item) => item.missionId === input.missionId);
      const run = { id: input.restart || !previous ? `run-${state.stateVersion}` : previous.id, missionId: input.missionId, phase: input.phase, answer: input.answer ?? "", reflection: input.reflection ?? "", evidenceId: input.evidenceId ?? null, revision: (previous?.revision ?? 0) + 1, createdAt: Date.now(), completedAt: null };
      state.taskRuns = [run]; state.stateVersion += 1;
      return send({ taskRun: run });
    }
    if (path === "/api/v2/manor/evidence" && input?.evidenceType === "expression") {
      assert.ok(input.taskRunId);
      const record = { id: input.evidenceId ?? "expression-new", missionId: input.missionId, taskRunId: input.taskRunId, revision: 1, evidenceType: "expression", status: "pending_review", rewardClass: "none", submission: { content: input.content } };
      state.evidence.unshift(record); state.stateVersion += 1;
      return send({ evidence: record });
    }
    unexpected.push(path); return send({ error: { message: "Unexpected fixture request" } }, 500);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const mount = async (mode = "student") => { await page.evaluate(({ mode, state }) => window.fixture.mount(mode, state), { mode, state }); await page.getByRole("heading", { name: mode === "student" ? "今日学习任务" : "庄园任务分派", exact: true }).waitFor(); };
  const open = async (panel) => { await page.evaluate((name) => window.fixture.open(name), panel); };
  const settle = async () => { await page.locator('[aria-busy="true"]').waitFor({ state: "hidden" }); };
  const workshop = () => page.getByRole("button", { name: "创作工坊", exact: true }).click();
  const content = () => page.getByRole("textbox", { name: "作品内容", exact: true });
  const save = async () => { await page.getByRole("button", { name: "保存作品", exact: true }).click(); await settle(); };
  await mount();
  assert.equal(await page.getByLabel("学习任务", { exact: true }).locator("option").count(), 2);
  await page.getByRole("button", { name: "示例练习 1", exact: true }).click();
  assert.match(await page.getByTestId("learning-panel").innerText(), /无成长奖励/);
  await workshop();
  assert.equal(await page.getByRole("button", { name: "提交老师", exact: true }).count(), 0);
  await page.getByRole("button", { name: "正式任务 1", exact: true }).click();
  const selected = page.locator('nav[aria-label="学习工作区"] button[aria-current="page"]');
  const contrast = async () => selected.evaluate((element) => {
    const s = getComputedStyle(element), lum = (color) => color.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    const a = lum(s.color), b = lum(s.backgroundColor); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  await selected.hover(); assert.ok(await contrast() >= 4.5);
  await selected.focus(); await page.mouse.move(0, 0); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  assert.equal(await selected.evaluate((el) => el.matches(":focus-visible")), true); assert.ok(await contrast() >= 4.5);
  checks.push("formal/sample separation; sample has no teacher submission; selected hover/focus contrast >= 4.5");

  await page.getByLabel("作品标题", { exact: true }).fill("节水记录");
  await content().fill("我比较了两个用水量并记录证据。"); await save();
  assert.equal(state.artifacts.length, 1); assert.equal(state.artifacts[0].revision, 1);
  await content().fill("我比较了两个用水量，补充了比较基准。"); await save();
  assert.equal(state.artifacts.length, 1); assert.equal(state.artifacts[0].revision, 2);
  await open("portfolio");
  await page.getByRole("button", { name: "继续创作", exact: true }).click();
  await content().fill("继续创作保留同一作品身份，补充限制。"); await save();
  assert.equal(state.artifacts.length, 1); assert.equal(state.artifacts[0].revision, 3);
  failArtifact = true;
  const localText = "发生冲突时这段未保存的输入必须保留。";
  await content().fill(localText); await save();
  assert.equal(await content().inputValue(), localText);
  await page.getByRole("region", { name: "作品版本冲突" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "保存作品", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "保留本稿并采用版本 4" }).click(); await save();
  assert.equal(state.artifacts[0].revision, 5); assert.equal(state.artifacts[0].content, localText);
  await page.getByRole("button", { name: "另存副本", exact: true }).click(); await save();
  assert.equal(state.artifacts.length, 2); assert.equal(state.artifacts[1].revision, 1);
  await page.getByRole("button", { name: "新建作品", exact: true }).click(); assert.equal(await content().inputValue(), "");
  checks.push("same artifact updates v1-v3; CAS conflict keeps input and requires explicit v4 reconciliation; v5 save; copy creates one new artifact; new clears editor");

  await content().fill("首次正式表达，提交前必须创建我的任务轮次。");
  authId = "student-b";
  const beforeOwnerCheck = requests.filter((item) => item.method === "POST").length;
  await page.getByRole("button", { name: "提交老师", exact: true }).click(); await settle();
  assert.equal(requests.filter((item) => item.method === "POST").length, beforeOwnerCheck);
  assert.equal(await content().inputValue(), "首次正式表达，提交前必须创建我的任务轮次。");
  authId = "student-a";
  await page.getByRole("button", { name: "提交老师", exact: true }).click(); await settle();
  const firstExpressionPosts = requests.filter((item) => item.method === "POST").slice(-2);
  assert.deepEqual(firstExpressionPosts.map((item) => item.path), ["/api/v2/manor/task-runs", "/api/v2/manor/evidence"]);
  assert.equal(firstExpressionPosts[1].input.taskRunId, state.taskRuns[0].id);
  checks.push("student owner preflight prevents cross-account POST and preserves input; first expression creates its server taskRun before submission");

  state = initial();
  state.taskRuns = [{ id: "run-old", missionId: mission.id, phase: "summary", answer: "A", reflection: "旧反思", evidenceId: "old-expression", revision: 7, completedAt: Date.now() }];
  state.evidence = [{ id: "old-expression", missionId: mission.id, taskRunId: "run-old", evidenceType: "expression", status: "accepted_mastery", revision: 2, rewardClass: "none", submission: { content: "旧轮次已接受的表达，不得污染新轮次。" } }];
  await mount();
  const provenance = page.locator("details").filter({ has: page.locator("summary", { hasText: "任务来源与版本" }) });
  assert.equal(await provenance.getAttribute("open"), null);
  assert.equal(await provenance.getByText("assignment-1", { exact: true }).isVisible(), false);
  assert.equal(await provenance.getByText("run-old", { exact: true }).isVisible(), false);
  assert.equal(await page.getByText("模拟数据", { exact: true }).isVisible(), true);
  await page.getByText("正式分派 · 发布版本 1", { exact: true }).waitFor();
  await provenance.locator("summary").click();
  for (const text of ["assignment-1", "run-old", "resource-1", "dataset-1"]) assert.equal(await provenance.getByText(text, { exact: true }).isVisible(), true);
  await provenance.locator("summary").click();
  checks.push("student technical IDs and provenance are collapsed by default, fully inspectable, with grade/simulated/published/save states visible");
  await workshop(); assert.equal(await content().inputValue(), state.evidence[0].submission.content);
  assert.equal(await page.getByRole("button", { name: "老师已接受", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "今日学习任务", exact: true }).click();
  await page.getByRole("button", { name: "开始新一轮任务", exact: true }).click(); await settle();
  await workshop(); assert.equal(await content().inputValue(), "");
  await content().fill("这是新轮次的表达，引用本轮数据并保留限制。");
  await page.getByRole("button", { name: "提交老师", exact: true }).click(); await settle();
  assert.equal(state.evidence[0].taskRunId, state.taskRuns[0].id);
  assert.equal(state.evidence[1].submission.content, "旧轮次已接受的表达，不得污染新轮次。");
  state = { ...initial(), subject: { ...initial().subject, id: "student-b", name: "同名学生" } };
  await page.evaluate((next) => window.fixture.update(next), state); await workshop(); assert.equal(await content().inputValue(), "");
  checks.push("same-day restart selects only current taskRunId, clears editor and accepted lock; immutable old expression; account switch clears editor");

  state = { ...initial(), missions: [], taskRuns: [] }; await mount();
  await page.getByText("暂无正式分派", { exact: true }).waitFor();
  await page.getByRole("button", { name: "查看示例练习", exact: true }).click();
  await open("greenhouse"); await page.getByRole("button", { name: "查看学习任务", exact: true }).waitFor();
  await open("class"); await page.getByText("共同成果尚待补充", { exact: true }).waitFor();
  assert.equal(await page.getByRole("region", { name: "项目贡献状态" }).locator("span").filter({ hasText: /尚待补充/ }).count(), 4);
  checks.push("contextual empty-state actions; incomplete project displays all three missing contributions");

  state = initial();
  state.missions = ["数学", "科学", "语文"].map((subject, index) => ({ ...mission, id: `project-mission-${index}`, subject, projectId: "water" }));
  for (const [index, item] of state.missions.entries()) {
    const runId = `project-run-${index}`;
    const record = { id: `project-expression-${index}`, missionId: item.id, taskRunId: runId, assignmentId: "assignment-1", datasetVersion: "dataset-1", evidenceType: "expression", status: "accepted_mastery", revision: 2, rewardClass: "none", submission: { content: `${item.subject}贡献的已接受内容与版本` } };
    state.evidence.push(record, { ...record, id: `project-objective-${index}`, evidenceType: "mastery", submission: { choice: "A" } });
    state.artifacts.push({ id: `accepted-artifact-${index}`, evidenceId: record.id, taskRunId: runId, assignmentId: "assignment-1", datasetVersion: "dataset-1", artifactType: "expression", status: "archived", title: `${item.subject}成果`, content: record.submission.content, revision: 1, acceptedRevision: 1 });
  }
  state.artifacts.push({ ...state.artifacts[0], id: "wrong-dataset-artifact", datasetVersion: "dataset-2" }, { ...state.artifacts[1], id: "unaccepted-artifact", acceptedRevision: null }, { ...state.artifacts[2], id: "wrong-content-artifact", content: "未经接受的替换内容" });
  await mount(); await open("class");
  await page.getByLabel("共同成果内容", { exact: true }).fill("这份共同成果综合了量化比较、科学限制与节水建议。");
  for (const subject of project.requiredSubjects) assert.equal(await page.getByLabel(`${subject}贡献`, { exact: true }).locator("option").count(), 2);
  assert.equal(await page.getByRole("button", { name: "提交共同成果", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "保存成果草稿", exact: true }).click(); await settle();
  assert.equal(project.status, "incomplete"); assert.equal(project.result, null); assert.equal(project.draft.artifactId, "project-artifact");
  await open("mission"); await open("class");
  assert.equal(await page.getByLabel("共同成果内容", { exact: true }).inputValue(), project.draft.content);
  await page.getByLabel("数学贡献", { exact: true }).selectOption("accepted-artifact-0");
  unknownProject = true;
  await page.getByRole("button", { name: "保存成果草稿", exact: true }).click(); await settle();
  await page.getByRole("button", { name: "保存成果草稿", exact: true }).click(); await settle();
  assert.deepEqual(projectCommands[1], projectCommands[2]);
  assert.equal(project.contributions.length, 1); assert.equal(project.status, "incomplete");
  const projectText = "冲突时保留这份共同成果，以及已经选择的数学贡献。";
  await page.getByLabel("共同成果内容", { exact: true }).fill(projectText);
  failProject = true; await page.getByRole("button", { name: "保存成果草稿", exact: true }).click(); await settle();
  assert.equal(await page.getByLabel("共同成果内容", { exact: true }).inputValue(), projectText);
  assert.equal(await page.getByLabel("数学贡献", { exact: true }).inputValue(), "accepted-artifact-0");
  await page.getByRole("button", { name: `保留本稿并采用成果版本 ${project.revision}`, exact: true }).click();
  await page.getByLabel("科学贡献", { exact: true }).selectOption("accepted-artifact-1");
  await page.getByLabel("语文贡献", { exact: true }).selectOption("accepted-artifact-2");
  await page.getByRole("button", { name: "保存成果草稿", exact: true }).click(); await settle();
  assert.equal(project.status, "incomplete", "explicit draft stays draft with all three contributions");
  await page.getByRole("heading", { name: "共同成果", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(temp, "project-sources-1440.png") });
  await page.getByLabel("共同成果内容", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(temp, "project-draft-1440.png") });
  await page.getByRole("button", { name: "提交共同成果", exact: true }).click(); await settle();
  assert.equal(project.status, "complete"); assert.equal(project.result.content, projectText);
  await page.getByText("共同成果已汇合", { exact: true }).waitFor();
  assert.ok((await page.getByRole("region", { name: "项目贡献状态" }).innerText()).includes("尚未评价"));
  assert.equal(await page.getByRole("button", { name: "提交共同成果", exact: true }).count(), 0);
  checks.push("project accepted exact-version source filtering; zero/partial/full draft persistence; unknown receipt identical retry; conflict preserves content/selections; explicit complete needs all 3 and uses server structural status, not teacher acceptance");
  await open("workshop");
  for (const viewport of [{ width: 390, height: 844 }, { width: 667, height: 375 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.getByTestId("learning-panel").evaluate((el) => ({ width: el.scrollWidth, client: el.clientWidth, bottom: el.getBoundingClientRect().bottom }));
    assert.ok(geometry.width <= geometry.client + 1); assert.ok(geometry.bottom <= viewport.height);
    await page.screenshot({ path: join(temp, `student-${viewport.width}.png`) });
  }
  checks.push("390/667/1440 source-component screenshots and modal overflow bounds");

  authId = "teacher-a"; await mount("teacher");
  await page.getByLabel("任务学段", { exact: true }).selectOption("lower_primary");
  assert.equal(await page.getByRole("checkbox").count(), 1);
  await page.getByRole("checkbox", { name: /未标学段旧模板/ }).waitFor();
  await page.getByLabel("任务学段", { exact: true }).selectOption("upper_primary");
  assert.equal(await page.getByRole("checkbox").count(), 1);
  await page.getByRole("checkbox", { name: /小学高段模板/ }).waitFor();
  await page.getByLabel("任务标题", { exact: true }).fill("正式节水任务");
  await page.getByLabel("任务学段", { exact: true }).selectOption("middle_school");
  assert.equal(await page.getByRole("checkbox").count(), 1);
  assert.equal(await page.getByRole("checkbox", { name: /未标学段旧模板/ }).count(), 0);
  checks.push("ungraded legacy templates are lower-primary only, matching server grade validation");
  await page.getByRole("checkbox", { name: /数学.*节水比较/ }).check();
  failPublish = true; await page.getByRole("button", { name: "发布正式任务", exact: true }).click(); await settle();
  assert.equal(await page.getByLabel("任务标题", { exact: true }).inputValue(), "正式节水任务");
  unknownPublish = true; await page.getByRole("button", { name: "发布正式任务", exact: true }).click(); await settle();
  await page.getByRole("button", { name: "确认发布结果", exact: true }).click(); await settle();
  assert.deepEqual(publishCommands[1], publishCommands[2]);
  assert.equal(publishCommands[2].classId, undefined); assert.deepEqual(publishCommands[2].missionIds, [sample.id]);
  await page.getByRole("region", { name: "已发布任务" }).getByText("正式节水任务", { exact: true }).waitFor();
  await page.getByLabel("任务标题", { exact: true }).fill("重试拒绝后保留的任务");
  await page.getByRole("checkbox", { name: /数学.*节水比较/ }).check();
  await page.getByLabel("成长奖励", { exact: true }).fill("4");
  await page.getByRole("button", { name: "指定学生", exact: true }).click();
  await page.getByRole("checkbox", { name: "测试学生", exact: true }).check();
  unknownPublish = true;
  await page.getByRole("button", { name: "发布正式任务", exact: true }).click(); await settle();
  const pendingCommand = publishCommands.at(-1);
  await mount("teacher");
  failPublish = true;
  await page.getByRole("button", { name: "确认发布结果", exact: true }).click(); await settle();
  assert.deepEqual(publishCommands.at(-1), pendingCommand);
  assert.equal(await page.getByLabel("任务标题", { exact: true }).inputValue(), pendingCommand.title);
  assert.equal(await page.getByLabel("任务标题", { exact: true }).isEnabled(), true);
  assert.equal(await page.getByLabel("任务学段", { exact: true }).inputValue(), pendingCommand.gradeBand);
  assert.equal(await page.getByLabel("资源版本", { exact: true }).inputValue(), pendingCommand.resourceVersion);
  assert.equal(await page.getByLabel("数据版本", { exact: true }).inputValue(), pendingCommand.datasetVersion);
  assert.equal(await page.getByLabel("成长奖励", { exact: true }).inputValue(), "4");
  assert.equal(await page.getByRole("checkbox", { name: /数学.*节水比较/ }).isChecked(), true);
  assert.equal(await page.getByRole("checkbox", { name: "测试学生", exact: true }).isChecked(), true);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("eduai.manor.assignment.v7.teacher-a.class-1")), null);
  await page.getByRole("button", { name: "发布正式任务", exact: true }).click(); await settle();
  assert.notEqual(publishCommands.at(-1).operationId, pendingCommand.operationId);
  assert.deepEqual({ ...publishCommands.at(-1), operationId: pendingCommand.operationId }, pendingCommand);
  checks.push("restored unknown publication retries the same command; definitive retry rejection clears storage/lock, restores all inputs and allows a fresh operation");
  await page.getByLabel("任务标题", { exact: true }).fill("另一份未发布任务");
  await page.getByRole("checkbox", { name: /数学.*节水比较/ }).check();
  await page.getByRole("button", { name: "本学段全体", exact: true }).click();
  authId = "teacher-b";
  const count = publishCommands.length;
  await page.getByRole("button", { name: "发布正式任务", exact: true }).click(); await settle();
  assert.equal(publishCommands.length, count);
  catalog = { ...catalog, ownerId: "teacher-b", assignments: [] };
  await page.getByRole("button", { name: "刷新任务分派", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[maxlength="80"]')?.value === "");
  assert.equal(await page.getByLabel("任务学段", { exact: true }).inputValue(), "");
  checks.push("teacher 409 retains input; unknown result retries identical operation/body; authenticated owner checked before POST; owner switch remounts form");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: join(temp, "teacher-390.png") });
  assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
  const modelSource = readFileSync(join(appRoot, source, "model/manor-learning.ts"), "utf8");
  const compiled = ts.transpileModule(modelSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  const model = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
  assert.equal(model.expressionForTaskRun([{ id: "old", missionId: "m", taskRunId: "old", evidenceType: "expression", revision: 9 }], "m", "new"), undefined);
  console.log(JSON.stringify({ ok: true, checks, apiFixtureRequests: requests.length, screenshots: process.env.MANOR_V7_KEEP_QA === "1" ? temp : "temporary captures checked and removed" }, null, 2));
} catch (failure) {
  if (page) { await page.screenshot({ path: join(temp, "failure.png") }).catch(() => {}); console.error((await page.locator("body").innerText()).slice(-7000)); }
  console.error(`QA fixture directory: ${temp}`);
  throw failure;
} finally {
  await browser?.close();
  if (server) await new Promise((done) => server.close(done));
  const target = resolve(temp);
  if (!target.startsWith(resolve(tmpdir()) + sep) || !basename(target).startsWith("manor-v7-learning-ui-")) throw new Error("Unsafe cleanup path");
  // Keep optional QA captures only when explicitly requested by the caller.
  if (process.env.MANOR_V7_KEEP_QA !== "1") rmSync(target, { recursive: true, force: true });
}
