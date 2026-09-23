"use client";

/**
 * SafetyHelp — 内容安全·求助/举报入口（评审 a11y P1-7 / 安全 P0-3 / P1-4 / P1-5）。
 * 面向中小学未成年人保护：举报不当内容、寻求帮助（持久化呈现真实热线，不靠瞬时 toast）、了解数据如何被保护。
 * 由 useSafetyStore 驱动 open/panel —— chat 危机分支可程序化打开（避免「右下角按钮」式感官方位指代）。
 * 可达：role=dialog / aria-modal / Escape / 焦点管理。
 */
import { useEffect, useRef, useState } from "react";
import * as motion from "motion/react-client";
import { AnimatePresence, MotionConfig } from "motion/react";
import { LifeBuoy, Flag, HeartHandshake, ShieldCheck, X, ChevronRight, Phone, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useMotionPref } from "@/lib/hooks/useReducedMotion";
import { useSafetyStore } from "@/lib/store/useSafetyStore";
import { CRISIS_HOTLINE, CRISIS_HOTLINE_NATIONAL, EMERGENCY_NUMBERS } from "@/lib/safety/hotlines";

export function SafetyHelp() {
  const open = useSafetyStore((s) => s.open);
  const panel = useSafetyStore((s) => s.panel);
  const setOpen = useSafetyStore((s) => s.setOpen);
  const setPanel = useSafetyStore((s) => s.setPanel);
  const openMenu = useSafetyStore((s) => s.openMenu);
  const closeRef = useRef<HTMLButtonElement>(null);
  const motionPref = useMotionPref();
  const [helpDetail, setHelpDetail] = useState("");
  const [helpBusy, setHelpBusy] = useState(false);
  const [helpReceipt, setHelpReceipt] = useState("");

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // 举报：落库为工单（/api/safety），诚实回执——不谎称「已送达某个大人」。
  //
  // ⚠️ 本函数曾有两处会把**失败报告成成功**，是全项目对铁律①最直接的一次违反：
  //   (a) 不查 res.ok——服务端 500 只要回了 JSON 就照样弹成功；
  //   (b) catch 分支直接 toast.success("你的反馈已记录…")——网络断了也说记录了。
  // 后果不是「体验不好」：一个正在被欺凌的学生以为已经求助过了，于是不再采取
  // 其他行动，而系统里根本没有这条记录。同文件的 requestHelp() 一直是对的
  // （查 res.ok、失败时给线下出口），两者的差异说明这不是设计取舍而是遗漏。
  //
  // 失败路径的三条要求，与 requestHelp() 对齐：
  //   ① 明说没记上，不用「可能/似乎」这类含糊词；
  //   ② 给一条不依赖本系统的线下出口（找信任的大人 / 110·120）；
  //   ③ 用 toast.error 而不是 success——语义与颜色都不能骗人。
  const report = async () => {
    setOpen(false);
    const offline = "请先联系身边信任的大人；如果有立即危险，请拨打 110 / 120。";
    try {
      const res = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "report" }) });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json().catch(() => null);
      toast.success(j?.message ?? "你的反馈已记录，将转交校内安全团队核实", { description: j?.ticketId ? `工单号 ${j.ticketId} · 完全保密` : "完全保密。" });
    } catch {
      toast.error("反馈没有提交成功，系统里没有留下记录。", { description: offline, duration: 12000 });
    }
  };

  // 求助：落库为工单，回执如实（已记录 + 提示联系大人），不制造「已送达」错觉。
  const requestHelp = async () => {
    setHelpBusy(true);
    setHelpReceipt("");
    try {
      const detail = helpDetail.trim();
      const res = await fetch("/api/safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "help", ...(detail ? { detail } : {}) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json().catch(() => null);
      setHelpReceipt(`${j?.message ?? "你的求助已记录，请同时联系身边信任的大人。"}${j?.ticketId ? ` 工单号 ${j.ticketId}` : ""}`);
    } catch {
      setHelpReceipt("求助记录暂时提交失败。请先联系身边信任的大人；如果有立即危险，请拨打 110 / 120。");
    } finally {
      setHelpBusy(false);
    }
  };

  return (
    <MotionConfig reducedMotion={motionPref}>
      <button
        type="button"
        onClick={openMenu}
        aria-label="内容安全与求助"
        // 几何（两轮修正，第一次改错了）：
        //   第一次改成「<md 移到左下」是错的——把碰撞从「压住发送键」搬成了「压住提示词库」：
        //   实测 elementFromPoint(提示词库中心) 返回的是本浮标，即手机上提示词库 100% 不可达，
        //   且学生想点提示词库却弹出危机求助，反过来给安全通道制造噪声、长期钝化。
        //   正解是让浮标**自动避让底部输入区**：Composer 挂载时把自身高度写进 --composer-h，
        //   本浮标据此上移；无 Composer 的页面回落默认值。位置**始终在右下**，不随断点跳来跳去
        //   （方位一致性很重要——全站多处求助指引会指向它）。
        //   断言见 render.mjs R3：浮标不得与**任何**可交互元素相交，而不只是发送键。
        style={{ bottom: "calc(var(--composer-h, 4rem) + 1rem)" }}
        className="fixed right-5 z-[var(--z-safety-fab)] inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--border-2)] bg-[var(--card)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--text)] shadow-[var(--shadow-lg)] transition hover:-translate-y-0.5 hover:border-[var(--ok)]/40"
      >
        <LifeBuoy size={15} className="text-[var(--ok-ink)]" />
        安全求助
      </button>

      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-[var(--z-safety-dialog)] flex items-end justify-end p-4 sm:items-center sm:justify-center"
            role="dialog" aria-modal="true" aria-labelledby="safety-title"
          >
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[rgba(15,23,42,0.4)] backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[400px] overflow-hidden rounded-[20px] border border-[var(--border-2)] bg-[var(--card)] shadow-[var(--shadow-lg)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-2)] px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-[12px] bg-[var(--ok-bg)] text-[var(--ok-ink)]">
                    <ShieldCheck size={16} />
                  </span>
                  <h2 id="safety-title" className="text-[14px] font-bold text-[var(--text)]">
                    {panel === "help" ? "需要帮助吗？我在这儿" : "内容安全与求助"}
                  </h2>
                </div>
                <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="关闭"
                  className="grid h-12 w-12 place-items-center rounded-full text-[var(--text-3)] transition hover:bg-[var(--bg-2)] hover:text-[var(--text)]">
                  <X size={16} />
                </button>
              </div>

              {panel === "menu" && (
                <div className="p-3">
                  <SafetyRow icon={HeartHandshake} tint="var(--p-rose)" ink="var(--p-rose-ink)"
                    title="我需要帮助" desc="遇到困扰，想联系老师或寻求支持" onClick={() => setPanel("help")} />
                  <SafetyRow icon={Flag} tint="var(--err-bg)" ink="var(--err-ink)"
                    title="举报不当内容" desc="发现不安全、不适宜的回答或资料" onClick={report} />
                  <SafetyRow icon={ShieldCheck} tint="var(--ok-bg)" ink="var(--ok-ink)"
                    title="我的数据谁能看到？" desc="了解校内存储与未成年人保护" onClick={() => setPanel("privacy")} />
                </div>
              )}

              {panel === "help" && (
                <div className="px-5 py-4 text-[13px] leading-relaxed text-[var(--text-2)]">
                  <p className="text-[var(--text)]">如果你正遇到困难，你并不孤单，也没有做错什么 💙 可以这样做：</p>
                  <ol className="mt-3 space-y-2.5">
                    <li>1. <strong className="text-[var(--text)]">立刻联系信任的大人</strong>——班主任、任课老师或家长。</li>
                    <li>2. 拨打 24 小时心理援助热线：
                      <a href={`tel:${CRISIS_HOTLINE_NATIONAL}`} className="ml-1 inline-flex min-h-[44px] items-center gap-1 rounded-[12px] px-1 font-semibold text-[var(--c-edu)] hover:bg-[var(--rg-hover-bg)] hover:underline">
                        <Phone size={12} /> {CRISIS_HOTLINE_NATIONAL}（全国统一）
                      </a>
                      <span className="mx-1 text-[var(--text-3)]">或</span>
                      <a href={`tel:${CRISIS_HOTLINE}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-[12px] px-1 font-semibold text-[var(--c-edu)] hover:bg-[var(--rg-hover-bg)] hover:underline">
                        <Phone size={12} /> {CRISIS_HOTLINE}
                      </a>
                    </li>
                    <li>3. 简单写下希望老师了解的情况，再点击「请老师联系我」。</li>
                  </ol>
                  <div className="mt-3 rounded-[12px] bg-[var(--p-rose)] px-3 py-2 text-[12px] text-[var(--p-rose-ink)]">
                    如果情况紧急、有立即危险，请马上拨打 {EMERGENCY_NUMBERS} 或告诉身边的大人。
                  </div>
                  <label htmlFor="safety-help-detail" className="mt-3 block text-[12px] font-semibold text-[var(--text)]">
                    补充情况
                  </label>
                  <textarea
                    id="safety-help-detail"
                    aria-label="补充情况"
                    value={helpDetail}
                    maxLength={500}
                    onChange={(event) => setHelpDetail(event.target.value)}
                    className="mt-1.5 min-h-[92px] w-full resize-none rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 py-2 text-[13px] leading-5 text-[var(--text)] outline-none transition placeholder:text-[var(--text-3)] focus:border-[var(--c-edu)] focus:ring-2 focus:ring-[var(--c-edu)]/20"
                    placeholder="可以写下希望安全 / 心理团队了解的情况；不需要填写真实手机号或邮箱。"
                  />
                  <p className="mt-1 text-[11px] leading-5 text-[var(--text-3)]">提交后只对校内安全 / 心理团队可见，手机号、邮箱和长编号会自动脱敏。</p>
                  {helpReceipt ? (
                    <div role="status" className="mt-3 rounded-[12px] bg-[var(--ok-bg)] px-3 py-2 text-[12px] leading-5 text-[var(--ok-ink)]">
                      {helpReceipt}
                    </div>
                  ) : null}
                  <button type="button" onClick={requestHelp} disabled={helpBusy}
                    className="mt-3 min-h-[44px] w-full rounded-full bg-[var(--c-edu)] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60">
                    {helpBusy ? "提交中…" : "请老师联系我"}
                  </button>
                  <button type="button" onClick={() => setPanel("menu")}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-[12px] px-2 text-[13px] font-semibold text-[var(--c-edu)] hover:bg-[var(--rg-hover-bg)] hover:underline">
                    <ArrowLeft size={13} /> 返回
                  </button>
                </div>
              )}

              {panel === "privacy" && (
                <div className="px-5 py-4 text-[13px] leading-relaxed text-[var(--text-2)]">
                  <ul className="space-y-2.5">
                    <li>· 你的对话与文件<strong className="text-[var(--text)]">存储在学校内部服务器</strong>；AI 回答与生图会经加密通道调用校外大模型服务完成计算，内容仅用于生成结果，不用于其他用途。</li>
                    {/* 曾写「老师 / 家长能看到」。产品没有家长账号（角色只有师/生/管/研），
                        对未成年人承诺一条不存在的数据可见路径属编造（铁律②）。
                        上面求助面板里的「班主任、任课老师或家长」不同——那是现实里的
                        信任大人，不是产品角色，保留。 */}
                    <li>· 老师能看到：<strong className="text-[var(--text)]">使用时长与安全提醒</strong>；看不到你的<strong className="text-[var(--text)]">聊天原文</strong>（除非触发安全保护规则）。</li>
                    <li>· 你寻求心理帮助的内容，<strong className="text-[var(--text)]">默认对老师匿名</strong>，只有校内安全 / 心理团队能看到。</li>
                    <li>· 你随时可以举报内容或申请删除自己的数据，相关请求会被如实记录。</li>
                  </ul>
                  <button type="button" onClick={() => setPanel("menu")}
                    className="mt-4 inline-flex min-h-[44px] items-center gap-1 rounded-[12px] px-2 text-[13px] font-semibold text-[var(--c-edu)] hover:bg-[var(--rg-hover-bg)] hover:underline">
                    <ArrowLeft size={13} /> 返回
                  </button>
                </div>
              )}

              <div className="border-t border-[var(--border-2)] px-5 py-2.5 text-center text-[11px] text-[var(--text-3)]">
                本平台面向中小学，以保护你的安全与隐私为先
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

function SafetyRow({
  icon: Icon, tint, ink, title, desc, onClick,
}: {
  icon: React.ComponentType<{ size?: number }>;
  tint: string; ink: string; title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3 rounded-[12px] p-2.5 text-left transition hover:bg-[var(--rg-hover-bg)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px]" style={{ background: tint, color: ink }}>
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--text)]">{title}</span>
        <span className="block text-[12px] text-[var(--text-2)]">{desc}</span>
      </span>
      <ChevronRight size={15} className="text-[var(--text-3)]" />
    </button>
  );
}
