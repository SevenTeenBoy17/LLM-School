"use client";

/**
 * /student/home —— 学生极简首页（S2，Apple Style：单列、大留白、一屏一个焦点）。
 * 「今日三件事」队列全部指向真实能力（继续上次会话/成长页/知识库），不编造任务。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, GraduationCap, BookOpen, ArrowRight, Sparkles, Compass, ClipboardList } from "lucide-react";
import { HeroArt } from "@/components/common/EduArt";
import { useUserStore } from "@/lib/store/useUserStore";
import { apiListSessions, type SessionSummary } from "@/lib/client/chatApi";
import { PlayIcon } from "@/components/common/PlayIcon";
import { ManorAssignedTasks } from "@/components/student/ManorAssignedTasks";

export default function StudentHomePage() {
  const name = useUserStore((s) => s.name);
  const [recent, setRecent] = useState<SessionSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    apiListSessions().then((list) => {
      if (!alive) return;
      setRecent(list?.[0] ?? null);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { alive = false; };
  }, []);

  const queue = [
    recent
      ? { icon: MessageCircle, play: "chat" as const, title: "继续上次的对话", desc: recent.title || "回到你和 AI 的最近一次讨论", href: `/chat?session=${encodeURIComponent(recent.id)}`, cta: "继续" }
      : { icon: MessageCircle, play: "chat" as const, title: "开始今天的第一个提问", desc: "备好问题了吗？AI 学伴在等你", href: "/chat", cta: "提问" },
    { icon: GraduationCap, play: "growth" as const, title: "看看我的成长", desc: "错题本与学习统计都在这里", href: "/student/growth", cta: "查看" },
    { icon: BookOpen, play: "knowledge" as const, title: "到知识库找资料", desc: "校内可信资料，AI 回答的依据", href: "/knowledge", cta: "去找" },
    // W-B3：项目活动经首页队列进入（顶层保持 4 入口，/student/activities 走 NAV_ORPHANS）
    { icon: ClipboardList, play: "project" as const, title: "项目活动", desc: "老师发布的学科小项目，通过批阅后进档案袋", href: "/student/activities", cta: "去看" },
    { icon: BookOpen, play: "knowledge" as const, title: "打开学习资源", desc: "课堂文件、互动活动与自己的学习笔记", href: "/student/resources", cta: "打开" },
    // 「学习探索」并线进这里，而不是撑成第 5 个导航项（S2 锁死 4 入口）。
    // 此前它只在移动端导航里出现、桌面侧栏没有——那是两份导航表漂移的产物。
    // 导航统一到 lib/nav.ts 后若不给它一个入口，这个 395 行的真实页面就成了孤儿。
    { icon: Compass, play: "explore" as const, title: "去学习探索看看", desc: "按学科分主题的练习与挑战", href: "/explore", cta: "探索" },
  ];

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[720px]">
        {/* Hero：一屏一个焦点 */}
        <div className="relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--border-2)] bg-[var(--surface-1)] p-6 md:p-8">
          <HeroArt aria-hidden className="pointer-events-none absolute -right-3 top-1/2 hidden h-[130px] w-[195px] -translate-y-1/2 opacity-90 md:block" />
          <div className="relative md:pr-[210px]">
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">你好，{name} 👋</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--text-2)]">今天想弄懂什么？把问题交给 AI 学伴——它会陪你想，而不是替你想。</p>
            <Link href="/chat" className="play-3d play-gloss mt-4 inline-flex min-h-[48px] items-center gap-2 rounded-full pl-3 pr-5 text-[14px] font-semibold text-white [--lip:#B0347A]" style={{ backgroundImage: "var(--play-grad-pp)" }}>
              <PlayIcon name="ask" size={26} fallback={Sparkles} /> 开始提问
            </Link>
          </div>
        </div>

        <ManorAssignedTasks />
        {/* 今日三件事（真实入口队列） */}
        <div className="stagger mt-6 space-y-3">
          {!loaded ? (
            <div className="surface-card p-5 text-[13px] text-[var(--text-3)]">正在载入…</div>
          ) : queue.map((q, i) => (
            <Link key={q.title} href={q.href} style={{ "--i": i } as React.CSSProperties} className="card-lift surface-card flex items-center gap-4 p-4 hover:border-[var(--accent)]/40">
              <PlayIcon name={q.play} size={44} fallback={q.icon} float className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[var(--text)]">{q.title}</span>
                <span className="mt-0.5 block truncate text-[12px] text-[var(--text-2)]">{q.desc}</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">{q.cta} <ArrowRight size={14} /></span>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-[12px] text-[var(--text-3)]">AI 会给你台阶而不是答案 · 遇到困难可随时点「安全求助」按钮</p>
      </div>
    </div>
  );
}
