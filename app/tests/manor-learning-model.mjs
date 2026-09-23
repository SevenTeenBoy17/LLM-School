import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(new URL("../app/(shell)/student/manor/model/manor-experience.ts", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
assert.doesNotMatch(source, /\bfetch\s*\(/, "front-end adapter must not issue network requests");
assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB)\b/, "front-end adapter must reset on refresh");

const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  fileName: sourcePath,
});
const model = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`);
const { createMockManorExperienceAdapter, validateClaim, validateEvidenceLink, sceneStatusLabel } = model;

const adapter = createMockManorExperienceAdapter({ delayMs: 0 });
const bootstrap = await adapter.bootstrap();
assert.equal(bootstrap.status, "success");
assert.equal(bootstrap.authoritativeEntity.project.title, "校园节水行动");
assert.equal(bootstrap.snapshot.milestones.length, 7);
assert.equal(bootstrap.snapshot.sceneNodes.length, 7);
assert.equal(bootstrap.snapshot.evidence.length, 4);
assert.match(bootstrap.operationId, /^mock-bootstrap-\d{3}$/);
assert.deepEqual([...new Set(bootstrap.snapshot.sceneNodes.map((node) => sceneStatusLabel(node.status)))].sort(), ["可展示", "可开始", "待审核", "待补证", "已验证", "进行中", "需订正"].sort());

bootstrap.snapshot.project.title = "外部篡改";
const cloneProbe = await adapter.bootstrap();
assert.equal(cloneProbe.snapshot.project.title, "校园节水行动", "adapter snapshots must be isolated clones");

const invalidEvidence = await adapter.recordEvidence({ milestoneId: "observe", subject: "科学", title: "短", method: "看", finding: "不具体", source: "无" });
assert.equal(invalidEvidence.status, "validation_error");
assert.equal(invalidEvidence.stateVersion, 1);
assert.deepEqual(Object.keys(invalidEvidence.fieldErrors).sort(), ["finding", "method", "source", "title"]);

const recorded = await adapter.recordEvidence({
  milestoneId: "observe",
  subject: "科学",
  title: "午休时段滴漏复测",
  method: "同一位置连续计数三次",
  finding: "一分钟滴数依次为 42、45、43，平均为 43.3。",
  source: "节水小组现场测量表",
});
assert.equal(recorded.status, "success");
assert.equal(recorded.stateVersion, 2);
assert.equal(recorded.authoritativeEntity.id, "evidence-005");
assert.equal(recorded.snapshot.sceneNodes.find((node) => node.milestoneId === "observe").status, "active");

const weakInput = {
  evidenceId: recorded.authoritativeEntity.id,
  objectiveId: "obj-explain",
  milestoneId: "observe",
  relation: "supports",
  sharedProblem: recorded.snapshot.project.drivingQuestion,
  reason: "两个内容主题看起来相似",
};
assert.ok(validateEvidenceLink(weakInput, recorded.snapshot).reason, "weak thematic association must be rejected");
const linksBefore = recorded.snapshot.links.length;
const weakLink = await adapter.linkEvidence(weakInput);
assert.equal(weakLink.status, "validation_error");
assert.equal(weakLink.snapshot.links.length, linksBefore, "failed association must roll back cleanly");
assert.equal(weakLink.stateVersion, 2);

const linked = await adapter.linkEvidence({
  ...weakInput,
  objectiveId: "obj-data",
  relation: "method",
  reason: "重复测量提供共享数据，并说明单位换算前的观察方法与误差来源。",
});
assert.equal(linked.status, "success");
assert.equal(linked.stateVersion, 3);
assert.equal(linked.authoritativeEntity.relation, "method");

const duplicateLink = await adapter.linkEvidence({
  ...weakInput,
  objectiveId: "obj-data",
  relation: "method",
  reason: "重复测量提供共享数据，并说明单位换算前的观察方法与误差来源。",
});
assert.equal(duplicateLink.status, "validation_error");
assert.match(duplicateLink.fieldErrors.evidenceId, /已经存在/);
assert.equal(duplicateLink.snapshot.links.length, linked.snapshot.links.length);

const incompleteClaim = {
  milestoneId: "explain",
  conclusion: "节水",
  evidenceIds: [],
  reasoning: "因为有数据",
  limitation: "没有",
};
assert.deepEqual(Object.keys(validateClaim(incompleteClaim, linked.snapshot)).sort(), ["conclusion", "evidenceIds", "limitation", "reasoning"]);
const rejectedClaim = await adapter.submitClaim(incompleteClaim);
assert.equal(rejectedClaim.status, "validation_error");
assert.equal(rejectedClaim.snapshot.claims.length, 1);

const submitted = await adapter.submitClaim({
  milestoneId: "explain",
  conclusion: "应先维修持续滴漏的水龙头，并在一周后复测。",
  evidenceIds: ["evidence-data-1", "evidence-data-2"],
  reasoning: "重复测量证明滴漏持续存在，单位换算进一步说明浪费规模。",
  limitation: "滴水体积仍为估算值，且样本只覆盖一栋教学楼。",
});
assert.equal(submitted.status, "success");
assert.equal(submitted.authoritativeEntity.status, "revise");
assert.match(submitted.message, /尚未判定通过/);

const movedClaim = await adapter.reviseClaim({
  claimId: submitted.authoritativeEntity.id,
  milestoneId: "act",
  conclusion: "应先维修持续滴漏的水龙头，并在一周后复测。",
  evidenceIds: ["evidence-data-1", "evidence-data-2"],
  reasoning: "重复测量证明滴漏持续，单位换算后的估算说明浪费规模和维修优先级。",
  limitation: "样本只覆盖一栋楼，下一轮仍需量杯实测并扩大观察范围。",
});
assert.equal(movedClaim.status, "validation_error");
assert.match(movedClaim.fieldErrors.milestoneId, /不能/);

const revised = await adapter.reviseClaim({
  claimId: submitted.authoritativeEntity.id,
  milestoneId: "explain",
  conclusion: "应先维修持续滴漏的水龙头，并在一周后复测。",
  evidenceIds: ["evidence-data-1", "evidence-data-2", recorded.authoritativeEntity.id],
  reasoning: "三次重复测量证明滴漏持续，统一单位后的估算说明规模，两类方法共同支持维修优先级。",
  limitation: "样本只覆盖一栋楼，滴水体积使用估算值，下一轮需要量杯实测和维修前后对照。",
});
assert.equal(revised.status, "success");
assert.equal(revised.authoritativeEntity.status, "accepted");
assert.equal(revised.authoritativeEntity.revision, 2);
assert.equal(Object.hasOwn(revised.authoritativeEntity, "claimId"), false);
assert.equal(revised.authoritativeEntity.milestoneId, submitted.authoritativeEntity.milestoneId);
assert.equal(revised.snapshot.sceneNodes.find((node) => node.milestoneId === "explain").status, "verified");

const noReflection = await adapter.publishArtifact({
  claimId: revised.authoritativeEntity.id,
  title: "校园滴漏证据卡",
  summary: "用重复测量和单位换算说明维修优先级。",
  visibility: "class",
  reflection: "太短",
});
assert.equal(noReflection.status, "validation_error");
assert.ok(noReflection.fieldErrors.reflection);

const published = await adapter.publishArtifact({
  claimId: revised.authoritativeEntity.id,
  title: "校园滴漏节水证据卡",
  summary: "我们用重复测量和单位换算说明维修优先级，并如实标注样本局限。",
  visibility: "class",
  reflection: "重复测量让结论更可靠；下一轮要增加量杯实测和维修后的对照数据。",
});
assert.equal(published.status, "success");
assert.equal(published.snapshot.artifacts.length, 1);
assert.equal(published.snapshot.reflections.length, 1);
assert.equal(published.snapshot.sceneNodes.find((node) => node.milestoneId === "explain").status, "showcase");
assert.match(published.message, /成果与反思/);

const resetAdapter = createMockManorExperienceAdapter({ delayMs: 0 });
const resetSnapshot = await resetAdapter.bootstrap();
assert.equal(resetSnapshot.snapshot.artifacts.length, 0, "new adapter must reset in-memory artifacts");
assert.equal(resetSnapshot.snapshot.reflections.length, 0, "new adapter must reset in-memory reflections");

for (const [milestoneId, terminalStatus] of [["act", "verified"], ["reflect", "showcase"]]) {
  const terminalAdapter = createMockManorExperienceAdapter({ delayMs: 0 });
  const terminalBefore = await terminalAdapter.bootstrap();
  const terminalNodeBefore = terminalBefore.snapshot.sceneNodes.find((node) => node.milestoneId === milestoneId);
  const appended = await terminalAdapter.recordEvidence({
    milestoneId,
    subject: "科学",
    title: "终态节点补充验证记录",
    method: "沿用既定方案复测并记录差异",
    finding: "复测结果与原结论一致，同时补充了新的观察范围与时间点。",
    source: "节水小组补充验证表",
  });
  const terminalNodeAfter = appended.snapshot.sceneNodes.find((node) => node.milestoneId === milestoneId);
  assert.equal(appended.status, "success");
  assert.equal(terminalNodeAfter.status, terminalStatus, `${terminalStatus} node must not regress after new evidence`);
  assert.equal(terminalNodeAfter.nextAction, terminalNodeBefore.nextAction);
  assert.equal(terminalNodeAfter.evidenceCount, terminalNodeBefore.evidenceCount + 1);
}

const scenarioExpectations = { failure: "error", conflict: "conflict", offline: "offline", disabled: "disabled" };
for (const [scenario, status] of Object.entries(scenarioExpectations)) {
  const scenarioResult = await createMockManorExperienceAdapter({ scenario, delayMs: 0 }).bootstrap();
  assert.equal(scenarioResult.status, status, `${scenario} status mismatch`);
  assert.equal(scenarioResult.authoritativeEntity, null);
  assert.equal(scenarioResult.snapshot.project.title, "校园节水行动");
}

const empty = await createMockManorExperienceAdapter({ scenario: "empty", delayMs: 0 }).bootstrap();
assert.equal(empty.status, "success");
assert.equal(empty.snapshot.evidence.length, 0);
assert.equal(empty.snapshot.links.length, 0);
assert.equal(empty.snapshot.claims.length, 0);
assert.equal(empty.snapshot.sceneNodes.every((node, index) => node.status === (index === 0 ? "active" : "available")), true);

await assert.rejects(
  createMockManorExperienceAdapter({ scenario: "rejected_bootstrap", delayMs: 0 }).bootstrap(),
  /bootstrap promise rejected/,
);
const rejectedOperationAdapter = createMockManorExperienceAdapter({ scenario: "rejected_operation", delayMs: 0 });
assert.equal((await rejectedOperationAdapter.bootstrap()).status, "success");
await assert.rejects(
  rejectedOperationAdapter.recordEvidence({
    milestoneId: "observe",
    subject: "科学",
    title: "操作异常验证记录",
    method: "使用固定输入触发适配器拒绝",
    finding: "适配器拒绝 Promise 时不应产生任何权威状态变更。",
    source: "前端异常状态测试",
  }),
  /operation promise rejected/,
);

console.log(JSON.stringify({
  ok: true,
  contract: ["bootstrap", "recordEvidence", "linkEvidence", "submitClaim", "reviseClaim", "publishArtifact"],
  chain: ["objective", "project", "milestone", "evidence", "link", "claim", "review", "scene", "artifact", "reflection"],
  rejected: ["weak-association", "duplicate-link", "incomplete-claim", "claim-milestone-change", "missing-reflection"],
  scenarios: ["normal", "empty", "failure", "conflict", "offline", "disabled", "rejected-bootstrap", "rejected-operation"],
  persistence: "deterministic-memory-reset"
}, null, 2));
