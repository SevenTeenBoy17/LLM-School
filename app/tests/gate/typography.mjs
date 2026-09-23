#!/usr/bin/env node
/**
 * 字阶 / 圆角 / 字重 收敛门（方案 §3.1 R3、§4.4）
 *
 * 与色彩门同一套诚实策略——**棘轮，不宣称一次到位**：
 *   · 目标：字号档 ≤7（§3.1 R3）、圆角两档 + pill（§4.3）、字重三档 **400/600/700**（§4.4，已据实更正）
 *   · 现实：实测 /dashboard 12 个字号档、5 个字重档（含 800）、全站 9 档圆角
 *   · 因此：先锁基线，只许降不许升；**同时对「明确越界」的项直接设硬上限**
 *     （字重 800 不在三档里，没有任何理由保留，属可以立即归零的一类）
 *
 * 为什么必须在**真浏览器**里量：字号与圆角的真值来自计算样式——
 * Tailwind 任意值、rem 换算、响应式断点、继承，都会让源码里的字面量与实际渲染值对不上。
 * 数 className 只能得到「写了几种」，得不到「用户看到几种」。
 *
 * 用法：npm run gate:type        （需 dev server 在 BASE 运行）
 *       UPDATE_TYPE_BASELINE=1 npm run gate:type   把进度锁进基线
 */

import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:3000";
const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BASELINE = join(APP_ROOT, "tests", "gate", "type-baseline.json");

const MATRIX = [
  { user: "student", pw: "Student@123", pages: ["/student/home", "/chat", "/student/growth"] },
  { user: "teacher", pw: "Teacher@123", pages: ["/dashboard", "/prompts", "/class"] },
];

/**
 * 门户页（未登录可达）。**与 MATRIX 分开走，两个原因都不是风格问题。**
 *
 * 一、/login 不需要登录。拿一个已登录上下文去访问它，测的是另一件事。
 *
 * 二、**它默认不把要测的东西渲染出来。** 1440px 下 `showDesktopUnlock` 为真、
 *    `isUnlocked` 为假，登录卡片挂着 `lg:hidden` → `display:none` → 矩形为零 →
 *    被 AUDIT 开头的 `rc.width <= 0` 一句整段跳过。直接量的结果是：只量到左侧
 *    插画区的三档字号（40/14/12），报出一个非常好看的数字——而真正承载表单
 *    排版的那张卡片（24 标题 / 14 输入 / 13 副标题 / 11 演示账号提示）**一个字号
 *    都没进统计**。数字好看是因为没测，这正是「不可能失败的门比没有门更有害」
 *    的标准形态。因此必须先点开地球解锁，并且**断言解锁真的发生了**（T0）。
 *
 * 三、**不装假时钟**（与 MATRIX 相反）。MATRIX 装 `clock.install` 是为了避开
 *    宵禁遮罩，而宵禁属于登录后的 GuardianShell，门户页根本没有；反过来假时钟
 *    会冻结 rAF 与 setTimeout，解锁靠的是 React 状态更新后的重渲染，把调度器
 *    的计时器换成不会自己走的假货，风险远大于收益。此处没有任何时间相关断言。
 */
const PUBLIC_PAGES = [
  {
    path: "/login",
    /** 暗夜穹顶版：hero 视图先行，点主 CTA 才出现登录卡（旧版是点 3D 地球解锁）。
        转场 0.24s，1500ms 余量沿用。 */
    prepare: async (page) => {
      await page.getByRole("button", { name: "进入 i-learning" }).click();
      await page.waitForTimeout(1500);
    },
    /**
     * 防真空断言。没有这一条，prepare 里任何一步失效（选择器改名、按钮被挡、
     * 动画没跑完）都会**静默退回「只量左半屏」**——门依然全绿，只是测了个寂寞。
     */
    assertReady: (page) => page.evaluate(() => {
      const f = document.querySelector("main form");
      if (!f) return { ok: false, why: "未找到 main form" };
      const r = f.getBoundingClientRect();
      return { ok: r.width > 0 && r.height > 0, why: `form ${Math.round(r.width)}×${Math.round(r.height)}` };
    }),
  },
  {
    path: "/portal",
    // 门户落地页无需交互即可展开全部内容，故无 prepare。
    /**
     * 防真空断言换了个命题。/login 的风险是「卡片被 display:none 藏起来」，
     * /portal 的风险不同：它由六个区块组件拼装，**任何一个渲染失败都不会让
     * 页面报错**——React 只会少渲一块，页面照常 200，字阶门照常量到一个更小
     * 的档数然后全绿。所以这里断言的是「四个锚点区块都在，且都有实际高度」。
     * 少一块就红，而不是悄悄把基线量低。
     */
    assertReady: (page) => page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // 三个锚点区块 + 英雄区的标志物 h1。**不数 section 总数**——Hero 是不是
      // <section id> 属于实现自由，用它当判据等于让门去管一件它不该管的事，
      // 而且会在实现合法时误红。h1 是「英雄区真的渲染了」的最小充分证据。
      const missing = ["roles", "capabilities", "safety"].filter((id) => !visible(document.getElementById(id)));
      if (missing.length) return { ok: false, why: `缺失或零高度区块：${missing.join(",")}` };
      const h1 = document.querySelector("main h1");
      if (!visible(h1)) return { ok: false, why: "英雄区 h1 缺失或零高度" };
      return { ok: true, why: `三区块齐全 · h1「${(h1.textContent || "").trim().slice(0, 14)}」` };
    }),
  },
];

/**
 * 字重档位。
 *
 * **方案 §4.4 原写「400/500/700」，那是没量就写的规范。** 实测源码用量：
 *   font-medium(500) 82 · font-semibold(600) **231** · font-bold(700) 45 · font-extrabold(800) 8
 * 600 是绝对主力（标题与标签几乎全用它），却被原规范排除在外——照原规范执行
 * 等于把 231 处改掉去迁就一个凭空定的档位。规范据实改为 **400 / 600 / 700**：
 *   400 正文 · 600 标题与标签 · 700 强调与数字。
 *
 * 500 的处置（**已完成，过渡期结束**）：曾有 82 处，暂列过渡允许。它与 400 在 11-14px 下
 * 几乎不可分辨——**多占一档却不产生层级**。已按用途两分并档：
 *   · 与最弱化文字色 `text-[var(--text-3)]` **紧邻**的 8 处（单位后缀「天/%/次」、禁用态、
 *     跳过按钮）→ 落回 400。它们本就是刻意弱化，升到 600 会把「弱化」变成「强调」。
 *     只认紧邻不认同串任意位置——后者会把「text-3 在嵌套 span 上」的情况误判进来。
 *   · 其余 74 处（按钮、标签页、徽章、列表标题）→ 600，即规范里「标题与标签」那一档。
 *
 * 因此 **INTERIM 与 TARGET 现已合一**。留着一个仍然放行 500 的过渡集，等于给已经达成的
 * 目标留一道后门：下次谁写 `font-medium` 门照样绿。**目标达成即关闭豁免**，这是棘轮的另一半。
 *
 * 800 已清零（8 处 → font-bold）：纯粹的一次性越界，没有保留理由。
 */
const TARGET_WEIGHTS = new Set(["400", "600", "700"]);
const INTERIM_WEIGHTS = TARGET_WEIGHTS;

const results = [];
let failed = 0;
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const AUDIT = () => {
  const fs = new Set(), rd = new Set(), fw = new Set();
  for (const el of document.querySelectorAll("main *")) {
    const rc = el.getBoundingClientRect();
    if (rc.width <= 0 || rc.height <= 0) continue;
    if (el.closest(".sr-only")) continue;
    const cs = getComputedStyle(el);
    // 取「**自身直接持有非空文本节点**」的元素，而不是「没有子元素的元素」。
    //
    // 旧判据 `el.children.length === 0` 有个大洞：`<span><Icon/> 提示词库</span>` 这种
    // **图标 + 文字**的混排——本项目按钮几乎全长这样——因为有子元素而被整个跳过，
    // 它的字号与字重根本没进统计。这不是小概率边角：一次注入验证（往 StatRow 里塞
    // font-medium）门没红，查下去正是撞在这个洞上。**注入不红时先怀疑门，别先信门。**
    //
    // 只认「直接」文本节点，因此纯容器不会把后代的文字重复计一遍。
    const ownsText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.nodeValue || "").trim());
    if (ownsText) {
      fs.add(cs.fontSize);
      fw.add(cs.fontWeight);
    }
    const r = cs.borderTopLeftRadius;
    // rounded-full 会被算成一个巨大的 px 值（9999px 级），它是「胶囊」形态而非某一档半径，
    // 单列不计入档位数——否则每个圆头按钮都会把圆角档数顶掉一格。
    if (r && r !== "0px" && parseFloat(r) < 1000) rd.add(r);
  }
  return { fontSizes: [...fs].sort(), radii: [...rd].sort(), weights: [...fw].sort() };
};

async function main() {
  console.log(`字阶 / 圆角 / 字重收敛门 · BASE=${BASE}`);
  let base;
  try { base = JSON.parse(readFileSync(BASELINE, "utf8")); } catch { base = null; }

  const measured = {};
  const publicReady = {};
  const browser = await chromium.launch();
  try {
    // 门户页：不登录、不装假时钟、先解锁再量（理由见 PUBLIC_PAGES 注释）
    for (const entry of PUBLIC_PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      await page.goto(`${BASE}${entry.path}`, { waitUntil: "networkidle", timeout: 45000 });
      await page.waitForTimeout(1200);
      try {
        if (entry.prepare) await entry.prepare(page);
        publicReady[entry.path] = entry.assertReady ? await entry.assertReady(page) : { ok: true, why: "" };
      } catch (e) {
        // 解锁失败要变成一条红断言，而不是让整门崩掉——崩掉会连已经量到的
        // 六个应用页一起丢，且「异常」比「FAIL」更容易被当成环境问题忽略过去。
        publicReady[entry.path] = { ok: false, why: `解锁交互异常：${e.message.split("\n")[0]}` };
      }
      measured[entry.path] = await page.evaluate(AUDIT);
      await ctx.close();
    }

    for (const entry of MATRIX) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      // 与其它门一致：固定时钟，避免宵禁遮罩污染度量
      await ctx.clock.install({ time: new Date("2026-07-27T14:00:00") });
      const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: entry.user, password: entry.pw } });
      if (!login.ok()) { check(`登录 ${entry.user}`, false, `status=${login.status()}`); await ctx.close(); continue; }
      const page = await ctx.newPage();
      for (const path of entry.pages) {
        await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45000 });
        await page.waitForTimeout(1200);
        measured[path] = await page.evaluate(AUDIT);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }

  // ── T0 门户页可测性：先证明「要测的东西真的在屏幕上」──────────────────
  // 这一条必须排在 T1/T2 前面：它们量到的数字是否有意义，取决于它是否通过。
  console.log("\nT0 · 门户页可测性（防真空：不先解锁，量到的只有左半屏）");
  for (const [path, r] of Object.entries(publicReady)) {
    check(`${path} 解锁后表单可见`, r.ok, r.why);
  }

  // ── T1 字重：硬上限，无棘轮 ───────────────────────────────────────────
  console.log("\nT1 · 字重档位（400/600/700 硬上限——过渡期已结束，500 不再放行）");
  for (const [path, m] of Object.entries(measured)) {
    const bad = m.weights.filter((w) => !INTERIM_WEIGHTS.has(w));
    const offTarget = m.weights.filter((w) => !TARGET_WEIGHTS.has(w));
    check(
      `${path} 字重仅用 400/600/700`,
      bad.length === 0,
      bad.length ? `越界 ${bad.join(",")}` : `${m.weights.join(",")}${offTarget.length ? ` · 距目标还差：${offTarget.join(",")} 待并档` : " · 已达目标三档"}`,
    );
  }

  // ── T2 字号档 / 圆角档：棘轮（目标 ≤7 / 两档，现实还差得远）──────────────
  console.log("\nT2 · 字号档与圆角档（棘轮：只许降不许升；目标 字号 ≤7 / 圆角 ≤2）");
  let improved = false;
  for (const [path, m] of Object.entries(measured)) {
    const prev = base?.pages?.[path];
    const fsN = m.fontSizes.length, rdN = m.radii.length;
    if (prev) {
      check(`${path} 字号档 ≤ 基线 ${prev.fontSizes}`, fsN <= prev.fontSizes, `实测 ${fsN}${fsN <= 7 ? "（已达目标）" : ""}`);
      check(`${path} 圆角档 ≤ 基线 ${prev.radii}`, rdN <= prev.radii, `实测 ${rdN}${rdN <= 2 ? "（已达目标）" : ""}`);
      if (fsN < prev.fontSizes || rdN < prev.radii) improved = true;
    } else {
      console.log(`  [BASE] ${path} 字号 ${fsN} / 圆角 ${rdN} — 首次记录`);
      improved = true;
    }
  }

  if (improved) {
    console.log(`\n  ↓ 有下降或首次记录。`);
    if (process.env.UPDATE_TYPE_BASELINE === "1") {
      const next = {
        note: "字阶/圆角棘轮基线。目标：字号档 ≤7、圆角 ≤2（+pill 单列）。只许降不许升。",
        // 度量口径变更必须留痕：口径一改，前后数字就不再可比，
        // 「涨了」既可能是回流也可能是过去漏计。不写下来，下一个人只会看到一个莫名其妙变大的数。
        auditPredicate: "自身直接持有非空文本节点（含图标+文字混排）；旧口径为 children.length===0，漏计混排元素",
        recordedAt: new Date().toISOString().slice(0, 10),
        // **必须显式继承，不能靠从零构造。** knownFragility 记的是「某页档数为何会
        // 无故波动」这类只有踩过一次才写得出来的知识（当前那条是 growth 页空态）。
        // 写回逻辑原本整个对象重建，等于每锁一次基线就把它抹掉一次——而抹掉不会
        // 报错，下一个人只会看到一份干净得毫无历史的基线，然后重新踩一遍同一个坑。
        ...(base?.knownFragility ? { knownFragility: base.knownFragility } : {}),
        pages: {},
      };
      for (const [path, m] of Object.entries(measured)) {
        next.pages[path] = { fontSizes: m.fontSizes.length, radii: m.radii.length, fontSizeValues: m.fontSizes, radiiValues: m.radii };
      }
      writeFileSync(BASELINE, JSON.stringify(next, null, 2) + "\n");
      console.log("  已写回基线（UPDATE_TYPE_BASELINE=1）。");
    } else {
      console.log("  用 UPDATE_TYPE_BASELINE=1 npm run gate:type 锁定。");
    }
  }

  console.log("\nT3 · 当前实测明细（供下一批取靶）");
  for (const [path, m] of Object.entries(measured)) {
    console.log(`    ${path} — 字号 ${m.fontSizes.length}: ${m.fontSizes.join(" ")}`);
    console.log(`      圆角 ${m.radii.length}: ${m.radii.join(" ")}  字重: ${m.weights.join(",")}`);
  }

  console.log(`\n────────────────────────────────\n${results.length - failed}/${results.length} PASS${failed ? ` · ${failed} FAIL` : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("typography gate 异常：", e.message); process.exit(1); });
