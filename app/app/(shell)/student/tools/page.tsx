"use client";

/**
 * /student/tools —— AI 工具聚合页（S2 骨架 / S3 起生图为真入口）。扩展能力收进聚合页（学生端顶层只有 4 入口）。
 * 生图走 /student/tools/image 真管线（安全审核先于生成，8 张/日公平使用）；总结 seed 进对话走既有安全链。
 */
import Link from "next/link";
import { Sparkles, Palette, AlignLeft, ArrowRight, Network } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { PageIcon } from "@/components/common/PlayIcon";
import { PlayIcon } from "@/components/common/PlayIcon";

export default function StudentToolsPage() {
  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[720px]">
        <div className="flex items-center gap-3">
          <PageIcon name="tools" fallback={Sparkles} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">AI 工具</h1>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">学习的两个好帮手——都在校内安全策略保护下使用。</p>
          </div>
        </div>

        <Reveal delay={0.06} className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* 生图：S3 真管线（安全审核先于生成，8 张/日公平使用） */}
          <Link href="/student/tools/image" className="card-lift surface-card flex flex-col gap-3 p-5 hover:border-[var(--accent)]/40">
            <PlayIcon name="image" size={46} fallback={Palette} float />
            <div>
              <div className="text-[14px] font-semibold text-[var(--text)]">AI 生图</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">手抄报插图、实验示意图、黑板报素材——描述一句话，约 1 分钟画好。校内安全审核先于生成。</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">开始创作 <ArrowRight size={14} /></span>
          </Link>

          {/* 总结：真实可用（seed 进对话，走既有安全链） */}
          <Link href={`/chat?seed=${encodeURIComponent("请帮我做学习总结。我会把课文/笔记/资料贴在下面，请输出：①三句话概要 ②要点列表 ③一个考考我的自测问题。\n\n")}`} className="card-lift surface-card flex flex-col gap-3 p-5 hover:border-[var(--accent)]/40">
            <PlayIcon name="summary" size={46} fallback={AlignLeft} float />
            <div>
              <div className="text-[14px] font-semibold text-[var(--text)]">一键学习总结</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">把课文、笔记贴进来，AI 给你三句话概要 + 要点清单 + 一道自测题。</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">开始总结 <ArrowRight size={14} /></span>
          </Link>
          {/* W-B2：思维导图（LLM 受约束大纲 → markmap 渲染；主题/文档双入口） */}
          <Link href="/student/mindmap" className="card-lift surface-card flex flex-col gap-3 p-5 hover:border-[var(--accent)]/40">
            <PlayIcon name="mindmap" size={46} fallback={Network} float />
            <div>
              <div className="text-[14px] font-semibold text-[var(--text)]">思维导图</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-2)]">输入主题或上传课文文档，AI 整理成一张可展开的导图，可导出 PNG 和 Markdown。</p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)]">开始整理 <ArrowRight size={14} /></span>
          </Link>
        </Reveal>

        <p className="mt-6 text-[12px] leading-relaxed text-[var(--text-3)]">这些工具与 AI 对话共用同一套校内安全策略与公平使用配额；使用时长计入每日守护提醒。</p>
      </div>
    </div>
  );
}
