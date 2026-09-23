"use client";

/**
 * /student/badges —— 数字徽章（H13 荣誉展示板重构；研究依据见 state H9/H13 条目）。
 * 信息架构（Steam 精选展示柜 / 动森博物馆范式）：页面默认只陈列「已获得」徽章的
 * 暖黄木质荣誉展示板（AIGC 板底图，REGISTRY 登记）；全量 9 系列 × 5 档收藏柜收进
 * 「徽章图鉴」全屏弹层，按钮进入——45 枚全铺的冗余从主视图移除，收集欲入口保留。
 * 三态：locked = 灰剪影 + 轻模糊（图鉴内）/重模糊（详情大图，保留神秘）；
 * 判据确定性不变：每枚点开可见「凭什么获得」current/threshold；只展示本人数据，
 * 无任何班内比较（R1）；阈值全员固定公开；徽章只增不减。
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Medal, CheckCircle2, Circle, X, BookOpen, Target } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { TIER_NAME, EVENT_LABEL, SERIES_ORDER, SERIES_META } from "@/lib/gamify";
import type { BadgeEvent } from "@/lib/gamify";
import { cn } from "@/lib/utils";
import { PageIcon } from "@/components/common/PlayIcon";

interface WallItem { id: string; name: string; desc: string; tier: number; event: BadgeEvent; threshold: number; earned: boolean; awardedAt: number | null; current: number; fresh: boolean }
interface Weekly { label: string; target: number; current: number; done: boolean; bonus: number; endsAt: number }
interface Chapter { name: string; story: string; giftPart: string; bonus: number; goals: Array<{ label: string; need: number; current: number; done: boolean }>; completed: boolean }
interface Data { badges: WallItem[]; tasks: Array<{ id: string; label: string; done: boolean }>; weekly: Weekly | null; chapter: Chapter; balance: number; ledger: Array<{ delta: number; reason: string; createdAt: number }> }

/** 几何兜底徽章（资产加载失败时回退，档位形状语言与 W-B4 一致）。 */
function Medallion({ tier, earned, className }: { tier: number; earned: boolean; className?: string }) {
  const stroke = earned ? "var(--accent)" : "var(--border)";
  const fill = earned ? "var(--rg-selected-bg)" : "transparent";
  const dash = earned ? undefined : "3 3";
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {tier === 1 && <circle cx="24" cy="24" r="14" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />}
      {tier === 2 && (<>
        <circle cx="24" cy="24" r="11" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />
        <circle cx="24" cy="24" r="17" fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray={dash} opacity="0.6" />
      </>)}
      {tier === 3 && <polygon points="24,6 39.6,15 39.6,33 24,42 8.4,33 8.4,15" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />}
      {tier === 4 && <polygon points="24,7 41,24 24,41 7,24" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />}
      {tier === 5 && <polygon points="24,5 28.7,17.8 42.3,18.3 31.6,26.7 35.3,39.8 24,32.2 12.7,39.8 16.4,26.7 5.7,18.3 19.3,17.8" fill={fill} stroke={stroke} strokeWidth="2" strokeDasharray={dash} />}
    </svg>
  );
}

/** 徽章插画：AIGC webp；加载失败回退几何徽章（资产可缺席，页面不可缺席）。 */
function BadgeArt({ badge, size, className, active }: { badge: WallItem; size: number; className?: string; active?: boolean }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <Medallion tier={badge.tier} earned={badge.earned} className={className} />;
  return (
    <Image
      src={`/art/badges/${badge.id}.webp`}
      alt={`「${badge.name}」${TIER_NAME[badge.tier]}级徽章插画`}
      width={size} height={size} loading="lazy" unoptimized
      onError={() => setBroken(true)}
      className={cn(className, "object-contain transition-transform duration-200", !badge.earned && !active && "grayscale opacity-40 blur-[2px]")}
    />
  );
}

/** H14 方案A · 进度胶囊：横向条 + 内嵌数字，比小圆环留得下标签、满格时更有成就感。 */
function ProgressCapsule({ earned, total }: { earned: number; total: number }) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return (
    <div className="play-3d play-gloss flex shrink-0 items-center gap-3 rounded-full bg-[var(--card)] py-2 pl-3 pr-4">
      <Image src="/art/icons/progress-gem.webp" alt="" aria-hidden width={72} height={72} unoptimized className="h-9 w-9 shrink-0 object-contain" />
      <div>
        <p className="flex items-baseline gap-1 leading-none">
          <span className="text-[24px] font-extrabold text-[var(--play-primary)]">{earned}</span>
          <span className="text-[13px] font-semibold text-[var(--text-3)]">/ {total} 枚</span>
        </p>
        <span role="img" aria-label={`已收集 ${earned} 枚，共 ${total} 枚`}
          className="mt-1.5 block h-2 w-[132px] overflow-hidden rounded-full bg-[var(--rg-control-bg)] shadow-[inset_0_1px_3px_rgba(91,33,182,0.22)]">
          <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, backgroundImage: "var(--play-grad-pp)" }} />
        </span>
      </div>
    </div>
  );
}


/** H14 · 图鉴图标：3D 卡通书本资产，缺席时回退线性图标（资产可缺席，页面不可缺席）。 */
function CodexIcon() {
  const [broken, setBroken] = useState(false);
  if (broken) return <BookOpen size={16} className="shrink-0 text-[var(--play-primary)]" />;
  return (
    <Image src="/art/icons/codex-book.webp" alt="" aria-hidden width={64} height={64} unoptimized
      onError={() => setBroken(true)} className="h-7 w-7 shrink-0 object-contain" />
  );
}


/** 恒定星芒偏移表（不在渲染里取随机数——React 纯度规则）。 */
const STAR_OFFSETS: Array<{ sx: string; sy: string; d: string; s: string; c: string }> = [
  { sx: "-74px", sy: "-58px", d: "0s", s: "15px", c: "var(--c-edu)" },
  { sx: "70px", sy: "-64px", d: ".08s", s: "12px", c: "#F5B301" },
  { sx: "-88px", sy: "8px", d: ".16s", s: "10px", c: "#F5B301" },
  { sx: "86px", sy: "16px", d: ".12s", s: "14px", c: "var(--c-edu)" },
  { sx: "-52px", sy: "72px", d: ".2s", s: "11px", c: "#EC4899" },
  { sx: "58px", sy: "78px", d: ".05s", s: "13px", c: "#F5B301" },
  { sx: "0px", sy: "-92px", d: ".24s", s: "12px", c: "var(--c-edu)" },
  { sx: "-20px", sy: "88px", d: ".3s", s: "10px", c: "#8B5CF6" },
];

/**
 * H11 · 徽章详情弹层：点击放大查看——大图 + 吉祥物艺术小传（来历/守护什么）+
 * 「凭什么获得」真实计数。锁定态大图重模糊 + 放大裁边（保留神秘：轮廓可辨、
 * 边缘细节不泄密），小传照给（认识吉祥物本身不剧透徽章画面）。
 */
function BadgeDetailModal({ badge, isNext, onClose }: { badge: WallItem; isNext: boolean; onClose: () => void }) {
  const meta = SERIES_META[badge.event];
  const revealed = badge.earned || isNext;
  return createPortal((
    <div
      role="dialog" aria-modal="true" aria-label={`徽章详情：${badge.name}`}
      className="fixed inset-0 z-[var(--z-app-modal)] grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[400px] rounded-[20px] border border-[var(--border-2)] bg-[var(--card)] p-6 text-center shadow-[0_24px_64px_rgba(15,23,42,0.25)]">
        <button autoFocus type="button" onClick={onClose} aria-label="关闭详情"
          className="absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]">
          <X size={16} />
        </button>
        <div className="relative mx-auto mt-1 h-[176px] w-[176px] overflow-hidden">
          <BadgeArt badge={badge} size={176}
            className={cn("h-[176px] w-[176px]", !revealed && "scale-110 blur-[14px] grayscale opacity-45")} active={isNext} />
        </div>
        <p className="mt-3 text-[16px] font-semibold text-[var(--text)]">
          {badge.name} <span className="text-[13px] font-normal text-[var(--text-3)]">{TIER_NAME[badge.tier]}级 · {meta.name}系列</span>
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{badge.desc}</p>
        <div className="mt-3 rounded-[12px] bg-[var(--rg-control-bg)] p-3 text-left">
          <p className="text-[12px] font-semibold text-[var(--text-3)]">「{meta.mascot}」的小传</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{meta.lore}</p>
        </div>
        <p className="mt-3 text-[12px] text-[var(--text-3)]">
          凭什么获得：{EVENT_LABEL[badge.event]} {badge.current}/{badge.threshold}
          {badge.earned && badge.awardedAt ? ` · ${new Date(badge.awardedAt).toLocaleDateString("zh-CN")} 获得` : badge.current > 0 ? ` · 还差 ${badge.threshold - badge.current} 次` : ""}
        </p>
        {!badge.earned && <p className="mt-1 text-[12px] text-[var(--text-3)]">解锁后揭晓这一档的完整模样。</p>}
      </div>
    </div>
  ), document.body);
}

/**
 * H10 · 解锁庆祝：一次只弹一枚、逐枚排队、可跳过（研究结论：获得瞬间值得仪式感，
 * 但不搞通知轰炸）；每枚播放完 POST ack 落库（服务端权威，换设备/刷新不重播）；
 * 文案做努力归因（「这是你 N 次 X 换来的」）；prefers-reduced-motion 降级为静态。
 */
function UnlockCelebration({ queue, onDone }: { queue: WallItem[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const badge = queue[idx];
  if (!badge) return null;
  const ack = (ids: string[]) => {
    void fetch("/api/badges", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids }) }).catch(() => {});
  };
  const next = () => { ack([badge.id]); if (idx + 1 < queue.length) setIdx(idx + 1); else onDone(); };
  const skipAll = () => { ack(queue.slice(idx).map((b) => b.id)); onDone(); };
  const phrase = badge.event === "active_days"
    ? `这是你坚持了 ${badge.threshold} 天换来的`
    : badge.event === "activity_approved"
      ? `这是你 ${badge.threshold} 个入册作品换来的`
      : `这是你 ${badge.threshold} 次「${EVENT_LABEL[badge.event]}」换来的`;
  return createPortal((
    <div
      role="dialog" aria-modal="true" aria-label={`解锁新徽章：${badge.name}`}
      className="fixed inset-0 z-[var(--z-app-modal)] grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"
      onKeyDown={(e) => { if (e.key === "Escape") skipAll(); }}
      onClick={(e) => { if (e.target === e.currentTarget) skipAll(); }}
    >
      <style>{`
        @keyframes h10pop { 0% { transform: scale(.3) rotate(-14deg); opacity: 0 } 62% { transform: scale(1.08) rotate(3deg); opacity: 1 } 100% { transform: scale(1) rotate(0) } }
        @keyframes h10star { 0% { transform: translate(0, 0) scale(.3); opacity: 0 } 30% { opacity: 1 } 100% { transform: translate(var(--sx), var(--sy)) scale(1); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .h10-pop, .h10-star { animation: none !important; opacity: 1 !important } }
      `}</style>
      <div key={badge.id} className="w-full max-w-[360px] rounded-[20px] border border-[var(--border-2)] bg-[var(--card)] p-6 text-center shadow-[0_24px_64px_rgba(15,23,42,0.25)]">
        <p className="text-[13px] font-semibold text-[var(--c-edu)]">解锁新徽章！</p>
        <div className="relative mx-auto mt-3 h-[160px] w-[160px]">
          {STAR_OFFSETS.map((o, i) => (
            <span key={i} aria-hidden className="h10-star pointer-events-none absolute left-1/2 top-1/2 leading-none"
              style={{ "--sx": o.sx, "--sy": o.sy, fontSize: o.s, color: o.c, animation: `h10star .9s ease-out ${o.d} both` } as React.CSSProperties}>✦</span>
          ))}
          <BadgeArt badge={badge} size={160} className="h10-pop h-[160px] w-[160px]" active />
        </div>
        <p className="mt-3 text-[16px] font-semibold text-[var(--text)]">{badge.name} <span className="text-[13px] font-normal text-[var(--text-3)]">{TIER_NAME[badge.tier]}级</span></p>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">{phrase}——都是你真实做过的事。</p>
        <button autoFocus type="button" onClick={next}
          className="mt-4 min-h-[44px] w-full rounded-full text-[14px] font-semibold text-white shadow-md transition hover:-translate-y-0.5"
          style={{ backgroundImage: "var(--grad-primary)" }}>
          {idx + 1 < queue.length ? `太棒了！看下一枚（还有 ${queue.length - idx - 1} 枚）` : "太棒了！"}
        </button>
        {queue.length - idx > 1 && (
          <button type="button" onClick={skipAll} className="mt-2 min-h-[40px] w-full rounded-full text-[13px] text-[var(--text-3)] transition-colors hover:text-[var(--text)]">全部跳过</button>
        )}
      </div>
    </div>
  ), document.body);
}

/**
 * H13 · 荣誉展示板：页面主陈列面——只挂「已获得」徽章（Steam 精选展示柜范式），
 * 暖黄木质板底图为 AIGC 资产（挂载失败回退暖色系 surface）；上板逐枚弹入动效，
 * 悬停轻抬；空板给友好空态（0 枚也看得见板子，第一枚有地方可挂）。
 */
function HonorBoard({ earnedBadges, onOpenBadge }: { earnedBadges: WallItem[]; onOpenBadge: (id: string) => void }) {
  const [bgBroken, setBgBroken] = useState(false);
  return (
    <div className="relative w-full overflow-hidden rounded-[20px]">
      <style>{`
        @keyframes h13pop { 0% { transform: scale(.4) translateY(10px); opacity: 0 } 70% { transform: scale(1.06) translateY(-2px); opacity: 1 } 100% { transform: scale(1) translateY(0) } }
        @media (prefers-reduced-motion: reduce) { .h13-pop { animation: none !important; opacity: 1 !important } }
      `}</style>
      <div className={cn("relative w-full", bgBroken ? "aspect-[2/1] rounded-[20px] border border-[var(--border-2)] bg-[var(--rg-selected-bg)]" : "aspect-[1400/910]")}>
        {!bgBroken && (
          <Image src="/art/badge-board.webp" alt="" aria-hidden fill unoptimized
            onError={() => setBgBroken(true)} className="object-contain" />
        )}
        <div className="absolute bottom-[10%] left-[8%] right-[8%] top-[20%] flex flex-wrap content-center items-center justify-center gap-x-2 gap-y-2 sm:gap-x-4 sm:gap-y-3">
          {earnedBadges.length === 0 && (
            <p className="rounded-full bg-[var(--card)]/85 px-4 py-2 text-center text-[13px] text-[var(--text-2)] shadow-sm">
              展示板还空着——完成第一件小事，第一枚徽章就会挂上来。
            </p>
          )}
          {earnedBadges.map((b, i) => (
            <button key={b.id} type="button" onClick={() => onOpenBadge(b.id)}
              aria-haspopup="dialog" aria-label={`查看徽章详情：${b.name}，${TIER_NAME[b.tier]}级，已获得`}
              className="h13-pop group flex min-h-[44px] flex-col items-center gap-0.5"
              style={{ animation: `h13pop .5s cubic-bezier(.34,1.56,.64,1) ${Math.min(i * 0.06, 1.2)}s both` }}>
              <BadgeArt badge={b} size={112} className="h-12 w-12 drop-shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:rotate-2 sm:h-[72px] sm:w-[72px] md:h-20 md:w-20" />
              <span className="max-w-[84px] truncate rounded-full bg-[var(--card)]/85 px-2 py-0.5 text-[12px] font-semibold text-[var(--text)] shadow-sm">{b.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * H13 · 徽章图鉴：全量 9 系列 × 5 档收藏柜（原页面主体）收进全屏弹层——
 * 主视图只留荣誉板，收集欲全景（含灰剪影与进度）按需打开。
 */
function CollectionCodex({ badges, onOpenBadge, onClose }: {
  badges: WallItem[]; onOpenBadge: (id: string) => void; onClose: () => void;
}) {
  const earned = badges.filter((b) => b.earned).length;
  return createPortal((
    <div
      role="dialog" aria-modal="true" aria-label="徽章图鉴"
      className="fixed inset-0 z-[var(--z-app-modal)] grid place-items-center bg-slate-950/30 p-3 backdrop-blur-sm sm:p-6"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes h13codex { 0% { transform: scale(.96) translateY(10px); opacity: 0 } 100% { transform: scale(1) translateY(0); opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .h13-codex { animation: none !important; opacity: 1 !important } }
      `}</style>
      <div className="h13-codex flex max-h-[92vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[20px] border border-[var(--border-2)] bg-[var(--bg)] shadow-[0_24px_64px_rgba(15,23,42,0.25)]" style={{ animation: "h13codex .28s ease-out both" }}>
        <div className="flex items-center gap-2 border-b border-[var(--border-2)] bg-[var(--card)] px-4 py-3">
          <CodexIcon />
          <h2 className="text-[16px] font-semibold text-[var(--text)]">徽章图鉴</h2>
          <span className="text-[13px] text-[var(--text-3)]">已收集 {earned}/{badges.length}</span>
          <span className="ml-auto hidden text-[12px] text-[var(--text-3)] sm:block">展示板与徽章插画由 AI 生成</span>
          <button autoFocus type="button" onClick={onClose} aria-label="关闭图鉴"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {SERIES_ORDER.map((event) => {
            const items = badges.filter((b) => b.event === event).sort((a, b) => a.tier - b.tier);
            if (items.length === 0) return null;
            const meta = SERIES_META[event];
            const got = items.filter((b) => b.earned).length;
            const next = items.find((b) => !b.earned);
            const full = got === items.length;
            return (
              <div key={event} className={cn("surface-card p-4", full && "border-[var(--c-edu)]/45")}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-[14px] font-semibold text-[var(--text)]">{meta.name}</h3>
                  <span className={cn("text-[12px]", full ? "font-semibold text-[var(--c-edu)]" : "text-[var(--text-3)]")}>{full ? "全部集齐！" : `${got}/${items.length} 枚`}</span>
                  <span className="ml-auto min-w-0 truncate text-[12px] text-[var(--text-3)]">
                    {next ? `下一枚「${next.name}」还差 ${next.threshold - next.current} 次` : meta.blurb}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-5 gap-1.5 sm:gap-2.5">
                  {items.map((b) => {
                    const isNext = next?.id === b.id;
                    return (
                      <button key={b.id} type="button" onClick={() => onOpenBadge(b.id)}
                        aria-haspopup="dialog" aria-label={`查看徽章详情：${b.name}，${TIER_NAME[b.tier]}级，${b.earned ? "已获得" : `进度 ${b.current}/${b.threshold}`}`}
                        className="group flex min-h-[44px] flex-col items-center gap-1 rounded-[12px] p-1.5 pt-2 text-center transition-colors hover:bg-[var(--rg-hover-bg)]">
                        <BadgeArt badge={b} size={88} className="h-[52px] w-[52px] group-hover:scale-110 group-hover:-rotate-2 sm:h-[72px] sm:w-[72px]" active={isNext} />
                        <span className={cn("w-full truncate text-[12px] leading-tight", b.earned ? "font-semibold text-[var(--text)]" : "text-[var(--text-3)]")}>{b.name}</span>
                        {isNext ? (
                          <span className="block h-1 w-4/5 overflow-hidden rounded-full bg-[var(--rg-control-bg)]">
                            <span className="block h-full rounded-full bg-[var(--c-edu)]" style={{ width: `${Math.round((b.current / b.threshold) * 100)}%` }} />
                          </span>
                        ) : (
                          <span className="text-[12px] leading-none text-[var(--text-3)]">{TIER_NAME[b.tier]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-[12px] leading-relaxed text-[var(--text-3)]">45 枚徽章从第一天起全部可见，阈值对每个人都一样；徽章只增不减、永不过期，也永远只和你自己的记录有关。</p>
        </div>
      </div>
    </div>
  ), document.body);
}

export default function BadgesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState("");
  const [codexOpen, setCodexOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/badges").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const badges = data?.badges ?? [];
  const earned = badges.filter((b) => b.earned).length;
  // H10：待庆祝队列 = fresh 徽章按获得时间排队；本次会话播完/跳过即收（服务端 ack 保证跨会话不重播）
  const [celebrationDone, setCelebrationDone] = useState(false);
  const freshQueue = celebrationDone ? [] : badges.filter((b) => b.fresh).sort((a, b) => (a.awardedAt ?? 0) - (b.awardedAt ?? 0));
  // 「只差一点」：各系列「下一枚」里按进度比取前 3（禀赋进度 + 目标梯度；
  // 只收下一档——同一计数器的更远档位不重复曝光）
  const nextIds = new Set(
    SERIES_ORDER.map((ev) => badges.filter((b) => b.event === ev && !b.earned).sort((a, b) => a.tier - b.tier)[0]?.id).filter(Boolean)
  );
  const almost = badges
    .filter((b) => nextIds.has(b.id) && b.current > 0)
    .sort((a, b) => b.current / b.threshold - a.current / a.threshold)
    .slice(0, 3);
  // 展示板陈列序：高档在前（稀有居前更像荣誉墙），同档按获得时间
  const earnedBadges = badges
    .filter((b) => b.earned)
    .sort((a, b) => b.tier - a.tier || (a.awardedAt ?? 0) - (b.awardedAt ?? 0));

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[920px]">
        <Reveal>
          {/* 头部：标题 + 诚实口径 + 总进度环 */}
          <div className="flex flex-wrap items-center gap-3">
            <PageIcon name="badge" fallback={Medal} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">数字徽章</h1>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">每一枚都对应你真实做过的事——点开能看到「凭什么获得」。这里只有你自己，没有排行。</p>
            </div>
            {/* 窄屏让胶囊整行换行：与标题挤同排会把「数字徽章」压成两行、描述压成窄条（390px 实拍抓到） */}
            {data && <div className="basis-full sm:basis-auto"><ProgressCapsule earned={earned} total={badges.length} /></div>}
          </div>

          {error && <p role="alert" className="mt-4 text-[13px] text-[var(--c-alert)]">徽章数据加载失败，稍后再试。</p>}
          {!data && !error && <p className="mt-4 text-[13px] text-[var(--text-3)]">正在读取徽章墙…</p>}

          {data && (
            <>
              {/* H13 · 荣誉展示板：只陈列已获得（全量收进图鉴弹层） */}
              <section aria-label="荣誉展示板" className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-[var(--text)]">荣誉展示板</h2>
                  <span className="text-[13px] text-[var(--text-3)]">已挂上 {earned} 枚</span>
                  <button type="button" onClick={() => setCodexOpen(true)} aria-haspopup="dialog"
                    className="play-3d play-gloss ml-auto inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[var(--card)] py-1.5 pl-2 pr-4 text-[14px] font-semibold text-[var(--play-primary)]">
                    <CodexIcon />
                    徽章图鉴 <span className="text-[13px] font-semibold text-[var(--text-3)]">{earned}/{badges.length}</span>
                  </button>
                </div>
                <div className="mt-2">
                  <HonorBoard earnedBadges={earnedBadges} onOpenBadge={setOpen} />
                </div>
              </section>

              {/* 只差一点：最接近解锁的 1-3 枚（个人绝对量，无任何比较） */}
              {almost.length > 0 && (
                <section aria-label="只差一点" className="surface-card mt-4 p-4">
                  <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-[var(--text)]"><Target size={14} className="text-[var(--c-edu)]" /> 只差一点</h2>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {almost.map((b) => (
                      <div key={b.id} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-2)] p-2.5">
                        <BadgeArt badge={b} size={40} className="h-10 w-10 shrink-0" active />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-[var(--text)]">{b.name}</p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--rg-control-bg)]" role="progressbar" aria-valuemin={0} aria-valuemax={b.threshold} aria-valuenow={b.current} aria-label={`${b.name} 进度`}>
                            <div className="h-full rounded-full bg-[var(--c-edu)]" style={{ width: `${Math.round((b.current / b.threshold) * 100)}%` }} />
                          </div>
                          <p className="mt-0.5 text-[12px] text-[var(--text-3)]">还差 {b.threshold - b.current} 次 · {b.current}/{b.threshold}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 日任务 + 周协作副本：并列（月剧情通栏在下） */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <section aria-label="今日小任务" className="surface-card p-4">
                  <h2 className="text-[14px] font-semibold text-[var(--text)]">今日小任务</h2>
                  <ul className="mt-2 space-y-1.5">
                    {data.tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 text-[13px]">
                        {t.done ? <CheckCircle2 size={15} className="shrink-0 text-[var(--ok-ink)]" /> : <Circle size={15} className="shrink-0 text-[var(--text-3)]" />}
                        <span className={t.done ? "text-[var(--text-3)] line-through" : "text-[var(--text)]"}>{t.label}</span>
                      </li>
                    ))}
                  </ul>
                  {data.tasks.every((t) => t.done) && (
                    <p className="mt-2 text-[12px] text-[var(--ok-ink)]">今日任务全部完成——已经很好了，去休息一下吧。</p>
                  )}
                </section>

                {/* F4 周协作副本：全班共享一条进度条——刻意没有任何个人占比或名单（R1） */}
                {data.weekly ? (
                  <section aria-label="本周协作副本" className="surface-card p-4">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <h2 className="text-[14px] font-semibold text-[var(--text)]">本周协作副本</h2>
                      <span className="text-[12px] text-[var(--text-3)]">全班一条进度条 · 达成每人 +{data.weekly.bonus} 分</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-[var(--text)]">{data.weekly.label}</p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--rg-control-bg)]" role="progressbar"
                      aria-valuemin={0} aria-valuemax={data.weekly.target} aria-valuenow={data.weekly.current} aria-label="班级共同进度">
                      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round((data.weekly.current / data.weekly.target) * 100)}%`, backgroundImage: "var(--grad-primary)" }} />
                    </div>
                    <p className="mt-1.5 text-[12px] text-[var(--text-2)]">
                      {data.weekly.done ? "达成了——这周大家一起做到的。" : `${data.weekly.current}/${data.weekly.target}，还差的部分谁补上都算数；没达成也不会有任何惩罚。`}
                    </p>
                  </section>
                ) : <div className="hidden md:block" aria-hidden />}
              </div>

              {/* F4 月度剧情副本 */}
              <section aria-label="本月剧情副本" className="surface-card mt-4 p-4">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[14px] font-semibold text-[var(--text)]">本月剧情 · {data.chapter.name}</h2>
                  {data.chapter.completed && <span className="text-[12px] text-[var(--ok-ink)]">本章完成</span>}
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">{data.chapter.story}</p>
                <ul className="mt-2 space-y-1.5">
                  {data.chapter.goals.map((g) => (
                    <li key={g.label} className="flex items-center gap-2 text-[13px]">
                      {g.done ? <CheckCircle2 size={15} className="shrink-0 text-[var(--ok-ink)]" /> : <Circle size={15} className="shrink-0 text-[var(--text-3)]" />}
                      <span className={g.done ? "text-[var(--text-3)] line-through" : "text-[var(--text)]"}>{g.label}</span>
                      <span className="ml-auto text-[12px] text-[var(--text-3)]">{g.current}/{g.need}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[12px] text-[var(--text-3)]">完成全部目标：+{data.chapter.bonus} 分，并获得一件庄园建材（直接进仓库）。</p>
              </section>
            </>
          )}
        </Reveal>
      </div>
      {codexOpen && <CollectionCodex badges={badges} onOpenBadge={setOpen} onClose={() => setCodexOpen(false)} />}
      {(() => {
        const sel = badges.find((b) => b.id === open);
        return sel ? <BadgeDetailModal badge={sel} isNext={nextIds.has(sel.id)} onClose={() => setOpen("")} /> : null;
      })()}
      {freshQueue.length > 0 && <UnlockCelebration queue={freshQueue} onDone={() => setCelebrationDone(true)} />}
    </div>
  );
}
