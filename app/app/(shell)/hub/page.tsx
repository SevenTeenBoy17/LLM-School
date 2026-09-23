"use client";

import { useState } from "react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { Search, SlidersHorizontal, Sparkles, ArrowRight, ShieldCheck, FileText, LayoutGrid } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import { ModelCard } from "@/components/hub/ModelCard";
import { MODELS } from "@/lib/data/models";
import { cn } from "@/lib/utils";
import type { ModelProvider } from "@/lib/types";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";
import { TeacherFeatureGlyph } from "@/components/common/TeacherFeatureGlyph";

const FILTERS = ["全部模型", "文本对话", "长文本分析", "多模态理解", "视觉方案", "已开通", "需申请"] as const;
type Filter = typeof FILTERS[number];

const REC = [
  {
    title: "教案与试题",
    desc: "推荐使用 ChatGPT",
    modelId: "chatgpt" as ModelProvider,
    seed: "请为本周的信息科技课生成一份 45 分钟教案与 5 道分层练习题，包含课堂目标、活动步骤、学生证据和安全边界。",
    glyph: "lesson-test" as const,
    fallback: FileText,
  },
  {
    title: "论文与材料润色",
    desc: "推荐使用 Claude",
    modelId: "claude" as ModelProvider,
    seed: "请帮我润色一段教研材料，要求保持事实不变、语气专业、结构更清晰，并列出修改理由。",
    glyph: "paper-polish" as const,
    fallback: Sparkles,
  },
  {
    title: "课件配图与海报",
    desc: "推荐使用 GPT-Image 视觉方案",
    modelId: "gpt-image" as ModelProvider,
    seed: "请为一节中小学信息科技课设计 3 组可交给生图工具使用的中文图像提示词，包含画面主体、风格、比例、避免元素和课堂用途。",
    glyph: "courseware-art" as const,
    fallback: LayoutGrid,
  },
];

export default function ModelHubPage() {
  const [filter, setFilter] = useState<Filter>("全部模型");
  const [q, setQ] = useState("");
  const requestModels = MODELS.filter((m) => m.status === "request");
  const availableModels = MODELS.filter((m) => m.status !== "request" && m.status !== "disabled" && m.status !== "maintain");
  const activeFilters = FILTERS.filter((f) => f !== "需申请" || requestModels.length > 0);
  const modelStats = [
    { label: "已接入能力", value: String(MODELS.length), hint: "模型 / 视觉方案" },
    { label: "当前可用", value: String(availableModels.length), hint: "无需付费版本" },
    { label: "需申请", value: String(requestModels.length), hint: requestModels.length ? requestModels.map((m) => m.name).join("、") : "暂无" },
    { label: "付费版本", value: "0", hint: "当前不做付费版" },
  ];

  const filtered = MODELS.filter((m) => {
    if (q && !`${m.name} ${m.description} ${m.tags.join(" ")} ${m.scenarios.join(" ")}`.toLowerCase().includes(q.toLowerCase())) return false;
    switch (filter) {
      case "文本对话":     return ["chatgpt", "claude", "minimax"].includes(m.id);
      case "长文本分析":   return ["claude", "chatgpt", "gemini"].includes(m.id);
      case "多模态理解":   return m.id === "gemini";
      case "视觉方案":      return m.id === "gpt-image";
      case "已开通":       return m.status !== "request";
      case "需申请":       return m.status === "request";
      default: return true;
    }
  });

  return (
    <div className="flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[20px] border border-[var(--border-2)] bg-[var(--card)] p-7 md:p-10"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-[300px] w-[300px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(124,58,237,0.4), transparent)" }} />
        <div className="pointer-events-none absolute -left-32 -bottom-32 h-[280px] w-[280px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(6,182,212,0.4), transparent)" }} />

        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--rg-selected-bg)] px-3 py-1 text-[11px] font-semibold text-[var(--c-primary)]">
            <Sparkles size={12} /> EduAI Model Hub · 2026
          </span>
          <div className="mt-3 flex items-center gap-3">
            <TeacherFeatureGlyph name="model-marketplace" size={56} fallback={LayoutGrid} priority />
            <h1 className="text-[34px] font-semibold tracking-tight text-[var(--text)]">模型广场</h1>
          </div>
          <p className="mt-2 max-w-2xl text-[14px] leading-[1.8] text-[var(--text-2)]">
            选择适合教学、科研与管理任务的 AI 能力。模型状态来自当前接入清单；视觉类入口会先生成可复制的图像提示词与制作方案，不伪装成已直出图片。
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex h-11 max-w-md flex-1 items-center gap-2.5 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-4 shadow-sm">
              <Search size={16} className="text-[var(--text-3)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="搜索模型"
                placeholder="搜索模型、能力、场景或关键词…"
                className="h-full w-full bg-transparent text-[13px] outline-none"
              />
            </div>
            <NotYetAvailable why="按能力/场景的多维高级筛选未开通；可用上方搜索框与下方分类筛选"><SlidersHorizontal size={14} /> 高级筛选</NotYetAvailable>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {modelStats.map((s) => (
              <div key={s.label} className="rounded-[20px] border border-[var(--border-2)] bg-[var(--card)]/70 p-3 backdrop-blur">
                <div className="text-[11px] text-[var(--text-3)]">{s.label}</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-num text-[18px] font-bold">{s.value}</span>
                  <span className="text-[11px] text-[var(--text-2)]">{s.hint}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Recommendations */}
      <h2 className="mt-7 mb-3 text-[14px] font-semibold tracking-tight text-[var(--text)]">精选推荐 · 适合本周教学</h2>
      <Reveal className="grid gap-3 md:grid-cols-3" delay={0.08}>
        {REC.map((r) => {
          return (
            <Link key={r.title} href={`/chat?model=${r.modelId}&seed=${encodeURIComponent(r.seed)}`}
              className="teacher-feature-surface surface-card group flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
            >
              <TeacherFeatureGlyph name={r.glyph} size={48} fallback={r.fallback} />
              <div className="flex-1">
                <div className="text-[14px] font-semibold">{r.title}</div>
                <div className="text-[12px] text-[var(--text-2)]">{r.desc}</div>
              </div>
              <ArrowRight size={14} className="text-[var(--text-3)] transition group-hover:translate-x-1 group-hover:text-[var(--c-edu)]" />
            </Link>
          );
        })}
      </Reveal>

      {/* Filter chips */}
      <h2 className="mt-7 mb-3 text-[14px] font-semibold tracking-tight text-[var(--text)]">按类型筛选</h2>
      <div className="flex flex-wrap gap-2">
        {activeFilters.map((f) => (
          <button
            type="button"
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "inline-flex h-[44px] items-center rounded-full px-3.5 py-2 text-[13px] font-semibold transition",
              filter === f
                ? "bg-[var(--c-primary)] text-white shadow-md"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-2)] hover:border-[var(--c-edu)]/40 hover:text-[var(--c-edu)]"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m, i) => (
          <ModelCard key={m.id} model={m} index={i} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="surface-card mt-5 p-10 text-center text-[var(--text-2)]">
          没有匹配的模型。试试其他筛选条件或搜索词。
        </div>
      )}

      {/* Security */}
      <div className="mt-7 flex items-start gap-3 rounded-[20px] border border-[var(--c-edu)]/20 bg-[var(--rg-hover-bg)] p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[var(--c-edu)] text-white">
          <ShieldCheck size={18} />
        </div>
        <p className="text-[13px] leading-[1.7] text-[var(--text)]">
          <strong>安全提示：</strong>请根据任务选择合适模型。涉及学生隐私、考试数据、未公开科研资料等内容时，应优先使用已接入校内安全策略的模型，并遵守学校数据安全规范。所有模型调用均会写入审计日志。
        </p>
      </div>
    </div>
  );
}
