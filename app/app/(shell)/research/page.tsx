"use client";

/**
 * /research —— 教研中心（S1 骨架页）。
 * 铁律：只呈现真实数据（提示词库/会话入口），没有后端支撑的能力一律诚实禁用；
 * 教研板块标题用衬线（land-book 实证：Serif=学术可信信号），正文保持无衬线。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { FlaskConical, FileText, Users2, ArrowRight, MessageCircle, Presentation, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/common/EduArt";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import { apiListPrompts, type ClientPrompt } from "@/lib/client/libraryApi";

const SERIF = { fontFamily: '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif' };

const ENTRIES = [
  { icon: MessageCircle, iconName: "chat" as const, title: "AI 教研问答", desc: "教学法、学情分析、命题思路的深度对话", href: "/chat?seed=" + encodeURIComponent("请以教研员视角，帮我分析下面这个教学问题：") },
  { icon: FileText, iconName: "research-paper" as const, title: "课题与论文", desc: "润色、摘要、综述框架与开题结构", href: "/research/paper" },
  { icon: Users2, iconName: "research-prep" as const, title: "集体备课", desc: "共享提示词模板与备课协作", href: "/research/prep" },
  { icon: Presentation, iconName: "research-courseware" as const, title: "课件工坊", desc: "逐页规划、教师审阅与可编辑 PPTX", href: "/research/courseware" },
];

export default function ResearchPage() {
  const [prompts, setPrompts] = useState<ClientPrompt[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    apiListPrompts().then(({ prompts: list }) => {
      if (!alive) return;
      // 教研相关类目优先；不足则按使用次数补齐（真实数据，不编造）
      const research = list.filter((p) => /教研|科研|论文|课题|命题/.test(`${p.category}${p.title}${p.scene ?? ""}`));
      const rest = list.filter((p) => !research.includes(p)).sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));
      setPrompts([...research, ...rest].slice(0, 6));
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

  return (
    <div className="teacher-workspace flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-5">
      <div className="teacher-page-header flex items-center gap-3">
        <TeacherFeatureIcon name="research-center" size={50} fallback={FlaskConical} />
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]" style={SERIF}>教研中心</h1>
          <p className="mt-1 text-[13px] text-[var(--text-2)]">备课之外的深水区：问答、课题、集备，都从这里出发。</p>
        </div>
      </div>

      <Reveal className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ENTRIES.map((e) => (
          <Link key={e.title} href={e.href} className="teacher-entry-card teacher-feature-surface card-lift surface-card flex flex-col gap-3 p-5 hover:border-[var(--accent)]/40">
            <TeacherFeatureIcon name={e.iconName} size={44} fallback={e.icon} />
            <div>
              <div className="text-[14px] font-semibold text-[var(--text)]" style={SERIF}>{e.title}</div>
              <div className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">{e.desc}</div>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">进入 <ArrowRight size={14} /></span>
          </Link>
        ))}
      </Reveal>

      <Reveal delay={0.08}>
        <Card>
          <CardHeader>
            <CardTitle><Sparkles size={15} className="mr-1.5 inline text-[var(--accent)]" /> 教研常用提示词</CardTitle>
            <Badge>来自提示词库真实数据</Badge>
          </CardHeader>
          <CardContent>
            {!loaded ? (
              <div className="p-4 text-[13px] text-[var(--text-3)]">正在载入…</div>
            ) : prompts.length === 0 ? (
              <div className="p-4 text-[13px] text-[var(--text-2)]">提示词库暂无内容——到「提示词中心」创建第一条教研模板。</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {prompts.map((p) => (
                  <Link key={p.id} href={`/chat?prompt=${encodeURIComponent(p.id)}`} className="flex min-h-[52px] items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-3 transition hover:border-[var(--accent)]/40 hover:bg-[var(--rg-hover-bg)]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{p.title}</span>
                      <span className="block truncate text-[11px] text-[var(--text-3)]">{p.category} · 已用 {p.uses ?? 0} 次</span>
                    </span>
                    <ArrowRight size={14} className="shrink-0 text-[var(--text-3)]" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <p className="text-[12px] text-[var(--text-3)]">教研数据看板与课题进度管理需教务系统接入，校内暂未开通——本页仅呈现已接入的真实能力，不以示例数据充数。</p>
    </div>
  );
}
