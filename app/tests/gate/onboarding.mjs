import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const CURRENT_VERSION = 2;
const LAST_STEP = 2;

async function login(username, password) {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200, "student test account must be able to log in");
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  assert.ok(cookie, "login must return a session cookie");
  return cookie;
}

async function prefs(cookie, method = "GET", body) {
  return fetch(`${BASE}/api/user/prefs`, {
    method,
    headers: {
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const cookie = await login("student-p", "Student@123");
const initialResponse = await prefs(cookie);
assert.equal(initialResponse.status, 200, "preferences GET must succeed");
const initial = (await initialResponse.json()).prefs;
assert.equal(typeof initial.onboardingVersion, "number");
assert.equal(typeof initial.onboardingStep, "number");
assert.ok(initial.onboardingCompletedAt === null || Number.isFinite(initial.onboardingCompletedAt));

const forged = await prefs(cookie, "PUT", { onboardingCompletedAt: 1 });
assert.equal(forged.status, 400, "clients must not be able to forge completion timestamps");

if (initial.onboardingVersion < CURRENT_VERSION) {
  const progressResponse = await prefs(cookie, "PUT", { onboardingStep: 1 });
  assert.equal(progressResponse.status, 200, "step progress must persist");
  const progress = (await progressResponse.json()).prefs;
  assert.equal(progress.onboardingStep, 1);
  assert.equal(progress.onboardingVersion, initial.onboardingVersion);
  assert.equal(progress.onboardingCompletedAt, null);
}

const completeResponse = await prefs(cookie, "PUT", {
  onboardingVersion: CURRENT_VERSION,
  onboardingStep: LAST_STEP,
});
assert.equal(completeResponse.status, 200, "completion must persist");
const completed = (await completeResponse.json()).prefs;
assert.equal(completed.onboardingVersion, CURRENT_VERSION);
assert.equal(completed.onboardingStep, LAST_STEP);
assert.ok(Number.isFinite(completed.onboardingCompletedAt));

const replayResponse = await prefs(cookie, "PUT", { onboardingStep: 0 });
assert.equal(replayResponse.status, 200, "completed state replay must be idempotent");
const replayed = (await replayResponse.json()).prefs;
assert.equal(replayed.onboardingVersion, CURRENT_VERSION);
assert.equal(replayed.onboardingStep, LAST_STEP, "completed onboarding cannot regress to an earlier step");
assert.equal(replayed.onboardingCompletedAt, completed.onboardingCompletedAt, "completion timestamp must remain stable");

console.log("onboarding API: progress, authoritative completion, anti-forgery and idempotency PASS");
