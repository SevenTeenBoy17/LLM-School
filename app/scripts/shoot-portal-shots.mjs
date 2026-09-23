// 门户产品实拍重拍器。
//
// 为什么保留而不是用完即删：这四张图是门户页上**唯一承载「产品真的长这样」**的证据，
// 一旦有人改了应用外壳就得重拍，而重拍有四条容易踩错的约束固化在这里：
//
//  1. **必须以对应角色的真实会话拍。** 曾经「学生」那张是用教师账号拍的
//     （侧栏身份条写着「教师」、顶栏带教师专属分段），alt 却写「学生端首页」——
//     那是铁律②「不编造」的直接违反，而且肉眼扫过去不容易发现。ROLE 字段就是防这个的。
//  2. **视口不能低于 1024。** 应用外壳在 <1024 收起竖向导航（实测 700/820/900 三档
//     均无侧栏），而三张图的 alt 都明写「左侧导航为…」。拍窄了 alt 立刻变成假描述——
//     **修一个缺陷时制造另一个**。
//  3. **dev 覆盖层必须隐藏。** Next 开发模式的 nextjs-portal 会在左下角画一枚黑底
//     白「N」圆牌，四张图全部中招过。这里用 CSS 隐藏而不是切生产构建：等效，且不必
//     动 next.config（那超出本轮授权范围）。
//  4. **装假时钟到白天。** 夜间宵禁遮罩会盖满全屏，拍到的就不是功能界面。
//  5. **必须走真实登录表单，不能用 /api/auth/login 直连。** 侧栏姓名读的是客户端
//     useUserStore，而该 store 的默认值是一个**硬编码的真人身份**，只在登录表单
//     成功后由 setUser 覆盖。直连 API 会让 store 停在默认值——于是不管拍谁，
//     侧栏都显示同一个人。原先那张「学生端首页」就是这么来的（它不是用教师账号拍的，
//     是 store 没被水合）。下面的 assertIdentity 用**播种姓名**逐张验，防复发。
//     ⚠️ 同一个坑也在 tests/gate/visual.mjs 里：它同样走 API 登录。
//
// DPR2 采集后缩到 1400 宽：位图密度 1400/1024 = 1.37×（原先是 1.0×），
// next/image 按槽宽×DPR 选变体，密度上去了同一变体里的界面文字才更清楚。
//
// 用法：node scripts/shoot-portal-shots.mjs [key]   （key ∈ teacher/student/admin/chat）
import { chromium } from "playwright";
import sharp from "sharp";
import { statSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT_W = 1400;

const JOBS = {
  teacher: { role: "teacher", pw: "Teacher@123", path: "/dashboard", w: 1024, h: 640,
    expect: ["aside", "nav[aria-label]"], why: "教师端首页（三个入口 tab · 教师）" },
  student: { role: "student", pw: "Student@123", path: "/student/home", w: 1024, h: 640,
    expect: ["aside", "nav[aria-label]"], why: "学生端首页（三个入口 tab · 学生）" },
  // 实测 /admin/audit 不用 <table>（审计日志是 div 网格），故只断言外壳结构。
  admin:   { role: "admin",   pw: "Admin@123",   path: "/admin/audit",  w: 1024, h: 640,
    expect: ["aside", "main"], why: "管理端安全审计（三个入口 tab · 管理员）" },
  chat:    { role: "student", pw: "Student@123", path: "/chat",         w: 1280, h: 800,
    expect: ["aside"], why: "英雄区主视觉（alt 写的是「回应学生的提问」，故用学生会话）" },
};

/** 身份自证：比对**播种姓名**，且只在 aside（外壳侧栏）里找。
 *
 *  两个坑都踩过：
 *  · 用角色词比对不行——学生自己的界面根本不会写「学生」二字；
 *  · 全文比对不行——学生首页的监督横幅会正当地写出任课教师姓名（王思远），
 *    那在 main 里，不是会话身份。限定 aside 才分得开。 */
const SEED_NAME = { teacher: "王思远", student: "刘子涵", admin: "李校长" };

async function shoot(key) {
  const j = JOBS[key];
  const br = await chromium.launch();
  const ctx = await br.newContext({
    viewport: { width: j.w, height: j.h },
    deviceScaleFactor: 2,
  });
  await ctx.clock.install({ time: new Date("2026-07-27T14:00:00") });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
  // /login 的表单藏在地球解锁之后：不点开，输入框存在但 visible=false，
  // Playwright 的 fill 会一直等到超时（值甚至已经写进了 DOM，很有迷惑性）。
  // 解锁流程与 tests/gate/typography.mjs 的 PUBLIC_PAGES./login.prepare 保持一致。
  await p.getByLabel("点击地球进入登录").click();
  await p.waitForSelector('input[placeholder="账号"]', { state: "visible", timeout: 20000 });
  await p.fill('input[placeholder="账号"]', j.role);
  await p.fill('input[placeholder="密码"]', j.pw);
  await p.press('input[placeholder="密码"]', "Enter");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  await p.goto(`${BASE}${j.path}`, { waitUntil: "networkidle", timeout: 60000 });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await p.waitForTimeout(1400);

  // ── 拍前三道断言，任何一条不过就不出片 ──────────────────────────
  const chk = await p.evaluate(({ expect }) => {
    const missing = expect.filter((s) => !document.querySelector(s));
    const dev = document.querySelector("nextjs-portal");
    const devOverlay = !!dev && getComputedStyle(dev).display !== "none";
    // 会话身份：只看外壳侧栏，不看正文（监督横幅会正当地写出任课教师姓名）
    const sideText = [...document.querySelectorAll("aside")].map((a) => a.innerText || "").join(" ");
    const found = ["王思远", "刘子涵", "李校长"].filter((n) => sideText.includes(n));
    return { missing, devOverlay, found, landed: location.pathname };
  }, { expect: j.expect });

  const bad = [];
  if (chk.landed !== j.path) bad.push(`落点 ${chk.landed} ≠ ${j.path}`);
  if (chk.missing.length) bad.push(`结构缺失 ${chk.missing.join("/")}`);
  if (chk.devOverlay) bad.push("dev 覆盖层仍可见");
  // 冒名检查：侧栏姓名必须**恰好**是该角色的播种姓名，多一个少一个都不出片
  const want = SEED_NAME[j.role];
  if (chk.found.length !== 1 || chk.found[0] !== want)
    bad.push(`侧栏身份不符：期望「${want}」，实测「${chk.found.join("/") || "无"}」`);
  if (bad.length) { console.log(`✗ ${key} 不出片：${bad.join(" · ")}`); await br.close(); return; }

  const raw = await p.screenshot();
  await br.close();

  const to = `public/shots/${key}.webp`;
  let q = 82, size = Infinity;
  while (q >= 40) {
    await sharp(raw).resize({ width: OUT_W }).webp({ quality: q }).toFile(to);
    size = statSync(to).size;
    if (size <= 150 * 1024) break;
    q -= 6;
  }
  const m = await sharp(to).metadata();
  console.log(`✓ ${key.padEnd(8)} ${m.width}×${m.height}  ${(size/1024).toFixed(0).padStart(3)}KB (q=${q})  侧栏 ${chk.found.join("/")}  ${j.why}`);
}

const only = process.argv[2];
for (const k of (only ? [only] : Object.keys(JOBS))) await shoot(k);
