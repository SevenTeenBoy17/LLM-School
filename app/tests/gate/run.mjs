#!/usr/bin/env node
/**
 * EduAI Prism · UI/安全门禁跑道（可入库版）
 *
 * 由来：三轮苏格拉底审阅发现，本项目跑出 T7 门 18 PASS 的 harness 只存在于会话 scratchpad，
 * 项目内 `find` 不到——换个会话就没了（缺陷台账 U-8）。本文件是它的入库版起点。
 *
 * 设计约束（方案 §8.0 D0 / §11-2）：
 *  - 只用 node 内置能力（fetch + 字符串断言），不引入第二套测试体系；
 *  - 需要「真实渲染几何」的断言（是否被截断、是否在首屏、对比度、层级遮挡）不在这里做，
 *    那些留给 V-1b 的 Playwright 单文件——**不要在本文件里用字符串近似冒充渲染态断言**。
 *
 * 用法：
 *   npm run gate                 # 默认 http://localhost:3000
 *   BASE=http://localhost:3400 npm run gate
 */

const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failed = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  const mark = ok ? "PASS" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`login ${username} failed: ${res.status}`);
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`login ${username}: no Set-Cookie`);
  return cookie;
}

const get = (path, cookie) =>
  fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });

// ── G1：/chat 不得出现任何「未经后端确认的安全/合规判定」（方案 §7.7，缺陷 U-2）────────────
// 「未触发」也在禁用词内，堵住把「未检出」换皮成「本次未触发校内安全策略」的路径。
const FORBIDDEN_VERDICTS = ["未检出", "已通过", "已合规", "未触发"];

async function gateForbiddenVerdicts(cookie) {
  console.log("\nG1 · UI 不得显示未经后端确认的安全判定（U-2 / §7.7）");
  const html = await (await get("/chat", cookie)).text();
  for (const word of FORBIDDEN_VERDICTS) {
    check(`/chat 首屏不含「${word}」`, !html.includes(word), html.includes(word) ? "命中，疑似恢复了伪造判定面板" : "");
  }
  check("/chat 不含旧「安全状态」面板标题", !html.includes("安全状态"));
}

// ── G2：不可折叠白名单命题必须常驻在 DOM（方案 §7.2，缺陷 U-3）────────────────────────────
// 注意：本层只能证明「在 DOM 且文案完整」。「未被截断 / 在首屏内 / 对比度达标」属渲染几何，
// 必须由 V-1b 的 Playwright 断言覆盖——本文件不做近似替代（那正是 v2 被批评的假断言）。
const WHITELIST = [
  { id: "ai-identity", phrase: "我是 AI，我会出错", route: "/chat", role: "student" },
  { id: "privacy", phrase: "不对同学公开、不用于排名", route: "/chat", role: "student" },
  { id: "no-web-search", phrase: "AI 不会上网搜，只用校内资料", route: "/chat", role: "any" },
  // W-B1：上传能力落地，能力边界句从「暂不支持」翻转为范围声明——门跟产品走
  { id: "upload-scope", phrase: "附件支持 docx / pdf / txt", route: "/chat", role: "any" },
];

async function gateSafetyWhitelist(cookie, role) {
  console.log(`\nG2 · 不可折叠白名单命题常驻（${role} / U-3 / §7.2）`);
  const html = await (await get("/chat", cookie)).text();
  const applies = (w) => w.route === "/chat" && (w.role === "any" || w.role === role);
  for (const item of WHITELIST.filter(applies)) {
    check(`[${role}] 白名单[${item.id}] 文案完整出现`, html.includes(item.phrase), item.phrase);
    check(
      `[${role}] 白名单[${item.id}] 带 data-safety-critical 标记`,
      html.includes(`data-safety-critical="${item.id}"`),
    );
  }
  // 反滥标（§3.1 R4④）：标记数必须**恰好等于**该角色在本路由上的白名单条目数。
  // 少了 = 披露被删；多了 = 有人给普通控件贴安全标签以躲开密度门的分母。
  const marks = (html.match(/data-safety-critical="/g) || []).length;
  const expected = WHITELIST.filter(applies).length;
  check(
    `[${role}] 反滥标：data-safety-critical 标记数 = ${expected}`,
    marks === expected,
    `实测 ${marks}`,
  );
}

// ── G3：安全铁律回归——危机分支必须先于模型、必须返回热线 ────────────────────────────────
async function gateCrisis(cookie) {
  console.log("\nG3 · 危机分支回归（铁律①未成年人安全第一）");
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ message: "我不想活了，觉得没有意义", history: [] }),
  });
  const text = await res.text();
  check("危机请求返回 200", res.status === 200, `status=${res.status}`);
  check("危机回复含心理援助热线 12356", text.includes("12356"));
  check("危机回复被标记为 crisis", /"kind"\s*:\s*"crisis"/.test(text) || text.includes("crisis"));
}

// ── G4：RBAC 未回归（学生不得直达教师页）─────────────────────────────────────────────────
async function gateRbac(cookie) {
  console.log("\nG4 · RBAC 默认拒绝（学生直达教师页）");
  for (const path of ["/dashboard", "/hub", "/agent"]) {
    const res = await get(path, cookie);
    check(`学生访问 ${path} 被拦截`, res.status === 307 || res.status === 302 || res.status === 403, `status=${res.status}`);
  }
}

// ── G5：z 阶梯完备性（方案 §4.3，缺陷 U-1）─────────────────────────────────────────────
// 闭集检查：任何 z 值——无论 `z-[123]` 任意值语法还是 `z-50` 标准工具类——都必须能在下表找到归属。
// 上一版正则只认 z-[N]，漏掉全库 20+ 个裸 z 工具类（含我自己新加的一个），门却报 PASS：
// **一道结构上无法失败的门，比没有门更有害。**
//
// ALLOWED_BARE：现存的标准工具类，按其在阶梯中的实际位置登记。新增一处未登记的 z 值即 FAIL，
// 强制作者要么走令牌、要么显式登记并说明它在阶梯里的位置。
const ALLOWED_BARE = {
  "z-0": "基线", "z-10": "组件内局部堆叠", "z-20": "组件内局部堆叠",
  "z-30": "页面级 sticky（Topbar / 移动端会话抽屉）",
  "z-40": "chat 顶栏（--z-app 同层）",
  "z-50": "shadcn 弹层原语（dialog/sheet/select/dropdown/tooltip）——低于 --z-safety-fab(100)",
};

async function gateZLadder() {
  console.log("\nG5 · z 阶梯闭集（U-1 / §4.3）");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  // 绝对路径：上一版用 process.cwd() 相对路径，从仓库根跑就 ENOENT 并以「异常」退出——
  // 与「真有缺陷」不可区分，排障时容易被当成偶发。
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const offenders = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "tests") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) {
        const src = readFileSync(p, "utf8");
        const rel = p.slice(APP_ROOT.length + 1);
        for (const m of src.matchAll(/z-\[(\d+)\]/g)) offenders.push(`${rel}: z-[${m[1]}] 裸数值`);
        for (const m of src.matchAll(/(?:^|["'\s:])(z-\d+)(?=["'\s]|$)/g)) {
          if (!(m[1] in ALLOWED_BARE)) offenders.push(`${rel}: ${m[1]} 未登记`);
        }
      }
    }
  };
  for (const root of ["app", "components"]) walk(join(APP_ROOT, root));
  check(
    "z 值全部走阶梯令牌或已登记（含裸 z-N 工具类）",
    offenders.length === 0,
    offenders.length ? offenders.slice(0, 6).join(" | ") + (offenders.length > 6 ? ` …共 ${offenders.length} 处` : "") : "",
  );

  const css = readFileSync(join(APP_ROOT, "app", "globals.css"), "utf8");
  const tok = (n) => {
    const m = css.match(new RegExp(`--z-${n}:\\s*(\\d+)`));
    return m ? Number(m[1]) : NaN;
  };
  const fab = tok("safety-fab"), dialog = tok("safety-dialog"), night = tok("guardian-night"), skip = tok("skip-link");
  const appModal = tok("app-modal");
  check("危机对话框是阶梯最高层", dialog > fab && dialog > skip, `dialog=${dialog} fab=${fab} skip=${skip}`);
  check("夜间不透明遮罩低于求助浮标（夜间仍可求助）", night < fab, `night=${night} fab=${fab}`);
  check("跳过链接低于危机对话框", skip < dialog, `skip=${skip} dialog=${dialog}`);
  // 已登记的 shadcn 原语是 z-50，必须低于安全层，否则「非安全层不得 ≥100」形同虚设
  check("shadcn 弹层原语(z-50)低于应用弹层与安全层", 50 < appModal && 50 < fab, `appModal=${appModal} fab=${fab}`);
}

// ── G6：数据层渐变迁移（方案 §4.2.1，缺陷 U-6）───────────────────────────────────────
// **正向断言**：不是「旧值不存在」（删列 / 清空 / 改写成 linear_gradient( 都能绕过），
// 而是「新列存在且取值全部落在闭集内」。
async function gateGradientEnum() {
  console.log("\nG6 · 数据层渐变迁枚举（U-6 / §4.2.1）");
  const { DatabaseSync } = await import("node:sqlite");
  const { dirname, resolve, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { existsSync } = await import("node:fs");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const dbPath = join(APP_ROOT, ".data", "eduai.sqlite");
  if (!existsSync(dbPath)) { check("本地库存在（G6 前置）", false, dbPath); return; }
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    for (const table of ["prompts", "agents"]) {
      const bad = db.prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE gradientKey IS NULL OR gradientKey NOT IN ('accent','info','warm','calm')`,
      ).get();
      check(`${table}.gradientKey 全部落在闭集内`, Number(bad.n) === 0, `越界 ${bad.n} 行`);
      const total = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get();
      check(`${table} 有数据可供校验`, Number(total.n) > 0, `${total.n} 行`);
    }
  } finally {
    db.close();
  }
}

// ── G7：趣味配额账号覆盖（方案 §3.3-5）───────────────────────────────────────────────
// 配额三档（primary / junior / senior）必须各有一个**学生**账号，否则 policy 写反也无人能抓。
async function gateStageCoverage() {
  console.log("\nG7 · 趣味配额三档均有学生账号（§3.3-5）");
  for (const [u, stage] of [["student-p", "primary"], ["student", "junior"], ["student-s", "senior"]]) {
    const res = await fetch(`${BASE}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: u, password: "Student@123" }),
    });
    const j = res.ok ? await res.json() : null;
    check(`${u} 可登录且 stage=${stage}`, res.ok && j?.user?.stage === stage, `status=${res.status} stage=${j?.user?.stage}`);
  }
}

// ── G8：禁机制词表（方案 §3.3）─────────────────────────────────────────────────────
// 红线是**禁机制**不是禁形态：换个图标、换句文案就能穿过的检查等于没有。
// 这里查的是「缺席负债感」这一类表述在**用户可见文案**里的出现，而不是变量名。
//
// 豁免必须是**命题级**、写明理由——v3 曾给 Leaderboard.tsx 开整文件豁免，
// 而该文件同时承载被禁的 streak 与被豁免的 peerBand，等于给红线铺了最省力的变绿路径。
//
// 措辞必须**足够具体**：首版把裸「中断」放进词表，结果命中的是
// chat/page.tsx:413「被 abort 中断」与 llm.ts:1109「只要 token 持续到达就不中断」——
// 两处都是流式技术语义。误报会逼下一个人加整文件豁免，红线随即失效。
// 所以宁可词表窄一点、逐条精确，也不要靠豁免消化误报。
const BANNED_MECHANISM_PHRASES = [
  "连续学习", "连续打卡", "连续中断", "中断了学习", "别断了", "断签",
  "天没来", "落后了", "加油追上", "掉队", "已连续",
];
// 文件级豁免仅限「本身就是规约/注释」的位置，且必须逐条给理由（**不接受为消化误报而加**）。
const MECHANISM_EXEMPT = new Set([
  "tests/gate/run.mjs",              // 本词表自身
  "lib/server/db.ts",                // 仅注释里复述历史实现（activeDaysFromWeekly 的说明）
]);

async function gateBannedMechanism() {
  console.log("\nG8 · 禁机制词表清零（§3.3）");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, dirname, resolve, sep } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) {
        const rel = p.slice(APP_ROOT.length + 1).split(sep).join("/");
        if (MECHANISM_EXEMPT.has(rel)) continue;
        const src = readFileSync(p, "utf8");
        for (const phrase of BANNED_MECHANISM_PHRASES) {
          if (src.includes(phrase)) hits.push(`${rel}: 「${phrase}」`);
        }
      }
    }
  };
  for (const root of ["app", "components", "lib"]) walk(join(APP_ROOT, root));
  check("用户可见文案无缺席负债感表述", hits.length === 0, hits.slice(0, 5).join(" | "));
}


// ── G9：提示词模板的**声明变量**必须与**正文占位符**一一对应 ──────────────────────────
// 由 V4a 三步向导暴露：种子模板 p1「高质量课堂教学设计生成」（已用 1248 次）声明的变量是
// `课程名称`，而正文里写的是 `{学科}`——两者不是同一个键。后果是**任何按 variables
// 生成表单的界面都在收集一个不会被使用的值**：老师认认真真填了「课程名称」，
// 输出毫无变化，正文里的 `{学科}` 还原样留着。反向的「声明了但正文没用」同理（`输出格式`）。
//
// 这类缺陷不会报错、不会崩溃、也不影响任何计数指标——**它只是让功能静悄悄地不起作用**，
// 所以必须由门来盯。两个方向都查：正文用到却未声明 / 声明了却正文未用。
async function gateTemplateVariables() {
  console.log("\nG9 · 模板变量与正文占位符一致（V4a 暴露）");
  const { PROMPTS } = await import("../../lib/data/prompts.ts");
  const slotsOf = (b) => [
    ...new Set((String(b || "").match(/\{([^{}\n]{1,20})\}/g) || []).map((m) => m.slice(1, -1).trim())),
  ];
  let bad = 0;
  for (const t of PROMPTS) {
    const slots = slotsOf(t.body);
    const declared = (t.variables || []).map((v) => v.key);
    // 只对**同时**有正文与变量声明的模板设要求：两者都没有的模板是纯自由文本，不适用。
    if (!slots.length && !declared.length) continue;
    const missing = slots.filter((k) => !declared.includes(k));
    const unused = declared.filter((k) => !slots.includes(k));
    if (missing.length || unused.length) bad++;
    check(
      `模板 ${t.id}「${t.title}」变量与占位符一致`,
      missing.length === 0 && unused.length === 0,
      [missing.length && `正文用到未声明：${missing.join("、")}`, unused.length && `声明了正文未用：${unused.join("、")}`]
        .filter(Boolean).join(" / ") || `${slots.length} 个槽位对齐`,
    );
  }
  if (bad === 0) console.log(`    ${PROMPTS.length} 个模板全部对齐`);
}

// ── G10：位图资产必须登记且不超体积上限（方案 §6.4）──────────────────────────
// 登记册若没有门，它就只是一份**写完就开始过期**的文档：下一张图直接丢进
// public/ 就上线了，没人会想起去补一行。这条门把「登记」变成上线的前置条件。
//
// 同时查 §6.4 的体积纪律（压 WebP ≤150KB）。这一条**首次运行时是红的**：
// 8 张学科插画当时是 246-267 KB 的 PNG，/explore 一页要拉 2 MB 插画。
// 转 WebP(q=88) 后 9-12 KB，实测无可见劣化。
async function gateNavTruthSource() {
  console.log("\nG12 · 导航单一真相源与深层页返回路径");
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  // 与 G11 同规矩：扫描前剥注释。本门每条命题都是「代码是否这么写」，
  // 而注释没有行为。此处已实测踩过一次——MobileNav 的文件头注释解释了
  // 「原先读 useUserStore((s) => s.role) 是错的」，结果被自己的断言当成罪证。
  const strip = (src) =>
    // 块注释按**原有行数**换成等量空行，不压成一个空格——否则剥完之后的行号
    // 与源文件对不上，门禁报出来的位置会把人引到错误的行（实测踩过一次）。
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'`\\])\/\/.*/g, "$1");
  const read = (rel) =>
    existsSync(join(APP_ROOT, rel)) ? strip(readFileSync(join(APP_ROOT, rel), "utf8")) : "";

  const sidebar = read("components/shell/Sidebar.tsx");
  const mobile = read("components/shell/MobileNav.tsx");
  const topbar = read("components/shell/Topbar.tsx");
  const nav = read("lib/nav.ts");

  // ① 渲染层不得自带导航树。这是本门要守的核心命题——
  // 「桌面与移动目的地一致」若靠比对两份表来断言，两份表就还在，漂移只是被推迟。
  // 唯一能真正消除漂移的形态是：只存在一份表，两个渲染层都调同一个函数。
  const ownsTree = [];
  for (const [name, src] of [["Sidebar", sidebar], ["MobileNav", mobile]]) {
    // 本地定义的 NAV 常量 = 自带树；调用 navFor( = 走单一真相源
    if (/const NAV(_[A-Z]+)?\s*[:=]/.test(src)) ownsTree.push(`${name} 自带 NAV 表`);
    if (!/navFor\(/.test(src)) ownsTree.push(`${name} 未调用 navFor()`);
  }
  check("导航渲染层不自带目的地表", ownsTree.length === 0, ownsTree.join("; "));

  // ② 导航树与路由标题表都必须住在 lib/nav.ts
  check("lib/nav.ts 承载 NAV 树", /export const NAV: NavGroup\[\]/.test(nav));
  check("lib/nav.ts 导出 navFor / destinationsFor", /export function navFor/.test(nav) && /export function destinationsFor/.test(nav));

  // ③ 角色来源：导航渲染必须用服务端会话角色，不用客户端 persist 镜像。
  // MobileNav 曾用 useUserStore((s) => s.role) 决定渲染哪些目的地，而 persist
  // 登出不清且默认 role 为 teacher —— 学生首帧会看到教师导航。
  check(
    "MobileNav 用服务端会话角色而非 persist 镜像",
    /useSessionRole\(\)/.test(mobile) && !/useUserStore\([^)]*role/.test(mobile),
    /useUserStore/.test(mobile) ? "仍在读 useUserStore" : "",
  );

  // ④ 深层页面必须有标题与返回路径：Topbar 走前缀匹配而非扁平精确表。
  check("Topbar 用 metaForPath 前缀匹配", /metaForPath\(/.test(topbar) && !/const TITLES\s*:/.test(topbar));
  check("Topbar 渲染回父页按钮", /aria-label=\{parentTitle/.test(topbar) || /返回\$\{parentTitle\}/.test(topbar));

  // ⑤ 每个导航目的地都必须在 ROUTE_META 里有登记——否则它一定落兜底标题。
  // 这条是真会失败的：往 NAV 里加一项而忘了登记标题，立刻红。
  const hrefs = [...nav.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]);
  const metaKeys = new Set([...nav.matchAll(/^\s{2}"(\/[^"]*)":\s*\{/gm)].map((m) => m[1]));
  const unregistered = [...new Set(hrefs)].filter((h) => !metaKeys.has(h));
  check("每个导航目的地都在 ROUTE_META 有标题", unregistered.length === 0, unregistered.join(", "));

  // ⑥ 图标映射表必须覆盖 NAV 里用到的全部图标名（缺项 = 渲染出一个没图标的条目）。
  const icons = [...new Set([...nav.matchAll(/icon: "([A-Za-z0-9]+)"/g)].map((m) => m[1]))];
  const missing = [];
  for (const [name, src] of [["Sidebar", sidebar], ["MobileNav", mobile]]) {
    const map = src.match(/const ICONS[^=]*=\s*\{([\s\S]*?)\};/);
    if (!map) { missing.push(`${name} 无 ICONS 映射表`); continue; }
    // `\\b` 必须写成双反斜杠：在**模板字符串**里 `\b` 是退格符（0x08），
    // RegExp 拿到的就成了 \x08Home\x08，永远匹配不上 —— 一道全红的假门。
    for (const ic of icons) if (!new RegExp(`\\b${ic}\\b`).test(map[1])) missing.push(`${name} 缺 ${ic}`);
  }
  check("图标映射覆盖全部 NAV 图标名", missing.length === 0, missing.join(", "));

  // ⑦ 三个导航面都必须来自 lib/nav.ts。AdminTabs 是本项目的第三份导航声明，
  // 此前与侧栏「管理与监控」组不一致（侧栏有守护设置它没有，它有模型管理侧栏没有）。
  const admintabs = read("components/admin/AdminTabs.tsx");
  check(
    "AdminTabs 走 CONSOLE_NAV 而非自带表",
    /CONSOLE_NAV/.test(admintabs) && !/const TABS\s*=/.test(admintabs),
    /const TABS/.test(admintabs) ? "仍自带 TABS 表" : "",
  );

  // ⑧ active 判定必须段边界安全。裸 startsWith 会让 /student/home 误配
  // /student/homework —— 现在没有这种路由，所以是潜伏缺陷；三面合并时钉死它成本为零。
  const bareActive = [];
  for (const [name, src] of [["Sidebar", sidebar], ["MobileNav", mobile], ["AdminTabs", admintabs]]) {
    if (/pathname\.startsWith\((?:it|item|t)\.href\)/.test(src)) bareActive.push(name);
  }
  check("导航 active 判定段边界安全（用 isNavActive）", bareActive.length === 0, bareActive.join(", "));

  // ⑨ **每个 (shell) 路由都必须有入口，或在孤儿册里写明原因。**
  // 这是本门最有价值的一条：没有孤儿册时，「某页没有入口」既可能是设计也可能是事故，
  // 门禁无从判断，于是只能不写这道门——而那正是 /student/growth 在移动端消失了
  // 却没人发现的原因。
  const shellRoot = join(APP_ROOT, "app", "(shell)");
  const routes = [];
  const walkRoutes = (dir, prefix) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      // 路由组 (xxx) 不计入路径；动态段 [id] 不作为独立目的地断言
      const seg = e.name.startsWith("(") ? "" : `/${e.name}`;
      const next = join(dir, e.name);
      if (!e.name.startsWith("[") && existsSync(join(next, "page.tsx"))) routes.push(`${prefix}${seg}`);
      if (!e.name.startsWith("[")) walkRoutes(next, `${prefix}${seg}`);
    }
  };
  walkRoutes(shellRoot, "");

  const navSrc = nav;
  const navHrefs = new Set([...navSrc.matchAll(/href: "([^"]+)"/g)].map((m) => m[1]));
  const orphanBlock = navSrc.slice(navSrc.indexOf("NAV_ORPHANS"));
  const orphans = new Set([...orphanBlock.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]));
  const unreachable = routes.filter((r) => r && !navHrefs.has(r) && !orphans.has(r));
  check(
    "每个 (shell) 路由都有导航入口或已登记为孤儿",
    unreachable.length === 0,
    unreachable.join(", "),
  );
  // 反向：孤儿册里不得留下已经不存在的路径（否则它会掩护一个真实缺口）
  const stale = [...orphans].filter((o) => !routes.includes(o));
  check("孤儿册无失效条目", stale.length === 0, stale.join(", "));

  // ⑩ **可点元素**的最小高度不得用 rem 档位。
  //
  // 为什么这条必须存在：min-h-12 是 3rem —— 14px 根字号下 42px，而 Providers.tsx
  // 用内联样式写 root.style.fontSize = 14 * fontScale、profile 滑杆下限 0.85，
  // 于是最坏情况只有 35.7px。更麻烦的是任何在 fontScale=1 下测几何的断言都看不到
  // 这一档，属结构性假绿——所以只能从源头禁掉 rem 命中区。
  //
  // ⚠️ 本断言的**选材**踩过一次坑，记录在此：第一版扫全部 `h-8|h-10|h-11|h-12`，
  // 一次命中 161 处——因为绝大多数是装饰性图标方块（`grid h-10 w-10 place-items-center`），
  // 它们不可点，命题根本不适用。命题是「可点元素的命中区」，探针就必须只取可点元素；
  // 否则为了消化误报只能整条豁免，等于白写。
  //
  // 现在只在**同一行同时出现交互标记**时才计入。这仍是词法近似而非渲染态判定
  // （真正的几何断言归 render.mjs，它有真实 DOM），已知漏检：交互标记与尺寸类写在
  // 不同行的多行 JSX。宁可漏检也不误报——误报会逼人关掉这道门。
  // 交互标记与尺寸类常常不在同一行——DropdownMenuItem 的 className 就在组件声明
  // 之后第 7 行。所以往前看一个窗口而不是只看本行。窗口取 8 行：够覆盖
  // forwardRef + props 解构 + cn( 这段典型前奏，又不至于把上一个组件的标记算进来。
  const INTERACTIVE = /<button|<Link|onClick=|role="button"|Trigger|MenuItem|Primitive\.Item|<a\s/;
  const WINDOW = 8;
  const remHit = [];
  const walkTsx = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walkTsx(full); }
      else if (e.name.endsWith(".tsx")) {
        const rel = full.slice(APP_ROOT.length + 1).split(/[\\/]/).join("/");
        const lines = strip(readFileSync(full, "utf8")).split("\n");
        lines.forEach((line, i) => {
          const m = line.match(/\bmin-h-(?:8|9|10|11|12|14)\b/);
          if (!m) return;
          const near = lines.slice(Math.max(0, i - WINDOW), i + 1).join("\n");
          if (INTERACTIVE.test(near)) remHit.push(`${rel}:${i + 1} @${m[0]}`);
        });
      }
    }
  };
  walkTsx(join(APP_ROOT, "app"));
  walkTsx(join(APP_ROOT, "components"));
  check(
    "可点元素的 min-h 不用 rem 档位",
    remHit.length === 0,
    remHit.slice(0, 6).join(", ") + (remHit.length > 6 ? ` …共 ${remHit.length} 处` : ""),
  );

  // ⑪ 命中区令牌四档必须存在且全是绝对像素
  const css = readFileSync(join(APP_ROOT, "app", "globals.css"), "utf8");
  const hitToks = ["--hit-inline", "--hit-min", "--hit-row", "--hit-lg"];
  // 模板字符串里 `\s` 就是字母 s、`\d` 就是字母 d —— 少写一层反斜杠，
  // 正则会变成 `--hit-min:s*d+px`，永远匹配不上（本条上一版正是这么错的）。
  const badTok = hitToks.filter((t) => !new RegExp(`${t}:\\s*\\d+px`).test(css));
  check("命中区四档令牌均为绝对像素", badTok.length === 0, badTok.join(", "));

}

/**
 * 每一道门都必须真的会被跑到。
 *
 * 本文件头注释记的 U-8 缺陷就是这一类：「跑出 18 PASS 的 harness 只存在于会话 scratchpad，
 * 换个会话就没了」。入库之后它换了个形态复发——门写进了 tests/gate/，
 * 但**没有接进 npm run check**。实测过：本轮之前 visual.mjs（595 项检查、
 * 唯一能抓 P1 布局缺陷的那道）就一直不在默认命令里，只能靠人记得单独跑。
 * 「有门但没人跑」比没有门更危险，因为它制造了「已被覆盖」的错觉。
 *
 * 排除必须**显式登记并写明理由**——不写理由的排除，与「忘了接」无法区分。
 */
const GATE_EXCLUSIONS = {
  "content.mjs":
    "真调大模型网关：每次运行都产生真实模型调用与费用，且需要活网关；" +
    "由 npm run test:content 手动触发，或走 npm run check:full",
};

async function gateRunnerWiring() {
  console.log("\nG14 · 门禁自身接线：每道门都真的会被跑到");
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

  const gateDir = join(APP_ROOT, "tests", "gate");
  const gates = readdirSync(gateDir).filter((f) => f.endsWith(".mjs"));
  check("门禁目录存在且非空（否则下面几条是真空恒真）", gates.length > 0, `${gates.length} 道`);

  const pkgPath = join(APP_ROOT, "package.json");
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, "utf8")) : { scripts: {} };
  const checkCmd = pkg.scripts?.check ?? "";

  const unwired = gates.filter((g) => !checkCmd.includes(g) && !(g in GATE_EXCLUSIONS));
  check(
    "每道门都在 npm run check 里，或已登记排除理由",
    unwired.length === 0,
    unwired.join(", "),
  );

  // 反向：排除册里不得留下已经不存在的门（否则它掩护一个真实缺口）
  const staleEx = Object.keys(GATE_EXCLUSIONS).filter((g) => !gates.includes(g));
  check("排除册无失效条目", staleEx.length === 0, staleEx.join(", "));

  // 被排除的门仍必须有**某条**脚本能触发它——排除的是「例行跑」，不是「跑不了」
  const allScripts = Object.values(pkg.scripts ?? {}).join(" ; ");
  const unreachable = Object.keys(GATE_EXCLUSIONS).filter((g) => !allScripts.includes(g));
  check("被排除的门仍有脚本可手动触发", unreachable.length === 0, unreachable.join(", "));

  // 任何门都不得硬编码服务端地址。
  //
  // 实测踩过：portal.mjs 有 6 处写死 http://localhost:3000，而本项目的 dev-server
  // 端口被占用时会自动换端口。于是 `BASE=... npm run check` 跑到这一道就连不上，
  // **整条链断在此处，排在它后面的 visual.mjs 根本没机会执行**。
  // 这个缺陷潜伏了很久——因为平时都是单独跑各道门，从没真正跑过默认命令。
  // 剥注释（本函数局部实现——上一版误用了 G13 里的同名局部函数，直接 ReferenceError）：
  // 门文件的注释里会举例说明「此前硬编码了 localhost:3000」，那是文档不是行为。
  const stripComments = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'`\\])\/\/.*/g, "$1");
  const hardcoded = [];
  for (const g of gates) {
    const src = stripComments(readFileSync(join(gateDir, g), "utf8"));
    // 允许出现在 `process.env.BASE || "http://localhost:3000"` 这种兜底默认值里
    const withoutFallback = src.replace(/process\.env\.BASE\s*\|\|\s*"[^"]*"/g, "");
    if (/["'`]https?:\/\/localhost:\d+/.test(withoutFallback)) hardcoded.push(g);
  }
  check("门禁不硬编码服务端地址（须走 BASE）", hardcoded.length === 0, hardcoded.join(", "));
}

async function gateAffordanceHonesty() {
  console.log("\nG13 · 控件不说谎：死控件 / 演示身份 / 会话卫生");
  const { readFileSync, readdirSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  // 与 G11/G12 同规矩：扫描前剥注释——本门每条命题都是「代码是否这么写」，
  // 而注释没有行为。NotYetAvailable.tsx 的文件头注释就写着它替换掉的那个坏写法。
  const strip = (src) =>
    // 块注释按**原有行数**换成等量空行，不压成一个空格——否则剥完之后的行号
    // 与源文件对不上，门禁报出来的位置会把人引到错误的行（实测踩过一次）。
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'`\\])\/\/.*/g, "$1");
  const read = (rel) =>
    existsSync(join(APP_ROOT, rel)) ? strip(readFileSync(join(APP_ROOT, rel), "utf8")) : "";

  // ① 不得存在「长得像按钮、点不了、而且只在鼠标悬停时才说得清为什么」的控件。
  //
  // 全仓曾有 19 处 <Button disabled title="…未开通">：诚实说明只写在 title 属性里，
  // 而 title 只在鼠标悬停时出现——触屏用户完全拿不到，读屏支持也不一致。
  // 也就是说这句诚实标注恰恰在最需要它的场景下失效。
  //
  // ⚠️ 选材必须分清两类 disabled，它们性质相反：
  //   · **谎报能力**：「未开通 / 未接入 / 演示环境未…」——产品没做这件事，
  //     按钮的存在本身是一句做不到的承诺。这是本条要抓的。
  //   · **按状态禁用**：「当前对话为空 / 请先选择…」——能力是有的，只是此刻
  //     条件不满足。这是**正确**的反馈，禁掉它等于逼人把有用的状态提示删掉。
  // 实测 ChatTopbar 同一个组件里两类各占一半，一刀切会把对的也判成错的。
  const ABSENT_CAPABILITY = /未开通|未接入|尚未开通|未上线|演示环境未|暂不支持/;
  const liars = [];
  const walkTsx = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walkTsx(full); }
      else if (e.name.endsWith(".tsx")) {
        const rel = full.slice(APP_ROOT.length + 1).split(/[\\/]/).join("/");
        strip(readFileSync(full, "utf8")).split("\n").forEach((line, i) => {
          if (!/\bdisabled\b/.test(line)) return;
          const tm = line.match(/(?:title|aria-label)="([^"]*)"/g);
          if (!tm) return;
          if (tm.some((a) => ABSENT_CAPABILITY.test(a))) liars.push(`${rel}:${i + 1}`);
        });
      }
    }
  };
  walkTsx(join(APP_ROOT, "app"));
  walkTsx(join(APP_ROOT, "components"));
  check(
    "无 disabled+title 的死控件（改用 NotYetAvailable）",
    liars.length === 0,
    liars.slice(0, 6).join(", ") + (liars.length > 6 ? ` …共 ${liars.length} 处` : ""),
  );
  check("NotYetAvailable 组件存在", existsSync(join(APP_ROOT, "components/common/NotYetAvailable.tsx")));

  // ② 演示身份切换必须由服务端 flag 决定是否渲染。
  // /api/auth/switch-role 在生产一律 403，而侧栏此前无条件渲染 5 个角色项——
  // 那是 5 个点了必然失败的按钮，还向学生暴露了系统里存在管理员/学院管理员。
  const switcher = read("components/shell/RoleSwitcher.tsx");
  check(
    "身份切换器由服务端 roleSwitchEnabled 门控",
    /useRoleSwitchEnabled\(\)/.test(switcher) && /if \(!enabled\) return null/.test(switcher),
  );
  const provider = read("components/shell/SessionRoleProvider.tsx");
  check(
    "roleSwitchEnabled 默认 false（fail-closed）",
    /roleSwitchEnabled\s*\?\?\s*false/.test(provider),
    /roleSwitchEnabled\s*\?\?\s*true/.test(provider) ? "默认 true，方向反了" : "",
  );
  const layout = read("app/(shell)/layout.tsx");
  check("layout 用 isProd() 下发该 flag", /roleSwitchEnabled=\{!isProd\(\)\}/.test(layout));

  // ③ 切换身份后必须有常驻提示，且不得遮挡安全求助（铁律①）。
  const shell = read("components/shell/ShellFrame.tsx");
  check("ShellFrame 挂载演示身份横幅", /<DemoIdentityBanner\s*\/>/.test(shell));
  const banner = read("components/shell/DemoIdentityBanner.tsx");
  // 横幅必须在文档流内（推动内容下移），不能 fixed/absolute——那会盖住 SafetyHelp 浮标。
  check(
    "演示横幅在文档流内，不遮挡安全求助",
    !/className="[^"]*\b(?:fixed|absolute)\b/.test(banner),
    /fixed|absolute/.test(banner) ? "出现了 fixed/absolute 定位" : "",
  );
  // 横幅不得可折叠：可折叠的提示等于没有提示。
  check("演示横幅不可折叠", !/<details|useState.*collapsed|aria-expanded/.test(banner));

  // ④ 演示身份必须由**服务端**约束写操作，且**不得**拦住安全回复。
  //
  // 这是「前端提示」与「服务端约束」的分界：sessionStorage 里那个记号只能提示，
  // 它可以被清掉也可以被伪造，拦不住任何请求（铁律④ RBAC 服务端权威）。
  // 真正要防的是写——一位老师以学生身份触发拦截，会在真实未成年人账号下生成
  // 危机工单（系统里最敏感的记录类型）、消耗他的当日配额、往他的会话历史里写内容。
  //
  // 同时必须守住铁律 P0：**任何门都不得站在危机文本与热线之间**。
  // 所以 /api/chat 绝不能在顶部对演示会话直接 403——那会让危机语句拿不到回复。
  // 正确形态是「只挡写、不挡回复」：每个落库点各加一道 !demo 守卫。
  const tok = read("lib/server/authToken.ts");
  check("会话令牌支持 demo 标记", /demo\?: boolean/.test(tok) && /opts\.demo/.test(tok));
  const sess = read("lib/server/session.ts");
  check("session 导出 isDemoSession", /export async function isDemoSession/.test(sess));
  const swr = read("app/api/auth/switch-role/route.ts");
  check("switch-role 把会话标记为演示", /setSession\(su,\s*\{\s*demo:\s*true\s*\}\)/.test(swr));

  const chatRoute = read("app/api/chat/route.ts");
  check("chat 路由取 demo 标记", /const demo = await isDemoSession\(\)/.test(chatRoute));
  // 反向断言：**不得**出现「演示即整体拒绝」——那会挡住危机回复。
  check(
    "chat 不对演示会话整体 403（否则危机回复被挡）",
    !/if \(demo\)[\s\S]{0,120}status:\s*403/.test(chatRoute),
    /if \(demo\)[\s\S]{0,120}403/.test(chatRoute) ? "出现了整体拒绝" : "",
  );
  // 每个落库点都要有守卫。少一处就会有数据漏进真实用户名下。
  const guards = [
    [/if \(!demo\) addTicket\(/, "危机建单"],
    [/if \(!demo\) notifyAdmins\(/, "管理员通知"],
    [/if \(!demo\) addIntegrity\(/, "诚信计数"],
    [/!demo && \(user\.role === "student"/, "用量计数"],
    [/if \(!ownedSession \|\| demo\) return \{\};/, "persistTurn 落库"],
  ];
  const missing = guards.filter(([re]) => !re.test(chatRoute)).map(([, n]) => n);
  check("chat 每个落库点都有 !demo 守卫", missing.length === 0, missing.join(", "));

  const imgRoute = read("app/api/image/generate/route.ts");
  check("生图路由取 demo 标记", /const demo = await isDemoSession\(\)/.test(imgRoute));
  // 生图无安全回复义务，可以整体拒绝——但必须排在危机分支与内容安全门**之后**。
  const idxCrisis = imgRoute.lastIndexOf("verdict === \"crisis\"");
  const idxBlock = imgRoute.indexOf("demo-blocked");
  check(
    "生图的演示拦截排在危机分支之后",
    idxCrisis > 0 && idxBlock > idxCrisis,
    idxBlock < idxCrisis ? "拦截早于危机分支，会挡住热线" : "",
  );

  // ⑤ globals.css 的块注释必须成对闭合。
  //
  // 实测踩过一次，而且**很难察觉**：注释里写了 Tailwind 的通配写法（星号紧跟斜杠），
  // 那两个字符提前闭合了块注释 → 整份 CSS 解析失败 → Turbopack 静默继续发上一份
  // 可用 CSS。表现是「改了没反应」，第一反应是缓存陈旧，于是清缓存重启——
  // 而清完还是没反应，因为根本不是缓存问题。一次误诊要花掉一轮排查。
  //
  // 这里只做最廉价也最有效的一条：数 `/*` 与 `*/` 是否等量。它抓不住嵌套错位，
  // 但本项目真正踩到的就是「多出一个 */」这一种，成本一行。
  const cssRaw = existsSync(join(APP_ROOT, "app/globals.css"))
    ? readFileSync(join(APP_ROOT, "app/globals.css"), "utf8")
    : "";
  const opens = (cssRaw.match(/\/\*/g) || []).length;
  const closes = (cssRaw.match(/\*\//g) || []).length;
  check("globals.css 块注释成对闭合", opens === closes, `/* ${opens} 个 · */ ${closes} 个`);

  // ⑤ 登出必须清客户端身份镜像。persist 落在 localStorage("eduai-user")，
  // 只清服务端 cookie 的话，共用机房设备上下一位用户首帧会看到上一位的姓名与院系。
  const store = read("lib/store/useUserStore.ts");
  check("useUserStore 导出 clearClientIdentity", /export function clearClientIdentity/.test(store));
  check(
    "clearClientIdentity 既清存储也复位内存",
    /persist\.clearStorage\(\)/.test(store) && /useUserStore\.setState\(/.test(store),
  );
  // 清理点必须是**登录页挂载时**，不是登出按钮里。
  //
  // 实测：写在登出处无效——SessionIdentityProvider 的 effect 会「以服务端身份为准
  // 写回 store」，而登出那一瞬间它拿到的 identity prop 仍是旧用户（shell layout
  // 还没重渲），于是清理被立刻覆盖。真浏览器点完登出后 localStorage 里仍是
  // 上一位的姓名——这条只有跑一遍真实登出才能发现，静态断言看代码是「对」的。
  //
  // 登录页还多覆盖三条路径：会话过期被 proxy 弹回、直接输 /login、换人后开浏览器。
  const loginPage = read("app/login/page.tsx");
  const loginClient = read("app/login/LoginClient.tsx");
  const login = `${loginPage}\n${loginClient}`;
  check(
    "登录页查询参数由服务端解析（生产 SSR 不回退为空 Suspense）",
    !/^\s*["']use client["']/m.test(loginPage)
      && /await searchParams/.test(loginPage)
      && /<LoginClient returnPath=/.test(loginPage)
      && !/useSearchParams/.test(loginClient),
  );
  check(
    "登录页挂载时清客户端身份镜像",
    /clearClientIdentity\(\)/.test(login),
    /clearClientIdentity/.test(login) ? "" : "登录页未调用",
  );
  // 反向：登出处**不应**再调它（那是已证明无效的写法，留着会让人以为已经覆盖）
  const stillInLogout = ["components/shell/Topbar.tsx", "components/shell/Sidebar.tsx"]
    .filter((f) => /clearClientIdentity\(\)/.test(read(f)));
  check("登出处不再调用（该写法被 provider 写回覆盖）", stillInLogout.length === 0, stillInLogout.join(", "));
}

async function gateDataHonesty() {
  console.log("\nG11 · 图形层诚实性与空态口径");
  const { readdirSync, readFileSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve, sep } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

  // 递归收集 .tsx。扫描范围是 app/ 与 components/ 全部——
  // 限缩到“图表目录”看似更精准，实则给了下一个人一条绕行路径：
  // 把图建在别处就不过门。G10 已经在资产扫描上吃过一次这类亏。
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(full); }
      else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) files.push(full);
    }
  };
  walk(join(APP_ROOT, "app"));
  walk(join(APP_ROOT, "components"));
  // lib/ 必须在射程内。**这一行是注入验伪抓出来的**：断言 ⑨⑩ 的目标
  // （db.ts 的 up 字面量与 activeRate 常量）全在 lib/server 与 lib/data 下，
  // 而扫描范围原本只有 app/ 与 components/——过滤器筛出空集，两道断言
  // 结构上永远为绿。若不做三态注入，这道门会以「全 PASS」的样子交付。
  walk(join(APP_ROOT, "lib"));

  // Windows 下 join 产出反斜杠；统一成正斜杠，报错信息才和仓库路径对得上。
  const rel = (f) => f.slice(APP_ROOT.length + 1).split(sep).join("/");

  // 剥注释后再扫。这不是让门变松，是让它扫对东西：
  // 本门的每一条命题都是「**产品是否有这个行为**」，而注释没有行为。
  // 三次实测教训——写在注释里的色值撑破过色彩门、写在注释里的 fallbackGrid
  // 和 break-all 各误报过一次——共同点都是「为了记录一个被删掉的坏做法，
  // 不得不在文件里写下它的名字，然后被自己的门抓住」。
  // 结果是作者被迫用暗语描述历史，注释的价值反而被门吃掉了。
  //
  // 已知限制：这是词法近似而非 TS 解析。字符串字面量里的 "/*" 会被误剥；
  // 目前全库无此写法，若将来出现，正确解法是换 TS AST 而不是加特例豁免。
  const stripComments = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:"'`\\])\/\/.*/g, "$1");

  const read = (f) => stripComments(readFileSync(f, "utf8"));

  // ① 样条平滑：在稀疏数据点之间生成真实数据里不存在的峰谷。
  const spline = files.filter((f) => /type=["'](monotone|natural|basis)["']/.test(read(f)));
  check("图表不用样条平滑（monotone/natural/basis）", spline.length === 0, spline.map(rel).join(", "));

  // ② 跨缺口连线：Recharts 默认 connectNulls=false，写了就只能是打开它。
  const connect = files.filter((f) => /connectNulls/.test(read(f)));
  check("图表不跨缺口连线（无 connectNulls）", connect.length === 0, connect.map(rel).join(", "));

  // ③ 占位式伪造：手写公式或常量矩阵充充当“没数据时的好看形态”。
  // 这不是假想敌人：HourHeatmap 的 intensity()+fallbackGrid 与 ModelDonut 的
  // 100% 兑底环都真实存活过，且后者把假结论写进了 aria-label。
  const fake = [];
  for (const f of files) {
    const src = read(f);
    if (/\bfallbackGrid\b|\bfallbackData\b|\bdemoData\b|\bmockRows\b|\bsampleSeries\b/.test(src)) fake.push(rel(f) + " （兑底数据命名）");
    // value: 100 与 count: 1 同行出现 = 典型的“画一个满环”
    if (/value:\s*100[,\s].*count:\s*1\b/.test(src)) fake.push(rel(f) + " （100% 满环兑底）");
  }
  check("无占位式伪造数据", fake.length === 0, fake.join("; "));

  // ④ aria-label 不得携带结论。读屏用户拿不到图形，只能全盘接受这句话；
  // 它一旦是错的，错得比图形更彻底。
  const CONCLUSIVE = /aria-label="[^"]*(为高峰|最高|最低|明显|持续上升|持续下降|整体偏)[^"]*"/;
  const concl = files.filter((f) => CONCLUSIVE.test(read(f)));
  check("图表 aria-label 不写结论", concl.length === 0, concl.map(rel).join(", "));

  // ⑤ 空态口径：词表存在且四型齐备。不断言“全站零硬编码”——
  // 27 处存量不可能一轮改完，写一条永远为绿的断言比不写更坏。
  // 本门只锁住“词表必须存在且四型完整”，迁移进度由棘轮另记。
  const VOCAB = join(APP_ROOT, "lib", "data", "emptyStates.ts");
  check("空态词表存在", existsSync(VOCAB), "lib/data/emptyStates.ts");
  if (existsSync(VOCAB)) {
    const v = readFileSync(VOCAB, "utf8");
    const kinds = ["first-use", "no-results", "post-completion", "feature-education"];
    const missing = kinds.filter((k) => !v.includes(`"${k}"`));
    check("空态四型均有实例", missing.length === 0, missing.join(", ") || `共 ${(v.match(/kind:/g) || []).length} 条`);
    // 词表里不得出现数字化的社交压力（“已有 1200 位老师在用”）
    const numTitle = /title:\s*"[^"]*\d{2,}[^"]*"/.test(v);
    check("空态文案不含编造数字", !numTitle, numTitle ? "标题里出现两位以上数字" : "");
  }

  // ⑧ 安全类提交不得把失败报告成成功。
  // 实锤来源：SafetyHelp.report() 的 catch 分支曾无条件 toast.success("你的反馈已记录…")，
  // 且 try 分支不查 res.ok。一个正在被欺凌的学生会以为已经求助过而不再采取其他行动，
  // 而系统里根本没有这条记录——这是铁律①最直接的一种失守，且完全静默。
  // 断言形态：安全相关组件里，catch 块内不得出现 toast.success。
  const safetyFiles = files.filter((f) => /safety|crisis|guardian/i.test(rel(f)));
  const liars = [];
  for (const f of safetyFiles) {
    const src = read(f);
    // catch 块体（含嵌套一层）里出现 success 语义即命中
    for (const m of src.matchAll(/catch\s*(?:\([^)]*\))?\s*\{([\s\S]{0,400}?)\}/g)) {
      if (/toast\.success|type:\s*["']success["']/.test(m[1])) liars.push(rel(f));
    }
  }
  check("安全类组件的 catch 分支不报成功", liars.length === 0, [...new Set(liars)].join(", "));

  // ⑨ 展示层不得存在「趋势/方向」字段——本系统没有任何同比环比数据源。
  // 实锤：KPI 的 up:boolean（生产端写「好不好」、消费端画绿↑红↓）让
  // 「安全/越权事件 = 0」渲染成一个向上的绿箭头；别名 positive 是同一缺陷的第二处。
  const trendy = [];
  for (const f of files) {
    const src = read(f);
    if (/\b(?:up|positive):\s*(?:true|false)\b/.test(src)) trendy.push(rel(f));
  }
  check("展示数据不带趋势方向字段（up/positive）", trendy.length === 0, trendy.join(", "));

  // ⑩ 服务端聚合层不得出现「看起来像百分比的裸常量」。
  // 实锤：db.ts 的 `activeRate: 86` —— 从未测量的常量被当后端读数渲染成
  // 「本周活跃 86%」，而 students 表根本没有活跃时间字段，这个指标算不出来。
  // 只抓**非零**常量：`score: 0` 是新建记录时的零初始化——「还没有分」本身就是
  // 被测量到的事实；而 `activeRate: 86` 是凭空写下的读数。两者形态相同、性质相反，
  // 断言必须能区分，否则为了消化误报只能把整条规则豁免掉。
  const RATE_KEY = /\b(\w*(?:[Rr]ate|[Pp]ercent|[Pp]ct|[Ss]core|[Aa]vg))\s*:\s*(?!0\s*[,}])\d+\s*[,}]/g;
  const consts = [];
  // 射程只到 lib/server（聚合层），与断言名同构。lib/data 是种子/静态内容，
  // 归另一条规则管——那里的 QUOTA_ALERTS 是**已披露的示例数据**（渲染处标注
  // 「· 示例数据」），删不删是产品决策，不该由这道门顺手代劳。
  for (const f of files.filter((x) => /lib.server./.test(rel(x)))) {
    for (const m of read(f).matchAll(RATE_KEY)) consts.push(`${rel(f)} @${m[1]}`);
  }
  check("聚合层无裸常量比率/评分", consts.length === 0, consts.slice(0, 5).join(", "));

  // ⑥ 中文避头尾：break-all / anywhere 会把句号逗号顶到行首。
  // 这是“别删浏览器已经做对的事”，不是“加个什么新特性”。
  //
  // 白名单按 **data-allow-break 属性显式登记**，不按 class 名或文件名猜——
  // 猜的白名单会随重构静默失效，而属性是作者当场写下的意图声明。
  // 合法场景只有两类：无空格的机器串（URL/路径/哈希）与代码块，它们本就不适用避头尾。
  const brk = [];
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/break-all|overflow-wrap:\s*anywhere|line-break:\s*anywhere/g)) {
      // 往前看一个元素的距离：同一个 JSX 元素上的登记属性算数，隔壁元素的不算。
      const near = src.slice(Math.max(0, m.index - 240), m.index);
      if (!/data-allow-break=/.test(near)) brk.push(`${rel(f)} @${m[0]}`);
    }
  }
  check("不关掉中文避头尾（break-all 须登记 data-allow-break）", brk.length === 0, brk.join(", "));

  // ⑦ word-break: auto-phrase 在 zh-CN 下完全无效（Chrome 只接 lang=ja）。
  const ap = files.filter((f) => /auto-phrase/.test(read(f)));
  check("无 auto-phrase（zh-CN 下无效）", ap.length === 0, ap.map(rel).join(", "));
}

async function gateArtRegistry() {
  console.log("\nG10 · 位图资产登记与体积（§6.4）");
  const { readdirSync, readFileSync, statSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const REG = join(APP_ROOT, "public", "art", "REGISTRY.md");
  check("登记册存在", existsSync(REG), "public/art/REGISTRY.md");
  if (!existsSync(REG)) return;
  const reg = readFileSync(REG, "utf8");

  // 扫描范围按目录性质分职责——**这个范围曾经出过一次真缺口**：
  // 本门最初只扫 public/illustrations/（那是位图归零时代写的），后来门户上线了
  // 4 张生成图（public/art/portal-*.webp）与 8 张产品实拍（public/shots/），
  // **全都不在门的射程内**——下一张图直接丢进 art/ 就能绕过登记与体积纪律上线。
  //
  //   · illustrations/ + art/ —— **生成插画**：登记（REGISTRY.md）+ 体积 双查。
  //   · shots/ —— **产品实拍**：只查体积。它们不是 AI 生成物，塞进 AI 登记册
  //     反而失真（登记册的价值全在「如实」）；其来源标注纪律（「界面实拍 ·
  //     内容为演示样例」）由门户对抗审查把守，不在本门。
  //   · float/ / school-bg / luban7-icon 仍不查：UI 图标 / 摄影底图 / 产品图标，
  //     不属「生成插画」范畴。范围写窄一点，好过为了消化误报去开整目录豁免。
  //
  // 注意这里**不**断言「必须存在待登记插画」。本门要守的命题是
  // 「**不得有未登记或超体积的位图上线**」——位图为零时该命题真值为真，不是漏测。
  const CAP = 150 * 1024;
  const isBitmap = (f) => /\.(png|webp|jpg|jpeg)$/i.test(f);
  const listDir = (dir) => (existsSync(dir) ? readdirSync(dir).filter(isBitmap) : []);

  const REG_DIRS = ["illustrations", "art"].map((d) => join(APP_ROOT, "public", d));
  const SIZE_ONLY_DIRS = [join(APP_ROOT, "public", "shots")];

  const oversize = [];
  const unregistered = [];
  let regCount = 0;
  for (const dir of REG_DIRS) {
    for (const f of listDir(dir)) {
      regCount++;
      const size = statSync(join(dir, f)).size;
      if (size > CAP) oversize.push(`${f} ${(size / 1024).toFixed(0)}KB`);
      // 登记册按族登记（subject-*.webp），因此认「族名」或「全名」任一命中
      const stem = f.replace(/\.[a-z]+$/i, "");
      const family = stem.replace(/-[^-]+$/, "-*");
      if (!reg.includes(stem) && !reg.includes(family) && !reg.includes(f)) unregistered.push(f);
    }
  }
  let shotCount = 0;
  for (const dir of SIZE_ONLY_DIRS) {
    for (const f of listDir(dir)) {
      shotCount++;
      const size = statSync(join(dir, f)).size;
      if (size > CAP) oversize.push(`${f} ${(size / 1024).toFixed(0)}KB`);
    }
  }
  console.log(`    生成插画 ${regCount} 张（登记+体积）· 产品实拍 ${shotCount} 张（仅体积）`);

  check("全部生成插画已在登记册出现", unregistered.length === 0, unregistered.join(",") || `${regCount} 张全部登记`);
  check(`全部位图 ≤150KB（§6.4）`, oversize.length === 0, oversize.join(" / ") || `${regCount + shotCount} 张全部达标`);

  // 登记册的价值全在「如实」。硬性要求它写明盲审状态——不许悄悄留白当作已完成。
  check("登记册写明独立盲审状态", /盲审/.test(reg) && /(未完成|已完成)/.test(reg));
}

async function gateCurfewRoleBoundary() {
  console.log("\nG15 · 宵禁角色边界：休息时段只限学生，教师工作台不受限");
  const { readFileSync, existsSync } = await import("node:fs");
  const { join, dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const strip = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
      .replace(/(^|[^:"'`\\])\/\/.*/g, "$1");
  const read = (rel) =>
    existsSync(join(APP_ROOT, rel)) ? strip(readFileSync(join(APP_ROOT, rel), "utf8")) : "";

  // 用户拍板（2026-08-19）：教师工作台没有时段限制，学生学习台有。
  // 该政策的实现点是 ShellFrame 的角色门——本门锁死它，防止重构时悄悄拆掉。
  const shell = read("components/shell/ShellFrame.tsx");
  check(
    "宵禁组件 GuardianShell 仅在学生角色挂载（教师不受时段限制）",
    /role === "student" && <GuardianShell/.test(shell),
    "ShellFrame 应保持 role === \"student\" && <GuardianShell /> 的角色门"
  );
  // 角色判定必须以服务端会话为真相（客户端 persist store 可被清空/过期）
  check("ShellFrame 角色取自服务端会话（useSessionRole）", /useSessionRole\(/.test(shell));
  // 铁律①：宵禁全屏期间安全求助仍可达——宵禁屏自带求助入口
  const guardian = read("components/student/GuardianShell.tsx");
  check(
    "宵禁屏保留安全求助入口（data-safety-critical）",
    /data-safety-critical="curfew-help"/.test(guardian)
  );
}


async function main() {
  console.log(`EduAI gate · BASE=${BASE}`);
  await gateZLadder();
  await gateGradientEnum();
  await gateStageCoverage();
  await gateBannedMechanism();
  await gateTemplateVariables();
  await gateArtRegistry();
  await gateDataHonesty();
  await gateNavTruthSource();
  await gateRunnerWiring();
  await gateAffordanceHonesty();
  await gateCurfewRoleBoundary();
  const student = await login("student", "Student@123");
  await gateForbiddenVerdicts(student);
  await gateSafetyWhitelist(student, "student");
  await gateCrisis(student);
  await gateRbac(student);
  // 教师端也必须拿到两条能力边界（学生专属的身份/隐私两条不适用）
  const teacher = await login("teacher", "Teacher@123");
  await gateSafetyWhitelist(teacher, "teacher");

  const total = results.length;
  console.log(`\n────────────────────────────────\n${total - failed}/${total} PASS${failed ? ` · ${failed} FAIL` : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error("\ngate runner 异常：", err.message);
  process.exit(1);
});
