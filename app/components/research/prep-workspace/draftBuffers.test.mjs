import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { SAMPLE_PROJECTS } from "./model.ts";

function moduleUrl(name, imports) {
  let source = readFileSync(new URL(name, import.meta.url), "utf8");
  for (const [from, to] of Object.entries(imports)) source = source.replaceAll(`from "${from}"`, `from "${to}"`);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}
const model = new URL("./model.ts", import.meta.url).href;
const recovery = moduleUrl("./recovery.ts", { "./model": model });
const buffers = await import(moduleUrl("./draftBuffers.ts", { "./model": model, "./recovery": recovery }));
const { readPrepBuffer, writePrepBuffer, clearPrepBuffer, readCreationBuffer, writeCreationBuffer, clearCreationBuffer, EMPTY_CREATION } = buffers;
const saved = structuredClone(SAMPLE_PROJECTS[0]);
const savedBefore = JSON.stringify(saved);
const draft = structuredClone(saved);
draft.goal = "unsaved goal";
draft.evidence[0].observation = "unsaved classroom observation";
draft.discussions[0].replies.push("submitted but not saved reply");
const discussionId = draft.discussions[0].id;
const unsubmitted = { comment: "pending comment", replies: { [discussionId]: "pending reply" }, reasons: { [discussionId]: "pending reason" } };
const snapshot = { saved, draft, unsubmitted };
writePrepBuffer("teacher-a:1", snapshot);
const restored = readPrepBuffer("teacher-a:1", structuredClone(saved));
assert.deepEqual(restored, snapshot);
assert.equal(readPrepBuffer("teacher-b:1", saved), undefined);
assert.equal(readPrepBuffer("teacher-a:2", saved), undefined);
assert.equal(readPrepBuffer(null, saved), undefined);
assert.equal(readPrepBuffer("teacher-a:1", SAMPLE_PROJECTS[1]), undefined);
const newer = { ...saved, version: saved.version + 1 };
assert.equal(readPrepBuffer("teacher-a:1", newer), undefined);
assert.equal(readPrepBuffer("teacher-a:1", { ...saved, goal: "changed saved baseline" }), undefined);
assert.equal(readPrepBuffer("teacher-a:1", { ...saved, revisions: [{ version: 1, at: Date.now(), note: "new baseline", goal: "", question: "" }] }), undefined);
writePrepBuffer("teacher-a:1", { saved: newer, draft: newer, unsubmitted: { comment: "", replies: {}, reasons: {} } });
assert.deepEqual(readPrepBuffer("teacher-a:1", saved), snapshot);
restored.draft.evidence[0].observation = "changed outside buffer";
restored.unsubmitted.reasons[discussionId] = "changed outside buffer";
assert.deepEqual(readPrepBuffer("teacher-a:1", saved), snapshot);
assert.equal(JSON.stringify(saved), savedBefore);
clearPrepBuffer("teacher-a:1", saved.id);
assert.equal(readPrepBuffer("teacher-a:1", saved), undefined);
writePrepBuffer(null, snapshot);
assert.equal(readPrepBuffer("teacher-a:1", saved), undefined);
writePrepBuffer("teacher-a:1", { ...snapshot, draft: { ...draft, id: "another project" } });
assert.equal(readPrepBuffer("teacher-a:1", saved), undefined);

const creation = { ...EMPTY_CREATION, title: "unfinished form", kind: "研究课", conditions: "pending conditions" };
writeCreationBuffer("teacher-a:1", creation);
assert.deepEqual(readCreationBuffer("teacher-a:1"), creation);
assert.equal(readCreationBuffer("teacher-b:1"), undefined);
assert.equal(readCreationBuffer("teacher-a:2"), undefined);
const creationCopy = readCreationBuffer("teacher-a:1"); creationCopy.title = "mutated";
assert.equal(readCreationBuffer("teacher-a:1").title, creation.title);
clearCreationBuffer("teacher-a:1");
assert.equal(readCreationBuffer("teacher-a:1"), undefined);
writeCreationBuffer("teacher-a:1", creation);
writeCreationBuffer("teacher-a:1", EMPTY_CREATION);
assert.equal(readCreationBuffer("teacher-a:1"), undefined);

// Execute the current hook with a minimal committed-effect lifecycle, without a browser or writes.
const source = readFileSync(new URL("./useDepartureBuffer.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("useDepartureBuffer.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node));
const hookSource = ts.transpileModule(declaration.getText(ast).replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const refs = []; let refIndex = 0; let effects = [];
const useRef = initial => refs[refIndex++] ?? (refs[refIndex - 1] = { current: initial });
const useLayoutEffect = effect => effects.push(effect);
const runDepartureHook = new Function("useRef", "useLayoutEffect", `${hookSource}; return useDepartureBuffer;`)(useRef, useLayoutEffect);
function render(value) {
  refIndex = 0; effects = [];
  const clear = runDepartureHook(value, data => writePrepBuffer("teacher-a:1", data), () => clearPrepBuffer("teacher-a:1", saved.id));
  effects[0]();
  return { clear, unmount: effects[1]() };
}
const first = render(snapshot);
const latest = { ...snapshot, unsubmitted: { ...unsubmitted, comment: "last committed keystroke" } };
const second = render(latest);
first.unmount();
assert.deepEqual(readPrepBuffer("teacher-a:1", saved), latest);
second.clear();
first.unmount();
assert.equal(readPrepBuffer("teacher-a:1", saved), undefined, "successful save/discard must not be re-stashed by stale unmount cleanup");
render(snapshot).unmount();
assert.deepEqual(readPrepBuffer("teacher-a:1", saved), snapshot);
clearPrepBuffer("teacher-a:1", saved.id);
console.log("PASS: owner/session/project/baseline isolation, SPA buffer roundtrip, all pending fields, form recovery, deep-copy isolation, save/discard cleanup ordering");
