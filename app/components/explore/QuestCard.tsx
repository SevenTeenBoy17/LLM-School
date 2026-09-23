"use client";

import { useRouter } from "next/navigation";
import * as motion from "motion/react-client";
import { ArrowRight, Check, Clock } from "lucide-react";
import { type ExploreQuest } from "@/lib/data/explore";
import { SubjectMark } from "@/components/explore/SubjectMark";

const STATUS: Record<ExploreQuest["status"], { label: string; cls: string }> = {
  new: { label: "全新", cls: "bg-[var(--proc-bg)] text-[var(--proc-ink)]" },
  hot: { label: "热门", cls: "bg-[var(--err-bg)] text-[var(--err-ink)]" },
  continue: { label: "继续", cls: "bg-[var(--info-bg)] text-[var(--info-ink)]" },
  done: { label: "已完成", cls: "bg-[var(--ok-bg)] text-[var(--ok-ink)]" },
};

export function QuestCard({ quest, index = 0 }: { quest: ExploreQuest; index?: number }) {
  const router = useRouter();
  const state = STATUS[quest.status];
  const done = quest.status === "done";

  return (
    <motion.button
      type="button"
      data-testid="explore-quest-card"
      data-status={quest.status}
      data-href={quest.href}
      onClick={() => router.push(quest.href)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.35), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      aria-label={`探索任务：${quest.title}，学科 ${quest.subject}，进度 ${quest.progress}%，状态 ${state.label}`}
      className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)] focus-visible:ring-offset-2"
    >
      <div
        className="relative h-[156px] w-full overflow-hidden"
        style={{ background: `linear-gradient(180deg, ${quest.accent} 0%, rgba(255,255,255,0) 100%)` }}
      >
        <span
          className="absolute left-3 top-3 z-10 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: quest.accent, color: quest.ink }}
        >
          {quest.subject}
        </span>
        <span className={`absolute right-3 top-3 z-10 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.cls}`}>
          {done && <Check size={10} />} {state.label}
        </span>

        {/* 位图插画 → 纯几何标记（§6.4-4 默认路径，理由见 SubjectMark.tsx 顶部）。
            顺带去掉了原来的 ART_MASK：那个径向遮罩是用来柔化位图硬边的，
            几何标记本身自带留白，再叠一层遮罩只会把线条边缘啃掉。 */}
        <SubjectMark
          icon={quest.icon}
          className="pointer-events-none absolute left-1/2 top-[52%] h-[132px] w-[132px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-out group-hover:-translate-y-[56%] group-hover:scale-[1.06]"
        />
      </div>

      <div className="flex flex-1 flex-col p-4 pt-3">
        <h3 className="text-[14.5px] font-semibold leading-snug text-[var(--text)]">{quest.title}</h3>
        <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[var(--text-3)]">{quest.evidence}</p>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[12px] text-[var(--text-2)]">
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> 约 {quest.durationMin} 分钟
            </span>
            <span className="text-num font-semibold" style={{ color: done ? "var(--ok-ink)" : quest.ink }}>
              {quest.progress}%
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${quest.progress}%`,
                background: done ? "var(--ok)" : quest.ink,
                transition: "width var(--t-slow) var(--ease-out)",
              }}
            />
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-[var(--border-2)] pt-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--text-2)]">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: quest.model.color }} />
            {quest.model.name}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--c-edu)]">
            {quest.progress > 0 && !done ? "继续" : done ? "回顾" : "开始"}
            <ArrowRight size={13} className="transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
