"use client";

/**
 * 学生端守护三件套 v1（S2，青少年模式规范惯例）：
 *  ① TimeUseMeter：当日累计使用时长环（40 分钟档变色）；
 *  ② RestGateModal：达阈值弹全屏休息卡（60s 倒计时后可继续，每满一档触发一次）；
 *  ③ 宵禁窗口（22:00–06:00）：学生端进入「休息态」全屏页。
 * v1 为客户端计时（localStorage 按日累计，跨页共享）；阈值/宵禁的教师端配置属后续能力，
 * 本组件不假称「教师已配置」。
 * 层级契约（V-1a 收口）：本文件三层已登记进 globals.css 的 z 阶梯闭集——
 *   徽章 --z-guardian-badge(60) / 休息提醒 --z-guardian-rest(92) / 夜间遮罩 --z-guardian-night(94)。
 * 夜间遮罩是不透明全屏，必须始终低于 --z-safety-fab(100)，否则夜间模式下学生无法求助（门禁有断言）。
 * 注意：契约靠注释是守不住的（上一版就是这么被稀释的）——真正的守卫是 `npm run gate` 的阶梯完备性检查。
 * 恒在本组件全屏层（z-85/90）之上——危机求助入口永不被守护层遮挡；宵禁卡另内嵌热线兜底。
 * 实现注：仅一个计时 effect（回调内 setState，合规）；休息卡可见性与倒计时全部由 sec 派生，无级联状态机。
 */
import { useEffect, useState } from "react";
import { Moon, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GUARDIAN_DEFAULTS, inCurfew, type GuardianConfig } from "@/lib/guardian";
import { useSafetyStore } from "@/lib/store/useSafetyStore";

const REST_SEC = 60;                  // 休息卡倒计时
const LS_KEY = () => `eduai-usage-${new Date().toISOString().slice(0, 10)}`;

export function GuardianShell() {
  const [sec, setSec] = useState(-1); // -1 = 未挂载（SSR/首帧不渲染，避免水合不一致）
  const [ackTier, setAckTier] = useState(0);
  // M3/B2：阈值/宵禁改读服务端（60s 轮询，改配置 ≤60s 生效）；拿不到时回落默认值（不谎称已配置）
  const [cfg, setCfg] = useState<GuardianConfig>(GUARDIAN_DEFAULTS);
  // 必须在下方 `if (sec < 0) return null` 之前取，否则违反 hooks 规则。
  const openSafetyMenu = useSafetyStore((s) => s.openMenu);

  useEffect(() => {
    const read = () => setSec(Number(localStorage.getItem(LS_KEY()) ?? 0));
    const t0 = setTimeout(read, 0); // 初始读取放进回调（合规：不在 effect 体内同步 setState）
    const t = setInterval(() => {
      if (document.hidden) return; // 只累计前台活跃时间
      const next = Number(localStorage.getItem(LS_KEY()) ?? 0) + 5;
      localStorage.setItem(LS_KEY(), String(next));
      setSec(next);
    }, 5000);
    const loadCfg = async () => {
      try {
        const r = await fetch("/api/guardian", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j.guardian) setCfg({ limitMin: j.guardian.limitMin, curfewStart: j.guardian.curfewStart, curfewEnd: j.guardian.curfewEnd });
      } catch { /* 保持当前值 */ }
    };
    const t1 = setTimeout(loadCfg, 0);
    const t2 = setInterval(loadCfg, 60_000);
    return () => { clearTimeout(t0); clearInterval(t); clearTimeout(t1); clearInterval(t2); };
  }, []);

  if (sec < 0) return null; // 未挂载：守护 UI 全部客户端呈现

  // —— 以下全为派生值：无额外状态机 ——
  const LIMIT_MIN = cfg.limitMin;
  const min = Math.floor(sec / 60);
  const pct = Math.min(100, (sec / (LIMIT_MIN * 60)) * 100);
  const over = min >= LIMIT_MIN;
  const tier = Math.floor(sec / (LIMIT_MIN * 60));            // 当前档位（1=满一档）
  const showGate = tier > 0 && tier > ackTier;                // 未确认的新档位 → 弹休息卡
  const sinceTier = sec - tier * LIMIT_MIN * 60;              // 进入本档后的秒数
  const restRemain = Math.max(0, REST_SEC - sinceTier);       // 倒计时（5s 粒度递减）
  const curfew = inCurfew(new Date().getHours(), cfg);

  return (
    <>
      {/* ① 用时环（固定右上，不遮 Topbar 控件） */}
      <div
        aria-label={`今日已使用 ${min} 分钟`}
        title={`今日已使用 ${min} 分钟（每 ${LIMIT_MIN} 分钟提醒休息）`}
        className="fixed right-4 top-[68px] z-[var(--z-guardian-badge)] flex items-center gap-1.5 rounded-full border border-[var(--border-2)] bg-[var(--card)]/90 px-2.5 py-1 text-[11px] shadow-[var(--shadow-sm)] backdrop-blur"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 -rotate-90">
          <circle cx="10" cy="10" r="8" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle cx="10" cy="10" r="8" fill="none" stroke={over ? "var(--warn)" : "var(--c-growth)"} strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 50.3} 50.3`} strokeLinecap="round" />
        </svg>
        <span className={over ? "font-semibold text-[var(--warn-ink)]" : "text-[var(--text-2)]"}>{min} 分钟</span>
      </div>

      {/* ② 强制休息卡（倒计时结束才可继续；不提供跳过） */}
      {showGate && !curfew && (
        <div role="dialog" aria-modal="true" aria-label="休息提醒" className="fixed inset-0 z-[var(--z-guardian-rest)] grid place-items-center bg-[rgba(15,23,42,0.55)] p-6 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[var(--r-xl)] bg-[var(--card)] p-7 text-center shadow-[var(--shadow-lg)]">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--ok-bg)] text-[var(--ok-ink)]"><TimerReset size={26} /></span>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--text)]">休息一下吧</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">
              你已累计学习 {tier * LIMIT_MIN} 分钟。起来走走、看看窗外远处，让眼睛休息一下。
            </p>
            <div className="mt-5">
              {restRemain > 0 ? (
                <div className="text-[13px] text-[var(--text-3)]">约 {restRemain}s 后可继续使用</div>
              ) : (
                <Button variant="grad" className="min-h-[44px] w-full" onClick={() => setAckTier(tier)}>
                  我休息好了，继续
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ③ 宵禁休息态（22:00–06:00；危机求助浮标 z-index 更高不受遮挡） */}
      {curfew && (
        <div role="dialog" aria-modal="true" aria-label="夜间休息" className="fixed inset-0 z-[var(--z-guardian-night)] grid place-items-center bg-[var(--night-overlay)] p-6 text-center">
          <div>
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white"><Moon size={30} /></span>
            <h2 className="mt-5 text-[18px] font-semibold text-white">夜深了，休息时间</h2>
            <p className="mx-auto mt-2 max-w-[360px] text-[13px] leading-relaxed text-white/70">
              每天 {cfg.curfewStart}:00 – 次日 {cfg.curfewEnd}:00 是休息时段，学习平台暂停使用。睡个好觉，明天见 🌙
            </p>
            {/* 对抗审查 P1：这里原本写「请点右下角『安全求助』」——而本轮曾把浮标挪到左下，
                指引与实际位置反向。这块是全站唯一「除求助外什么都点不了」的不透明全屏遮罩，
                **不能靠文案指路**。改为内联一个真实按钮：不依赖任何方位、不依赖浮标是否被遮挡。
                求助对话框 --z-safety-dialog(110) > 本遮罩 --z-guardian-night(94)，可正常盖住。 */}
            <p className="mt-4 text-[12px] text-white/45">休息时段里，需要帮助随时可以求助。</p>
            <button
              type="button"
              onClick={openSafetyMenu}
              data-safety-critical="curfew-help"
              className="mx-auto mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/25"
            >
              安全求助
            </button>
            {/* 触控目标（视觉门实测）：原为裸 <a>，实测 35×15px——远低于安全控件应有的 44×44。
                这是**夜间遮罩上唯一的电话入口**，正需要它的学生在手机上却按不准。
                SafetyHelp 里的同类链接早已是 min-h-[44px]，此处与之对齐。 */}
            <p className="mt-2 flex flex-wrap items-center justify-center gap-1 text-[12px] font-semibold text-white/80">
              <span>心理援助热线</span>
              <a
                href="tel:12356"
                data-no-press
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] bg-white/15 px-3 text-[14px] text-white underline decoration-white/40 underline-offset-2 transition hover:bg-white/25"
              >
                12356
              </a>
              <span>（24 小时）· 紧急情况拨 110 / 120</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
