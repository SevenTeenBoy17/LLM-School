import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import JSZip from "jszip";
import { startIsolatedManorDevServer } from "./manor-v5-helpers.mjs";

const tempDbDir = mkdtempSync(`${tmpdir()}${sep}eduai-courseware-`);
const previousApiKey = process.env.LLM_API_KEY;
process.env.LLM_API_KEY = "";

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

async function uploadText(base, cookie, name, content) {
  const form = new FormData();
  form.append("file", new File([content], name, { type: "text/plain" }));
  const response = await fetch(`${base}/api/upload`, { method: "POST", headers: { cookie }, body: form });
  const body = await response.json();
  assert.equal(response.status, 200, `upload failed: ${JSON.stringify(body)}`);
  return body;
}

let serverHandle;
try {
  serverHandle = await startIsolatedManorDevServer({ label: "courseware-api", tempDbDir });
  const { base } = serverHandle;
  const teacherCookie = await login(base, "teacher", "Teacher@123");
  const researcherCookie = await login(base, "research", "Research@123");
  const studentCookie = await login(base, "student", "Student@123");

  const anonymousList = await fetch(`${base}/api/courseware`);
  assert.equal(anonymousList.status, 401, "anonymous user could list teacher courseware");
  const studentList = await fetch(`${base}/api/courseware`, { headers: { cookie: studentCookie } });
  assert.equal(studentList.status, 403, "student could list teacher courseware");

  const studentSource = await uploadText(base, studentCookie, "student-private.txt", "这份资料属于学生账号，教师课件不得读取。内容是私有观察记录。");
  const teacherSource = await uploadText(base, teacherCookie, "campus-water.txt", "周一用水 120 吨，周二 115 吨，周三 108 吨。节水提示张贴后，用水量连续下降。数据需要由教师再次核对。\n");

  const operationId = "courseware-plan-e2e-0001";
  const planInput = {
    operationId,
    subject: "数学与科学",
    grade: "八年级",
    topic: "校园节水数据分析",
    slideCount: 6,
    objectives: ["读懂一周用水数据", "提出有证据的节水建议"],
    style: "project",
    sourceSummary: "保留数据核验提醒，并设计一项课堂讨论。",
    uploadIds: [teacherSource.id, studentSource.id],
  };
  const planResponse = await fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(planInput),
  });
  const planned = await planResponse.json();
  assert.equal(planResponse.status, 200, `plan failed: ${JSON.stringify(planned)}`);
  assert.equal(planned.status, "succeeded");
  assert.equal(planned.operationId, operationId);
  assert.equal(planned.stateVersion, 1);
  assert.equal(planned.authoritativeEntity.generationSource, "local-fallback");
  assert.equal(planned.authoritativeEntity.plan.schemaVersion, "courseware.v2");
  assert.equal(planned.authoritativeEntity.quality.grade, "A");
  assert.equal(planned.authoritativeEntity.quality.issues.length, 0);
  assert.ok(planned.authoritativeEntity.quality.editableObjectEstimate >= 72);
  assert.deepEqual(planned.authoritativeEntity.sourceFiles, [teacherSource.name], "cross-account upload was included in source context");
  assert.equal(planned.authoritativeEntity.plan.slides.length, 6);
  assert.equal(planned.authoritativeEntity.plan.slides.every((slide) => slide.title && slide.purpose && slide.bullets.length > 0), true);
  assert.equal(planned.authoritativeEntity.plan.reviewNotes.some((note) => /复核|核对/.test(note)), true, "fallback did not disclose teacher review requirement");

  const replayResponse = await fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(planInput),
  });
  const replay = await replayResponse.json();
  assert.equal(replayResponse.status, 200);
  assert.equal(replay.duplicate, true);
  assert.equal(replay.authoritativeEntity.id, planned.authoritativeEntity.id);

  const mismatchedReplayResponse = await fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify({ ...planInput, topic: "同一幂等键下的另一课题" }),
  });
  const mismatchedReplay = await mismatchedReplayResponse.json();
  assert.equal(mismatchedReplayResponse.status, 409);
  assert.equal(mismatchedReplay.error.code, "IDEMPOTENCY_CONFLICT");

  const crossOriginResponse = await fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json", origin: "https://attacker.invalid" },
    body: JSON.stringify({ ...planInput, operationId: "courseware-plan-cross-origin-0002" }),
  });
  assert.equal(crossOriginResponse.status, 403);
  assert.equal((await crossOriginResponse.json()).error.code, "CROSS_ORIGIN_REQUEST");

  const listResponse = await fetch(`${base}/api/courseware`, { headers: { cookie: teacherCookie } });
  const listed = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listed.schemaVersion, "courseware.v2");
  assert.equal(listed.items.length, 1, "idempotent replay created a second deck");

  const stalePlanInput = {
    ...planInput,
    operationId: "courseware-plan-stale-recovery-0003",
    topic: "校园节水陈旧任务恢复",
  };
  const staleAction = `plan:${createHash("sha256").update(JSON.stringify(stalePlanInput)).digest("hex")}`;
  const directDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  const staleAt = Date.now() - 11 * 60_000;
  const staleLeaseToken = "stale-worker-lease-token";
  directDb.prepare(
    `INSERT INTO courseware_operations
      (ownerId, operationId, action, state, resultJson, leaseToken, createdAt, updatedAt)
     VALUES (?, ?, ?, 'pending', NULL, ?, ?, ?)`,
  ).run("u-teacher", stalePlanInput.operationId, staleAction, staleLeaseToken, staleAt, staleAt);
  directDb.close();
  const staleRecoveryResponse = await fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(stalePlanInput),
  });
  const staleRecovery = await staleRecoveryResponse.json();
  assert.equal(staleRecoveryResponse.status, 200, `stale operation did not recover: ${JSON.stringify(staleRecovery)}`);
  assert.equal(staleRecovery.status, "succeeded");
  const fencingDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  const recoveredOperation = fencingDb.prepare(
    "SELECT state, leaseToken FROM courseware_operations WHERE ownerId = ? AND operationId = ?",
  ).get("u-teacher", stalePlanInput.operationId);
  assert.equal(recoveredOperation.state, "done");
  assert.notEqual(recoveredOperation.leaseToken, staleLeaseToken, "stale operation kept its old lease token");
  const staleFinalize = fencingDb.prepare(
    "UPDATE courseware_operations SET resultJson = 'late-worker' WHERE ownerId = ? AND operationId = ? AND leaseToken = ? AND state = 'pending'",
  ).run("u-teacher", stalePlanInput.operationId, staleLeaseToken);
  assert.equal(Number(staleFinalize.changes), 0, "stale worker could finalize a reclaimed operation");
  fencingDb.close();

  const concurrentInput = {
    ...planInput,
    operationId: "courseware-plan-concurrent-0004",
    topic: "校园节水并发幂等验证",
  };
  const concurrentResponses = await Promise.all([1, 2].map(() => fetch(`${base}/api/courseware/plan`, {
    method: "POST",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(concurrentInput),
  })));
  const concurrentBodies = await Promise.all(concurrentResponses.map((response) => response.json()));
  assert.equal(concurrentResponses.every((response) => response.status === 200 || response.status === 409), true);
  const concurrentSucceeded = concurrentBodies.filter((body, index) => concurrentResponses[index].status === 200);
  assert.ok(concurrentSucceeded.length >= 1, "both concurrent generation requests failed");
  assert.equal(new Set(concurrentSucceeded.map((body) => body.authoritativeEntity.id)).size, 1, "concurrent replay created different authoritative decks");
  for (const [index, response] of concurrentResponses.entries()) {
    if (response.status === 409) assert.equal(concurrentBodies[index].error.code, "OPERATION_IN_PROGRESS");
  }
  const listAfterRecovery = await fetch(`${base}/api/courseware`, { headers: { cookie: teacherCookie } });
  const recoveredItems = (await listAfterRecovery.json()).items;
  assert.equal(recoveredItems.filter((item) => item.title.includes("陈旧任务恢复")).length, 1);
  assert.equal(recoveredItems.filter((item) => item.title.includes("并发幂等验证")).length, 1);

  const originalDeck = planned.authoritativeEntity;
  const revisedPlan = structuredClone(originalDeck.plan);
  revisedPlan.slides[1].teacherNote = "先让学生独立描述趋势，再核对原始数据。";
  const saveBody = {
    operationId: "courseware-save-e2e-0001",
    stateVersion: originalDeck.stateVersion,
    plan: revisedPlan,
  };
  const saveResponse = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
    method: "PATCH",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(saveBody),
  });
  const saved = await saveResponse.json();
  assert.equal(saveResponse.status, 200, `save failed: ${JSON.stringify(saved)}`);
  assert.equal(saved.authoritativeEntity.stateVersion, 2);
  assert.equal(saved.authoritativeEntity.status, "reviewed");
  assert.equal(saved.authoritativeEntity.plan.slides[1].teacherNote, revisedPlan.slides[1].teacherNote);

  const patchCrossOriginResponse = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
    method: "PATCH",
    headers: { cookie: teacherCookie, "content-type": "application/json", origin: "https://attacker.invalid" },
    body: JSON.stringify({ ...saveBody, operationId: "courseware-save-cross-origin-0003", stateVersion: saved.stateVersion }),
  });
  assert.equal(patchCrossOriginResponse.status, 403);
  assert.equal((await patchCrossOriginResponse.json()).error.code, "CROSS_ORIGIN_REQUEST");

  const saveReplayResponse = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
    method: "PATCH",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify(saveBody),
  });
  const saveReplay = await saveReplayResponse.json();
  assert.equal(saveReplayResponse.status, 200);
  assert.equal(saveReplay.duplicate, true);
  assert.equal(saveReplay.stateVersion, 2);

  const cacheDb = new DatabaseSync(join(tempDbDir, "eduai.sqlite"));
  try {
    const cachedOperation = cacheDb.prepare("SELECT resultJson FROM courseware_operations WHERE ownerId = ? AND operationId = ?").get("u-teacher", saveBody.operationId);
    const corruptResult = JSON.parse(cachedOperation.resultJson);
    corruptResult.authoritativeEntity.plan = { slides: "invalid" };
    cacheDb.prepare("UPDATE courseware_operations SET resultJson = ? WHERE ownerId = ? AND operationId = ?").run(JSON.stringify(corruptResult), "u-teacher", saveBody.operationId);
    const corruptReplay = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
      method: "PATCH", headers: { cookie: teacherCookie, "content-type": "application/json" }, body: JSON.stringify(saveBody),
    });
    assert.equal(corruptReplay.status, 409, "corrupt replay should be a controlled conflict, not a repeated write");
    assert.equal((await corruptReplay.json()).error.code, "IDEMPOTENCY_CONFLICT");
    assert.equal(cacheDb.prepare("SELECT stateVersion FROM courseware_decks WHERE id = ?").get(originalDeck.id).stateVersion, 2);
    cacheDb.prepare("UPDATE courseware_operations SET resultJson = ? WHERE ownerId = ? AND operationId = ?").run(cachedOperation.resultJson, "u-teacher", saveBody.operationId);
  } finally { cacheDb.close(); }

  const staleResponse = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
    method: "PATCH",
    headers: { cookie: teacherCookie, "content-type": "application/json" },
    body: JSON.stringify({ ...saveBody, operationId: "courseware-save-stale-0002" }),
  });
  const stale = await staleResponse.json();
  assert.equal(staleResponse.status, 409);
  assert.equal(stale.error.code, "VERSION_CONFLICT");
  assert.equal(stale.authoritativeEntity.stateVersion, 2);

  const downloadResponse = await fetch(`${base}/api/courseware/${originalDeck.id}/download`, { headers: { cookie: teacherCookie } });
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get("content-type") ?? "", /presentationml\.presentation/);
  assert.match(downloadResponse.headers.get("content-disposition") ?? "", /\.pptx/i);
  const bytes = Buffer.from(await downloadResponse.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");
  const zip = await JSZip.loadAsync(bytes);
  const slideParts = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideParts.length, 6);
  const editedSlideXml = await zip.file("ppt/slides/slide2.xml").async("string");
  const editedNotesXml = await zip.file("ppt/notesSlides/notesSlide2.xml").async("string");
  assert.match(editedSlideXml, /校园|用水|数据|趋势/);
  assert.match(editedNotesXml, /先让学生独立描述趋势/);

  const researcherList = await fetch(`${base}/api/courseware`, { headers: { cookie: researcherCookie } });
  assert.equal(researcherList.status, 200);
  assert.equal((await researcherList.json()).items.length, 0, "another authorized educator could list the teacher's decks");
  const researcherGet = await fetch(`${base}/api/courseware/${originalDeck.id}`, { headers: { cookie: researcherCookie } });
  assert.equal(researcherGet.status, 404, "another authorized educator could read the teacher's deck");
  const researcherPatch = await fetch(`${base}/api/courseware/${originalDeck.id}`, {
    method: "PATCH",
    headers: { cookie: researcherCookie, "content-type": "application/json" },
    body: JSON.stringify({
      operationId: "courseware-cross-owner-save-0004",
      stateVersion: saved.stateVersion,
      plan: saved.authoritativeEntity.plan,
    }),
  });
  assert.equal(researcherPatch.status, 404, "another authorized educator could modify the teacher's deck");
  const researcherDownload = await fetch(`${base}/api/courseware/${originalDeck.id}/download`, { headers: { cookie: researcherCookie } });
  assert.equal(researcherDownload.status, 404, "another authorized educator could download the teacher's deck");

  const studentDownload = await fetch(`${base}/api/courseware/${originalDeck.id}/download`, { headers: { cookie: studentCookie } });
  assert.equal(studentDownload.status, 403, "student could download teacher courseware");
  const missingDeck = await fetch(`${base}/api/courseware/not-owned-or-missing`, { headers: { cookie: teacherCookie } });
  assert.equal(missingDeck.status, 404);

  console.log(JSON.stringify({
    ok: true,
    plan: { source: planned.authoritativeEntity.generationSource, slides: planned.authoritativeEntity.plan.slides.length, sourceFiles: planned.authoritativeEntity.sourceFiles.length },
    idempotency: { planDuplicate: replay.duplicate, saveDuplicate: saveReplay.duplicate, mismatchStatus: mismatchedReplayResponse.status, staleRecovered: true, concurrentDecks: 1 },
    persistence: { initialVersion: 1, savedVersion: saved.stateVersion, staleStatus: staleResponse.status },
    download: { bytes: bytes.length, slides: slideParts.length, editableXml: true, speakerNotes: true },
    security: { anonymous: anonymousList.status, student: studentList.status, crossOrigin: crossOriginResponse.status, patchCrossOrigin: patchCrossOriginResponse.status, crossAccountSourceFiltered: true, crossEducatorIsolation: true },
  }, null, 2));
} finally {
  if (previousApiKey === undefined) delete process.env.LLM_API_KEY;
  else process.env.LLM_API_KEY = previousApiKey;
  await serverHandle?.cleanup();
  const resolvedTemp = resolve(tempDbDir);
  const tempPrefix = `${resolve(tmpdir())}${sep}`;
  if (!resolvedTemp.startsWith(tempPrefix) || !basename(resolvedTemp).startsWith("eduai-courseware-")) {
    throw new Error(`Refusing to remove unexpected temp path: ${resolvedTemp}`);
  }
  rmSync(resolvedTemp, { recursive: true, force: true, maxRetries: 20, retryDelay: 200 });
}
