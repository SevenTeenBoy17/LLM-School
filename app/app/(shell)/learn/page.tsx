"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import { MotionConfig } from "motion/react";
import {
  AlertCircle,
  ArrowRight,
  BookMarked,
  Check,
  Database,
  GraduationCap,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/common/EduArt";
import { Progress } from "@/components/ui/progress";
import { RightRail, RailSection } from "@/components/shell/RightRail";
import { useMotionPref } from "@/lib/hooks/useReducedMotion";
import { greeting } from "@/lib/greeting";
import { useUserStore } from "@/lib/store/useUserStore";
import { cn } from "@/lib/utils";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

type LearningSnapshot = {
  generatedAt: number;
  user: { id: string; name: string; role: string; classId: string };
  kpis: Array<{ id: string; label: string; value: string; hint: string; tone: "blue" | "green" | "violet" | "gold" }>;
  weeklyTrend: Array<{ day: string; sessions: number; messages: number }>;
  recentSessions: Array<{ id: string; title: string; href: string; preview: string; updatedAt: number; messageCount: number; modelId: string }>;
  reviewItems: Array<{ id: string; subject: string; title: string; count: number; href: string }>;
  tasks: Array<{ id: string; label: string; done: boolean; evidence: string }>;
  achievements: Array<{ id: string; label: string; unlocked: boolean }>;
  honestStates: Array<{ id: string; title: string; status: "connected" | "not_connected"; note: string }>;
  sourceSummary: {
    sessions: number;
    userMessages: number;
    assistantMessages: number;
    favorites: number;
    feedback: number;
    knowledgeFiles: number;
    integrityWeekly: number;
  };
};

const toneClass: Record<LearningSnapshot["kpis"][number]["tone"], string> = {
  blue: "bg-[var(--info-bg)] text-[var(--info-ink)]",
  green: "bg-[var(--ok-bg)] text-[var(--ok-ink)]",
  violet: "bg-[var(--rg-selected-bg)] text-[var(--c-primary)]",
  gold: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
};

function toPercent(value?: string): number {
  const n = Number((value ?? "").replace("%", ""));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

function formatTime(value: number): string {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(value);
}

export default function LearnPage() {
  const mp = useMotionPref();
  const storeName = useUserStore((s) => s.name);
  const role = useUserStore((s) => s.role);
  const hour = useSyncExternalStore(() => () => {}, () => new Date().getHours(), () => 9);
  const [snapshot, setSnapshot] = useState<LearningSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/learning", { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as LearningSnapshot;
      setSnapshot(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown_error";
      setError(message);
      toast.error("学习快照读取失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSnapshot]);

  const displayName = snapshot?.user.name || storeName;
  const mastery = toPercent(snapshot?.kpis.find((item) => item.id === "mastery")?.value);
  const maxWeeklyMessages = Math.max(1, ...(snapshot?.weeklyTrend.map((d) => d.messages) ?? [0]));
  const doneTasks = snapshot?.tasks.filter((task) => task.done).length ?? 0;

  const sourceRows = useMemo(() => {
    if (!snapshot) return [];
    return [
      ["会话", snapshot.sourceSummary.sessions],
      ["用户提问", snapshot.sourceSummary.userMessages],
      ["AI 回复", snapshot.sourceSummary.assistantMessages],
      ["收藏", snapshot.sourceSummary.favorites],
      ["反馈", snapshot.sourceSummary.feedback],
      ["知识库", snapshot.sourceSummary.knowledgeFiles],
      ["诚信引导", snapshot.sourceSummary.integrityWeekly],
    ] as Array<[string, number]>;
  }, [snapshot]);

  return (
    <MotionConfig reducedMotion={mp}>
      <div data-register="campus" className="flex flex-1 min-w-0 flex-col p-5 md:p-7 max-w-full overflow-x-hidden">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--card)] p-6 md:p-8"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-[240px] w-[240px] rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(closest-side, rgba(6,182,212,0.32), transparent)" }}
          />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--p-sky)] px-3 py-1 text-[11px] font-semibold text-[var(--p-sky-ink)]">
                <Database size={12} /> 后端实时学习快照
              </span>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-white shadow-[var(--shadow-sm)]" style={{ backgroundImage: "var(--grad-primary)" }}><GraduationCap size={20} /></span>
                <h1 className="text-[24px] font-bold tracking-tight text-[var(--text)]">
                  {greeting(displayName, role, hour)}
                </h1>
              </div>
              <p className="mt-1.5 max-w-3xl text-[13px] leading-6 text-[var(--text-2)]">
                这里现在只展示当前账号可从服务端读回的学习足迹：AI 学习会话、消息轮次、收藏反馈、知识库和安全诚信引导。未接入教务作业和题目级错题表的模块会明确标注，不再混入示例数据。
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Badge variant="primary" className="h-[28px] px-3">API /api/learning</Badge>
                <span className="text-[12px] text-[var(--text-3)]" aria-live="polite">
                  {snapshot ? `生成时间 ${formatTime(snapshot.generatedAt)}` : loading ? "正在读取后端数据" : "等待重新读取"}
                </span>
              </div>
            </div>
            <div className="w-full max-w-[280px] rounded-[20px] border border-[var(--border-2)] bg-[var(--bg-2)] p-4">
              <div className="flex items-center justify-between text-[12px] text-[var(--text-2)]">
                <span>学习覆盖度</span>
                <span className="text-num font-bold text-[var(--text)]">{mastery}%</span>
              </div>
              <Progress value={mastery} className="mt-3 h-3" />
              <p className="mt-3 text-[12px] leading-5 text-[var(--text-3)]">按真实会话、AI 回复、收藏反馈和知识库足迹估算，仅用于自我参照。</p>
            </div>
          </div>
        </motion.section>

        {error && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[var(--r-lg)] border border-[var(--err)]/30 bg-[var(--err-bg)] p-4 text-[var(--err-ink)]">
            <AlertCircle size={18} />
            <span className="text-[13px] font-semibold">学习快照读取失败：{error}</span>
            <Button type="button" variant="outline" className="min-h-[48px]" onClick={() => void loadSnapshot()}>
              <RefreshCw size={15} /> 重试
            </Button>
          </div>
        )}

        <Reveal className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(snapshot?.kpis ?? Array.from({ length: 4 })).map((item, index) => (
            <Card key={item?.id ?? index}>
              <CardContent className="p-4">
                {item ? (
                  <>
                    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", toneClass[item.tone])}>{item.label}</span>
                    <div className="mt-3 text-num text-[24px] font-bold text-[var(--text)]">{item.value}</div>
                    <p className="mt-1 text-[12px] text-[var(--text-3)]">{item.hint}</p>
                  </>
                ) : (
                  <div className="flex h-[94px] items-center justify-center text-[var(--text-3)]">
                    <Loader2 className="animate-spin" size={18} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </Reveal>

        <Reveal delay={0.08} className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <div>
                <CardTitle><History size={15} className="mr-1.5 inline text-[var(--c-edu)]" /> 最近学习会话</CardTitle>
                <CardDescription>来自当前账号的真实会话列表，点击后回到对应聊天记录。</CardDescription>
              </div>
              <Button asChild variant="grad" className="min-h-[48px]">
                <Link href="/chat"><Sparkles size={15} /> 开始新学习</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading && !snapshot ? (
                <div className="grid min-h-[220px] place-items-center text-[var(--text-3)]">
                  <Loader2 className="animate-spin" size={22} />
                </div>
              ) : snapshot && snapshot.recentSessions.length > 0 ? (
                <div className="space-y-2">
                  {snapshot.recentSessions.map((session) => (
                    <Link
                      key={session.id}
                      href={session.href}
                      className="flex min-h-[72px] items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-3 transition hover:border-[var(--c-edu)]/40 hover:bg-[var(--rg-hover-bg)]"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-primary)]">
                        <Sparkles size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold text-[var(--text)]">{session.title}</span>
                        <span className="mt-1 block truncate text-[12px] text-[var(--text-2)]">{session.preview}</span>
                        <span className="mt-1 block text-[11px] text-[var(--text-3)]">{session.modelId} · {session.messageCount} 条消息 · {formatTime(session.updatedAt)}</span>
                      </span>
                      <ArrowRight size={15} className="shrink-0 text-[var(--text-3)]" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-[220px] place-items-center rounded-[12px] border border-dashed border-[var(--border)] bg-[var(--bg-2)] p-8 text-center">
                  <div>
                    <Sparkles size={26} className="mx-auto text-[var(--text-3)]" />
                    <p className="mt-3 text-[13px] font-semibold text-[var(--text)]">还没有学习会话</p>
                    <p className="mt-1 text-[12px] text-[var(--text-2)]">开始一次 AI 学习后，这里会显示真实记录。</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle><BookMarked size={15} className="mr-1.5 inline text-[var(--warn-ink)]" /> 复习入口</CardTitle>
              <CardDescription>基于真实学习会话生成，不冒充题目级错题本。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(snapshot?.reviewItems ?? []).map((item) => (
                  <Link key={item.id} href={item.href} className="flex min-h-[56px] items-center gap-3 rounded-[12px] p-2 transition hover:bg-[var(--rg-hover-bg)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--warn-bg)] text-[11px] font-bold text-[var(--warn-ink)]">{item.subject}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{item.title}</span>
                      <span className="text-[11px] text-[var(--text-3)]">{item.count} 条上下文可复盘</span>
                    </span>
                    <ArrowRight size={14} className="text-[var(--text-3)]" />
                  </Link>
                ))}
                {snapshot && snapshot.reviewItems.length === 0 && (
                  <p className="rounded-[12px] bg-[var(--bg-2)] p-3 text-[12px] leading-5 text-[var(--text-2)]">暂无可复盘会话。完成一次 AI 学习后会自动出现。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>7 日学习趋势</CardTitle>
              <CardDescription>按当前账号消息时间聚合。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-[180px] items-end gap-2">
                {(snapshot?.weeklyTrend ?? []).map((day) => (
                  <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <div className="flex h-[120px] w-full max-w-[34px] items-end rounded-full bg-[var(--bg-2)]">
                      <div
                        className="w-full rounded-full bg-[image:var(--grad-primary)]"
                        style={{ height: `${Math.max(6, (day.messages / maxWeeklyMessages) * 100)}%` }}
                        title={`${day.day}: ${day.messages} 条消息`}
                      />
                    </div>
                    <span className="text-[11px] text-[var(--text-3)]">{day.day}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>功能接入状态</CardTitle>
              <CardDescription>严肃标注真实接入范围，避免示例数据误导学生。</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(snapshot?.honestStates ?? []).map((item) => (
                  <div key={item.id} className="rounded-[12px] border border-[var(--border-2)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-[var(--text)]">{item.title}</span>
                      <Badge variant={item.status === "connected" ? "green" : "default"}>
                        {item.status === "connected" ? "已接入" : "未接入"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-[12px] leading-5 text-[var(--text-2)]">{item.note}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-4 xl:hidden">
          <CardHeader>
            <CardTitle>来源读回</CardTitle>
            <CardDescription>移动端同样展示后端返回的来源计数，便于学生确认本页不是示例数据。</CardDescription>
          </CardHeader>
          <CardContent>
            <div data-testid="learning-source-summary-mobile" className="grid grid-cols-2 gap-2">
              {sourceRows.map(([label, value]) => (
                <div key={label} className="rounded-[12px] bg-[var(--bg-2)] p-2">
                  <div className="text-[11px] text-[var(--text-3)]">{label}</div>
                  <div className="text-num text-[16px] font-bold text-[var(--text)]">{value}</div>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" className="mt-3 min-h-[48px] w-full" onClick={() => void loadSnapshot()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} 刷新后端数据
            </Button>
            <NotYetAvailable why="需接入教务作业系统后开放同步">同步教务作业</NotYetAvailable>
          </CardContent>
        </Card>
      </div>

      <RightRail>
        <RailSection title="今日学习任务">
          <div className="space-y-2">
            {(snapshot?.tasks ?? []).map((task) => (
              <div key={task.id} className={cn("rounded-[12px] p-3", task.done ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--bg-2)] text-[var(--text-2)]")}>
                <div className="flex items-start gap-2">
                  <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", task.done ? "bg-[var(--ok)] text-white" : "border border-[var(--border)]")}>
                    {task.done && <Check size={12} />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{task.label}</div>
                    <div className="mt-0.5 text-[11px] opacity-75">{task.evidence}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[var(--text-3)]">完成度 {doneTasks}/{snapshot?.tasks.length ?? 0}，由后端返回值判定。</p>
        </RailSection>

        <RailSection title="学习成就">
          <div className="space-y-2">
            {(snapshot?.achievements ?? []).map((item) => (
              <div key={item.id} className={cn("flex items-center gap-2 rounded-[12px] px-2.5 py-2 text-[12px]", item.unlocked ? "bg-[var(--rg-hover-bg)] text-[var(--text)]" : "bg-[var(--bg-2)] text-[var(--text-3)]")}>
                <ShieldCheck size={14} className={item.unlocked ? "text-[var(--ok-ink)]" : ""} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </RailSection>

        <RailSection title="来源读回">
          <div data-testid="learning-source-summary" className="grid grid-cols-2 gap-2">
            {sourceRows.map(([label, value]) => (
              <div key={label} className="rounded-[12px] bg-[var(--bg-2)] p-2">
                <div className="text-[11px] text-[var(--text-3)]">{label}</div>
                <div className="text-num text-[16px] font-bold text-[var(--text)]">{value}</div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" className="mt-3 min-h-[48px] w-full" onClick={() => void loadSnapshot()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />} 刷新后端数据
          </Button>
          <NotYetAvailable why="需接入教务作业系统后开放同步">同步教务作业</NotYetAvailable>
        </RailSection>
      </RightRail>
    </MotionConfig>
  );
}
