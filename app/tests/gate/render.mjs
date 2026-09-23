#!/usr/bin/env node
/**
 * EduAI Prism · 渲染态门禁（真浏览器）
 *
 * 为什么必须有这一层：run.mjs 只能证明「字符串在 DOM 里」。而本项目真实发生过的失效
 * 全都在渲染几何与合成层面：
 *   · 披露被 truncate 截成半句 —— 在 DOM、非 aria-hidden，字符串断言全绿（U-3）
 *   · 层级遮挡取决于**层叠上下文**而非 z 数值 —— 只比数值会得出错误结论（曾据此误报一条 P1）
 *   · Composer 掉出首屏 —— 空会话时测一切正常，有历史消息时「常驻可见」根本不成立
 *
 * 本文件第二版，逐条堵掉对抗审查指出的**假绿路径**：
 *   ① 载入未完成就测量（空态页短，什么都在首屏内）→ 现在等会话载入完成再测
 *   ② 只断言「白名单节点数 > 0」→ 删掉三条披露仍满绿。现在断言**期望 id 集合**
 *   ③ 「未被截断」只测水平溢出，对 inline span（scrollWidth/clientWidth 恒为 0）与
 *      line-clamp（垂直裁剪）双双失明 → 现在两轴都测，且对 inline 元素改用 Range 实测
 *   ④ 命令面板打不开只 console.log SKIP、不计入 results → 现在计为 FAIL
 *   ⑤ R4 选择器把正文里的 markdown 链接算作控件；且量的是历史消息而非新发的那条
 *   ⑥ 浮标只与「发送键」比几何 → 现在与**任何**可交互元素比
 *
 * 用法：npm run gate:render     （需要 dev server 已在 BASE 运行）
 */

import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const results = [];
let failed = 0;

function check(name, ok, detail = "") {
  results.push({ name, ok });
  if (!ok) failed++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function loginAs(context, username, password) {
  const res = await context.request.post(`${BASE}/api/auth/login`, { data: { username, password } });
  if (!res.ok()) throw new Error(`login ${username}: ${res.status()}`);
}

/**
 * 固定时钟——门禁不得依赖跑测时的墙上时间。
 *
 * 由来：某次凌晨跑门，GuardianShell 的夜间宵禁遮罩（22:00–06:00，不透明全屏）挡住了所有点击，
 * 断言全线超时。**白天过、夜里挂的门是不可信的门**：它给出的绿灯取决于运气。
 * 常规断言一律固定到 14:00；宵禁本身另有一条**刻意的**用例（见 R8），把这个条件变成被测对象，
 * 而不是被回避的噪声。
 */
async function pinDaytime(ctx) {
  await ctx.clock.install({ time: new Date("2026-07-27T14:00:00") });
}

/** 打开 /chat 并**等到会话载入真正结束**——否则测的是空态短页，一切都在首屏内（假绿）。 */
async function openChat(ctx) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-safety-critical]", { timeout: 20000 });
  // 会话列表与历史消息都由客户端拉取；networkidle 之后再等布局稳定两帧
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-chat-role], [data-empty-chat], main');
    return Boolean(el);
  }, { timeout: 20000 });
  await page.waitForTimeout(1200);
  return page;
}

/** 白名单期望集合（与 run.mjs 的 WHITELIST 对应，按角色区分） */
const EXPECTED_IDS = {
  // W-B1：上传能力落地，no-upload（暂不支持）→ upload-scope（范围声明）——与 run.mjs 白名单同步
  student: ["ai-identity", "privacy", "no-web-search", "upload-scope"],
  teacher: ["no-web-search", "upload-scope"],
};

/** 渲染态断言：可见 / 未截断（双轴） / 首屏内 / 非 aria-hidden / 文案非空 */
async function assertWhitelistRendered(page, label, role) {
  const items = await page.$$eval("[data-safety-critical]", (nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      const cs = getComputedStyle(n);
      // inline 元素的 scrollWidth/clientWidth 恒为 0，水平溢出判据在它上面是**真空恒真**。
      // 改用 Range 量真实文本宽度，与元素盒宽比较；块级元素继续用 scroll/client。
      let overflowX = false;
      if (cs.display === "inline") {
        const range = document.createRange();
        range.selectNodeContents(n);
        overflowX = range.getBoundingClientRect().width > r.width + 1;
      } else {
        overflowX = n.scrollWidth > n.clientWidth + 1;
      }
      // line-clamp / max-height 是**垂直**裁剪，上一版完全看不见
      const overflowY = n.scrollHeight > n.clientHeight + 1 && cs.overflow !== "visible";
      return {
        id: n.getAttribute("data-safety-critical"),
        text: (n.innerText || "").trim(),
        visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0,
        truncated: overflowX || overflowY,
        inFirstViewport: r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0,
        ariaHidden: n.closest("[aria-hidden='true']") !== null,
        // 补：命中测试。可见 + 未截断 + 在首屏，仍可能被浮层压住——上一版漏了这一项。
        // NEXTJS-PORTAL 是 dev 模式的构建指示器浮标，生产不存在，按工具产物排除。
        blocked: (() => {
          const pts = [[r.left + 4, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2]];
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const el = document.elementFromPoint(x, y);
            if (!el || n.contains(el) || el === n || el.contains(n)) continue; // 祖先容器不算遮挡
            if (el.tagName === "NEXTJS-PORTAL" || el.closest("nextjs-portal")) continue;
            // 同一行的相邻内联 span 属正常排版，不算遮挡
            if (el.parentElement === n.parentElement) continue;
            return String(el.className || el.tagName).slice(0, 40);
          }
          return null;
        })(),
      };
    }),
  );
  // ② 期望集合而非 count>0：删掉披露不能再靠「剩下的都合格」蒙混过关
  const found = items.map((i) => i.id).sort();
  const want = [...EXPECTED_IDS[role]].sort();
  check(
    `[${label}] 白名单 id 集合与期望一致`,
    JSON.stringify(found) === JSON.stringify(want),
    `实测 [${found}] 期望 [${want}]`,
  );
  for (const it of items) {
    check(`[${label}] ${it.id} 可见`, it.visible);
    check(`[${label}] ${it.id} 未被截断（双轴）`, !it.truncated);
    check(`[${label}] ${it.id} 在首屏内`, it.inFirstViewport);
    check(`[${label}] ${it.id} 非 aria-hidden`, !it.ariaHidden);
    check(`[${label}] ${it.id} 文案非空`, it.text.length > 0, it.text.slice(0, 20));
    check(`[${label}] ${it.id} 未被浮层遮挡`, !it.blocked, it.blocked || "");
  }
}

/**
 * z 序真实可点性。断言的是 elementFromPoint 命中，**不是**比较 z 值——
 * 后者正是那次 P1 误报的根因（ChatTopbar 的 z-130 被自身层叠上下文关住）。
 */
async function assertCrisisReachable(page, scenario) {
  const hit = await page.evaluate(() => {
    const fab = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").includes("安全求助"));
    if (!fab) return { found: false };
    const r = fab.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { found: true, self: fab.contains(el) || el === fab, blockedBy: el ? String(el.className).slice(0, 60) : null };
  });
  check(`[${scenario}] 安全求助浮标存在`, hit.found);
  if (hit.found) check(`[${scenario}] 浮标中心点可被命中（未被遮挡）`, hit.self, hit.self ? "" : `被 ${hit.blockedBy} 拦截`);
}

/** ⑥ 浮标不得与**任何**可交互元素相交（上一版只比发送键，于是把碰撞从右边搬到左边时全绿） */
async function assertFabGeometry(page, width) {
  const r = await page.evaluate(() => {
    const fab = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").includes("安全求助"));
    if (!fab) return null;
    const fr = fab.getBoundingClientRect();
    const hits = [];
    for (const el of document.querySelectorAll('button,a[href],input,select,textarea,summary,[role="button"]')) {
      if (el === fab || fab.contains(el) || el.contains(fab)) continue;
      // 收起的 details 菜单项（如「回答待改进」）在 Chromium 里仍有真实几何盒子，
      // 但用户看不见也点不到——拿它和浮标做相交必是误报（与 visual 门 visible() 同一缺陷）。
      // summary 本身仍参与检测。
      const closedDetails = (() => { let n = el.parentElement; while (n && n !== document.body) { if (n.tagName === "DETAILS" && !n.open) { const s = n.querySelector(":scope > summary"); if (!s || !s.contains(el)) return true; } n = n.parentElement; } return false; })();
      if (closedDetails) continue;
      const b = el.getBoundingClientRect();
      if (b.width <= 0 || b.height <= 0) continue;
      if (!(fr.right < b.left || b.right < fr.left || fr.bottom < b.top || b.bottom < fr.top)) {
        hits.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 16));
      }
    }
    return { hits };
  });
  if (!r) { check(`[${width}px] 浮标存在`, false); return; }
  check(`[${width}px] 浮标不与任何可交互元素相交`, r.hits.length === 0, r.hits.join(","));
}

/** ⑦ 布局守卫：消息区必须是真正的滚动容器，页面不得被内容撑高 */
/**
 * 数据卡里**数值必须是最强的元素**。
 *
 * 实测 /admin/analytics 的 6 张 KPI 卡曾各自叠三层：一颗 h-24 的渐变模糊球（纯装饰）、
 * 一个 35×35 的饱和渐变图标块 + 阴影、以及 24px 的数值。前两层的视觉重量压过第三层——
 * 而卡片存在的全部意义就是那个数字，一屏 6 张把这套竞争重复 6 遍。
 *
 * 这条只能在真实渲染里断言：装饰是否「更响」取决于**渲染后的面积与是否带渐变/阴影**，
 * 源码里看到的 `h-10 w-10` 在 14px 根字号下是 35px 而不是 40px，静态扫描算不出来。
 *
 * 两条命题，都刻意用可测量的代理指标而不是主观判断：
 *  · 卡内不得有零信息的模糊球（blur 装饰层）——它没有任何可读性贡献，是净负担；
 *  · 图标块面积不得超过数值字号的平方（24px → 576px²，留 15% 余量至 660px²）。
 *    这不是美学标准，是「谁更大」的算术：图标块比数值的字面尺寸还大时，
 *    扫读时先看到的一定是它。
 */
async function assertKpiValueDominates(page) {
  const r = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll(".surface-card")).filter((c) =>
      c.querySelector(".text-num"),
    );
    return cards.slice(0, 8).map((c) => {
      const box = c.querySelector('[class*="place-items-center"]');
      const val = c.querySelector(".text-num");
      const b = box?.getBoundingClientRect();
      const cs = box && getComputedStyle(box);
      return {
        iconArea: b ? Math.round(b.width * b.height) : 0,
        iconGradient: cs ? /gradient/.test(cs.backgroundImage) : false,
        iconShadow: cs ? cs.boxShadow !== "none" : false,
        valueFont: val ? parseFloat(getComputedStyle(val).fontSize) : 0,
        blurs: c.querySelectorAll('[class*="blur-"]').length,
      };
    });
  });
  if (!r.length) { check("数据卡存在（否则下面两条是真空恒真）", false); return; }
  check("数据卡存在（否则下面两条是真空恒真）", true, `${r.length} 张`);

  const withBlur = r.filter((k) => k.blurs > 0).length;
  check("数据卡内无零信息的模糊装饰层", withBlur === 0, withBlur ? `${withBlur} 张仍带 blur 球` : "");

  const tooBig = r.filter((k) => k.valueFont > 0 && k.iconArea > k.valueFont * k.valueFont * 1.15);
  check(
    "图标块不比数值更抢眼（面积 ≤ 字号² × 1.15）",
    tooBig.length === 0,
    tooBig.length ? `${tooBig.length} 张：icon ${tooBig[0].iconArea}px² vs 阈值 ${Math.round(tooBig[0].valueFont ** 2 * 1.15)}px²` : `icon ${r[0].iconArea}px² / 阈值 ${Math.round(r[0].valueFont ** 2 * 1.15)}px²`,
  );

  const loud = r.filter((k) => k.iconGradient || k.iconShadow).length;
  check("数据卡图标块不用渐变或阴影", loud === 0, loud ? `${loud} 张仍带渐变/阴影` : "");
}

/**
 * 密度档必须**真的改变布局**。
 *
 * 这条只能在真实渲染里断言：紧凑档此前是一个「已完整接通但几乎不产生效果」的开关——
 * store → root.dataset.density → CSS → API → 落库整条链路都通，
 * 而 CSS 那一端只写了 `body { font-size: 13px }`（rem 解析的是 html，无效）
 * 与卡片圆角。实测切换前后文档高度 2231px → 2231px，卡片内边距 14px → 14px。
 * 任何**静态**断言看到的都是「链路完整」，只有量一遍真实几何才发现它什么也没干。
 *
 * 同时守住反向约束：密度档不得把任何可点元素压到 44px 以下。
 * 命中区已迁到绝对像素令牌，理应免疫；这条断言是那个前提的看门人。
 */
async function assertDensityHasEffect(page) {
  const r = await page.evaluate(() => {
    const root = document.documentElement;
    const prev = root.dataset.density;
    const probe = () => {
      const card = document.querySelector(".surface-card");
      const clickable = Array.from(document.querySelectorAll("a, button"))
        .map((e) => Math.round(e.getBoundingClientRect().height))
        .filter((h) => h > 0);
      return {
        docH: Math.round(document.body.scrollHeight),
        pad: card ? parseFloat(getComputedStyle(card).paddingTop) : null,
        under44: clickable.filter((h) => h < 44).length,
      };
    };
    root.dataset.density = "comfortable";
    const comfy = probe();
    root.dataset.density = "compact";
    const compact = probe();
    root.dataset.density = prev || "comfortable";
    return { comfy, compact };
  });
  const saved = r.comfy.docH - r.compact.docH;
  const padDelta = (r.comfy.pad ?? 0) - (r.compact.pad ?? 0);
  check(
    "紧凑档真的压缩了布局（文档高度下降 ≥ 3%）",
    saved / Math.max(1, r.comfy.docH) >= 0.03,
    `${r.comfy.docH}px → ${r.compact.docH}px（省 ${saved}px）`,
  );
  check(
    "紧凑档真的收紧了卡片内边距",
    padDelta > 0,
    `${r.comfy.pad}px → ${r.compact.pad}px`,
  );
  check(
    "紧凑档不把可点元素压到 44px 以下（命中区免疫）",
    r.compact.under44 <= r.comfy.under44,
    `舒适 ${r.comfy.under44} 个 → 紧凑 ${r.compact.under44} 个`,
  );
}

async function assertLayout(page, width) {
  const r = await page.evaluate(() => {
    const scroller = document.querySelector("main .overflow-y-auto");
    return {
      docH: document.documentElement.scrollHeight,
      vh: window.innerHeight,
      scrollerScrollable: scroller ? scroller.scrollHeight >= scroller.clientHeight : null,
      hasScroller: Boolean(scroller),
    };
  });
  check(`[${width}px] 页面未被内容撑高（docH ≤ 视口 + 2）`, r.docH <= r.vh + 2, `docH=${r.docH} vh=${r.vh}`);
  check(`[${width}px] 消息区是滚动容器`, r.hasScroller === true);
}

async function main() {
  console.log(`EduAI render gate · BASE=${BASE}`);
  const browser = await chromium.launch();
  try {
    for (const vp of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      const ctx = await browser.newContext({ viewport: vp });
      await pinDaytime(ctx);
      await loginAs(ctx, "student", "Student@123");
      const page = await openChat(ctx);
      console.log(`\nR1 · 白名单渲染态 @ ${vp.width}×${vp.height}（§7.2）`);
      await assertWhitelistRendered(page, `${vp.width}px`, "student");
      console.log(`\nR3 · 浮标几何 @ ${vp.width}px（§7.1-7）`);
      await assertFabGeometry(page, vp.width);
      console.log(`\nR5 · 布局守卫 @ ${vp.width}px`);
      await assertLayout(page, vp.width);
      await ctx.close();
    }

    // R7 dashboard 无同屏重复面板（§5 P2）
    // **必须在真浏览器里测**：dashboard 是客户端渲染，SSR HTML 里根本没有这些标题——
    // 我最初把这条写进 run.mjs 的字符串层，实测「0 次」而报 PASS，
    // 是一道结构上无法失败的门。这个错误在本项目已经出现过三次，记在这里。
    for (const [u, pw] of [["teacher", "Teacher@123"], ["admin", "Admin@123"]]) {
      const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await pinDaytime(ctxD);
      await loginAs(ctxD, u, pw);
      const pageD = await ctxD.newPage();
      await pageD.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await pageD.waitForTimeout(1500);
      const dup = await pageD.evaluate(() => {
        const t = document.querySelector("main")?.innerText || "";
        const n = (re) => (t.match(re) || []).length;
        return { 安全状态: n(/安全状态/g), 模型调用占比: n(/模型调用占比/g), hasMain: Boolean(document.querySelector("main")) };
      });
      console.log(`
R7 · dashboard 无重复面板（${u}）`);
      check(`[${u}] main 已渲染（R7 前置，防空页假绿）`, dup.hasMain && (dup.安全状态 + dup.模型调用占比) > 0, JSON.stringify(dup));
      check(`[${u}] 「安全状态」只出现一次`, dup.安全状态 <= 1, `实测 ${dup.安全状态}`);
      check(`[${u}] 「模型调用占比」只出现一次`, dup.模型调用占比 <= 1, `实测 ${dup.模型调用占比}`);
      await ctxD.close();
    }

    // R6 跨页回落：Composer 卸载后 --composer-h 必须清掉，否则非 chat 页的浮标
    // 会按一个不存在的输入区高度上移（组件间通过 documentElement 传值的典型泄漏路径）。
    {
      const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await loginAs(ctx3, "student", "Student@123");
      const page3 = await openChat(ctx3);
      const onChat = await page3.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--composer-h").trim());
      console.log("\nR6 · --composer-h 跨页回落");
      check("chat 页已注入 --composer-h", /^\d+px$/.test(onChat), onChat || "(空)");
      await page3.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
      await page3.waitForTimeout(800);
      const off = await page3.evaluate(() => {
        const v = getComputedStyle(document.documentElement).getPropertyValue("--composer-h").trim();
        const fab = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").includes("安全求助"));
        return { v, fabBottom: fab ? Math.round(window.innerHeight - fab.getBoundingClientRect().bottom) : null };
      });
      check("离开 chat 后 --composer-h 已清除（回落默认）", off.v === "", `实测 "${off.v}"`);
      check("非 chat 页浮标贴近视口底部（未按不存在的输入区上移）", off.fabBottom !== null && off.fabBottom < 120, `bottom=${off.fabBottom}px`);
      await ctx3.close();
    }

    // R2 危机可达性：应用层弹层打开时浮标仍可被命中
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await pinDaytime(ctx);
    await loginAs(ctx, "student", "Student@123");
    const page = await openChat(ctx);
    console.log("\nR2 · 危机入口可达性（elementFromPoint，§7.1-8）");
    await assertCrisisReachable(page, "基线");
    // H7：桌面搜索内联化——Ctrl+K 聚焦顶栏输入，结果面板贴挂（同为 --z-app-modal 层）。
    // 命题不变：模态层开启时安全浮标必须仍可命中；载体从弹层换成内联结果面板。
    await page.keyboard.press("Control+KeyK").catch(() => {});
    await page.waitForTimeout(300);
    const searchFocused = await page.evaluate(() => document.activeElement?.getAttribute("role") === "combobox");
    check("Ctrl+K 聚焦内联搜索输入（R2 前置）", searchFocused);
    await page.keyboard.type("对话");
    await page.waitForTimeout(800);
    const panelOpen = await page.evaluate(() => Boolean(document.querySelector("#inline-search-results")));
    // ④ 打不开不再静默 SKIP：这条是唯一验证 --z-app-modal 与 --z-safety-fab 相对关系的断言，
    //    让它永久静默失效，等于给该红线发免检证。
    check("输入后结果面板贴挂出现（R2 前置）", panelOpen);
    if (panelOpen) await assertCrisisReachable(page, "内联搜索面板打开时");
    await ctx.close();

    // R4 每条助手消息常驻控件 ≤2
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await pinDaytime(ctx2);
    await loginAs(ctx2, "student", "Student@123");
    const page2 = await openChat(ctx2);
    console.log("\nR4 · 每条助手消息常驻控件 ≤2（§3.1 R4①）");
    const before = await page2.$$eval('[data-chat-role="assistant"]', (n) => n.length);
    await page2.fill("textarea", "1+1 等于几？");
    await page2.click('button[aria-label="发送"]');
    // ⑤ 等**新**消息，不是等选择器（历史消息早已满足）；超时不再静默吞掉
    let grew = true;
    try {
      await page2.waitForFunction(
        (n) => document.querySelectorAll('[data-chat-role="assistant"][data-chat-streaming="false"]').length > n,
        before, { timeout: 90000 },
      );
    } catch { grew = false; }
    check("发送后产生了新的助手消息", grew, grew ? "" : "90s 内未出现（网关慢/配额耗尽）");
    if (grew) {
      const counts = await page2.$$eval('[data-chat-role="assistant"][data-chat-streaming="false"]', (nodes) =>
        nodes.map((n) => {
          const bubble = n.querySelector(".prose");
          return Array.from(n.querySelectorAll('button, summary, a[href], [role="button"]')).filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            if (el.closest('[role="menu"]')) return false;      // 二级菜单内的项不算常驻
            if (bubble && bubble.contains(el)) return false;     // ⑤ 正文里的 markdown 链接不是控件
            return true;
          }).length;
        }),
      );
      check(`助手消息常驻控件 ≤2（实测 ${counts.join(",")}）`, counts.every((c) => c <= 2));
    }
    await ctx2.close();
    // ── R8 宵禁遮罩（**刻意**固定到深夜，把回避对象变成被测对象）───────────────
    // 这是全站唯一「除求助外什么都点不了」的界面：不透明全屏，学生在最脆弱的时段面对它。
    // 曾因它挡住点击而让门在夜里全线超时——正确回应不是屏蔽它，而是专门测它。
    {
      // H2（2026-08-19 拍板）：宵禁默认停用——门跟产品走，改为**双态**：
      // ① 默认关：深夜无遮罩（学生可正常使用）；② 管理端临时开启 22-6：遮罩全断言照跑；③ 还原关。
      // 能力测试保留而非删除——「关闭默认值」不等于「拆掉安全能力」。
      const adminLogin = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Admin@123" }) });
      const adminCookie = adminLogin.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
      const setCurfew = (s, e) => fetch(`${BASE}/api/guardian`, { method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie }, body: JSON.stringify({ limitMin: 40, curfewStart: s, curfewEnd: e }) });

      const ctxN = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctxN.clock.install({ time: new Date("2026-07-27T23:30:00") });
      await loginAs(ctxN, "student", "Student@123");
      const pageN = await ctxN.newPage();
      await pageN.goto(`${BASE}/student/home`, { waitUntil: "networkidle" });
      await pageN.waitForTimeout(1500);
      console.log("\nR8 · 宵禁双态（23:30，390px）");
      const offState = await pageN.evaluate(() => Boolean(document.querySelector('[aria-label="夜间休息"]')));
      check("默认停用：深夜无宵禁遮罩（H2 拍板）", !offState);

      await setCurfew(22, 6);
      await pageN.reload({ waitUntil: "networkidle" });
      await pageN.waitForTimeout(1500);
      const night = await pageN.evaluate(() => {
        const overlay = document.querySelector('[aria-label="夜间休息"]');
        if (!overlay) return { present: false };
        const tel = overlay.querySelector('a[href^="tel:"]');
        const help = Array.from(overlay.querySelectorAll("button")).find((b) => (b.innerText || "").includes("安全求助"));
        const box = (e) => (e ? e.getBoundingClientRect() : null);
        const hit = (e) => {
          if (!e) return false;
          const r = e.getBoundingClientRect();
          const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return Boolean(el) && (e.contains(el) || el === e);
        };
        const tb = box(tel);
        return {
          present: true,
          telSize: tb ? [Math.round(tb.width), Math.round(tb.height)] : null,
          telHit: hit(tel), helpHit: hit(help), helpPresent: Boolean(help),
          hasPositionalWording: /右下角|左下角/.test(overlay.textContent || ""),
        };
      });
      check("管理端开启后遮罩出现（能力保留）", night.present, JSON.stringify(night));
      if (night.present) {
        check("遮罩内有可点的「安全求助」按钮（不依赖方位指引）", night.helpPresent && night.helpHit);
        check("遮罩内无方位指代文案（右下角/左下角）", !night.hasPositionalWording);
        check("热线触控目标 ≥44px 高", Boolean(night.telSize) && night.telSize[1] >= 44, `实测 ${night.telSize}`);
        check("热线可被命中（未被遮挡）", night.telHit);
      }
      await setCurfew(0, 0); // 还原默认停用（门不留残局）
      await ctxN.close();
    }

    // ── R9 · 色彩令牌**运行时解析**（色彩迁移第四批的配套断言）─────────────────
    //
    // 为什么非有不可：色彩棘轮门（color.mjs）是**静态计数**，它只知道「源码里少了 46 个 hex」，
    // 完全不知道换上去的东西在浏览器里是否解析得出颜色。这一批把大量 `#RRGGBB`
    // 换成了 `var(--ok)` / `var(--accent-focus)` / `gradientCss(key)`，任何一处写错——
    // 令牌名拼错、令牌未在该 register 作用域定义、把枚举键当 CSS 直接塞进 backgroundImage——
    // 结果都是**颜色静默消失**（transparent / none），而棘轮门会因为 hex 变少而更绿。
    // 「改完更绿但实际更糟」正是本项目已经吃过亏的假绿形态，所以计数门必须配一条解析门。
    //
    // 判据是「解析后不透明」，不是「等于某个具体颜色」——后者会把这条门变成快照测试，
    // 每次调色都要改断言，最终被改成永远为真。
    {
      console.log("\nR9 · 色彩令牌运行时解析（迁移后不得静默变透明）");
      const TRANSPARENT = /^rgba\(0,\s*0,\s*0,\s*0\)$|^transparent$/;
      // 「已解析的颜色」不等于「序列化成 rgb()」。实测 color-mix() 会被解析成
      // `color(srgb 0.50 0.64 0.95)`——是真颜色，只是另一种序列化。旧判据只认 rgb()/rgba()，
      // 会把这批模型色板渐变全部误判为失效。
      // 反过来，若浏览器**没有**解析 color-mix，计算值里会残留 `color-mix(` 字面量，
      // 那才是真失效——所以同时加一条「不得残留 color-mix(」的反向断言，
      // 避免这次放宽把「没解析」也一并放过去。
      const RESOLVED_COLOR = /(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\(/;

      // ① 教师首页快捷入口：新版使用透明语义图标，旧实现仍允许经 gradientCss
      //    解析的渐变图标。两种实现都必须有真实视觉资产，不能静默退化为空白。
      {
        const ctxT = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await pinDaytime(ctxT);
        await loginAs(ctxT, "teacher", "Teacher@123");
        const p = await ctxT.newPage();
        await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
        await p.waitForSelector('[data-testid^="dashboard-quick-"]', { timeout: 20000 });
        await p.waitForTimeout(600);
        const tiles = await p.evaluate(() =>
          Array.from(document.querySelectorAll('[data-testid^="dashboard-quick-"]')).map((btn) => {
            const semantic = btn.querySelector('[data-teacher-feature-icon]');
            const image = semantic?.querySelector("img");
            const legacy = btn.querySelector('div[style*="background-image"]');
            const bi = legacy ? getComputedStyle(legacy).backgroundImage : "";
            return {
              id: btn.getAttribute("data-testid"),
              semantic: semantic?.getAttribute("data-teacher-feature-icon") || "",
              source: image?.getAttribute("src") || "",
              fallback: Boolean(semantic?.classList.contains("teacher-feature-icon-fallback")),
              bi,
            };
          }),
        );
        check("快捷入口语义图标数量 > 0（R9 前置）", tiles.length > 0, `实测 ${tiles.length}`);
        const badTile = tiles.filter((t) => {
          const semanticOk = Boolean(t.semantic) && /teacher-nav-atlas-v2\.webp/.test(t.source) && !t.fallback;
          const legacyOk = /gradient\(/.test(t.bi) && RESOLVED_COLOR.test(t.bi) && !/color-mix\(/.test(t.bi);
          return !semanticOk && !legacyOk;
        });
        check(
          "快捷入口均渲染语义图标或有效渐变",
          tiles.length > 0 && badTile.length === 0,
          badTile.length ? JSON.stringify(badTile.slice(0, 3)) : `${tiles.length} 个全部有效`,
        );
        await ctxT.close();
      }

      // ② 管理端分析页：漏斗分段 + 好评/待改进图例色点，全部改走语义令牌。
      {
        const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await pinDaytime(ctxA);
        await loginAs(ctxA, "admin", "Admin@123");
        const p = await ctxA.newPage();
        await p.goto(`${BASE}/admin/analytics`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1500);
        const swatches = await p.evaluate(() =>
          Array.from(document.querySelectorAll('div[style*="background"], span[style*="background"]'))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.width < 400; // 色点与漏斗条，排除大面积容器
            })
            .map((el) => {
              const cs = getComputedStyle(el);
              return { bg: cs.backgroundColor, bi: cs.backgroundImage };
            }),
        );
        check("分析页有带内联背景色的元素（R9 前置）", swatches.length > 0, `实测 ${swatches.length}`);
        const badSw = swatches.filter((s) => TRANSPARENT.test(s.bg) && s.bi === "none");
        check(
          "分析页图例/漏斗色块无一解析为透明",
          swatches.length > 0 && badSw.length === 0,
          badSw.length ? `${badSw.length} 个透明` : `${swatches.length} 个全部有色`,
        );
        await ctxA.close();
      }

      // ③ 学生探索页：学科八色板已收敛为单一 --accent-tint / --accent-focus。
      //    color-mix() 若在该作用域解析失败会直接落成 transparent——正是这条要防的。
      {
        const ctxS = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await pinDaytime(ctxS);
        await loginAs(ctxS, "student", "Student@123");
        const p = await ctxS.newPage();
        await p.goto(`${BASE}/explore`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1500);
        const dots = await p.evaluate(() =>
          Array.from(document.querySelectorAll('span[style*="background"], div[style*="background"]'))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.width <= 64;
            })
            .map((el) => {
              const cs = getComputedStyle(el);
              return { bg: cs.backgroundColor, bi: cs.backgroundImage };
            }),
        );
        check("探索页有色点元素（R9 前置）", dots.length > 0, `实测 ${dots.length}`);
        // 首跑这里报了 5/14 透明，查下去是**断言本身写窄了**：这 5 个是
        // `background-image: var(--grad-primary)` 的圆形图标，背景色本就该是透明，颜色在 image 上。
        // ② 号探针已经带了 `bi === "none"` 这一半条件，③ 号漏抄——同一条判据两处写法不一致，
        // 于是产出一条假红。记在这里是因为**假红和假绿同样危险**：它会训练人去调低门的标准。
        const badDot = dots.filter((d) => TRANSPARENT.test(d.bg) && d.bi === "none");
        check(
          "探索页色点无一解析为透明（--accent-tint / --accent-focus 生效）",
          dots.length > 0 && badDot.length === 0,
          badDot.length ? `${badDot.length}/${dots.length} 既无背景色也无背景图` : `${dots.length} 个全部有色`,
        );
        await ctxS.close();
      }

      // ④ 色彩第五批新触及的三处表面。加这一条的理由与 R9 本身相同：
      //    这批把 ROLES 的 `color` 拆成了 `tint`/`ink` 两个令牌字段（原实现是
      //    `r.color + "22"` **字符串拼 hex** 造透明度），把侧边栏头像与 hub 推荐卡
      //    的裸渐变换成了令牌/枚举键。**改动落在哪，断言就要覆盖到哪**——
      //    否则「不会静默变透明」这句话在这三处只是没被测过，不是成立。
      {
        const ctxP = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await pinDaytime(ctxP);
        await loginAs(ctxP, "admin", "Admin@123");
        const p = await ctxP.newPage();
        await p.goto(`${BASE}/admin/permissions`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1200);
        const roleBadges = await p.evaluate(() =>
          Array.from(document.querySelectorAll('span[style*="background"], div[style*="background"]'))
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.width <= 90 && r.height <= 40;
            })
            .map((el) => {
              const cs = getComputedStyle(el);
              // 字符串拼接失败的典型残迹：`var(--x)22` 解析不出来 → 背景与文字色双双落空
              return { bg: cs.backgroundColor, bi: cs.backgroundImage, fg: cs.color, raw: el.getAttribute("style") || "" };
            }),
        );
        check("权限页角色徽标存在（R9 前置）", roleBadges.length > 0, `实测 ${roleBadges.length}`);
        const badRole = roleBadges.filter((b) => TRANSPARENT.test(b.bg) && b.bi === "none");
        check(
          "角色徽标底色无一解析为透明（tint/ink 拆分后不再拼字符串）",
          roleBadges.length > 0 && badRole.length === 0,
          badRole.length ? JSON.stringify(badRole.slice(0, 2)) : `${roleBadges.length} 个全部有色`,
        );
        // 侧边栏头像：改为 --accent-focus 底 + 白字，两个 register 都要过 AA，
        // 这里只断言「底色解析得出且非透明」，对比度另由设计规范约束。
        const avatar = await p.evaluate(() => {
          // 用**范围**定位而不是 `width === 36`。首版写死 36（h-9 w-9 的名义值），
          // 实测渲染出来是 32——定位条件写成精确相等，探针就会在代码完全正常时报 null。
          // 被测的是「底色解析得出吗」，尺寸只是找到它的手段，不该被当成断言的一部分。
          const el = Array.from(document.querySelectorAll('div[style*="background"]'))
            .find((e) => {
              const w = e.getBoundingClientRect().width;
              return /rounded-\[12px\]/.test(String(e.className)) && w >= 28 && w <= 44;
            });
          if (!el) return null;
          const cs = getComputedStyle(el);
          return { bg: cs.backgroundColor, bi: cs.backgroundImage };
        });
        check("侧边栏头像块底色已解析", Boolean(avatar) && !(TRANSPARENT.test(avatar.bg) && avatar.bi === "none"), JSON.stringify(avatar));
        await ctxP.close();
      }

      {
        const ctxH = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        await pinDaytime(ctxH);
        await loginAs(ctxH, "teacher", "Teacher@123");
        const p = await ctxH.newPage();
        await p.goto(`${BASE}/hub`, { waitUntil: "networkidle" });
        await p.waitForTimeout(1200);
        // hub 三张推荐卡已升级为透明 PNG 语义图标。检查真实资产路径、透明容器和
        // 无回退状态，防止图标在加载失败时留下白框或空位。
        const tiles = await p.evaluate(() =>
          Array.from(document.querySelectorAll('[data-teacher-feature-glyph]'))
            .filter((el) => { const r = el.getBoundingClientRect(); return r.width >= 40 && r.width <= 52; })
            .map((el) => {
              const cs = getComputedStyle(el);
              return {
                glyph: el.getAttribute("data-teacher-feature-glyph") || "",
                source: el.querySelector("img")?.getAttribute("src") || "",
                fallback: el.getAttribute("data-fallback") === "true",
                background: cs.backgroundColor,
                backgroundImage: cs.backgroundImage,
                boxShadow: cs.boxShadow,
              };
            }),
        );
        check("hub 推荐卡透明语义图标存在（R9 前置）", tiles.length === 3, `实测 ${tiles.length}`);
        const badTile = tiles.filter((tile) =>
          !/\/art\/teacher-feature-icons-v2\/.+\.png/.test(tile.source)
          || tile.fallback
          || !TRANSPARENT.test(tile.background)
          || tile.backgroundImage !== "none"
          || tile.boxShadow !== "none",
        );
        check(
          "hub 推荐卡图标均为透明新版资产",
          tiles.length === 3 && badTile.length === 0,
          badTile.length ? JSON.stringify(badTile.slice(0, 2)) : `${tiles.length} 个全部有效`,
        );
        // ⑤ 模型身份色板（MODEL_PALETTE + tonalPair）。这是本批唯一用到 color-mix() 的地方，
        //    也是最容易悄悄失效的一处：color-mix 不被解析时整条 background-image 声明会被丢弃，
        //    卡片变成白图标压白底——**看起来像图标没加载，而不像颜色坏了**，人眼很难归因。
        const modelTiles = await p.evaluate(() =>
          Array.from(document.querySelectorAll('div[style*="background-image"]'))
            .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 48; })
            .map((el) => getComputedStyle(el).backgroundImage),
        );
        check("hub 模型卡图标块存在（R9 前置）", modelTiles.length > 0, `实测 ${modelTiles.length}`);
        const badModel = modelTiles.filter(
          (bi) => !/gradient\(/.test(bi) || !RESOLVED_COLOR.test(bi) || /color-mix\(/.test(bi),
        );
        check(
          "模型身份渐变全部解析（color-mix 未残留、未被整条丢弃）",
          modelTiles.length > 0 && badModel.length === 0,
          badModel.length ? JSON.stringify(badModel.slice(0, 2)) : `${modelTiles.length} 个全部解析`,
        );
        // 五个模型必须**互不同色**——色板存在的全部意义就是让它们可区分。
        // 只断言「解析得出」不够：五个槽位若都映射到同一个下标，门照样全绿而页面一片同色。
        const firstStops = modelTiles.map((bi) => (bi.match(/(?:rgba?|color)\([^)]*\)/) || [""])[0]);
        const distinct = new Set(firstStops.filter(Boolean));
        check(
          "模型身份色互不相同（≥4 种，5 槽允许一次并列）",
          distinct.size >= 4,
          `${distinct.size} 种 / ${firstStops.length} 张`,
        );
        await ctxH.close();
      }

      // ⑥ 图表 SVG 的令牌解析。与前几条同因不同表面：SVG 用的是 presentation attribute
      //    （stroke / stop-color），不是 background。var() 在这里**能**解析（实测
      //    stroke="var(--border-2)" → rgb(238,240,245)），但这一点是量出来的不是想当然——
      //    真失效时网格线与坐标轴会变成黑色或消失，而截图类检查（溢出/裁切/空白率）
      //    对「颜色错了但布局没错」完全无感。
      {
        const ctxG = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await pinDaytime(ctxG);
        await loginAs(ctxG, "teacher", "Teacher@123");
        const p = await ctxG.newPage();
        await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
        await p.waitForTimeout(2500);
        const svg = await p.evaluate(() => {
          const grid = document.querySelector(".recharts-cartesian-grid line");
          const curve = document.querySelector(".recharts-area-curve, .recharts-line-curve");
          const pick = (el, prop) => (el ? getComputedStyle(el)[prop] : null);
          // 主页调研重构后，趋势/占比卡在**数据全零时刻意不画空坐标轴**（反模式：
          // 无真实数据的占位模块；铁律②的图表版），改渲染一句诚实空态说明。
          // 因此本组断言是二选一：图表态 → 验令牌解析；空态 → 验说明文案在场。
          // 「二选一都不在」才是真失效——防真空保住了：若有人把图表和空态一起
          // 删掉，或空态文案改坏，这里依然会红。
          const emptyNote = [...document.querySelectorAll("p")].some((e) =>
            /暂无真实调用|暂无模型调用/.test(e.textContent || ""));
          return {
            gridStroke: pick(grid, "stroke"),
            curveStroke: pick(curve, "stroke"),
            gridAttr: grid ? grid.getAttribute("stroke") : null,
            emptyNote,
          };
        });
        const chartMode = Boolean(svg.gridStroke && svg.curveStroke);
        check("趋势卡处于图表态或诚实空态（R9 前置，两者皆无=失效）", chartMode || svg.emptyNote, JSON.stringify(svg));
        if (chartMode) {
          const okStroke = (v) => Boolean(v) && v !== "none" && !/^var\(/.test(v) && RESOLVED_COLOR.test(v);
          check(
            "图表网格线令牌已解析（未残留 var() / 未落空）",
            okStroke(svg.gridStroke),
            `computed=${svg.gridStroke} attr=${svg.gridAttr}`,
          );
          check("图表曲线描边已解析", okStroke(svg.curveStroke), `computed=${svg.curveStroke}`);
        } else {
          check("空态说明在场（图表断言按空态跳过，非真空）", svg.emptyNote, "两张卡均显示诚实空态文案");
        }
        await ctxG.close();
      }
    }

    // ── R10 · 教师三步向导（V4a）─────────────────────────────────────────────
    //
    // 三条断言对应方案 §5 P4 的三条硬要求，每条都挑了**会真的失效**的那一面来测：
    //   ① 安全/隐私三项常驻可见 且**不在折叠区内**。只断言「存在」不够——
    //      把它们塞进 <Collapsible> 后节点依然存在，只是默认收起、用户看不到。
    //   ② 换步后焦点落到当前步标题。向导最常见的无障碍失败不是「按不到」，
    //      而是**焦点还停在已消失的按钮上**，屏幕阅读器用户不知道页面变了。
    //   ③ 预览里不得残留未处理的 `{占位符}`。这条是 V4a 实测踩到的：
    //      首版盲取 variables[0..1]，而模板声明的键与正文占位符对不上，
    //      于是老师填的项不影响输出、正文里的 `{学科}` 原样发给模型。
    {
      console.log("\nR10 · 教师三步向导（V4a）");
      const ctxW = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await pinDaytime(ctxW);
      await loginAs(ctxW, "teacher", "Teacher@123");
      const p = await ctxW.newPage();
      await p.goto(`${BASE}/research/prep`, { waitUntil: "networkidle" });
      await p.waitForSelector('[data-testid="prep-wizard"]', { timeout: 20000 });
      await p.waitForTimeout(600);

      const tpl = await p.$('[data-testid^="prep-tpl-"]');
      check("向导出现且有可选模板（R10 前置）", Boolean(tpl));
      if (tpl) {
        // 下一步在未选模板时必须是禁用的——否则「必填」只是个说法
        const blockedBefore = await p.$eval('[data-testid="prep-next"]', (b) => b.disabled);
        check("未选模板时「下一步」禁用", blockedBefore === true);

        await tpl.click();
        await p.click('[data-testid="prep-next"]');
        await p.waitForTimeout(400);
        const focus2 = await p.evaluate(() => (document.activeElement?.textContent || "").slice(0, 12));
        check("换到第 2 步后焦点落在该步标题", focus2.includes("填两项"), `activeElement=${focus2}`);

        const blockedEmpty = await p.$eval('[data-testid="prep-next"]', (b) => b.disabled);
        check("必填项为空时「下一步」禁用", blockedEmpty === true);

        const fields = await p.$$('[data-testid^="prep-field-"]');
        check("必填项数量为 1-2（§5 P4 上限）", fields.length >= 1 && fields.length <= 2, `实测 ${fields.length}`);
        for (const f of fields) await f.fill("信息科技");
        await p.click('[data-testid="prep-next"]');
        await p.waitForTimeout(500);

        const focus3 = await p.evaluate(() => (document.activeElement?.textContent || "").slice(0, 12));
        check("换到第 3 步后焦点落在该步标题", focus3.includes("确认后"), `activeElement=${focus3}`);

        const safety = await p.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll('[data-safety-critical^="wizard-"]'));
          return nodes.map((n) => {
            const r = n.getBoundingClientRect();
            const cs = getComputedStyle(n);
            return {
              id: n.getAttribute("data-safety-critical"),
              visible: r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && Number(cs.opacity) > 0,
              // 折叠区判据：祖先里有 data-open 属性的容器（Collapsible 的根）
              inCollapsible: Boolean(n.closest("[data-open]")),
            };
          });
        });
        const want = ["wizard-model", "wizard-scope", "wizard-trace"];
        check(
          "安全/隐私三项齐全",
          JSON.stringify(safety.map((s) => s.id).sort()) === JSON.stringify(want),
          safety.map((s) => s.id).join(","),
        );
        check("安全/隐私三项全部可见", safety.length > 0 && safety.every((s) => s.visible));
        check(
          "安全/隐私三项均不在折叠区内（§7.2）",
          safety.length > 0 && safety.every((s) => !s.inCollapsible),
          safety.filter((s) => s.inCollapsible).map((s) => s.id).join(",") || "0 项被折叠",
        );

        const preview = await p.$eval('[data-testid="prep-preview"]', (e) => e.textContent || "");
        const leftovers = preview.match(/\{[^{}\n]{1,20}\}/g) || [];
        check(
          "预览无未处理的占位符（填写值/默认值已代入）",
          leftovers.length === 0,
          leftovers.length ? `残留 ${leftovers.join(",")}` : "0 处",
        );
        check("预览含填写的值", preview.includes("信息科技"));
      }
      await ctxW.close();
    }

    // ── R11 · 趣味分级运行时（V4b 中不依赖资产的那一半）────────────────────────
    //
    // 方案给 V4b 定的验收条件是「`[data-delight]` 不得与安全态共现（含 openHelp 路径）」。
    // **在接线之前，这句断言是结构上无法失败的**：`lib/delight/policy.ts` 有 24 条单测，
    // 但全站没有任何组件调用它，`data-delight` 属性只在一句注释里出现过——
    // 属性不存在，共现自然测不出来，门永远绿。
    //
    // 现在 <Delight> 真的会发出该属性，这条门才有对象可测。三段：
    //   ① 触发条件成立时它**确实出现**（否则下面两条又变成真空恒真）；
    //   ② 打开求助面板后它**消失**（policy.suppressed 的 safetyOpen 分支）；
    //   ③ 教师端拿不到 L3（policy.allowed 的角色限高）。
    {
      console.log("\nR11 · 趣味分级运行时（data-delight 与安全态不共现）");
      const ctxD = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await pinDaytime(ctxD);
      await loginAs(ctxD, "student", "Student@123");

      // 造一条「昨天已复习过」的错题，使本次 PATCH 触发服务端 celebrate（跨自然日第二次）。
      // 直接调 API 而不是靠页面点两次——同一天点两次按 §5 P3 恰恰**不该**庆祝。
      const mk = await ctxD.request.post(`${BASE}/api/mistakes`, {
        data: { subject: "数学", content: "R11 门禁用例：跨天复习庆祝", knowledgePoint: "一元二次方程" },
      });
      const created = mk.ok() ? await mk.json() : null;
      const mid = created?.mistake?.id || created?.id || null;
      check("能创建测试错题（R11 前置）", Boolean(mid), String(mid));

      // 跨天条件靠**直接回填一条昨天的 review 行**构造（与 content.mjs C7 同法）——
      // 没有、也不该有「回填」这种生产端点：那等于给前端开一个伪造复习历史的口子。
      if (mid) {
        const { DatabaseSync } = await import("node:sqlite");
        const { dirname, resolve, join } = await import("node:path");
        const { fileURLToPath } = await import("node:url");
        const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
        let backfilled = false;
        try {
          const db = new DatabaseSync(join(APP_ROOT, ".data", "eduai.sqlite"));
          db.prepare("INSERT INTO mistake_reviews (id,mistakeId,userId,at) VALUES (?,?,?,?)")
            .run(`rev_r11_${Date.now()}`, mid, "u-student", Date.now() - 26 * 3600 * 1000);
          db.close();
          backfilled = true;
        } catch (e) { console.log("    (回填失败：" + String(e.message).slice(0, 60) + ")"); }
        check("能回填一条昨天的复习记录（R11 前置）", backfilled);
        // 注意这里**不**再调一次 PATCH：那会把 mistakes.reviewedAt 设上，
        // 页面上的「标记已复习」按钮随即消失，门就点不到真实控件了。
      }

      const p = await ctxD.newPage();
      await p.goto(`${BASE}/student/growth`, { waitUntil: "networkidle" });
      await p.waitForTimeout(1500);

      // ① 点「标记已复习」触发庆祝——走页面上真实存在的控件，不注入 DOM。
      // 该按钮在 <details>「⋯ 更多」菜单里，且只在**未复习**时渲染，所以：
      //   · 前置步骤只回填一条昨天的 review 行，**不**先调一次 PATCH——
      //     先 PATCH 会把 mistakes.reviewedAt 设上，按钮随即消失，门就点不到了；
      //   · 回填那行即「第一次复习」，页面这次点击是跨天的第二次 → 服务端判 celebrate。
      let appeared = false;
      const opened = await p.evaluate(() => {
        const sums = Array.from(document.querySelectorAll("details > summary"));
        const s = sums.find((x) => (x.textContent || "").includes("更多"));
        if (!s) return false;
        s.closest("details").open = true;
        return true;
      });
      check("能展开错题卡的「更多」菜单（R11 前置）", opened);
      if (opened) {
        const btn = await p.$('button[role="menuitem"]:has-text("标记已复习")');
        check("菜单内存在「标记已复习」（R11 前置）", Boolean(btn));
        if (btn) {
          await btn.click();
          await p.waitForTimeout(900);
          appeared = await p.evaluate(() => Boolean(document.querySelector("[data-delight]")));
        }
      }
      check("触发条件成立时 [data-delight] 确实出现（否则下面两条是真空恒真）", appeared,
        appeared ? "" : "未出现——本页当前可能无未复习错题，下面的抑制断言不成立");

      if (appeared) {
        // ② 打开求助面板 → 必须消失
        await p.evaluate(() => {
          const fab = Array.from(document.querySelectorAll("button")).find((b) => (b.innerText || "").includes("安全求助"));
          fab?.click();
        });
        await p.waitForTimeout(500);
        const stillThere = await p.evaluate(() => document.querySelectorAll("[data-delight]").length);
        check("求助面板打开后 [data-delight] 归零（§3.3 不可共现）", stillThere === 0, `实测 ${stillThere} 个`);
      }

      // 清理测试错题。**会改动持久状态的门必须自己收拾**——
      // 首版没删，那条错题留在 .data 里，把 /student/growth 从空态变成有内容，
      // 字阶门下一次跑就报「字号档 2→3」回归。查下去根本不是排版改坏了，是**门污染了门**。
      // （content.mjs 的 C7 一直有这一步，我这条漏抄了。）
      if (mid) {
        await ctxD.request.delete(`${BASE}/api/mistakes`, { data: { id: mid } }).catch(() => {});
      }
      await ctxD.close();

      // ③ 教师端限高：allowed('teacher', *) = 1，L3 一律不得渲染
      const ctxT2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await pinDaytime(ctxT2);
      await loginAs(ctxT2, "teacher", "Teacher@123");
      const pt = await ctxT2.newPage();
      await pt.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await pt.waitForTimeout(900);
      const teacherHigh = await pt.evaluate(() =>
        Array.from(document.querySelectorAll("[data-delight]")).map((e) => Number(e.getAttribute("data-delight"))).filter((n) => n > 1),
      );
      check("教师端不出现 L2 以上趣味元素（policy.allowed 限高）", teacherHigh.length === 0, `实测 ${teacherHigh.join(",") || "无"}`);
      await ctxT2.close();

      // ④ 密度档必须真的改变布局（此前是个什么也没干的开关）
      const ctxDen = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await pinDaytime(ctxDen);
      await loginAs(ctxDen, "teacher", "Teacher@123");
      const pd = await ctxDen.newPage();
      await pd.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      await pd.waitForTimeout(900);
      console.log("\n密度档实效");
      await assertDensityHasEffect(pd);
      await ctxDen.close();

      // ⑤ 管理端数据卡：数值必须是最强元素（装饰不得压过数字）
      const ctxKpi = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await pinDaytime(ctxKpi);
      await loginAs(ctxKpi, "admin", "Admin@123");
      const pk = await ctxKpi.newPage();
      await pk.goto(`${BASE}/admin/analytics`, { waitUntil: "networkidle" });
      await pk.waitForTimeout(900);
      console.log("\n数据卡视觉分层");
      await assertKpiValueDominates(pk);
      await ctxKpi.close();
    }

  } finally {
    await browser.close();
  }

  const total = results.length;
  console.log(`\n────────────────────────────────\n${total - failed}/${total} PASS${failed ? ` · ${failed} FAIL` : ""}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\nrender gate 异常：", e.message);
  process.exit(1);
});
