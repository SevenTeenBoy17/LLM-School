"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as motion from "motion/react-client";
import { MotionConfig } from "motion/react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Brain,
  CalendarCheck,
  Check,
  CheckCircle2,
  Compass,
  Database,
  ExternalLink,
  Flame,
  Medal,
  RefreshCw,
  Rocket,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import { RightRail, RailSection } from "@/components/shell/RightRail";
import { Reveal } from "@/components/common/EduArt";
import { QuestCard } from "@/components/explore/QuestCard";
import { Leaderboard } from "@/components/explore/Leaderboard";
import { ProgressRing } from "@/components/explore/ProgressRing";
import { useUserStore } from "@/lib/store/useUserStore";
import { useMotionPref } from "@/lib/hooks/useReducedMotion";
import { givenName } from "@/lib/greeting";
import { cn } from "@/lib/utils";
import type { ExploreAchievement, ExploreSnapshot, QuestStatus } from "@/lib/data/explore";

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "continue", label: "继续学习" },
  { id: "new", label: "全新任务" },
  { id: "hot", label: "热门" },
  { id: "done", label: "已完成" },
] as const;
type Filter = (typeof FILTERS)[number]["id"];

const ACH_ICONS: Record<ExploreAchievement["icon"], typeof Flame> = {
  flame: Flame,
  trophy: Trophy,
  star: Star,
  rocket: Rocket,
  brain: Brain,
  medal: Medal,
};

function filterStatus(filter: Filter): QuestStatus | null {
  if (filter === "all") return null;
  return filter;
}

function SourceSummary({ snapshot }: { snapshot: ExploreSnapshot }) {
  const items = [
    ["会话", snapshot.sourceSummary.sessions],
    ["提问", snapshot.sourceSummary.userMessages],
    ["AI 回复", snapshot.sourceSummary.assistantMessages],
    ["收藏", snapshot.sourceSummary.favorites],
    ["反馈", snapshot.sourceSummary.feedback],
    ["知识库", snapshot.sourceSummary.knowledgeFiles],
    ["诚信信号", snapshot.sourceSummary.integrityWeekly],
  ] as const;

  return (
    <section
      data-testid="explore-source-summary"
      className="rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-[13px] font-bold text-[var(--text)]">
          <Database size={15} className="text-[var(--c-edu)]" /> 后端实时探索快照
        </h2>
        <span className="rounded-full bg-[var(--info-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--info-ink)]">
          API /api/explore · no-store
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-[12px] bg-[var(--bg-2)] px-3 py-2">
            <div className="text-[11px] text-[var(--text-3)]">{label}</div>
            <div className="text-num text-[18px] font-bold text-[var(--text)]">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HonestStates({ snapshot }: { snapshot: ExploreSnapshot }) {
  return (
    <section className="rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4">
      <h2 className="text-[13px] font-bold text-[var(--text)]">数据诚实状态</h2>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {snapshot.honestStates.map((item) => (
          <div key={item.id} className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-2)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-[var(--text)]">{item.title}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  item.status === "connected"
                    ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]"
                    : "bg-[var(--warn-bg)] text-[var(--warn-ink)]"
                )}
              >
                {item.status === "connected" ? "已接入" : "未接入"}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-3)]">{item.note}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AchievementGrid({ achievements }: { achievements: ExploreAchievement[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {achievements.map((item) => {
        const Icon = ACH_ICONS[item.icon];
        return (
          <div
            key={item.id}
            title={item.label}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-[12px] border p-2.5 text-center transition",
              item.unlocked
                ? "border-[var(--border-2)] bg-[var(--card)]"
                : "border-dashed border-[var(--border)] bg-[var(--bg-2)] opacity-65"
            )}
          >
            <span
              aria-hidden
              className={cn("grid h-9 w-9 place-items-center rounded-full", item.unlocked ? "text-white" : "text-[var(--text-3)]")}
              style={item.unlocked ? { backgroundImage: "var(--grad-primary)" } : { background: "var(--border)" }}
            >
              <Icon size={16} />
            </span>
            <span className="text-[11px] leading-tight text-[var(--text-2)]">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LoadingState() {
  return (
    <div data-register="campus" className="flex-1 min-w-0 p-5 md:p-7">
      {/* 动效预算修复（方案 §7.6）：原实现同屏渲染 **9 个** animate-pulse（3 条骨架 + 6 张卡），
          直接突破「同屏无限循环 ≤2」——而我此前用 `grep -c infinite globals.css` 得出的「7 处」
          压根没数到 Tailwind 内置类。改为**整块一个** shimmer：容器自身动，子块静态，
          视觉信息量不变而运行时无限循环实例从 9 降到 1；reduced-motion 下由 globals.css 统一降级。 */}
      <div className="animate-pulse">
        <div className="rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] p-6 md:p-8">
          <div className="h-5 w-36 rounded-full bg-[var(--bg-2)]" />
          <div className="mt-4 h-8 w-72 max-w-full rounded bg-[var(--bg-2)]" />
          <div className="mt-3 h-4 w-full max-w-xl rounded bg-[var(--bg-2)]" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-[320px] rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const motionPref = useMotionPref();
  const fallbackName = useUserStore((s) => s.name);
  const [snapshot, setSnapshot] = useState<ExploreSnapshot | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explore", { cache: "no-store", credentials: "include" });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setSnapshot(body as ExploreSnapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : "探索页数据加载失败";
      setError(message);
      toast.error("探索页数据加载失败", { description: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadSnapshot();
    }, 0);
    return () => window.clearTimeout(id);
  }, [loadSnapshot]);

  const quests = useMemo(() => {
    if (!snapshot) return [];
    const status = filterStatus(filter);
    return status ? snapshot.quests.filter((quest) => quest.status === status) : snapshot.quests;
  }, [filter, snapshot]);

  if (loading && !snapshot) {
    return <LoadingState />;
  }

  if (error || !snapshot) {
    return (
      <div data-register="campus" className="flex-1 min-w-0 p-5 md:p-7">
        <section className="rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] p-6 md:p-8">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--err-bg)] text-[var(--err-ink)]">
            <AlertTriangle size={20} />
          </div>
          <h1 className="mt-4 text-[24px] font-bold text-[var(--text)]">探索页暂时无法读取后端快照</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--text-2)]">
            当前没有展示任何示例进度或假排行。请重试读取 `/api/explore`，成功后再评价页面内容。
          </p>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            className="mt-5 inline-flex min-h-[var(--hit-inline)] items-center gap-2 rounded-full bg-[var(--c-primary)] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)] focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} /> 重新读取
          </button>
        </section>
      </div>
    );
  }

  const given = givenName(snapshot.user.name || fallbackName);
  const doneTasks = snapshot.tasks.filter((task) => task.done).length;
  const unlockedAchievements = snapshot.achievements.filter((item) => item.unlocked).length;

  return (
    <MotionConfig reducedMotion={motionPref}>
      <div data-register="campus" className="flex-1 min-w-0 max-w-full overflow-x-hidden p-5 md:p-7">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] p-6 md:p-8"
        >
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-peach)] px-3 py-1 text-[11px] font-semibold text-[var(--p-peach-ink)]">
                <Sparkles size={12} /> AI 学习探索
              </span>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><Compass size={20} /></span>
                <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">
                  继续探索，{given}
                </h1>
              </div>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--text-2)]">
                本页已切到真实后端快照：任务、成就和进度都从当前账号记录推导；没有接入的数据会明确标注，不再用演示数据冒充结果。
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-peach)] px-3 py-1.5 text-[13px] font-semibold text-[var(--p-peach-ink)]">
                  <CalendarCheck size={14} /> 本周有 {snapshot.progress.activeDays} 天来过
                </span>
                <span className="text-[12px] text-[var(--text-3)]" aria-live="polite">
                  今日探索任务 {doneTasks}/{snapshot.tasks.length}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {snapshot.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={task.href}
                    data-testid="explore-task-link"
                    data-task-id={task.id}
                    aria-label={`${task.done ? "已完成" : "待完成"}：${task.label}，证据：${task.evidence}`}
                    className={cn(
                      "inline-flex min-h-[var(--hit-inline)] items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)] focus-visible:ring-offset-2",
                      task.done
                        ? "bg-[var(--ok-bg)] font-semibold text-[var(--ok-ink)]"
                        : "border border-[var(--border)] text-[var(--text-2)] hover:border-[var(--c-edu)]/40 hover:text-[var(--c-edu)]"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "grid h-4 w-4 place-items-center rounded-full text-white",
                        task.done ? "bg-[var(--ok)]" : "border border-[var(--border)] bg-transparent"
                      )}
                    >
                      {task.done && <Check size={11} />}
                    </span>
                    <span>{task.label}</span>
                    <ExternalLink size={12} />
                  </Link>
                ))}
              </div>
            </div>

            <ProgressRing value={snapshot.progress.weeklyPercent} label={`本周真实学习探索完成度 ${snapshot.progress.weeklyPercent}%`}>
              <div>
                <div className="text-num text-[24px] font-bold leading-none text-[var(--text)]">
                  {snapshot.progress.weeklyPercent}<span className="text-[14px]">%</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[var(--text-3)]">本周完成</div>
              </div>
            </ProgressRing>
          </div>
        </motion.section>

        <Reveal delay={0.08} className="mt-5 grid gap-4">
          <SourceSummary snapshot={snapshot} />
          <HonestStates snapshot={snapshot} />
        </Reveal>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[14px] font-bold tracking-tight text-[var(--text)]">探索任务</h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid="explore-filter-button"
                data-filter={item.id}
                onClick={() => setFilter(item.id)}
                aria-pressed={filter === item.id}
                className={cn(
                  "min-h-[var(--hit-inline)] rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)] focus-visible:ring-offset-2",
                  filter === item.id
                    ? "bg-[var(--c-primary)] text-white shadow-[var(--shadow-md)]"
                    : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-2)] hover:border-[var(--c-edu)]/40 hover:text-[var(--c-edu)]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <Reveal delay={0.12}>
          <div data-testid="explore-quest-grid" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {quests.map((quest, index) => (
              <QuestCard key={quest.id} quest={quest} index={index} />
            ))}
          </div>
        </Reveal>

        {quests.length === 0 && (
          <div className="mt-4 grid place-items-center rounded-[var(--r-xl)] border border-dashed border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <Rocket size={28} className="text-[var(--text-3)]" />
            <p className="mt-3 text-[14px] font-semibold text-[var(--text)]">这一类暂无真实任务</p>
            <p className="mt-1 text-[12px] text-[var(--text-2)]">换个筛选，或从“全新任务”开启一段新的探索。</p>
          </div>
        )}

        <section className="mt-5 xl:hidden">
          <div className="rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-[var(--text)]">我的成就</h2>
              <span className="text-[11px] text-[var(--text-3)]">已点亮 {unlockedAchievements}/{snapshot.achievements.length}</span>
            </div>
            <AchievementGrid achievements={snapshot.achievements} />
          </div>
          <div className="mt-4 rounded-[var(--r-lg)] border border-[var(--border-2)] bg-[var(--card)] p-4">
            <h2 className="mb-3 text-[13px] font-bold text-[var(--text)]">我的成长</h2>
            <Leaderboard progress={snapshot.progress} />
          </div>
        </section>
      </div>

      <RightRail>
        <RailSection
          title="我的成就"
          action={<span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)]"><CheckCircle2 size={12} /> {unlockedAchievements}/{snapshot.achievements.length}</span>}
        >
          <AchievementGrid achievements={snapshot.achievements} />
        </RailSection>

        <RailSection title="我的成长">
          <Leaderboard progress={snapshot.progress} />
        </RailSection>
      </RightRail>
    </MotionConfig>
  );
}
