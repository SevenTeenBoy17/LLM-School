import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { AGENT_TEMPLATES, AGENT_GROUPS, AGENT_REFERENCES, agentTemplateInput, agentTemplatePrompt, findAgentTemplate } from "../lib/agent/templates.ts";

const transpiled = ts.transpileModule(readFileSync(new URL("../lib/server/agentContract.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function("require", "module", "exports", transpiled)(() => ({ getAgent: () => null }), mod, mod.exports);
const { buildAgentPreamble, canUseAgent } = mod.exports;
assert.equal(AGENT_TEMPLATES.length, 16);
assert.equal(new Set(AGENT_TEMPLATES.map(t => t.id)).size, 16);
for (const group of AGENT_GROUPS.slice(1)) assert.ok(AGENT_TEMPLATES.some(t => t.group === group));
for (const t of AGENT_TEMPLATES) {
  assert.equal(findAgentTemplate(t.id), t);
  assert.ok(t.materials.length >= 3 && t.outputs.length === 3 && t.boundary.length > 15);
  const input = agentTemplateInput(t);
  assert.equal(input.knowledgeBase, "");
  assert.equal(input.status, undefined);
  assert.ok(input.description.length <= 400 && input.name.length <= 40);
  assert.ok(input.systemPrompt.length < 6000 && input.systemPrompt.length + t.sample.length < 2000);
  assert.equal(input.systemPrompt, agentTemplatePrompt(t));
  assert.ok(input.systemPrompt.includes(t.method) && input.systemPrompt.includes(t.boundary));
  assert.ok(input.systemPrompt.includes("不按点击、用时、分数") && input.systemPrompt.includes("教师审核"));
  assert.equal(new URL(AGENT_REFERENCES[t.source].url).protocol, "https:");
  const agent = { ...input, id: "test", ownerId: "owner", status: "draft" };
  assert.ok(buildAgentPreamble(agent).includes(input.systemPrompt));
  assert.ok(canUseAgent({ id: "owner", role: "teacher" }, agent));
  assert.ok(!canUseAgent({ id: "other", role: "teacher" }, agent));
  assert.ok(!canUseAgent({ id: "owner", role: "teacher" }, { ...agent, status: "disabled" }));
}
const legacy = { name: "旧助手", description: "旧定位", knowledgeBase: "" };
assert.equal(buildAgentPreamble(legacy), "你正在以「旧助手」智能体身份协助校内用户。定位：旧定位。请贴合该定位作答。");
assert.equal(buildAgentPreamble({ ...legacy, systemPrompt: "" }), buildAgentPreamble(legacy));
assert.equal(findAgentTemplate("unknown"), undefined);
const clientCode = ts.transpileModule(readFileSync(new URL("../lib/client/libraryApi.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const client = { exports: {} };
let response = new Response();
new Function("module", "exports", "fetch", clientCode)(client, client.exports, async () => response);
for (const [status, body] of [[502, {}], [504, {}], [408, {}], [200, {}], [200, { agent: {} }], [200, { agent: { id: " " } }]]) {
  response = Response.json(body, { status });
  await assert.rejects(() => client.exports.apiCreateAgent({}), /agent_create_unconfirmed/);
}
response = Response.json({ error: "forbidden" }, { status: 403 });
assert.equal(await client.exports.apiCreateAgent({}), null);
response = Response.json({ agent: { id: "saved" } });
assert.equal((await client.exports.apiCreateAgent({})).id, "saved");
console.log("PASS: 16 template contracts, input limits, source links, prompt runtime inclusion, legacy compatibility and authorization policy");
console.log("PASS: ambiguous gateway/malformed success responses remain unconfirmed; explicit rejection and valid success distinguished");
