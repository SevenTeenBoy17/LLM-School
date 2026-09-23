import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "playwright/test";
import { launchManorBrowser } from "./manor-v5-helpers.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const BASE = new URL(process.env.HTML_ACTIVITY_BASE_URL || process.env.SCHOOL_RESOURCES_BASE_URL || "http://127.0.0.1:4921");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(BASE.hostname), "This test only contacts a loopback server.");
assert.ok(["http:", "https:"].includes(BASE.protocol));
const RUNTIME = new URL("/resource-runtime.html", BASE).href;
const HARNESS = new URL("/__html-activity-security-fixture__", BASE).href;
const OUT = join(ROOT, ".agent-supervisor/resources-v2-20260908/runtime-review");
const RUN_DIR = join(OUT, new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(RUN_DIR, { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const files = [
  "app/public/resource-runtime.html", "app/next.config.ts", "app/lib/school-resources/htmlRuntime.ts",
  "app/lib/school-resources/model.ts", "app/components/school-resources/HtmlActivityPlayer.tsx",
  "app/lib/school-resources/activityPackage.ts", "app/tests/html-activity-security.mjs",
  "app/tests/manor-v5-helpers.mjs", "app/tests/school-resources-model.mjs",
];
const sources = new Map(files.map(path => [path, readFileSync(join(ROOT, path))]));
const report = {
  schema: "HtmlActivitySecurityRegression/v1", goal: "goal-b440fbc8125718c0", goalVersion: 2,
  group: "independent-html-v2", startedAt: new Date().toISOString(), cwd: process.cwd(),
  command: "node tests/html-activity-security.mjs", base: BASE.origin,
  collector: "installed-playwright-fresh-contexts-real-wrapper", browser: null,
  sourceHashesBefore: Object.fromEntries([...sources].map(([path, bytes]) => [path, hash(bytes)])),
  checks: [], browserCases: [], policyProbes: [], artifacts: [], readiness: [],
  limits: [
    "Actual served static wrapper tested; teacher/student routes and actual React player receiver integration are NOT tested.",
    "Only GET /resource-runtime.html reaches the existing server. HTTP probes are fulfilled locally; native WebSocket probes target an ephemeral loopback-only sentinel. No login, upload, DB or account mutations.",
    "Fresh contexts use no user credentials or pre-existing service workers. Test fixtures, not uploaded user data. No Playwright service-worker blocker or WebSocket mock is injected into the sandbox.",
    "Local-network-access permission is granted only to the authored harness origin in disposable contexts so Chromium LNA cannot substitute for the CSP or native WebSocket sentinel proof.",
    "Interception is a safety net: any probe reaching it fails a protection assertion. Header-stripped and malformed-NBSP negative controls are explicitly separate.",
    "No CPU/memory/GPU denial-of-service, WebRTC/STUN/DNS or protocol-wide egress testing; no universal network/availability isolation claim.",
    "One installed Chromium-family browser; no Firefox/WebKit/mobile, production proxy/CDN/cache or downloaded-original security claim.",
    "Native audit only, not a signed Supervisor quality gate. Source drift keeps terminal incomplete.",
  ],
};

function flush() {
  report.endedAt = new Date().toISOString();
  report.counts = Object.fromEntries(["passed", "failed", "unavailable"].map(status => [status, report.checks.filter(c => c.status === status).length]));
  writeFileSync(join(RUN_DIR, "report.json"), JSON.stringify(report, null, 2) + "\n");
  writeFileSync(join(OUT, "latest-report.json"), JSON.stringify(report, null, 2) + "\n");
}
async function check(id, label, kind, run) {
  const item = { id, label, kind, startedAt: new Date().toISOString() };
  try { item.actual = await run(); item.status = "passed"; }
  catch (error) { item.status = "failed"; item.error = error.stack || String(error); }
  item.endedAt = new Date().toISOString();
  report.checks.push(item); flush();
  console.log(`${item.status.toUpperCase()} ${id} [${kind}] ${label}${item.error ? `\n${item.error}` : ""}`);
  return item.status === "passed";
}

// Compile only snapshotted, trusted product TypeScript in memory; never imported HTML.
const require = createRequire(import.meta.url);
const ts = require("typescript");
const moduleCache = new Map();
function loadProduct(path) {
  if (moduleCache.has(path)) return moduleCache.get(path).exports;
  const bytes = sources.get(path);
  assert.ok(bytes, `Unregistered product module ${path}`);
  const output = ts.transpileModule(bytes.toString("utf8"), {
    fileName: path, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const productModule = { exports: {} };
  moduleCache.set(path, productModule);
  const localRequire = specifier => {
    assert.ok(specifier.startsWith("."), `Unexpected external product dependency ${specifier}`);
    const target = resolve(ROOT, dirname(path), specifier + (specifier.endsWith(".ts") ? "" : ".ts"));
    const key = target.slice(resolve(ROOT).length + 1).replaceAll("\\", "/");
    return loadProduct(key);
  };
  new Function("module", "exports", "require", output)(productModule, productModule.exports, localRequire);
  return productModule.exports;
}
const model = loadProduct("app/lib/school-resources/model.ts");
const runtimeHelpers = loadProduct("app/lib/school-resources/htmlRuntime.ts");
const expectedDirectives = {
  "default-src": "'none'", "script-src": "'unsafe-inline'", "style-src": "'unsafe-inline'",
  "img-src": "data: blob:", "media-src": "data: blob:", "font-src": "data:",
  "frame-src": "blob:", "connect-src": "'none'", "object-src": "'none'", "worker-src": "'none'",
  "base-uri": "'none'", "form-action": "'none'", sandbox: "allow-scripts",
};
function parsePolicy(policy) {
  assert.equal(typeof policy, "string");
  assert.doesNotMatch(policy, /[^\t\x20-\x7e]/, "Runtime response must use printable ASCII or HTAB only.");
  assert.ok(!policy.includes(","), "Unexpected multiple serialized policies; review explicitly.");
  const entries = policy.split(";").map(part => part.trim()).filter(Boolean).map(part => {
    const [name, ...values] = part.split(/[ \t]+/); return [name.toLowerCase(), values.join(" ")];
  });
  assert.equal(new Set(entries.map(([name]) => name)).size, entries.length, "Duplicate CSP directive.");
  return Object.fromEntries(entries);
}
function payload(script = "document.querySelector('#run').onclick=()=>document.querySelector('#result').textContent='1';") {
  return `<!doctype html><html><head><title>Authored security fixture</title></head><body><button id="run">Run fixture</button><output id="result">0</output><script>${script}</script></body></html>`;
}
function sizedHtml(bytes, character = "\u4e2d") {
  const tail = "-->" + payload();
  const remaining = bytes - Buffer.byteLength("<!--" + tail);
  const width = Buffer.byteLength(character);
  assert.ok(remaining >= 0);
  const html = "<!--" + character.repeat(Math.floor(remaining / width)) + "x".repeat(remaining % width) + tail;
  assert.equal(Buffer.byteLength(html), bytes);
  return html;
}
function rejectPolicies(id, candidates) {
  const results = candidates.map(([label, policy]) => ({ id, label, accepted: runtimeHelpers.hasRuntimePolicy(policy), sha256: hash(policy) }));
  report.policyProbes.push(...results);
  assert.deepEqual(results.filter(result => result.accepted), [], "All policy variants must fail closed.");
  return { rejected: results.length, cases: results.map(result => result.label) };
}
const postFacts = "top.postMessage({type:'security-audit-probe',facts},'*');";
const init = (html = payload(), nonce = randomUUID()) => ({ type: "eduai-runtime-init", version: 1, nonce, html });
let browser;

async function withHarness(id, run, { stripHeader = false, overridePolicy = null } = {}) {
  assert.ok(!(stripHeader && overridePolicy !== null), "Choose only one explicit header negative control.");
  const context = await browser.newContext({ acceptDownloads: false, viewport: { width: 1000, height: 720 } });
  await context.grantPermissions(["local-network-access"], { origin: BASE.origin });
  const record = { id, stripHeader, overridePolicy, startedAt: new Date().toISOString(), intercepted: [], sockets: [], responses: [], console: [], pageErrors: [], messages: [], downloads: [], popups: [] };
  report.browserCases.push(record);
  // WebSocket routing replaces the native constructor, so use a loopback upgrade sentinel.
  const socketSentinel = createServer((request, response) => {
    record.sockets.push({ url: request.url, transport: "http", at: new Date().toISOString() });
    response.writeHead(403); response.end();
  });
  socketSentinel.on("upgrade", (request, socket) => {
    record.sockets.push({ url: request.url, transport: "upgrade", at: new Date().toISOString() });
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
  });
  await new Promise((resolve, reject) => { socketSentinel.once("error", reject); socketSentinel.listen(0, "127.0.0.1", resolve); });
  const wsUrl = `ws://127.0.0.1:${socketSentinel.address().port}/native-websocket-probe`;
  record.wsSentinel = wsUrl;
  const responseJobs = [];
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.url() === HARNESS && request.method() === "GET") {
      await route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><title>Runtime security harness</title><style>body{font:16px sans-serif;margin:24px}iframe#runtime{display:block;width:850px;height:480px;border:1px solid #555}</style></head><body><h1>Standalone runtime regression</h1><p>Authored local fixture. No student data.</p></body></html>' });
    } else if (url.origin === BASE.origin && url.pathname === "/resource-runtime.html" && request.method() === "GET" && !url.search) {
      if (stripHeader || overridePolicy !== null) {
        const response = await route.fetch({ maxRedirects: 0, timeout: 15000 });
        const headers = response.headers();
        if (stripHeader) delete headers["content-security-policy"];
        else headers["content-security-policy"] = overridePolicy;
        await route.fulfill({ response, headers });
      } else await route.continue();
    } else {
      record.intercepted.push({ url: request.url(), method: request.method(), resourceType: request.resourceType(), navigation: request.isNavigationRequest(), at: new Date().toISOString() });
      await route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Intercepted security probe</title>Never sent to an application API or external server." });
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(3500);
  page.on("console", message => { if (record.console.length < 100) record.console.push({ type: message.type(), text: message.text().slice(0, 900) }); });
  page.on("pageerror", error => record.pageErrors.push(error.message.slice(0, 1000)));
  page.on("download", download => record.downloads.push({ suggestedFilename: download.suggestedFilename(), url: download.url() }));
  page.on("popup", popup => { record.popups.push(popup.url()); void popup.close(); });
  page.on("response", response => {
    if (response.url() === RUNTIME) responseJobs.push((async () => {
      const body = await response.body();
      record.responses.push({ url: response.url(), status: response.status(), headers: await response.allHeaders(), bodySha256: hash(body), bytes: body.length });
    })().catch(error => record.responses.push({ url: response.url(), error: String(error) })));
  });
  try {
    await page.goto(HARNESS);
    await page.evaluate(() => {
      window.__audit = { messages: [], facts: [], mounts: 0 };
      window.addEventListener("message", event => {
        const data = event.data;
        const outer = document.querySelector("#runtime");
        const fromOuter = !!outer && event.source === outer.contentWindow;
        if (window.__audit.messages.length < 100 && data && typeof data === "object") window.__audit.messages.push({
          fromOuter, origin: event.origin, type: typeof data.type === "string" ? data.type.slice(0, 50) : "invalid",
          status: typeof data.status === "string" ? data.status.slice(0, 50) : "invalid",
          nonce: typeof data.nonce === "string" ? data.nonce.slice(0, 80) : null,
        });
        if (data?.type === "security-audit-probe" && window.__audit.facts.length < 30) window.__audit.facts.push(data.facts);
      });
    });
    return await run({ page, context, record, wsUrl });
  } finally {
    if (!page.isClosed()) {
      record.messages = await page.evaluate(() => window.__audit?.messages || []).catch(() => []);
      record.finalFrames = page.frames().map(frame => ({ name: frame.name(), url: frame.url() }));
      record.facts = await page.evaluate(() => window.__audit?.facts || []).catch(() => []);
    }
    await Promise.all(responseJobs);
    record.endedAt = new Date().toISOString();
    await context.close();
    socketSentinel.closeAllConnections();
    await new Promise(resolve => socketSentinel.close(resolve));
  }
}
async function mount(page, data = null) {
  const expectedMounts = await page.evaluate(() => window.__audit.mounts + 1);
  await page.evaluate(({ runtime, data }) => {
    const outer = document.createElement("iframe"); outer.id = "runtime"; outer.name = "runtime";
    outer.title = "Real served resource wrapper"; outer.setAttribute("sandbox", "allow-scripts");
    outer.referrerPolicy = "no-referrer";
    outer.onload = () => { window.__audit.mounts++; if (data) outer.contentWindow.postMessage(data, "*"); };
    outer.src = runtime; document.body.append(outer);
  }, { runtime: RUNTIME, data });
  await page.waitForFunction(expected => window.__audit.mounts === expected, expectedMounts);
  const outer = page.frames().find(frame => frame.parentFrame() === page.mainFrame() && frame.name() === "runtime");
  assert.ok(outer, "The real served outer frame must exist.");
  return outer;
}
async function send(page, data) {
  await page.evaluate(data => document.querySelector("#runtime").contentWindow.postMessage(data, "*"), data);
}
async function innerFrame(outer) {
  await expect(outer.locator("iframe")).toHaveCount(1);
  const inner = outer.childFrames()[0];
  assert.ok(inner, "Inner frame missing.");
  await expect(inner.locator("#run")).toBeVisible();
  return inner;
}
async function facts(page) {
  await page.waitForFunction(() => window.__audit.facts.length > 0);
  return page.evaluate(() => window.__audit.facts.at(-1));
}
function noProbeEscapes(record) {
  assert.deepEqual(record.intercepted, [], "A probe reached the test interception layer; product policy did not block it before networking.");
  assert.deepEqual(record.sockets, [], "A WebSocket reached the protective test route.");
}

try {
  let served;
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const response = await fetch(RUNTIME, { redirect: "manual", signal: AbortSignal.timeout(3500) });
      const body = Buffer.from(await response.arrayBuffer());
      served = { status: response.status, headers: Object.fromEntries(response.headers), bodySha256: hash(body), bytes: body.length };
      report.readiness.push({ attempt, status: response.status, at: new Date().toISOString() });
      if (response.ok && response.headers.has("content-security-policy")) break;
    } catch (error) { report.readiness.push({ attempt, error: String(error), at: new Date().toISOString() }); }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  await check("H01", "Real wrapper header and body match current security contract", "deployment", async () => {
    assert.ok(served, "Wrapper server unavailable after bounded readiness wait.");
    assert.equal(served.status, 200);
    const policy = parsePolicy(served.headers["content-security-policy"]);
    for (const [name, value] of Object.entries(expectedDirectives)) assert.equal(policy[name], value, `Unexpected ${name}`);
    assert.equal(served.headers["referrer-policy"], "no-referrer");
    assert.equal(served.headers["x-content-type-options"], "nosniff");
    assert.match(served.headers["cache-control"], /no-store/);
    assert.equal(served.bodySha256, report.sourceHashesBefore["app/public/resource-runtime.html"]);
    return served;
  });

  await check("C01", "HTML admission changed only for explicit sandbox activity formats", "contract-unit", async () => {
    for (const name of ["fixture.html", "fixture.htm", "fixture.HTML"]) assert.equal(model.validateResourceFile({ name, size: 100, type: "text/html" }), null);
    for (const [name, type] of [["fixture.md", "text/html"], ["fixture.svg", "image/svg+xml"], ["fixture.js", "application/javascript"], ["fixture.html", "application/xhtml+xml"]]) assert.ok(model.validateResourceFile({ name, size: 100, type }));
    const original = new Blob(["<!doctype html>\r\n<p>\u4e2d\u6587</p>\r\n"], { type: "text/html" });
    assert.equal(await runtimeHelpers.readActivityHtml(original), await original.text());
    for (const blob of [new Blob([]), new Blob([Uint8Array.of(0xff)]), new Blob(["a\0b"]), new Blob(["x".repeat(model.MAX_HTML_BYTES + 1)])]) await assert.rejects(runtimeHelpers.readActivityHtml(blob));
    return { maxHtmlBytes: model.MAX_HTML_BYTES, legacyTestNotEdited: true };
  });
  await check("C02", "Actual preflight helper rejects missing and required-directive loss", "contract-unit", async () => {
    assert.equal(runtimeHelpers.hasRuntimePolicy(null), false);
    assert.equal(runtimeHelpers.hasRuntimePolicy(""), false);
    const policy = served.headers["content-security-policy"];
    assert.equal(runtimeHelpers.hasRuntimePolicy(policy), true);
    for (const name of ["sandbox", "frame-src", "connect-src", "worker-src", "object-src", "base-uri", "form-action"]) {
      assert.equal(runtimeHelpers.hasRuntimePolicy(policy.split(";").filter(part => !part.trim().startsWith(name + " ")).join(";")), false, name);
    }
    return { mainReactMountNotTested: true };
  });
  await check("C03", "Preflight rejects permissive duplicate directives, not last-value parsing", "contract-unit", async () => {
    const policy = served.headers["content-security-policy"];
    const candidates = [
      ["permissive frame-src first", "frame-src https: blob:; " + policy],
      ["permissive connect-src first", "connect-src *; " + policy],
      ["mixed-case permissive frame-src first", "FrAmE-SrC https: blob:; " + policy],
      ["permissive frame-src last", policy + "; frame-src https: blob:"],
      ["multiple serialized policies require explicit review", policy + ", frame-src https:"],
    ];
    for (const [name, value] of Object.entries(expectedDirectives)) {
      candidates.push([`duplicate ${name}`, `${name} ${value}; ${policy}`]);
      candidates.push([`mixed-case duplicate ${name}`, `${name.toUpperCase()} ${value}; ${policy}`]);
    }
    return rejectPolicies("C03", candidates);
  });
  await check("C04", "Preflight rejects widened executable and resource sources", "contract-unit", async () => {
    const policy = served.headers["content-security-policy"];
    const candidates = [];
    for (const name of ["script-src", "style-src", "img-src", "media-src", "font-src"]) {
      candidates.push([`missing ${name}`, policy.split(";").filter(part => !part.trim().startsWith(name + " ")).join(";")]);
      candidates.push([`widened ${name}`, policy.replace(`${name} ${expectedDirectives[name]}`, `${name} ${expectedDirectives[name]} https:`)]);
    }
    candidates.push(["wildcard images", policy.replace("img-src data: blob:", "img-src * data: blob:")]);
    candidates.push(["eval enabled", policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'unsafe-eval'")]);
    candidates.push(["WASM enabled", policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'wasm-unsafe-eval'")]);
    for (const name of ["script-src-elem", "script-src-attr", "style-src-elem", "style-src-attr"]) {
      candidates.push([`unreviewed ${name} override`, policy + `; ${name} 'unsafe-inline' https:`]);
    }
    return rejectPolicies("C04", candidates);
  });
  await check("C05", "Preflight rejects Unicode/control serialization and accepts ASCII space or HTAB", "contract-unit", async () => {
    const policy = served.headers["content-security-policy"];
    const codePoints = [0x00a0, 0x1680, ...Array.from({ length: 11 }, (_, index) => 0x2000 + index),
      0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff, 0x200b, 0x4e2d, 0x1f600,
      0x00, 0x0a, 0x0b, 0x0c, 0x0d, 0x1f, 0x7f];
    const candidates = codePoints.flatMap(codePoint => {
      const character = String.fromCodePoint(codePoint);
      const label = `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
      return [
        [`${label} replaces source delimiter`, policy.replaceAll(" ", character)],
        [`${label} leading`, character + policy],
        [`${label} trailing`, policy + character],
        [`${label} frame-src only`, policy.replace("frame-src blob:", `frame-src${character}blob:`)],
      ];
    });
    const rejected = rejectPolicies("C05", candidates);
    const accepted = [policy, policy.replaceAll(" ", "\t"),
      " \t" + policy.replaceAll(" ", " \t ") + "\t ",
      policy.split(";").map(part => part.replace(/[a-z-]+/, name => name.toUpperCase())).join(";")];
    for (const candidate of accepted) {
      assert.equal(runtimeHelpers.hasRuntimePolicy(candidate), true, "Legitimate ASCII formatting must remain accepted.");
      assert.deepEqual(parsePolicy(candidate), expectedDirectives);
    }
    return { ...rejected, acceptedAsciiControls: accepted.length };
  });

  browser = await launchManorBrowser(); report.browser = browser.version();
  await check("R01", "Actual double-opaque wrapper renders and responds to a real click", "browser-protection", () => withHarness("R01", async ({ page, record }) => {
    const data = init(); const outer = await mount(page, data); const inner = await innerFrame(outer);
    assert.equal(await page.locator("#runtime").getAttribute("sandbox"), "allow-scripts");
    assert.equal(await outer.locator("iframe").getAttribute("sandbox"), "allow-scripts");
    assert.match(inner.url(), /^blob:null\//);
    await inner.locator("#run").click(); await expect(inner.locator("#result")).toHaveText("1");
    await page.waitForFunction(nonce => window.__audit.messages.some(m => m.fromOuter && m.nonce === nonce && m.status === "loaded"), data.nonce);
    const path = join(RUN_DIR, "R01-real-wrapper-click.png"); await page.screenshot({ path });
    report.artifacts.push({ type: "screenshot", path, sha256: hash(readFileSync(path)) });
    noProbeEscapes(record); assert.deepEqual(record.pageErrors, []);
    return { output: "1", outerUrl: outer.url(), innerUrl: inner.url() };
  }));

  await check("R02", "Script cannot read parent/top DOM or opaque-origin storage", "browser-protection", () => withHarness("R02", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=async()=>{const facts={};const attempts={parentDOM:()=>parent.document.title,topDOM:()=>top.document.title,cookie:()=>document.cookie,localStorage:()=>localStorage.length,sessionStorage:()=>sessionStorage.length,serviceWorker:()=>typeof navigator.serviceWorker,indexedDB:()=>{indexedDB.open('authored-probe');return 'opened'}};for(const [name,fn]of Object.entries(attempts)){try{facts[name]=fn()}catch(e){facts[name]=e.name}}${postFacts}};`;
    const outer = await mount(page, init(payload(script))); const inner = await innerFrame(outer);
    await inner.locator("#run").click(); const result = await facts(page);
    for (const key of ["parentDOM", "topDOM", "cookie", "localStorage", "sessionStorage", "indexedDB"]) assert.equal(result[key], "SecurityError", key);
    assert.ok(["undefined", "SecurityError"].includes(result.serviceWorker), "No ServiceWorkerContainer may be exposed to the opaque child.");
    const outerFacts = await outer.evaluate(() => { const out = {}; for (const [key, fn] of Object.entries({ parent: () => parent.document.title, cookie: () => document.cookie, storage: () => localStorage.length })) { try { out[key] = fn(); } catch (e) { out[key] = e.name; } } return out; });
    assert.deepEqual(outerFacts, { parent: "SecurityError", cookie: "SecurityError", storage: "SecurityError" });
    noProbeEscapes(record); return { inner: result, outer: outerFacts };
  }));

  await check("R03", "Actual CSP prevents HTTP resources, native WebSocket and app API requests", "browser-protection", () => withHarness("R03", async ({ page, record, wsUrl }) => {
    const api = new URL("/api/security-probe", BASE).href;
    const script = `document.querySelector('#run').onclick=async()=>{const facts={};const tasks=[];for(const [name,url]of Object.entries({external:'https://probe.invalid/fetch',api:${JSON.stringify(api)}}))tasks.push(fetch(url,{credentials:'include'}).then(()=>facts[name]='resolved',()=>facts[name]='rejected'));const img=new Image();img.src='https://probe.invalid/image';document.body.append(img);const s=document.createElement('script');s.src='https://probe.invalid/script';document.body.append(s);const f=document.createElement('iframe');f.src='https://probe.invalid/frame';document.body.append(f);const style=document.createElement('style');style.textContent='@import url(https://probe.invalid/style);';document.head.append(style);const audio=document.createElement('audio');audio.src='https://probe.invalid/audio';audio.preload='auto';document.body.append(audio);audio.load();const relative=new Image();relative.src='relative-probe.png';document.body.append(relative);tasks.push(new Promise(resolve=>{try{const ws=new WebSocket(${JSON.stringify(wsUrl)});ws.onerror=()=>{facts.websocket='error-event';resolve()};ws.onopen=()=>{facts.websocket='opened';ws.close();resolve()};setTimeout(()=>{ws.close();resolve()},700)}catch(e){facts.websocket=e.name;resolve()}}));await Promise.all(tasks);${postFacts}};`;
    const inner = await innerFrame(await mount(page, init(payload(script)))); await inner.locator("#run").click();
    const result = await facts(page); await page.waitForTimeout(250);
    assert.equal(result.external, "rejected"); assert.equal(result.api, "rejected"); noProbeEscapes(record);
    assert.equal(result.websocket, "error-event");
    assert.ok(record.console.some(m => /connect-src/.test(m.text) && m.text.includes(wsUrl)), "Expected native WebSocket CSP diagnostic absent."); return result;
  }));

  await check("R04", "User-activated forms, popups and downloads remain sandboxed", "browser-protection", () => withHarness("R04", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{const facts={popup:window.open('https://probe.invalid/popup')===null};const form=document.createElement('form');form.action='https://probe.invalid/form';form.method='POST';document.body.append(form);form.submit();const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['authored fixture only'],{type:'text/plain'}));link.download='authored-fixture.txt';document.body.append(link);link.click();${postFacts}};`;
    const inner = await innerFrame(await mount(page, init(payload(script)))); await inner.locator("#run").click();
    assert.equal((await facts(page)).popup, true); await page.waitForTimeout(250);
    noProbeEscapes(record); assert.deepEqual(record.downloads, []); assert.deepEqual(record.popups, []);
    return { userActivation: true, popupDenied: true, downloadEvents: record.downloads.length };
  }));

  await check("R05", "Inline probe cannot run eval, Blob worker code or WebAssembly", "browser-protection", () => withHarness("R05", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=async()=>{const facts={};try{eval('1+1');facts.eval='ran'}catch(e){facts.eval=e.name}try{new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0]));facts.wasm='ran'}catch(e){facts.wasm=e.name}facts.worker=await new Promise(resolve=>{try{const w=new Worker(URL.createObjectURL(new Blob(['postMessage(42)'])));w.onmessage=()=>{w.terminate();resolve('ran')};w.onerror=()=>resolve('error-event');setTimeout(()=>resolve('timeout'),500)}catch(e){resolve(e.name)}});${postFacts}};`;
    const inner = await innerFrame(await mount(page, init(payload(script)))); await inner.locator("#run").click(); const result = await facts(page);
    assert.equal(result.eval, "EvalError"); assert.equal(result.wasm, "CompileError"); assert.ok(["error-event", "SecurityError"].includes(result.worker)); noProbeEscapes(record); return result;
  }));

  const blobNavigationSource = JSON.stringify('<script>fetch("https://probe.invalid/blob-fetch").catch(()=>{});location.href="https://probe.invalid/blob-navigation";</script>').replaceAll("<", "\\u003c");
  const navigations = {
    N01: ["self location HTTPS", "location.href='https://probe.invalid/location'"],
    N02: ["self location app API", `location.replace(${JSON.stringify(new URL("/api/security-navigation-probe", BASE).href)})`],
    N03: ["self anchor HTTPS", "const a=document.createElement('a');a.href='https://probe.invalid/anchor';document.body.append(a);a.click()"],
    N04: ["self meta refresh", "const m=document.createElement('meta');m.httpEquiv='refresh';m.content='0;url=https://probe.invalid/meta';document.head.append(m)"],
    N05: ["parent navigation", "try{parent.location.href='https://probe.invalid/parent'}catch(e){}"],
    N06: ["top navigation", "try{top.location.href='https://probe.invalid/top'}catch(e){}"],
    N07: ["Blob self-navigation retains creator policy", `document.querySelector('meta[http-equiv="Content-Security-Policy"]').remove();location.href=URL.createObjectURL(new Blob([${blobNavigationSource}],{type:'text/html'}))`],
  };
  for (const [id, [label, action]] of Object.entries(navigations)) await check(id, label, "browser-protection", () => withHarness(id, async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{const facts={attempted:${JSON.stringify(id)}};${postFacts}${action}};`;
    const outer = await mount(page, init(payload(script))); const inner = await innerFrame(outer); await inner.locator("#run").click();
    assert.equal((await facts(page)).attempted, id); await page.waitForTimeout(300);
    noProbeEscapes(record); assert.equal(page.url(), HARNESS); assert.equal(outer.url(), RUNTIME);
    if (["N01", "N02", "N03", "N04", "N07"].includes(id)) assert.ok(record.console.some(m => /frame-src blob:/.test(m.text)), "No outer frame-src enforcement observed.");
    return { innerUrl: inner.url(), expectedPolicyViolations: record.console.filter(m => /blocked|violates/.test(m.text)).length };
  }));

  const invalidMessages = [
    ["B01", "wrong version", () => ({ ...init(), version: 2 })],
    ["B02", "invalid nonce shape", () => ({ ...init(), nonce: "invalid" })],
    ["B03", "non-string source", () => ({ ...init(), html: { source: "not HTML" } })],
    ["B04", "empty source", () => ({ ...init(), html: "" })],
    ["B05", "oversize ASCII source", () => init("x".repeat(model.MAX_HTML_BYTES + 1))],
  ];
  for (const [id, label, create] of invalidMessages) await check(id, `Wrapper rejects ${label} and remains usable`, "browser-protection", () => withHarness(id, async ({ page, record }) => {
    const outer = await mount(page); await send(page, create()); await page.waitForTimeout(150); await expect(outer.locator("iframe")).toHaveCount(0);
    await send(page, init()); await innerFrame(outer); noProbeEscapes(record); return { invalidIgnored: true, validInitializationAfterwards: true };
  }));
  await check("B06", "Foreign window cannot initialize the wrapper", "browser-protection", () => withHarness("B06", async ({ page, record }) => {
    const outer = await mount(page);
    await page.evaluate(data => {
      const sibling = document.createElement("iframe"); sibling.id = "foreign";
      sibling.srcdoc = '<script>parent.frames[0].postMessage(' + JSON.stringify(data).replaceAll("<", "\\u003c") + ',"*");<\/script>';
      document.body.append(sibling);
    }, init(payload("document.body.dataset.foreign='ran'")));
    await page.waitForTimeout(200); await expect(outer.locator("iframe")).toHaveCount(0);
    await send(page, init()); await innerFrame(outer); noProbeEscapes(record);
  }));
  await check("B07", "Wrapper enforces the HTML UTF-8 byte budget, not only string length", "browser-protection", () => withHarness("B07", async ({ page, record }) => {
    const outer = await mount(page);
    const html = sizedHtml(model.MAX_HTML_BYTES + 1);
    assert.ok(Buffer.byteLength(html) > model.MAX_HTML_BYTES && html.length < model.MAX_HTML_BYTES);
    await send(page, init(html)); await page.waitForTimeout(250);
    await expect(outer.locator("iframe")).toHaveCount(0);
    await send(page, init()); const inner = await innerFrame(outer);
    await inner.locator("#run").click(); await expect(inner.locator("#result")).toHaveText("1"); noProbeEscapes(record);
    return { bytes: Buffer.byteLength(html), codeUnits: html.length, validAfterRejection: true };
  }));
  await check("B08", "Initialization replay cannot replace an active activity", "browser-protection", () => withHarness("B08", async ({ page, record }) => {
    const first = init(); const outer = await mount(page, first); const inner = await innerFrame(outer); const url = inner.url();
    await send(page, { ...first, html: payload("document.querySelector('#result').textContent='replaced'") });
    await send(page, init(payload("document.querySelector('#result').textContent='replaced'")));
    await page.waitForTimeout(150); await expect(outer.locator("iframe")).toHaveCount(1); assert.equal(inner.url(), url);
    await expect(inner.locator("#result")).toHaveText("0"); await inner.locator("#run").click(); await expect(inner.locator("#result")).toHaveText("1"); noProbeEscapes(record);
  }));
  await check("B09", "Foreign lifecycle and arbitrary inner grade messages are not promoted", "browser-protection", () => withHarness("B09", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{parent.postMessage({type:'eduai-inner',status:'grade',score:100},'*');top.postMessage({type:'eduai-runtime',version:1,nonce:'forged',status:'loaded'},'*');const facts={sent:true};${postFacts}};`;
    const data = init(payload(script)); const outer = await mount(page, data); const inner = await innerFrame(outer);
    await inner.locator("#run").click(); await facts(page);
    await send(page, { type: "eduai-inner", status: "script-error" }); await page.waitForTimeout(150);
    const messages = await page.evaluate(() => window.__audit.messages);
    assert.ok(messages.some(m => !m.fromOuter && m.nonce === "forged"));
    assert.equal(messages.filter(m => m.fromOuter && ["grade", "script-error"].includes(m.status)).length, 0);
    noProbeEscapes(record); return { wrongSourceObservable: true, actualReactReceiverDeferred: true };
  }));
  await check("B10", "Unmount removes child execution; late message cannot revive old frame", "browser-protection", () => withHarness("B10", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{setTimeout(()=>{const facts={late:true};${postFacts}},600);const facts={armed:true};${postFacts}};`;
    const outer = await mount(page, init(payload(script))); const inner = await innerFrame(outer); await inner.locator("#run").click(); await facts(page);
    await page.evaluate(() => { window.__oldRuntime = document.querySelector('#runtime').contentWindow; document.querySelector('#runtime').remove(); });
    await page.evaluate(data => window.__oldRuntime.postMessage(data, "*"), init());
    await page.waitForTimeout(750); assert.equal(page.frames().length, 1);
    assert.equal((await page.evaluate(() => window.__audit.facts)).some(f => f.late), false);
    const fresh = await mount(page, null).catch(error => { throw new Error(`Fresh mount after removal: ${error.message}`); });
    await send(page, init()); await innerFrame(fresh); noProbeEscapes(record);
    return { oldChildRemoved: true, normalTimersCancelled: true, cpuHardStopNotTested: true };
  }));
  await check("B11", "Four-byte Unicode source at 5 MiB plus one is rejected", "browser-protection", () => withHarness("B11", async ({ page, record }) => {
    const html = sizedHtml(model.MAX_HTML_BYTES + 1, "\u{1f600}");
    assert.ok(html.length < model.MAX_HTML_BYTES);
    const outer = await mount(page); await send(page, init(html)); await page.waitForTimeout(250);
    await expect(outer.locator("iframe")).toHaveCount(0);
    await send(page, init()); await innerFrame(outer); noProbeEscapes(record);
    return { bytes: Buffer.byteLength(html), codeUnits: html.length, validAfterRejection: true };
  }));
  await check("B12", "Exactly 5 MiB of UTF-8 HTML still runs and responds to a real click", "browser-protection", () => withHarness("B12", async ({ page, record }) => {
    const html = sizedHtml(model.MAX_HTML_BYTES);
    const inner = await innerFrame(await mount(page, init(html)));
    await inner.locator("#run").click(); await expect(inner.locator("#result")).toHaveText("1"); noProbeEscapes(record);
    return { bytes: Buffer.byteLength(html), codeUnits: html.length, output: "1" };
  }));
  await check("B13", "Child lifecycle replay is bounded to one loaded and three errors", "browser-protection", () => withHarness("B13", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{for(let i=0;i<20;i++){parent.postMessage({type:'eduai-inner',status:'loaded'},'*');parent.postMessage({type:'eduai-inner',status:'script-error'},'*')}const facts={sent:40};${postFacts}};`;
    const data = init(payload(script)); const inner = await innerFrame(await mount(page, data));
    await page.waitForFunction(nonce => window.__audit.messages.some(m => m.fromOuter && m.nonce === nonce && m.status === "loaded"), data.nonce);
    await inner.locator("#run").click(); assert.equal((await facts(page)).sent, 40); await page.waitForTimeout(150);
    const messages = await page.evaluate(nonce => window.__audit.messages.filter(m => m.fromOuter && m.nonce === nonce), data.nonce);
    assert.equal(messages.filter(m => m.status === "loaded").length, 1);
    assert.equal(messages.filter(m => m.status === "script-error").length, 3);
    noProbeEscapes(record); return { loaded: 1, errors: 3, boundedFixtureMessages: 40, floodResistanceNotTested: true };
  }));

  await check("F01", "Header-stripped negative control is detected by the network sentinel", "negative-control", () => withHarness("F01", async ({ page, record }) => {
    const script = `document.querySelector('#run').onclick=()=>{const facts={attempted:true};${postFacts}location.href='https://probe.invalid/missing-header-control'};`;
    const inner = await innerFrame(await mount(page, init(payload(script)))); await inner.locator("#run").click(); await facts(page); await page.waitForTimeout(250);
    assert.ok(record.intercepted.some(request => request.url === "https://probe.invalid/missing-header-control"), "Negative control did not reach the protective interceptor; investigate test sensitivity.");
    assert.equal(runtimeHelpers.hasRuntimePolicy(null), false);
    return { expectedEscapeDetected: true, noExternalTransmission: true, actualPlayerFailClosedIntegration: "deferred" };
  }, { stripHeader: true }));
  await check("F02", "Native loopback WebSocket sentinel detects an unrestricted control", "negative-control", () => withHarness("F02", async ({ page, record, wsUrl }) => {
    await page.evaluate(url => {
      const button = document.createElement("button"); button.id = "socket-control"; button.textContent = "Native WebSocket control";
      button.onclick = () => { const socket = new WebSocket(url); socket.onerror = () => {}; };
      document.body.append(button);
    }, wsUrl);
    await page.locator("#socket-control").click();
    await expect.poll(() => record.sockets.filter(socket => socket.transport === "upgrade").length).toBe(1);
    assert.deepEqual(record.intercepted, []);
    return { nativeUpgradeObserved: true, loopbackOnly: true };
  }));
  const malformedPolicy = served.headers["content-security-policy"].replaceAll(" ", "\u00a0");
  await check("F03", "NBSP header is rejected; bypassing preflight reproduces the intercepted navigation", "negative-control", () => withHarness("F03", async ({ page, record }) => {
    assert.equal(runtimeHelpers.hasRuntimePolicy(malformedPolicy), false, "Original malformed-header preflight bypass must be closed.");
    const target = new URL("/api/never-transmitted-unicode-csp-probe", BASE).href;
    const script = `document.querySelector('#run').onclick=()=>{const facts={attempted:true};${postFacts}location.href=${JSON.stringify(target)}};`;
    // Deliberately bypass admission to prove Chrome ignores this malformed policy.
    const inner = await innerFrame(await mount(page, init(payload(script))));
    await inner.locator("#run").click(); assert.equal((await facts(page)).attempted, true);
    await expect.poll(() => record.intercepted.filter(request => request.url === target).length).toBe(1);
    assert.deepEqual(record.intercepted.map(request => ({ url: request.url, method: request.method, navigation: request.navigation })),
      [{ url: target, method: "GET", navigation: true }]);
    assert.ok(record.console.some(message => /invalid characters|invalid directive|unrecognized.*directive/i.test(message.text)), "Expected malformed CSP diagnostic absent.");
    assert.deepEqual(record.sockets, []);
    return { helperRejects: true, deliberatelyBypassed: true, expectedEscapeDetected: true, apiRequestLocallyFulfilled: true, actualReactMountNotTested: true };
  }, { overridePolicy: malformedPolicy }));
  await check("H02", "Every actual browser runtime response matches the snapshotted source and policy", "deployment", async () => {
    let checked = 0;
    for (const browserCase of report.browserCases) {
      const expectedResponses = browserCase.id === "F02" ? 0 : browserCase.id === "B10" ? 2 : 1;
      assert.equal(browserCase.responses.length, expectedResponses, `${browserCase.id}: missing or extra wrapper response`);
      for (const response of browserCase.responses) {
      assert.equal(response.status, 200, browserCase.id);
      assert.equal(response.bodySha256, report.sourceHashesBefore["app/public/resource-runtime.html"], browserCase.id);
      if (browserCase.stripHeader) assert.equal(response.headers["content-security-policy"], undefined);
      else if (browserCase.overridePolicy !== null) {
        assert.equal(browserCase.id, "F03", "Unexpected policy override outside the registered negative control.");
        assert.equal(response.headers["content-security-policy"], browserCase.overridePolicy);
        assert.equal(runtimeHelpers.hasRuntimePolicy(response.headers["content-security-policy"]), false);
      }
      else {
        const policy = parsePolicy(response.headers["content-security-policy"]);
        for (const [name, value] of Object.entries(expectedDirectives)) assert.equal(policy[name], value, `${browserCase.id}: ${name}`);
      }
      checked++;
      }
    }
    assert.equal(checked, 28, "Missing actual browser runtime responses, including the added NBSP negative control.");
    return { checked };
  });
} catch (error) {
  report.checks.push({ id: "INFRA", label: "Test infrastructure", status: "unavailable", kind: "infrastructure", error: error.stack || String(error) });
} finally {
  if (browser) await browser.close();
  report.sourceHashesAfter = Object.fromEntries(files.map(path => [path, hash(readFileSync(join(ROOT, path)))]));
  report.sourceDrift = files.filter(path => report.sourceHashesBefore[path] !== report.sourceHashesAfter[path]);
  report.terminal = report.checks.some(c => c.status !== "passed") || report.sourceDrift.length ? "incomplete" : "scoped-regression-passed";
  report.formalAcceptance = "MISSING: no signed Supervisor gate; main integration and declared exclusions remain unverified";
  flush();
  process.exitCode = report.counts.failed || report.counts.unavailable ? 1 : report.sourceDrift.length ? 2 : 0;
  console.log(JSON.stringify({ report: join(RUN_DIR, "report.json"), counts: report.counts, sourceDrift: report.sourceDrift, terminal: report.terminal, exitCode: process.exitCode }, null, 2));
}
