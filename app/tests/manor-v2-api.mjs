import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const tempDbDir = mkdtempSync(join(tmpdir(), "eduai-manor-v2-"));

function removeTempDirectory(target) {
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 30, retryDelay: 250 });
  } catch (error) {
    if (process.platform !== "win32" || error?.code !== "EPERM") throw error;
    const cleanupScript = `const { rmSync } = require("node:fs"); setTimeout(() => { try { rmSync(process.argv[1], { recursive: true, force: true, maxRetries: 30, retryDelay: 250 }); } catch {} }, 1000);`;
    const cleanup = spawn(process.execPath, ["-e", cleanupScript, target], { detached: true, stdio: "ignore", windowsHide: true });
    cleanup.unref();
  }
}

async function login(base, username, password) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, `${username} login failed: ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, `${username} login did not return a session cookie`);
  return cookie;
}

let serverHandle;
try {
  serverHandle = await startIsolatedManorDevServer({ label: "manor-v2", tempDbDir });
  const { base } = serverHandle;
  const studentCookie = await login(base, "student", "Student@123");
  const bootstrapResponse = await fetch(`${base}/api/v2/manor/bootstrap`, {
    headers: { cookie: studentCookie },
  });
  assert.equal(bootstrapResponse.status, 200, `bootstrap failed: ${bootstrapResponse.status}`);
  const bootstrap = await bootstrapResponse.json();
  assert.equal(bootstrap.schemaVersion, "manor.v2");
  assert.equal(Number.isInteger(bootstrap.stateVersion), true);
  assert.equal(bootstrap.plots.length, 24);
  assert.deepEqual(bootstrap.plots.slice(0, 6).map((plot) => plot.id), [0, 1, 2, 3, 4, 5]);
  assert.equal(bootstrap.plots.slice(6, 10).every((plot) => plot.unlocked), true);
  assert.equal(bootstrap.plots.slice(10).every((plot) => !plot.unlocked), true);
  assert.equal(bootstrap.daily.completed, false);
  assert.equal(bootstrap.subject.name, "刘子涵");

  const guardPayload = JSON.stringify({
    operationId: "evidence-guard-check-0001",
    missionId: "science-leaf-01",
    answer: "A",
    hintsUsed: [],
    accommodationCodes: [],
  });
  const unsupportedMediaResponse = await fetch(`${base}/api/v2/manor/evidence`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "text/plain" },
    body: guardPayload,
  });
  assert.equal(unsupportedMediaResponse.status, 415, "mutation accepted a non-JSON content type");
  assert.equal((await unsupportedMediaResponse.json()).error.code, "UNSUPPORTED_MEDIA_TYPE");
  const crossOriginResponse = await fetch(`${base}/api/v2/manor/evidence`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json", origin: "https://attacker.invalid" },
    body: guardPayload,
  });
  assert.equal(crossOriginResponse.status, 403, "cross-origin mutation was not rejected");
  assert.equal((await crossOriginResponse.json()).error.code, "CROSS_ORIGIN_REQUEST");

  const legacyBefore = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  const legacyWriteResponse = await fetch(`${base}/api/manor`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ action: "plant", plot: 0, cropId: "wheat", operationId: "legacy-write-check-0001" }),
  });
  assert.equal(legacyWriteResponse.status, 410, "legacy manor mutation endpoint is still writable");
  assert.equal((await legacyWriteResponse.json()).error, "legacy_manor_retired");
  const legacyAfter = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.equal(legacyAfter.stateVersion, legacyBefore.stateVersion, "retired legacy endpoint changed v2 state");

  const concurrentCookie = await login(base, "student-p", "Student@123");
  const concurrentPayload = {
    operationId: "evidence-concurrent-0001",
    missionId: "science-leaf-01",
    answer: "A",
    hintsUsed: [],
    accommodationCodes: [],
  };
  const concurrentResponses = await Promise.all(Array.from({ length: 20 }, () => fetch(`${base}/api/v2/manor/evidence`, {
    method: "POST",
    headers: { cookie: concurrentCookie, "content-type": "application/json" },
    body: JSON.stringify(concurrentPayload),
  })));
  assert.equal(concurrentResponses.every((response) => response.status === 200), true);
  const concurrentBodies = await Promise.all(concurrentResponses.map((response) => response.json()));
  assert.equal(new Set(concurrentBodies.map((body) => body.evidence.id)).size, 1, "concurrent replay created duplicate evidence");
  assert.equal(new Set(concurrentBodies.map((body) => body.grant.id)).size, 1, "concurrent replay created duplicate grants");
  const concurrentBootstrap = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: concurrentCookie } })).json();
  assert.equal(concurrentBootstrap.grants.length, 1);

  const evidenceUrl = `${base}/api/v2/manor/evidence`;
  const wrongPayload = {
    operationId: "evidence-reading-attempt-0001",
    missionId: "reading-clue-01",
    answer: "A",
    hintsUsed: [],
    accommodationCodes: [],
  };
  const wrongResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(wrongPayload),
  });
  assert.equal(wrongResponse.status, 200);
  const wrong = await wrongResponse.json();
  assert.equal(wrong.evidence.status, "revise");
  assert.equal(wrong.evidence.attemptCount, 1);
  assert.equal(wrong.feedback.correct, false);
  assert.equal(wrong.grant, null);

  const replayResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(wrongPayload),
  });
  assert.equal(replayResponse.status, 200);
  const replay = await replayResponse.json();
  assert.equal(replay.evidence.id, wrong.evidence.id);
  assert.equal(replay.evidence.attemptCount, 1, "idempotent replay must not append another attempt");
  assert.equal(replay.stateVersion, wrong.stateVersion, "idempotent replay must not advance state version");

  const conflictResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ ...wrongPayload, answer: "B" }),
  });
  assert.equal(conflictResponse.status, 409);
  assert.equal((await conflictResponse.json()).error.code, "OPERATION_CONFLICT");

  const correctedResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ ...wrongPayload, operationId: "evidence-reading-attempt-0002", answer: "B" }),
  });
  assert.equal(correctedResponse.status, 200);
  const corrected = await correctedResponse.json();
  assert.equal(corrected.evidence.id, wrong.evidence.id);
  assert.equal(corrected.evidence.status, "accepted_correction");
  assert.equal(corrected.evidence.rewardClass, "correction_support");
  assert.equal(corrected.evidence.attemptCount, 2);
  assert.equal(corrected.grant.evidenceId, corrected.evidence.id);
  assert.equal(corrected.grant.remainingUnits, 8);

  const afterEvidenceResponse = await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } });
  const afterEvidence = await afterEvidenceResponse.json();
  assert.equal(afterEvidence.grants.length, 1);
  assert.equal(afterEvidence.resources.growthEnergy, 8);
  assert.deepEqual(afterEvidence.grants[0].allowedPurposes, ["support_plot", "review"]);

  const plotActionUrl = `${base}/api/v2/manor/plots/3/actions`;
  const plantPayload = {
    action: "plant",
    operationId: "plot-plant-wheat-0001",
    expectedRevision: 1,
    cropId: "wheat",
    grantAllocations: [],
  };
  const plantResponse = await fetch(plotActionUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(plantPayload),
  });
  assert.equal(plantResponse.status, 200);
  const planted = await plantResponse.json();
  assert.equal(planted.plot.cropId, "wheat");
  assert.equal(planted.plot.revision, 2);

  const nurturePayload = {
    action: "nurture",
    operationId: "plot-nurture-support-0001",
    expectedRevision: 2,
    grantAllocations: [{ grantId: corrected.grant.id, amount: 8 }],
  };
  const nurtureResponse = await fetch(plotActionUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(nurturePayload),
  });
  assert.equal(nurtureResponse.status, 200);
  const nurtured = await nurtureResponse.json();
  assert.equal(nurtured.plot.stage, 1);
  assert.equal(nurtured.plot.status, "needs_support");
  assert.equal(nurtured.plot.revision, 3);
  assert.equal(nurtured.consumptions[0].amount, 8);
  assert.equal(nurtured.resources.growthEnergy, 0);

  const nurtureReplayResponse = await fetch(plotActionUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(nurturePayload),
  });
  assert.equal(nurtureReplayResponse.status, 200);
  assert.deepEqual(await nurtureReplayResponse.json(), nurtured);

  const staleResponse = await fetch(plotActionUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ ...nurturePayload, operationId: "plot-nurture-stale-0002" }),
  });
  assert.equal(staleResponse.status, 409);
  const stale = await staleResponse.json();
  assert.equal(stale.error.code, "MANOR_REVISION_CONFLICT");
  assert.equal(stale.authoritative.plot.revision, 3);

  const reviewResponse = await fetch(`${base}/api/v2/manor/reviews`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "review-reading-0001",
      evidenceId: corrected.evidence.id,
      strategy: "圈出动作幅度关键词",
      window: "tomorrow",
    }),
  });
  assert.equal(reviewResponse.status, 200);
  const scheduled = await reviewResponse.json();
  assert.equal(scheduled.review.status, "scheduled");
  assert.equal(scheduled.review.strategy, "圈出动作幅度关键词");

  const masteryResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "evidence-science-mastery-0001",
      missionId: "science-leaf-01",
      answer: "A",
      hintsUsed: [],
      accommodationCodes: [],
    }),
  });
  assert.equal(masteryResponse.status, 200);
  const mastery = await masteryResponse.json();
  assert.equal(mastery.evidence.status, "accepted_mastery");
  assert.equal(mastery.grant.remainingUnits, 12);
  assert.deepEqual(mastery.grant.allowedPurposes, ["plot", "artifact", "class_build"]);

  const beforeDuplicate = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  const duplicateGrantResponse = await fetch(`${base}/api/v2/manor/class-build/contributions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "class-build-duplicate-grant-0001",
      amount: 4,
      grantAllocations: [
        { grantId: mastery.grant.id, amount: 2 },
        { grantId: mastery.grant.id, amount: 2 },
      ],
    }),
  });
  assert.equal(duplicateGrantResponse.status, 409, "duplicate grant allocation was accepted");
  assert.equal((await duplicateGrantResponse.json()).error.code, "GRANT_INVALID");
  const afterDuplicate = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.equal(afterDuplicate.resources.growthEnergy, 12, "rejected duplicate allocation consumed grant units");
  assert.deepEqual(afterDuplicate.grants, beforeDuplicate.grants, "rejected duplicate allocation changed grants");
  assert.deepEqual(afterDuplicate.classBuild, beforeDuplicate.classBuild, "rejected duplicate allocation changed the class build");
  assert.equal(afterDuplicate.stateVersion, beforeDuplicate.stateVersion, "rejected duplicate allocation advanced state version");

  const artifactResponse = await fetch(`${base}/api/v2/manor/artifacts`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "artifact-observe-0001",
      evidenceId: mastery.evidence.id,
      artifactType: "observation",
      title: "叶片蒸腾观察",
      content: "透明袋里的水珠来自叶片释放的水汽凝结。",
      visibility: "private",
      grantAllocations: [],
    }),
  });
  assert.equal(artifactResponse.status, 200);
  const artifact = await artifactResponse.json();
  assert.equal(artifact.artifact.title, "叶片蒸腾观察");
  assert.equal(artifact.artifact.evidenceId, mastery.evidence.id, "free artifact save changed its source evidence");
  assert.deepEqual(artifact.consumptions, [], "free artifact save recorded a consumption");
  assert.equal(artifact.resources.growthEnergy, 12);
  const afterArtifact = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.equal(afterArtifact.resources.growthEnergy, afterDuplicate.resources.growthEnergy, "free artifact save changed the resource balance");
  assert.deepEqual(afterArtifact.grants, afterDuplicate.grants, "free artifact save changed grants");
  assert.deepEqual(afterArtifact.artifacts, [artifact.artifact], "free artifact save did not persist the correct source evidence");

  const foreignEvidenceArtifactResponse = await fetch(`${base}/api/v2/manor/artifacts`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "artifact-foreign-evidence-0001",
      evidenceId: concurrentBodies[0].evidence.id,
      artifactType: "observation",
      title: "证据归属探测",
      content: "免费保存作品也必须拒绝引用其他学生的学习证据。",
      visibility: "private",
      grantAllocations: [],
    }),
  });
  assert.equal(foreignEvidenceArtifactResponse.status, 404);
  assert.equal((await foreignEvidenceArtifactResponse.json()).error.code, "EVIDENCE_NOT_FOUND");
  const afterForeignEvidence = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.deepEqual(afterForeignEvidence.artifacts, afterArtifact.artifacts, "foreign evidence was saved as an artifact");
  assert.deepEqual(afterForeignEvidence.grants, afterArtifact.grants, "rejected foreign evidence changed grants");
  assert.equal(afterForeignEvidence.resources.growthEnergy, afterArtifact.resources.growthEnergy, "rejected foreign evidence changed the resource balance");
  assert.equal(afterForeignEvidence.stateVersion, afterArtifact.stateVersion, "rejected foreign evidence advanced state version");

  const contributionResponse = await fetch(`${base}/api/v2/manor/class-build/contributions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "class-build-0001",
      amount: 2,
      grantAllocations: [{ grantId: mastery.grant.id, amount: 2 }],
    }),
  });
  assert.equal(contributionResponse.status, 200);
  const contribution = await contributionResponse.json();
  assert.equal(contribution.accepted, 2);
  assert.equal(contribution.resources.growthEnergy, 10);

  const nearCapDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  nearCapDb.exec("PRAGMA busy_timeout = 5000");
  nearCapDb.prepare("INSERT INTO class_build_contrib (id,classId,userId,amount,createdAt) VALUES (?,?,?,?,?)")
    .run("fixture-near-cap", "c1", "fixture", 797, Date.now());
  nearCapDb.close();
  const cappedContributionResponse = await fetch(`${base}/api/v2/manor/class-build/contributions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "class-build-cap-0001",
      amount: 2,
      grantAllocations: [{ grantId: mastery.grant.id, amount: 2 }],
    }),
  });
  assert.equal(cappedContributionResponse.status, 200);
  const cappedContribution = await cappedContributionResponse.json();
  assert.equal(cappedContribution.accepted, 1, "class build consumed more than the remaining project gap");
  assert.equal(cappedContribution.resources.growthEnergy, 9);

  const expressionResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "evidence-expression-0001",
      missionId: "math-pattern-01",
      evidenceType: "expression",
      content: "我把 12 分钟画成四段，每一段都是 3 分钟，所以可以浇四块田。",
      hintsUsed: [],
      accommodationCodes: [],
    }),
  });
  assert.equal(expressionResponse.status, 200);
  const expression = await expressionResponse.json();
  assert.equal(expression.evidence.status, "pending_review");
  assert.equal(expression.grant, null);

  const teacherCookie = await login(base, "teacher", "Teacher@123");
  const studentTeacherQueueResponse = await fetch(`${base}/api/v2/teacher/manor/evidence?status=pending_review`, { headers: { cookie: studentCookie } });
  assert.equal(studentTeacherQueueResponse.status, 403);
  const queueResponse = await fetch(`${base}/api/v2/teacher/manor/evidence?status=pending_review`, { headers: { cookie: teacherCookie } });
  assert.equal(queueResponse.status, 200);
  const queue = await queueResponse.json();
  assert.equal(queue.items.some((item) => item.id === expression.evidence.id), true);

  const missingMissionDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  missingMissionDb.exec("PRAGMA busy_timeout = 5000");
  missingMissionDb.prepare("UPDATE learning_evidence SET missionId = ? WHERE id = ?").run("missing-mission", expression.evidence.id);
  missingMissionDb.close();
  const missingMissionDecisionResponse = await fetch(`${base}/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "teacher-decision-missing-mission-0001",
      expectedRevision: expression.evidence.revision,
      status: "accepted_mastery",
      reason: "验证失效任务不会产生审核写入。",
    }),
  });
  assert.equal(missingMissionDecisionResponse.status, 404);
  assert.equal((await missingMissionDecisionResponse.json()).error.code, "MISSION_NOT_FOUND");
  const missingMissionAssertDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  missingMissionAssertDb.exec("PRAGMA busy_timeout = 5000");
  const missingMissionEvidence = missingMissionAssertDb.prepare("SELECT status, revision FROM learning_evidence WHERE id = ?").get(expression.evidence.id);
  assert.equal(missingMissionEvidence?.status, "pending_review");
  assert.equal(missingMissionEvidence?.revision, expression.evidence.revision);
  assert.equal(Number(missingMissionAssertDb.prepare("SELECT COUNT(*) AS count FROM evidence_decisions WHERE evidenceId = ?").get(expression.evidence.id).count), 0);
  assert.equal(Number(missingMissionAssertDb.prepare("SELECT COUNT(*) AS count FROM growth_grants WHERE evidenceId = ?").get(expression.evidence.id).count), 0);
  missingMissionAssertDb.prepare("UPDATE learning_evidence SET missionId = ? WHERE id = ?").run("math-pattern-01", expression.evidence.id);
  missingMissionAssertDb.close();

  const decisionResponse = await fetch(`${base}/api/v2/teacher/manor/evidence/${expression.evidence.id}/decisions`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "teacher-decision-0001",
      expectedRevision: expression.evidence.revision,
      status: "accepted_mastery",
      reason: "分段方法与结论一致，表达清楚。",
    }),
  });
  assert.equal(decisionResponse.status, 200);
  const decision = await decisionResponse.json();
  assert.equal(decision.evidence.status, "accepted_mastery");
  assert.equal(decision.evidence.revision, expression.evidence.revision + 1);
  assert.ok(decision.grant);

  const adminCookie = await login(base, "admin", "Admin@123");
  const adminMediaGuard = await fetch(`${base}/api/admin/models/chatgpt`, {
    method: "PUT",
    headers: { cookie: adminCookie, "content-type": "text/plain" },
    body: JSON.stringify({ openToStudents: true }),
  });
  assert.equal(adminMediaGuard.status, 415);
  const adminOriginGuard = await fetch(`${base}/api/admin/models/chatgpt`, {
    method: "PUT",
    headers: { cookie: adminCookie, "content-type": "application/json", origin: "https://school-tools.attacker.invalid" },
    body: JSON.stringify({ openToStudents: true }),
  });
  assert.equal(adminOriginGuard.status, 403);

  const demoSwitchResponse = await fetch(`${base}/api/auth/switch-role`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ role: "admin" }),
  });
  assert.equal(demoSwitchResponse.status, 200);
  const demoAdminCookie = demoSwitchResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(demoAdminCookie);

  const demoStudentSwitchResponse = await fetch(`${base}/api/auth/switch-role`, {
    method: "POST",
    headers: { cookie: adminCookie, "content-type": "application/json" },
    body: JSON.stringify({ role: "student" }),
  });
  assert.equal(demoStudentSwitchResponse.status, 200);
  const demoStudentCookie = demoStudentSwitchResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(demoStudentCookie);
  const demoStudent = (await demoStudentSwitchResponse.json()).user;
  assert.ok(demoStudent?.id);

  // Force a state where each formerly impure GET would definitely write. A simple row-count
  // snapshot can miss idempotent writes once seeded data already exists.
  const demoQuizId = "quiz-demo-readonly-probe";
  const demoQuizEventKey = `quiz:${demoQuizId}`;
  const demoPrepDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  demoPrepDb.exec("PRAGMA busy_timeout = 5000");
  demoPrepDb.prepare("DELETE FROM notifications WHERE userId = ?").run(demoStudent.id);
  demoPrepDb.prepare("DELETE FROM user_badges WHERE userId = ? AND badgeId = 'quiz-1'").run(demoStudent.id);
  demoPrepDb.prepare("DELETE FROM points_ledger WHERE userId = ? AND eventKey = ?").run(demoStudent.id, demoQuizEventKey);
  demoPrepDb.prepare(`INSERT OR REPLACE INTO quiz_attempts
    (id,userId,subject,knowledgePoint,question,options,answerIdx,studentIdx,correct,ruleVersion,createdAt,answeredAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(demoQuizId, demoStudent.id, "数学", "只读探针", "1+1=?", JSON.stringify(["1", "2"]), 1, 1, 1, "test-v1", Date.now(), Date.now());
  demoPrepDb.close();

  const demoProbeDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"), { readOnly: true });
  const publicPrompt = demoProbeDb.prepare("SELECT id,uses FROM prompts WHERE status='pub' ORDER BY id LIMIT 1").get();
  const publicAgent = demoProbeDb.prepare("SELECT id,calls FROM agents WHERE status='pub' ORDER BY id LIMIT 1").get();
  assert.ok(publicPrompt?.id);
  assert.ok(publicAgent?.id);
  const auditCountBeforeDemoReads = Number(demoProbeDb.prepare("SELECT COUNT(*) AS count FROM audit").get().count);
  for (const path of [
    "/api/dashboard",
    "/api/explore",
    "/api/learning",
    "/api/class",
    `/api/prompts/${publicPrompt.id}?use=1`,
    `/api/agents/${publicAgent.id}?use=1`,
  ]) {
    const response = await fetch(`${base}${path}`, { headers: { cookie: demoAdminCookie } });
    assert.equal([200, 403].includes(response.status), true, `unexpected demo GET response for ${path}: ${response.status}`);
  }
  assert.equal(Number(demoProbeDb.prepare("SELECT COUNT(*) AS count FROM audit").get().count), auditCountBeforeDemoReads, "demo GET wrote an audit record");
  assert.equal(demoProbeDb.prepare("SELECT uses FROM prompts WHERE id=?").get(publicPrompt.id).uses, publicPrompt.uses, "demo GET incremented prompt usage");
  assert.equal(demoProbeDb.prepare("SELECT calls FROM agents WHERE id=?").get(publicAgent.id).calls, publicAgent.calls, "demo GET incremented agent calls");

  const demoBadgeResponse = await fetch(`${base}/api/badges`, { headers: { cookie: demoStudentCookie } });
  assert.equal(demoBadgeResponse.status, 200);
  const demoBadgeWall = await demoBadgeResponse.json();
  assert.equal(demoBadgeWall.badges.find((badge) => badge.id === "quiz-1")?.earned, true, "demo badge projection hid a completed achievement");
  for (const path of ["/api/points", "/api/notifications"]) {
    const response = await fetch(`${base}${path}`, { headers: { cookie: demoStudentCookie } });
    assert.equal(response.status, 200, `unexpected demo student GET response for ${path}: ${response.status}`);
  }
  assert.equal(Number(demoProbeDb.prepare("SELECT COUNT(*) AS count FROM notifications WHERE userId = ?").get(demoStudent.id).count), 0, "demo notifications GET seeded a row");
  assert.equal(Number(demoProbeDb.prepare("SELECT COUNT(*) AS count FROM user_badges WHERE userId = ? AND badgeId = 'quiz-1'").get(demoStudent.id).count), 0, "demo badges GET materialized an award");
  assert.equal(Number(demoProbeDb.prepare("SELECT COUNT(*) AS count FROM points_ledger WHERE userId = ? AND eventKey = ?").get(demoStudent.id, demoQuizEventKey).count), 0, "demo GET materialized points");
  demoProbeDb.close();
  for (const request of [
    { url: "/api/admin/models/chatgpt", method: "PUT", body: { openToStudents: true } },
    { url: "/api/prompts", method: "POST", body: { title: "演示写入探测" } },
    { url: "/api/knowledge", method: "POST", body: { name: "demo.txt" } },
    { url: `/api/prompts/${publicPrompt.id}`, method: "POST", body: { action: "use" } },
    { url: `/api/agents/${publicAgent.id}`, method: "POST", body: { action: "use" } },
  ]) {
    const response = await fetch(`${base}${request.url}`, {
      method: request.method,
      headers: { cookie: demoAdminCookie, "content-type": "application/json" },
      body: JSON.stringify(request.body),
    });
    assert.equal(response.status, 403, `demo session mutated ${request.url}`);
    assert.equal((await response.json()).error.code, "DEMO_READONLY");
  }
  for (const path of [`/api/prompts/${publicPrompt.id}`, `/api/agents/${publicAgent.id}`]) {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { cookie: studentCookie, "content-type": "application/json" },
      body: JSON.stringify({ action: "use" }),
    });
    assert.equal(response.status, 200, `explicit use operation failed for ${path}`);
  }
  const auditResponse = await fetch(`${base}/api/v2/admin/manor/audit/${decision.correlationId}`, { headers: { cookie: adminCookie } });
  assert.equal(auditResponse.status, 200);
  const audit = await auditResponse.json();
  assert.equal(audit.events.some((event) => event.eventType === "evidence.teacher_decided"), true);
  assert.equal(audit.subject.id, "u-student");
  assert.equal(audit.integrity.complete, true, JSON.stringify(audit.integrity));
  assert.equal(audit.decisions.length, 1);
  assert.equal(audit.operations.length, 1);
  assert.equal(audit.events.some((event) => event.eventType === "growth_grant.issued" && event.entityId === decision.grant.id), true);
  assert.equal(audit.grants.some((grant) => grant.id === decision.grant.id && grant.evidenceId === expression.evidence.id), true);
  assert.equal(audit.integrity.checks.find((check) => check.id === "teacher_grants_resolved")?.passed, true);

  const beforeAtomicBootstrapResponse = await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } });
  assert.equal(beforeAtomicBootstrapResponse.status, 200);
  const beforeAtomicBootstrap = await beforeAtomicBootstrapResponse.json();

  const failedAtomicResponse = await fetch(`${base}/api/v2/manor/plots/4/actions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "plot-plant-nurture-fail-0001",
      action: "plant_and_nurture",
      expectedRevision: 1,
      cropId: "wheat",
      grantAllocations: [{ grantId: decision.grant.id, amount: 7 }],
    }),
  });
  assert.equal(failedAtomicResponse.status, 422);
  assert.equal((await failedAtomicResponse.json()).error.code, "GRANT_INSUFFICIENT");
  const afterFailedAtomic = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.deepEqual(afterFailedAtomic.plots.find((plot) => plot.id === 4), beforeAtomicBootstrap.plots.find((plot) => plot.id === 4), "failed atomic action changed the plot");
  assert.equal(afterFailedAtomic.grants.find((grant) => grant.id === decision.grant.id)?.remainingUnits, beforeAtomicBootstrap.grants.find((grant) => grant.id === decision.grant.id)?.remainingUnits, "failed atomic action consumed a grant");
  assert.equal(afterFailedAtomic.resources.growthEnergy, beforeAtomicBootstrap.resources.growthEnergy, "failed atomic action changed the resource balance");

  // Force a failure after consumeGrants has updated the grant and inserted a consumption.
  // This proves the transaction rolls back writes already made, not just precondition failures.
  const studentUserId = "u-student";
  const rollbackOperationId = "plot-plant-nurture-rollback-0001";
  const rollbackProbeDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  rollbackProbeDb.exec("PRAGMA busy_timeout = 5000");
  rollbackProbeDb.exec("DROP TRIGGER IF EXISTS test_force_plot_rollback");
  const plotEventsBeforeRollback = Number(rollbackProbeDb.prepare("SELECT COUNT(*) AS count FROM manor_domain_events WHERE studentId = ? AND eventType = 'plot.plant_and_nurture' AND entityId = '4'").get(studentUserId).count);
  rollbackProbeDb.exec(`CREATE TRIGGER test_force_plot_rollback
    BEFORE UPDATE OF cropId,stage,state,evidenceId,revision ON manor_plots
    WHEN NEW.userId = '${studentUserId}' AND NEW.plot = 4
    BEGIN SELECT RAISE(ABORT, 'forced rollback probe'); END;`);
  rollbackProbeDb.close();
  let injectedRollbackResponse;
  try {
    injectedRollbackResponse = await fetch(`${base}/api/v2/manor/plots/4/actions`, {
      method: "POST",
      headers: { cookie: studentCookie, "content-type": "application/json" },
      body: JSON.stringify({
        operationId: rollbackOperationId,
        action: "plant_and_nurture",
        expectedRevision: 1,
        cropId: "wheat",
        grantAllocations: [{ grantId: decision.grant.id, amount: 8 }],
      }),
    });
  } finally {
    const cleanupProbeDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
    cleanupProbeDb.exec("PRAGMA busy_timeout = 5000");
    cleanupProbeDb.exec("DROP TRIGGER IF EXISTS test_force_plot_rollback");
    cleanupProbeDb.close();
  }
  assert.equal(injectedRollbackResponse.status, 500, "fault injection did not reach the post-consumption failure path");
  const afterInjectedRollback = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.deepEqual(afterInjectedRollback.plots.find((plot) => plot.id === 4), beforeAtomicBootstrap.plots.find((plot) => plot.id === 4), "post-consumption failure changed the plot");
  assert.equal(afterInjectedRollback.grants.find((grant) => grant.id === decision.grant.id)?.remainingUnits, beforeAtomicBootstrap.grants.find((grant) => grant.id === decision.grant.id)?.remainingUnits, "post-consumption failure did not restore the grant");
  assert.equal(afterInjectedRollback.resources.growthEnergy, beforeAtomicBootstrap.resources.growthEnergy, "post-consumption failure changed the resource balance");
  const rollbackAssertDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"), { readOnly: true });
  assert.equal(Number(rollbackAssertDb.prepare("SELECT COUNT(*) AS count FROM grant_consumptions WHERE studentId = ? AND operationId = ?").get(studentUserId, rollbackOperationId).count), 0, "rolled-back grant consumption remained in the ledger");
  assert.equal(Number(rollbackAssertDb.prepare("SELECT COUNT(*) AS count FROM manor_operations WHERE userId = ? AND operationId = ?").get(studentUserId, rollbackOperationId).count), 0, "rolled-back operation was recorded as committed");
  assert.equal(Number(rollbackAssertDb.prepare("SELECT COUNT(*) AS count FROM manor_domain_events WHERE studentId = ? AND eventType = 'plot.plant_and_nurture' AND entityId = '4'").get(studentUserId).count), plotEventsBeforeRollback, "rolled-back operation emitted a domain event");
  rollbackAssertDb.close();

  const atomicPlotBody = {
    operationId: "plot-plant-nurture-0001",
    action: "plant_and_nurture",
    expectedRevision: 1,
    cropId: "wheat",
    grantAllocations: [{ grantId: decision.grant.id, amount: 8 }],
  };
  const atomicPlotResponse = await fetch(`${base}/api/v2/manor/plots/4/actions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(atomicPlotBody),
  });
  assert.equal(atomicPlotResponse.status, 200);
  const atomicPlot = await atomicPlotResponse.json();
  assert.equal(atomicPlot.plot.cropId, "wheat");
  assert.equal(atomicPlot.plot.stage, 1);
  assert.equal(atomicPlot.plot.revision, 2);
  assert.equal(atomicPlot.resources.growthEnergy, beforeAtomicBootstrap.resources.growthEnergy - 8);

  const atomicReplayResponse = await fetch(`${base}/api/v2/manor/plots/4/actions`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify(atomicPlotBody),
  });
  assert.equal(atomicReplayResponse.status, 200);
  const atomicReplay = await atomicReplayResponse.json();
  assert.equal(atomicReplay.correlationId, atomicPlot.correlationId, "idempotent replay did not return the committed result");
  assert.equal(atomicReplay.plot.revision, atomicPlot.plot.revision);
  assert.equal(atomicReplay.resources.growthEnergy, atomicPlot.resources.growthEnergy);
  const afterAtomicReplay = await (await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } })).json();
  assert.equal(afterAtomicReplay.plots.find((plot) => plot.id === 4).revision, 2, "idempotent replay changed the plot twice");
  assert.equal(afterAtomicReplay.resources.growthEnergy, atomicPlot.resources.growthEnergy, "idempotent replay consumed the grant twice");

  assert.equal(afterAtomicReplay.daily.completed, false, "evidence alone completed the daily task");
  const reflection = "圈出动作幅度关键词，再联系原句解释。";
  let completedTask;
  for (const [expectedRevision, phase] of ["evidence", "outcome", "reflection", "summary"].entries()) {
    const taskResponse = await fetch(`${base}/api/v2/manor/task-runs`, {
      method: "POST",
      headers: { cookie: studentCookie, "content-type": "application/json" },
      body: JSON.stringify({
        operationId: `task-reading-${phase}-0001`,
        missionId: "reading-clue-01",
        phase,
        answer: "B",
        evidenceId: corrected.evidence.id,
        reflection,
        expectedRevision,
      }),
    });
    assert.equal(taskResponse.status, 200, `daily task phase ${phase} failed`);
    completedTask = await taskResponse.json();
    assert.equal(completedTask.taskRun.phase, phase);
    assert.equal(completedTask.taskRun.revision, expectedRevision + 1);
  }
  assert.ok(completedTask.taskRun.completedAt);
  assert.ok(completedTask.taskRun.artifactId);

  const staleEndResponse = await fetch(`${base}/api/v2/manor/session/end`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ operationId: "session-end-stale-0001", expectedRevision: 99 }),
  });
  assert.equal(staleEndResponse.status, 409);
  const staleEnd = await staleEndResponse.json();
  assert.equal(staleEnd.error.code, "MANOR_REVISION_CONFLICT");
  assert.equal(staleEnd.authoritative.profile.revision, 1);

  const endResponse = await fetch(`${base}/api/v2/manor/session/end`, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({ operationId: "session-end-0001", expectedRevision: 1 }),
  });
  assert.equal(endResponse.status, 200);
  const ended = await endResponse.json();
  assert.equal(ended.profile.revision, 2);
  assert.ok(ended.profile.quietUntil > Date.now());
  const beijingEnded = new Date(ended.profile.quietUntil + 8 * 60 * 60 * 1000);
  assert.equal(beijingEnded.getUTCHours(), 0);
  assert.equal(beijingEnded.getUTCMinutes(), 0);
  assert.equal(beijingEnded.getUTCSeconds(), 0);

  const quietWriteResponse = await fetch(evidenceUrl, {
    method: "POST",
    headers: { cookie: studentCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "evidence-after-quiet-0001",
      missionId: "science-leaf-01",
      answer: "A",
      hintsUsed: [],
      accommodationCodes: [],
    }),
  });
  assert.equal(quietWriteResponse.status, 423);
  assert.equal((await quietWriteResponse.json()).error.code, "SESSION_QUIET");

  const persistedResponse = await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: studentCookie } });
  const persisted = await persistedResponse.json();
  assert.equal(persisted.plots.find((plot) => plot.id === 3).revision, 3);
  assert.equal(persisted.reviews.length, 1);
  assert.equal(persisted.artifacts.length, 3);
  assert.deepEqual(persisted.artifacts.find((item) => item.id === artifact.artifact.id), artifact.artifact, "persisted artifact lost its source evidence");
  const expressionArtifacts = persisted.artifacts.filter((item) => item.evidenceId === expression.evidence.id);
  assert.equal(expressionArtifacts.length, 1, "expression submission did not persist exactly one artifact");
  assert.equal(expressionArtifacts[0].artifactType, "expression");
  assert.equal(expressionArtifacts[0].content, "我把 12 分钟画成四段，每一段都是 3 分钟，所以可以浇四块田。");
  assert.equal(expressionArtifacts[0].status, "archived");
  assert.equal(expressionArtifacts[0].evidenceRevision, decision.evidence.revision);
  const reflectionArtifact = persisted.artifacts.find((item) => item.id === completedTask.taskRun.artifactId);
  assert.ok(reflectionArtifact, "completed daily task did not persist its reflection artifact");
  assert.equal(reflectionArtifact.artifactType, "reflection");
  assert.equal(reflectionArtifact.evidenceId, corrected.evidence.id);
  assert.equal(reflectionArtifact.content, reflection);
  assert.equal(persisted.resources.growthEnergy, beforeAtomicBootstrap.resources.growthEnergy - 8);
  assert.equal(persisted.daily.completed, true);
  assert.deepEqual(persisted.taskRuns, [completedTask.taskRun]);
  assert.equal(persisted.profile.revision, 2);

  const database = new DatabaseSync(join(tempDbDir, "eduai.sqlite"), { readOnly: true });
  const ledgerRows = database.prepare(`SELECT g.id,g.units,g.remainingUnits,COALESCE(SUM(c.amount),0) AS consumed
    FROM growth_grants g LEFT JOIN grant_consumptions c ON c.grantId=g.id GROUP BY g.id,g.units,g.remainingUnits`).all();
  assert.equal(ledgerRows.length >= 4, true);
  assert.equal(ledgerRows.every((row) => Number(row.units) === Number(row.remainingUnits) + Number(row.consumed)), true, `grant ledger invariant failed: ${JSON.stringify(ledgerRows)}`);
  const immutableTriggers = database.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%_immutable_%'").all();
  assert.deepEqual(immutableTriggers.map(({ name }) => name).sort(), [
    "evidence_attempts_immutable_delete",
    "evidence_attempts_immutable_update",
    "evidence_decisions_immutable_delete",
    "evidence_decisions_immutable_update",
    "grant_consumptions_immutable_delete",
    "grant_consumptions_immutable_update",
    "manor_domain_events_immutable_delete",
    "manor_domain_events_immutable_update",
    "manor_task_history_immutable_delete",
    "manor_task_history_immutable_update",
  ], "immutable evidence/event/consumption/task-history trigger set does not match");
  database.close();

  const logoutResponse = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { cookie: concurrentCookie } });
  assert.equal(logoutResponse.status, 200);
  const revokedReplayResponse = await fetch(`${base}/api/v2/manor/bootstrap`, { headers: { cookie: concurrentCookie } });
  assert.equal(revokedReplayResponse.status, 401, "logout did not revoke the captured session cookie");

  console.log(JSON.stringify({
    ok: true,
    bootstrap: { schemaVersion: bootstrap.schemaVersion, plots: bootstrap.plots.length },
    evidence: { attempts: corrected.evidence.attemptCount, status: corrected.evidence.status, grants: persisted.grants.length },
    plot: { id: nurtured.plot.id, status: nurtured.plot.status, revision: nurtured.plot.revision },
    persisted: { reviews: persisted.reviews.length, artifacts: persisted.artifacts.length, growthEnergy: persisted.resources.growthEnergy },
    review: { queue: queue.items.length, status: decision.evidence.status, auditEvents: audit.events.length },
    concurrency: { requests: concurrentResponses.length, evidence: 1, grants: 1 },
    ledger: { rows: ledgerRows.length, invariant: "issued=remaining+consumed", immutableTriggers: immutableTriggers.length },
    security: { contentType: 415, crossOrigin: 403, adminContentType: 415, adminCrossOrigin: 403, demoReadOnly: 403, legacyMutation: 410, duplicateGrant: 409, foreignEvidence: 404, quietSession: 423, revokedSession: 401 },
  }, null, 2));
} finally {
  await serverHandle?.cleanup();
  const resolvedTemp = resolve(tempDbDir);
  const tempRoot = resolve(tmpdir()) + sep;
  if (!resolvedTemp.startsWith(tempRoot) || !basename(resolvedTemp).startsWith("eduai-manor-v2-")) {
    throw new Error(`Refusing to remove unexpected temp path: ${resolvedTemp}`);
  }
  removeTempDirectory(resolvedTemp);
}
