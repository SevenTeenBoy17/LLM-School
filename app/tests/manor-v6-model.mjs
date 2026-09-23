import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(new URL("../app/(shell)/student/manor/model/manor-learning.ts", import.meta.url));
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: sourcePath });
const load = (suffix = "") => import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}#${suffix}`);
const model = await load();
const originalFetch = globalThis.fetch;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
const storage = new Map();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
const artifactInput = { artifactType: "explanation", title: "My evidence", content: "An explanation with sources." };
const artifactResult = { artifact: { id: "artifact-1", ...artifactInput, status: "draft", revision: 1 }, resources: { growthEnergy: 0 } };
const grant = (id, units, purposes = ["plot"], evidenceId = "evidence-1", status = "available") => ({ id, evidenceId, units, remainingUnits: units, allowedPurposes: purposes, status });

try {
  await check("scheduled, due and completed are disjoint including exact due boundary", () => {
    assert.equal(model.reviewQueueState({ status: "scheduled", dueAt: 101, completedAt: null }, 100), "scheduled");
    assert.equal(model.reviewQueueState({ status: "scheduled", dueAt: 100, completedAt: null }, 100), "due");
    assert.equal(model.reviewQueueState({ status: "completed", dueAt: 0 }, 100), "completed");
    assert.equal(model.reviewQueueState({ status: "scheduled", dueAt: 0, completedAt: 20 }, 100), "completed");
  });
  await check("source-aware portfolio never invents a subject or teacher approval", () => {
    const artifact = { id: "a", evidenceId: "science-e", title: "Title", content: "Text", status: "saved" };
    assert.equal(model.portfolioFromArtifact(artifact, [{ id: "science-e", missionId: "m" }], [{ id: "m", subject: "数学" }]).subject, "数学");
    assert.equal(model.portfolioFromArtifact(artifact, [], []).subject, "未关联学科");
    assert.equal(model.portfolioFromArtifact(artifact, [], []).status, "saved");
    assert.equal(model.evidenceStatusLabel("accepted_practice"), "练习已完成");
    assert.notEqual(model.evidenceStatusLabel("pending_review"), "已接受");
  });
  await check("split allocations exclude wrong purposes, wrong sources and consumed grants", () => {
    const grants = [grant("g1", 3), grant("g2", 7, ["support_plot"]), grant("g3", 99, ["class_build"]), grant("g4", 99, ["plot"], "other"), grant("g5", 99, ["plot"], "evidence-1", "consumed")];
    assert.deepEqual(model.allocateManorGrants(grants, ["plot", "support_plot"], 8, "evidence-1"), [{ grantId: "g1", amount: 3 }, { grantId: "g2", amount: 5 }]);
    assert.equal(model.allocateManorGrants(grants, ["plot"], 8, "evidence-1"), null);
    assert.equal(model.allocateManorGrants([grant("g", 4), grant("g", 4)], ["plot"], 8), null);
    assert.equal(model.allocateManorGrants(grants, ["plot"], 0), null);
    assert.equal(model.allocateManorGrants(grants, ["plot"], 1.5), null);
    assert.equal(model.eligibleGrants(grants, "class_build", 2, "evidence-1")[0].id, "g3");
    assert.equal(grants[0].remainingUnits, 3);
  });
  await check("free artifact save strips obsolete grants and permits a genuine unlinked draft", async () => {
    let sent;
    globalThis.fetch = async (url, init) => { assert.equal(url, "/api/v2/manor/artifacts"); sent = JSON.parse(init.body); return json(artifactResult); };
    const result = await model.createManorLearningRepository({ subjectId: "free-draft" }).saveArtifact({ ...artifactInput, grantId: "obsolete" });
    assert.equal(result.growthEnergy, 0);
    assert.equal(Object.hasOwn(sent, "grantAllocations"), false);
    assert.equal(Object.hasOwn(sent, "grantId"), false);
    assert.equal(Object.hasOwn(sent, "evidenceId"), false);
    assert.equal(sent.content, artifactInput.content);
    assert.equal(storage.size, 0);
  });
  await check("task run preserves phase, answer, reflection, evidence and expected revision", async () => {
    const input = { missionId: "m", phase: "reflection", answer: "B", reflection: "Use a comparison.", evidenceId: "e", expectedRevision: 4 };
    globalThis.fetch = async (url, init) => { assert.equal(url, "/api/v2/manor/task-runs"); const { operationId, ...sent } = JSON.parse(init.body); assert.match(operationId, /^manor-/); assert.deepEqual(sent, input); return json({ taskRun: { ...input, id: "run", revision: 5 } }); };
    assert.equal((await model.createManorLearningRepository({ subjectId: "run-owner" }).saveTaskRun(input)).revision, 5);
  });
  await check("class contribution accepts split allocations and retains legacy single-grant calls", async () => {
    const sent = [];
    globalThis.fetch = async (_url, init) => { sent.push(JSON.parse(init.body)); return json({ accepted: 2, build: { raised: 2, cost: 20, done: false }, resources: { growthEnergy: 0 } }); };
    const repo = model.createManorLearningRepository({ subjectId: "class-owner" });
    const split = [{ grantId: "g1", amount: 1 }, { grantId: "g2", amount: 1 }];
    await repo.contributeToClass(2, split);
    await repo.contributeToClass(2, "g3");
    assert.deepEqual(sent[0].grantAllocations, split);
    assert.deepEqual(sent[1].grantAllocations, [{ grantId: "g3", amount: 2 }]);
  });
  await check("expression revision submits original evidence identity and teacher revision", async () => {
    const input = { missionId: "m", content: "Revised argument", evidenceId: "expression-original", expectedRevision: 3 };
    globalThis.fetch = async (url, init) => { const body = JSON.parse(init.body); assert.equal(url, "/api/v2/manor/evidence"); assert.equal(body.evidenceType, "expression"); assert.equal(body.evidenceId, input.evidenceId); assert.equal(body.expectedRevision, 3); assert.deepEqual(body.hintsUsed, []); assert.equal(Object.hasOwn(body, "grantAllocations"), false); return json({ evidence: { id: input.evidenceId, status: "pending_review", revision: 4 } }); };
    assert.equal((await model.createManorLearningRepository({ subjectId: "expression-owner" }).submitExpression(input)).evidence.status, "pending_review");
  });
  await check("review answer and defer use versioned endpoint and authoritative feedback", async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => { assert.equal(url, "/api/v2/manor/reviews/review-1/actions"); const body = JSON.parse(init.body); calls.push(body); return json({ review: { id: "review-1", status: "scheduled", revision: body.expectedRevision + 1 }, feedback: { correct: false, explanation: "Reconsider the changed conditions." } }); };
    const repo = model.createManorLearningRepository({ subjectId: "review-owner" });
    const result = await repo.reviewAction("review-1", { action: "complete", answer: "A", expectedRevision: 1 });
    assert.equal(result.feedback.correct, false);
    await repo.reviewAction("review-1", { action: "defer", expectedRevision: 2 });
    assert.equal(calls[0].answer, "A"); assert.equal(calls[1].action, "defer"); assert.equal(calls[1].expectedRevision, 2);
  });
  await check("lost mutation response recovers committed result without a second POST", async () => {
    let posts = 0; let operation;
    globalThis.fetch = async (url, init) => {
      if (init.method === "POST") { posts++; operation = JSON.parse(init.body).operationId; throw new TypeError("lost response"); }
      assert.equal(url, `/api/v2/manor/operations/${operation}`);
      return json({ status: "committed", result: artifactResult });
    };
    const result = await model.createManorLearningRepository({ subjectId: "lost-response" }).saveArtifact(artifactInput);
    assert.equal(result.item.id, "artifact-1"); assert.equal(posts, 1); assert.equal(storage.size, 0);
  });
  await check("bounded header timeout and bounded receipt lookup leave an unknown operation", async () => {
    globalThis.fetch = async () => new Promise(() => {});
    const started = performance.now();
    await assert.rejects(model.createManorLearningRepository({ subjectId: "timeout", timeoutMs: 15 }).saveArtifact(artifactInput), (error) => error.code === "OPERATION_UNKNOWN" && Boolean(error.operationId));
    assert.ok(performance.now() - started < 1000);
  });
  await check("bounded response-body timeout recovers the operation receipt", async () => {
    let posts = 0;
    globalThis.fetch = async (_url, init) => init.method === "POST" ? (posts++, { ok: true, status: 200, json: () => new Promise(() => {}) }) : json({ status: "committed", result: artifactResult });
    const result = await model.createManorLearningRepository({ subjectId: "body-timeout", timeoutMs: 15 }).saveArtifact(artifactInput);
    assert.equal(result.item.id, "artifact-1"); assert.equal(posts, 1);
  });
  await check("unknown retry after module reload queries the stored operation before posting", async () => {
    const owner = "reload-owner"; let operation;
    globalThis.fetch = async (_url, init) => { if (init.method === "POST") { operation = JSON.parse(init.body).operationId; throw new TypeError("offline"); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    await assert.rejects(model.createManorLearningRepository({ subjectId: owner }).saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    const reloaded = await load("reload"); let posts = 0;
    globalThis.fetch = async (url, init) => { if (init.method === "POST") { posts++; throw new Error("must not post"); } assert.equal(url, `/api/v2/manor/operations/${operation}`); return json({ status: "committed", result: artifactResult }); };
    assert.equal((await reloaded.createManorLearningRepository({ subjectId: owner }).saveArtifact(artifactInput)).item.id, "artifact-1");
    assert.equal(posts, 0);
  });
  await check("same unknown payload retries same identity; other subject gets a new identity", async () => {
    const ids = [];
    globalThis.fetch = async (_url, init) => { if (init.method === "POST") { ids.push(JSON.parse(init.body).operationId); throw new TypeError("offline"); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    const first = model.createManorLearningRepository({ subjectId: "student-a" });
    await assert.rejects(first.saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    await assert.rejects(first.saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    await assert.rejects(model.createManorLearningRepository({ subjectId: "student-b" }).saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    assert.equal(ids[0], ids[1]); assert.notEqual(ids[1], ids[2]);
    assert.ok([...storage.keys()].some((key) => key.includes("student-a")));
    assert.ok([...storage.keys()].some((key) => key.includes("student-b")));
  });
  await check("plot operation identities include plot URL; split allocations are preserved", async () => {
    const posts = [];
    globalThis.fetch = async (url, init) => { if (init.method === "POST") { posts.push({ url, ...JSON.parse(init.body) }); throw new TypeError("offline"); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    const input = { action: "nurture", expectedRevision: 1, grantAllocations: [{ grantId: "g1", amount: 3 }, { grantId: "g2", amount: 5 }] };
    const repo = model.createManorLearningRepository({ subjectId: "plot-owner" });
    await assert.rejects(repo.plotAction(1, input)); await assert.rejects(repo.plotAction(2, input));
    assert.notEqual(posts[0].operationId, posts[1].operationId); assert.deepEqual(posts[0].grantAllocations, input.grantAllocations);
  });
  for (const [status, code] of [[401, "AUTH_REQUIRED"], [403, "FORBIDDEN"], [400, "INVALID_INPUT"], [415, "UNSUPPORTED_MEDIA_TYPE"], [423, "SESSION_QUIET"], [409, "OPERATION_CONFLICT"]]) {
    await check(`unknown committed operation survives retry ${status} and reload without a new operation`, async () => {
      const owner = `unknown-before-${status}`;
      let originalOperation;
      const posts = [];
      globalThis.fetch = async (_url, init) => {
        if (init.method === "POST") {
          const body = JSON.parse(init.body);
          originalOperation = body.operationId;
          posts.push(body);
          throw new TypeError("commit succeeded but response was lost");
        }
        throw new TypeError("receipt was also lost");
      };
      const repository = model.createManorLearningRepository({ subjectId: owner });
      await assert.rejects(repository.saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
      const storedBefore = [...storage].find(([key]) => key.includes(owner));
      assert.ok(storedBefore);
      globalThis.fetch = async (_url, init) => {
        if (init.method === "POST") posts.push(JSON.parse(init.body));
        return json({ error: { code } }, status);
      };
      await assert.rejects(repository.saveArtifact(artifactInput), { code });
      assert.equal(storage.get(storedBefore[0]), storedBefore[1], "preexecution failure erased an unresolved operation");
      const reloaded = await load(`retry-${status}`);
      globalThis.fetch = async (url, init) => {
        assert.notEqual(init.method, "POST", "successful receipt recovery must not create a new artifact");
        assert.equal(url, `/api/v2/manor/operations/${originalOperation}`);
        return json({ status: "committed", result: artifactResult });
      };
      assert.equal((await reloaded.createManorLearningRepository({ subjectId: owner }).saveArtifact(artifactInput)).item.id, "artifact-1");
      assert.equal(storage.has(storedBefore[0]), false);
      assert.equal(new Set(posts.map((body) => body.operationId)).size, 1);
    });
  }
  await check("unknown auth failure retains original body until relogin replay with the same identity", async () => {
    const owner = "unknown-auth-replay";
    const posts = [];
    const repository = model.createManorLearningRepository({ subjectId: owner });
    globalThis.fetch = async (_url, init) => {
      if (init.method === "POST") posts.push(JSON.parse(init.body));
      throw new TypeError("offline");
    };
    await assert.rejects(repository.saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    globalThis.fetch = async (_url, init) => {
      if (init.method === "POST") posts.push(JSON.parse(init.body));
      return json({ error: { code: "AUTH_REQUIRED" } }, 401);
    };
    await assert.rejects(repository.saveArtifact(artifactInput), { code: "AUTH_REQUIRED" });
    const reloaded = await load("auth-replay");
    globalThis.fetch = async (_url, init) => {
      if (init.method === "POST") { posts.push(JSON.parse(init.body)); return json(artifactResult); }
      return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404);
    };
    await assert.rejects(reloaded.createManorLearningRepository({ subjectId: owner }).saveArtifact({ ...artifactInput, title: "Changed after login" }), { code: "PREVIOUS_OPERATION_COMMITTED" });
    assert.equal(posts.length, 3);
    assert.deepEqual(posts[2], posts[0]);
    assert.equal(new Set(posts.map((body) => body.operationId)).size, 1);
  });
  await check("post-replay authoritative revision conflict resolves a never-committed operation and allows corrected input", async () => {
    const owner = "unknown-not-committed";
    const posts = [];
    const repository = model.createManorLearningRepository({ subjectId: owner });
    const input = { missionId: "m", phase: "evidence", expectedRevision: 1 };
    globalThis.fetch = async (_url, init) => {
      if (init.method === "POST") posts.push(JSON.parse(init.body));
      throw new TypeError("request never reached server");
    };
    await assert.rejects(repository.saveTaskRun(input), { code: "OPERATION_UNKNOWN" });
    globalThis.fetch = async (_url, init) => {
      if (init.method === "POST") {
        posts.push(JSON.parse(init.body));
        return json({ error: { code: "MANOR_REVISION_CONFLICT", authoritative: { taskRun: { revision: 2 } } } }, 409);
      }
      return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404);
    };
    await assert.rejects(repository.saveTaskRun(input), { code: "MANOR_REVISION_CONFLICT" });
    assert.equal([...storage.keys()].some((key) => key.includes(owner)), false);
    globalThis.fetch = async (_url, init) => {
      assert.equal(init.method, "POST");
      posts.push(JSON.parse(init.body));
      return json({ taskRun: { id: "new-run", revision: 3 } });
    };
    assert.equal((await repository.saveTaskRun({ ...input, expectedRevision: 2 })).revision, 3);
    assert.equal(posts[0].operationId, posts[1].operationId);
    assert.notEqual(posts[1].operationId, posts[2].operationId);
  });
  await check("changed input cannot bypass an unresolved operation or submit a second mutation", async () => {
    let oldOperation; let posts = 0;
    const repo = model.createManorLearningRepository({ subjectId: "changed-input" });
    globalThis.fetch = async (_url, init) => { if (init.method === "POST") { oldOperation = JSON.parse(init.body).operationId; posts++; throw new TypeError("offline"); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    await assert.rejects(repo.saveArtifact(artifactInput), { code: "OPERATION_UNKNOWN" });
    globalThis.fetch = async (url, init) => { assert.notEqual(init.method, "POST"); assert.equal(url, `/api/v2/manor/operations/${oldOperation}`); return json({ status: "committed", result: artifactResult }); };
    await assert.rejects(repo.saveArtifact({ ...artifactInput, content: "A different revision." }), { code: "PREVIOUS_OPERATION_COMMITTED" });
    assert.equal(posts, 1);
  });
  await check("unknown old body is retried unchanged even when refreshed revision differs", async () => {
    const repo = model.createManorLearningRepository({ subjectId: "changed-revision" });
    const posts = [];
    globalThis.fetch = async (_url, init) => { if (init.method === "POST") { posts.push(JSON.parse(init.body)); throw new TypeError("offline"); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    const original = { action: "nurture", expectedRevision: 3, grantId: "g" };
    await assert.rejects(repo.plotAction(2, original), { code: "OPERATION_UNKNOWN" });
    globalThis.fetch = async (_url, init) => { if (init.method === "POST") { posts.push(JSON.parse(init.body)); return json({ plot: { id: 2, revision: 4 }, resources: { growthEnergy: 0 } }); } return json({ error: { code: "OPERATION_NOT_FOUND" } }, 404); };
    await assert.rejects(repo.plotAction(2, { ...original, expectedRevision: 4 }), { code: "PREVIOUS_OPERATION_COMMITTED" });
    assert.deepEqual(posts[1], posts[0]);
  });
  await check("definitive version conflict exposes authoritative state without receipt lookup", async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return json({ error: { code: "MANOR_REVISION_CONFLICT", message: "Version changed", authoritative: { taskRun: { revision: 9 } } } }, 409); };
    await assert.rejects(model.createManorLearningRepository({ subjectId: "conflict-owner" }).saveTaskRun({ missionId: "m", phase: "evidence", expectedRevision: 0 }), (error) => error.status === 409 && error.authoritative.taskRun.revision === 9);
    assert.equal(calls, 1);
  });
  await check("legacy repository resolves authenticated subject before any mutation", async () => {
    const paths = [];
    globalThis.fetch = async (url) => { paths.push(url); return url.endsWith("bootstrap") ? json({ subject: { id: "authenticated-owner" }, missions: [], evidence: [] }) : json(artifactResult); };
    await model.createManorLearningRepository().saveArtifact(artifactInput);
    assert.deepEqual(paths, ["/api/v2/manor/bootstrap", "/api/v2/manor/artifacts"]);
  });
  console.log(JSON.stringify({ ok: true, checks: checks.length, scenarios: checks }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, "sessionStorage", originalStorage);
  else delete globalThis.sessionStorage;
}
