#!/usr/bin/env node
/**
 * lib/delight/policy.ts 纯函数单测（方案 §3.3）
 *
 * 为什么这层值得单测：趣味配额是「不给 17 岁学生塞 6 岁形象」的唯一机制，而它最容易
 * 悄悄失效的方式是**默认值方向写反**——v2 就照抄了 useUserStore 里「安全默认取最强保护学段」
 * 的注释（那句语境是防代写强度，primary 管得最严），搬到趣味配额上方向正好翻转。
 * 端到端断言只能覆盖有账号的档位，senior/未登录这两档必须靠单测钉死。
 *
 * 用 node 原生类型剥离运行 .ts，不引入编译步骤（--experimental-strip-types）。
 */
const { allowed, suppressed, canRender, MAX_ALLOWED_LEVEL } = await import("../../lib/delight/policy.ts");

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${ok ? "" : ` — got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

console.log("\nP1 · 配额矩阵（role × stage）");
eq("student/primary → L3", allowed("student", "primary"), 3);
eq("student/junior  → L3", allowed("student", "junior"), 3);
eq("student/senior  → L1（高中段不出现拟人形象）", allowed("student", "senior"), 1);
eq("teacher/junior  → L1", allowed("teacher", "junior"), 1);
eq("admin/senior    → L1", allowed("admin", "senior"), 1);
eq("researcher      → L1", allowed("researcher", "senior"), 1);

console.log("\nP2 · fail-closed 方向（与防代写相反：未知 → 最低拟人化）");
eq("未登录(role=null) → L1", allowed(null, "primary"), 1);
eq("学段缺失 → L1（**不得**回落 primary）", allowed("student", null), 1);
eq("学段值非法 → L1", allowed("student", "unknown"), 1);

console.log("\nP3 · L4 全站禁用（红线，非配额）");
eq("MAX_ALLOWED_LEVEL = 3", MAX_ALLOWED_LEVEL, 3);
eq("L4 对 primary 学生也不放行", canRender(4, "student", "primary"), false);

console.log("\nP4 · 不可共现（§7.8）");
eq("crisis 抑制", suppressed({ kind: "crisis" }), true);
eq("care 抑制", suppressed({ kind: "care" }), true);
eq("scaffold 抑制", suppressed({ kind: "scaffold" }), true);
eq("source=safety 抑制", suppressed({ source: "safety" }), true);
eq("求助面板打开即抑制（全站浮标可从任意页触发）", suppressed({ safetyOpen: true }), true);
eq("本会话曾出现危机 → 剩余时间不恢复", suppressed({ kind: "normal", sessionHadCrisis: true }), true);
eq("普通回复不抑制", suppressed({ kind: "normal", source: "remote" }), false);
eq("无上下文不抑制", suppressed(null), false);

console.log("\nP5 · canRender 组合");
eq("L3 + primary + 普通 → 放行", canRender(3, "student", "primary", { kind: "normal" }), true);
eq("L3 + primary + 危机 → 拦截", canRender(3, "student", "primary", { kind: "crisis" }), false);
eq("L3 + senior → 拦截（超配额）", canRender(3, "student", "senior", { kind: "normal" }), false);
eq("L1 + senior → 放行", canRender(1, "student", "senior", { kind: "normal" }), true);
eq("L1 + 求助面板打开 → 拦截", canRender(1, "student", "senior", { safetyOpen: true }), false);

console.log(`\n────────────────────────────────\npolicy: ${failed ? `${failed} FAIL` : "全部通过"}`);
process.exit(failed ? 1 : 0);
