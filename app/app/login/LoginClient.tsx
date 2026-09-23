"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as motion from "motion/react-client";
import { MotionConfig } from "motion/react";
import { User, Lock, ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/common/BrandLogo";
import { HeroDome } from "@/components/login/HeroDome";
import { VideoBackdrop } from "@/components/login/VideoBackdrop";
import { DotMatrixTitle } from "@/components/login/DotMatrixTitle";
import { ModelBadges } from "@/components/login/ModelBadges";
import { useUserStore, clearClientIdentity } from "@/lib/store/useUserStore";
import { canAccessClass, canAccessConsole, homeFor } from "@/lib/nav";
import type { UserRole } from "@/lib/types";

/**
 * 登录门户 · 暗夜穹顶版。
 *
 * 设计文档：仓库根《登录门户重构·暗夜穹顶方案与技术文档.md》。
 * 结构：浮动胶囊导航 + 公告胶囊 + 点阵大标题 + 双 CTA + 事实承诺条。
 * 背景两层：HeroDome（纯 CSS/SVG 穹顶，静态兜底）+ VideoBackdrop（实拍循环
 * 视频，加载完成后淡入覆盖；reduced-motion / 加载失败时让位给穹顶）。
 * 前景控件统一玻璃质感（.lh-glass）——玻璃采样的正是身后活动的视频。
 *
 * 旧版（校园画卷 + 3D 地球解锁）随本轮移除，一并清偿两笔旧债：
 * 轮播位图内烤的伪数字（12,840 / 48——在图片里所以 G11 扫不到）与拟人吉祥物（铁律⑤）。
 */

function loginTargetFor(role: UserRole, target: string | null): string {
  if (!target) return homeFor(role);
  if (target.startsWith("/admin") && !canAccessConsole(role)) return homeFor(role);
  if (target.startsWith("/class") && !canAccessClass(role)) return homeFor(role);
  return target;
}

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * 双入口：学生 / 教师·教职工。
 *
 * 这是「账号与功能区隔绝」在登录面的显性化——隔绝本身早已是服务端事实
 * （proxy.ts default-deny + navFor() 按角色过滤，学生端锁死 4 入口），
 * 这里做的是把它**提前说出来**：学生在登录前就知道自己的界面只有四件事。
 * note 的措辞必须与 lib/nav.ts 学生组的四项逐字对齐（导航变了这里要跟着变）。
 *
 * 预填仅限非生产（演示便利）；生产环境两个入口只切换提示语，不碰凭证。
 */
const ENTRIES = {
  student: {
    label: "学生",
    account: "student",
    password: "Student@123",
    note: "学生端分三组：学习 · 成长 · 项目活动，左侧导航直达",
  },
  staff: {
    label: "教师 · 教职工",
    account: "teacher",
    password: "Teacher@123",
    note: "教师端含备课、学情与教研工作台；管理员用分配账号登录",
  },
} as const;
type EntryKey = keyof typeof ENTRIES;

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "能力", href: "/portal" },
  { label: "三步上手", href: "/portal#how-to-start" },
  { label: "安全与隐私", href: "/portal#trust-ledger" },
  { label: "常见问题", href: "/portal#faq" },
];

/* ── V16 进场编排（调研规格：三路研究 + 综合，state V16 节存档）──
   绝对时刻表：导航 0 → 公告胶囊 0.10 → 点阵标题 0.22 → 副文案 0.38 →
   CTA 行 0.50 → 页脚品牌条 0.65；全部 ≤1.25s 收束。首帧透明度必须保持 1，
   只用 transform 做位移入场：Next 首屏 HTML 是 hydration 前的可见预览，不能让
   Motion/JS 成为登录入口可见性的前置条件。hydration 失败或 rAF 冻结时内容仍直出。
   缓动复用站内 --ease-out。氛围循环（drift/glow/sheen）在 CSS 侧延迟 1.3s，
   入场落定后才开始呼吸。reduced-motion 由 MotionConfig reducedMotion="user"
   统一降级（保持可见、去位移）。 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function LoginClient({ returnPath }: { returnPath: string | null }) {
  const router = useRouter();
  // ?from= 已由服务端页面校验并传入；被 proxy 弹回来的用户直接看到表单。
  const cameFromGuard = Boolean(returnPath);
  const [view, setView] = useState<"hero" | "form">(cameFromGuard ? "form" : "hero");
  const [entry, setEntry] = useState<EntryKey>("student");
  const [account, setAccount] = useState(IS_PROD ? "" : ENTRIES.student.account);
  const [password, setPassword] = useState(IS_PROD ? "" : ENTRIES.student.password);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 进场编排只播一次：编排收束（1.25s）后翻转 introPlayed，此后动画元素一律
  // 以终态静态渲染——Esc 从表单返回 hero（元素随条件分支重挂）不重播；
  // 整页刷新 / 路由重进（LoginInner 重挂，state 归零）会重播。用 state 而非 ref：
  // render 期读 ref 被 react-hooks/refs 正确拦下。
  const [introPlayed, setIntroPlayed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setIntroPlayed(true), 1400);
    return () => clearTimeout(t);
  }, []);
  // 已播态不是「无 props」而是 initial:false + 终态：后台标签页打开时 rAF 冻结、
  // 定时器却会先翻转 introPlayed——若届时把动画 props 撤空，MotionValue 停在 0，
  // 切回前台页面永远不可见。initial:false 让 motion 确定性地直出 animate 值。
  const SETTLED = { initial: false as const, animate: { opacity: 1, y: 0 } };
  // rise(延迟, 位移, 时长)：入场只在首播窗口给动画属性；此后一律直出终态
  const rise = (delay: number, y = 12, d = 0.5) =>
    introPlayed
      ? SETTLED
      : {
          initial: { opacity: 1, y },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: d, ease: EASE },
        };

  // 到达登录页 = 当前没有已认证的外壳在运行。此刻清掉客户端身份镜像。
  //
  // 为什么清理点在这里、而不是在两个登出按钮里（那是最初的写法，实测无效）：
  // SessionIdentityProvider 的 effect 会「以服务端身份为准写回 store」，而登出
  // 那一瞬间它拿到的 identity prop 仍是**旧用户**（shell layout 还没重渲）。
  // 于是登出处的清理被立刻覆盖回去——localStorage 里仍留着上一位的姓名与院系。
  //
  // 放在登录页还多覆盖了三条路径：会话过期被 proxy 弹回、直接输 /login、
  // 以及共用机房设备上换人后打开浏览器。要守的不变量本来就是
  // 「没有已认证外壳时，本地不该留有任何用户身份」——登录页正是那条边界。
  // ⚠️ G13 断言直接盯本文件的这一行，重构时不可移除。
  useEffect(() => {
    clearClientIdentity();
  }, []);

  // Esc 从表单退回 hero（被守卫弹回的除外——他们没有「回 hero」的语境）
  useEffect(() => {
    if (view !== "form" || cameFromGuard) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setView("hero"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, cameFromGuard]);

  const pickEntry = useCallback((k: EntryKey) => {
    setEntry(k);
    setError("");
    if (!IS_PROD) {
      setAccount(ENTRIES[k].account);
      setPassword(ENTRIES[k].password);
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: account.trim(), password }),
      });
      if (!res.ok) {
        setSubmitting(false);
        // 失败不清输入（R1-top3 改造版：保留输入的错误恢复）
        setError(res.status === 429 ? "尝试过于频繁，请 1 分钟后再试" : "账号或密码不正确，请重试");
        return;
      }
      const { user } = await res.json();
      useUserStore.getState().setUser({
        name: user.name, role: user.role, stage: user.stage,
        department: user.department, avatarLetter: user.avatarLetter,
      });
      router.push(loginTargetFor(user.role, returnPath));
    } catch {
      setSubmitting(false);
      setError("网络异常，请稍后再试");
    }
  };

  return (
    // data-portal-root + data-ink="dark"：复用门户已有的焦点环作用域规则——
    // 深底上焦点环取 --portal-on-ink（奶油白），不接这两个属性会退回无层的
    // 钴蓝 *:focus-visible，深底上对比度不足（portal.mjs P-A 门的历史教训）。
    // MotionConfig reducedMotion="user"：系统减动效偏好下自动去位移并保持内容可见。
    <MotionConfig reducedMotion="user">
    <main
      data-portal-root
      data-ink="dark"
      className="relative min-h-screen overflow-clip"
      style={{ background: "var(--lh-bg)", color: "var(--lh-text)" }}
    >
      <HeroDome />
      <VideoBackdrop />

      {/* ── 浮动胶囊导航（不贴边，是悬浮在画面上的一个物体）。
          进场：从上方轻降落（守卫直达表单的用户只给 0.3s 纯淡入——他们要表单不要仪式）── */}
      {/* z-20：主内容容器（z-10、DOM 靠后、盒子从 y=0 铺满）曾把同层的导航整条压住——
          登录钮点击无响应的根因。z-20 已在 G5 阶梯登记（组件内局部堆叠） */}
      <header className="absolute inset-x-0 top-8 z-20 flex justify-center px-4">
        <motion.div
          {...(introPlayed
            ? SETTLED
            : cameFromGuard
              ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.3, ease: EASE } }
              : { initial: { opacity: 1, y: -12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease: EASE } })}
          className="lh-glass backdrop-blur-[18px] backdrop-saturate-150 flex w-full max-w-[860px] items-center gap-2 rounded-full px-3 py-2"
        >
          <Link href="/portal" className="flex min-h-[var(--hit-min)] items-center gap-2 px-2 transition-opacity duration-300 ease-[var(--ease-out)] hover:opacity-75" aria-label="回到门户首页">
            <BrandLogo size={30} withText={false} />
            <span className="text-[14px] font-bold text-[var(--lh-bg)]">i-learning</span>
          </Link>
          {/* V15.1 用户反馈：链接簇太挤、与两端留白失衡——链接内距 1.5→3、
              分隔点 2→3、字距 0.08→0.1em，让中段被文字自然填满而非空着 */}
          <nav aria-label="门户导航" className="mx-auto hidden items-center md:flex">
            {NAV_LINKS.map((l, i) => (
              <span key={l.href} className="flex items-center">
                {i > 0 && <span aria-hidden className="px-3 text-[var(--lh-bg)]/30">·</span>}
                <Link
                  href={l.href}
                  className="inline-flex min-h-[var(--hit-min)] items-center rounded-full px-3 text-[13px] font-semibold tracking-[0.1em] text-[var(--lh-bg)]/70 transition-[color,background-color] duration-300 ease-[var(--ease-out)] hover:bg-[var(--lh-bg)]/5 hover:text-[var(--lh-bg)]"
                >
                  {l.label}
                </Link>
              </span>
            ))}
          </nav>
          {/* 导航 CTA：品牌深青实底（苹果导航 CTA 语法）。白霜钮嵌白霜导航
              控件对比度 1.0:1 打红过 portal 门——嵌玻璃的可点物件要么换色要么描边，
              这里选色：与视频的青蓝弧同族 */}
          <button
            type="button"
            onClick={() => setView("form")}
            className="lh-glow-blue lh-border-trace ml-auto inline-flex min-h-[var(--hit-min)] items-center rounded-full bg-[var(--lh-cta)] px-5 text-[13px] font-semibold text-white transition-[filter,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:brightness-110 md:ml-0"
          >
            登录
          </button>
        </motion.div>
      </header>

      {/* ── 主区：hero ↔ 登录卡。旧视图即时卸载，新视图只做可选位移入场；
          视图切换不等待动画回调，因此后台标签页或冻结 rAF 不会卡死登录入口。── */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pb-24 pt-28">
        {view === "hero" ? (
            <motion.div
              key="hero"
              initial={{ opacity: 1, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex w-full flex-col items-center"
            >
              {/* 公告胶囊（双段式，悬浮微漂——页面的第一处呼吸）：
                  白霜底上标签反转为墨底白字，正文用墨色——层级靠明度差不靠灰纱。
                  进场挂外层 wrapper：lh-drift 用 CSS animation 改 transform，
                  与 motion 同元素必冲突（嵌套则 transform 相乘，无害） */}
              <motion.div {...rise(0.10, 10, 0.45)}>
                <div className="lh-glass backdrop-blur-[18px] backdrop-saturate-150 lh-drift mb-6 flex items-center gap-2 rounded-full py-1 pl-1 pr-4">
                  <span className="rounded-full bg-[var(--lh-bg)] px-2.5 py-0.5 text-[13px] font-semibold text-[var(--lh-text)]">
                    校内部署
                  </span>
                  <span className="text-[13px] text-[var(--lh-bg)]/70">数据不出校</span>
                </div>
              </motion.div>

              {/* 点阵大标题（B 案：第二行前三字降灰，复刻参考稿的明暗节奏）。
                  进场动 wrapper 且**禁 scale**：canvas 采样依赖 h1 的 rect，
                  scale 中触发重采样会拿到错误尺寸；canvas 自身的渐显交接是第二拍 */}
              <motion.div className="w-full max-w-[900px]" {...rise(0.22, 16, 0.6)}>
                <DotMatrixTitle
                  lines={[
                    [{ text: "师生与 AI" }],
                    [{ text: "在校内", dim: true }, { text: "一起创作" }],
                  ]}
                />
              </motion.div>

              {/* 副文案：复用门户已审口径，零数字 */}
              {/* 副文案用全白而非 text-2：视频最亮帧上灰阶文字会溶解，白字+投影两端通吃。
                  文案 V15.1 评审定稿：首行答「这是什么、给谁用」，次行答「免费、零门槛」，
                  与胶囊（数据信任）三处分工零重复；两行显式断行不靠自动换行 */}
              <motion.p
                {...rise(0.38, 12, 0.5)}
                className="lh-on-video mt-6 max-w-[560px] text-center text-[16px] leading-[1.7] text-[var(--lh-text)]"
              >
                <span className="block">面向全校师生的 AI 平台：教师备课，学生提问</span>
                <span className="block">免费开放，浏览器打开即用</span>
              </motion.p>

              {/* 双 CTA：主（实底白 + 光晕呼吸）次（玻璃胶囊）——权重仍然分明 */}
              <motion.div {...rise(0.50, 10, 0.45)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                <button
                  type="button"
                  onClick={() => setView("form")}
                  className="lh-glow-blue lh-border-trace inline-flex h-[var(--hit-row)] w-full items-center justify-center rounded-full bg-[var(--lh-text)] px-8 text-[14px] font-semibold text-[var(--lh-bg)] transition-[transform,filter] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:brightness-[1.04] sm:w-auto"
                >
                  进入 i-learning
                </button>
                <Link
                  href="/portal"
                  className="lh-glass lh-sheen backdrop-blur-[18px] backdrop-saturate-150 inline-flex h-[var(--hit-row)] w-full items-center justify-center rounded-full px-7 text-[14px] font-semibold transition-[filter,transform] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:brightness-105 sm:w-auto"
                >
                  了解边界与承诺
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 1, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: "easeOut" }}
              className="w-full max-w-[400px]"
            >
              {/* 玻璃登录卡（V15.2 拍板：暗域配方 → 白霜强化版，与前景玻璃件统一材质语言。
                  比 .lh-glass-strong 更实的底（0.86）——表单可读性优先。
                  焦点环：卡内以 CSS 变量把 --portal-focus 改挂深青 --lh-cta——
                  外层 data-ink="dark" 给的奶油白环在白霜上不可见，变量就近覆盖即可，
                  不动 globals.css 的环规则（那是门户全域的单一真相源） */}
              {/* V15.3 琉璃化：0.86 实白 → 0.66 半透——视频透过玻璃可感，
                  blur18+saturate 保住表单可读性；输入框同步降透成琉璃件 */}
              <div
                className="rounded-[16px] border p-6 backdrop-blur-[18px] backdrop-saturate-150"
                style={{
                  background: "rgba(255, 255, 255, 0.66)",
                  borderColor: "rgba(255, 255, 255, 0.75)",
                  boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 24px 48px rgba(10, 14, 30, 0.22)",
                  ["--portal-focus" as string]: "var(--lh-cta)",
                }}
              >
                <div className="mb-5 flex items-center justify-between">
                  {!cameFromGuard ? (
                    <button
                      type="button"
                      onClick={() => setView("hero")}
                      className="inline-flex h-[var(--hit-min)] w-[var(--hit-min)] items-center justify-center rounded-[12px] text-[var(--lh-bg)]/55 transition-[color,background-color] duration-300 ease-[var(--ease-out)] hover:bg-[var(--lh-bg)]/5 hover:text-[var(--lh-bg)]"
                      aria-label="返回"
                    >
                      <ArrowLeft size={18} />
                    </button>
                  ) : (
                    <span aria-hidden className="h-[var(--hit-min)] w-[var(--hit-min)]" />
                  )}
                  <span className="text-[14px] font-semibold text-[var(--lh-bg)]">登录 i-learning</span>
                  <span aria-hidden className="h-[var(--hit-min)] w-[var(--hit-min)]" />
                </div>

                {/* 学生 / 教职工 双入口：账号与功能区隔绝的登录面显性化。
                    选中态用墨底白字（白霜上的最大明度差），未选中墨字降透 */}
                <div
                  role="tablist"
                  aria-label="选择身份入口"
                  className="mb-2 grid grid-cols-2 gap-1 rounded-[12px] border border-[var(--lh-bg)]/10 p-1"
                >
                  {(Object.keys(ENTRIES) as EntryKey[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="tab"
                      aria-selected={entry === k}
                      onClick={() => pickEntry(k)}
                      className={`inline-flex min-h-[40px] items-center justify-center rounded-[12px] text-[13px] font-semibold transition-colors duration-300 ease-[var(--ease-out)] ${
                        entry === k
                          ? "bg-[var(--lh-bg)] text-[var(--lh-text)]"
                          : "text-[var(--lh-bg)]/55 hover:bg-[var(--lh-bg)]/5 hover:text-[var(--lh-bg)]"
                      }`}
                    >
                      {ENTRIES[k].label}
                    </button>
                  ))}
                </div>
                <p className="mb-5 text-center text-[12px] leading-relaxed text-[var(--lh-bg)]/55">
                  {ENTRIES[entry].note}
                </p>

                <form onSubmit={onSubmit} className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-[var(--lh-bg)]/70">账号</span>
                    <div className="flex h-[var(--hit-row)] items-center gap-2 rounded-[12px] border border-[var(--lh-bg)]/10 bg-white/55 px-3 transition-[border-color,background-color] duration-300 ease-[var(--ease-out)] hover:border-[var(--lh-bg)]/20 focus-within:border-[var(--lh-cta)]/50 focus-within:bg-white/75">
                      <User size={15} className="shrink-0 text-[var(--lh-bg)]/40" />
                      <input
                        value={account}
                        onChange={(e) => setAccount(e.target.value)}
                        autoComplete="username"
                        className="h-full w-full bg-transparent text-[14px] text-[var(--lh-bg)] outline-none placeholder:text-[var(--lh-bg)]/35"
                        placeholder="账号"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] text-[var(--lh-bg)]/70">密码</span>
                    <div className="flex h-[var(--hit-row)] items-center gap-2 rounded-[12px] border border-[var(--lh-bg)]/10 bg-white/55 px-3 transition-[border-color,background-color] duration-300 ease-[var(--ease-out)] hover:border-[var(--lh-bg)]/20 focus-within:border-[var(--lh-cta)]/50 focus-within:bg-white/75">
                      <Lock size={15} className="shrink-0 text-[var(--lh-bg)]/40" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        className="h-full w-full bg-transparent text-[14px] text-[var(--lh-bg)] outline-none placeholder:text-[var(--lh-bg)]/35"
                        placeholder="密码"
                      />
                    </div>
                  </label>

                  {error && (
                    <p role="alert" className="text-[13px] text-[var(--c-alert)]">
                      {error}
                    </p>
                  )}

                  {/* 提交钮走品牌深青（与导航登录钮同语法）：白霜上墨/青实底才有控件对比 */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="lh-glow-blue lh-border-trace inline-flex h-[var(--hit-row)] w-full items-center justify-center rounded-full bg-[var(--lh-cta)] text-[14px] font-semibold text-white transition-[transform,filter] duration-300 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60"
                  >
                    {submitting ? "登录中…" : "进入平台"}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
      </div>

      {/* ── 底部模型品牌条（V14.3 用户拍板：承诺条 → 已接入模型的官方标 + 真实型号。
          承诺内容仍完整在 /portal 信任账本；此处清单与网关路由一致，见 ModelBadges 注释）。
          进场压轴：0.65s 起步的轻浮现，守卫直达时同导航一样只给纯淡入 ── */}
      <footer className="absolute inset-x-0 bottom-0 z-20 px-10 pb-8">
        <motion.div
          {...(introPlayed
            ? SETTLED
            : cameFromGuard
              ? { initial: { opacity: 1 }, animate: { opacity: 1 }, transition: { duration: 0.3, ease: EASE } }
              : { initial: { opacity: 1, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.65, duration: 0.5, ease: EASE } })}
        >
          <ModelBadges />
        </motion.div>
      </footer>
    </main>
    </MotionConfig>
  );
}
