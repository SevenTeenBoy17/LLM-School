"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Lightbulb, Loader2, Lock, Settings2, BookOpen, Brain, Globe, Copy, Download } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { MODELS } from "@/lib/data/models";
import { useModelStore } from "@/lib/store/useModelStore";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { conversationToMarkdown, exportConversation } from "@/lib/client/exportChat";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/**
 * H5 · 学生端输入坞（Claude/ChatGPT 范式：对话面无独立工具条，控件收进输入卡底行）。
 * - 模型选择：Claude 式纯文字钮（品牌标 + 名称 + ⌄），菜单向上弹出；
 * - 引导模式：产品身份保留明面（紧凑短标签，班级锁定态照旧）；
 * - 更多：知识库/深度思考/联网（诚实禁用）+ 有内容时的复制/导出整段。
 * 逻辑与原 ChatTopbar 同源（模型走全局 store，引导偏好走 /api/user/prefs 服务端镜像）。
 */
export function StudentDock({ messages }: { messages?: ChatMessage[] }) {
  const { current, setCurrent, knowledgeOn, deepThinkOn, toggleKnowledge, toggleDeepThink } = useModelStore();
  const role = useSessionRole();
  const [socratic, setSocratic] = useState(false);
  const [socraticLocked, setSocraticLocked] = useState(false);
  const [savingSocratic, setSavingSocratic] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (role !== "student") return;
    let alive = true;
    fetch("/api/user/prefs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setSocratic(!!j.prefs?.socratic);
        setSocraticLocked(!!j.socraticLocked);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [role]);

  const toggleSocratic = async () => {
    if (socraticLocked || savingSocratic) return;
    const next = !socratic;
    setSavingSocratic(true);
    try {
      const response = await fetch("/api/user/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socratic: next }) });
      if (!response.ok) throw new Error("save_failed");
      const data = (await response.json()) as { prefs?: { socratic?: boolean } };
      setSocratic(Boolean(data.prefs?.socratic));
      toast.success(next ? "已开启引导模式" : "已关闭引导模式");
    } catch {
      toast.error("引导模式未保存，请重试");
    } finally {
      setSavingSocratic(false);
    }
  };

  const model = MODELS.find((m) => m.id === current) || MODELS[0];
  const settled = (messages ?? []).filter((m) => !m.streaming);
  const canExport = settled.length > 0;
  const buildTurns = () => settled.map((m) => ({
    speaker: m.role === "user" ? "我" : `AI · ${MODELS.find((x) => x.id === m.modelId)?.name || "助手"}`,
    content: m.content,
  }));

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(conversationToMarkdown(buildTurns()));
      toast.success(`已复制整段对话（${settled.length} 条）`);
    } catch { toast.error("复制受限，可用每条消息下方的「复制」"); }
  };
  const exportAll = async () => {
    if (exporting || !canExport) return;
    setExporting(true);
    const tid = toast.loading(<GenerationProgress label="正在导出整段对话" />);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await exportConversation(buildTurns(), "md");
      toast.success("已导出整段对话", { id: tid });
    } catch { toast.error("导出失败，请重试", { id: tid }); }
    finally { setExporting(false); }
  };

  return (
    <>
      {/* 模型选择（Claude 式纯文字钮，向上弹出） */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`当前模型 ${model.name}，点击切换`}
            className="edu-3d-control inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[13px] text-[var(--text-2)] hover:text-[var(--text)]"
          >
            <ModelGlyph id={model.id} size={15} />
            <span className="max-w-[96px] truncate sm:max-w-[140px]">{model.name}</span>
            <ChevronDown size={12} className="text-[var(--text-3)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="edu-glass-panel-strong w-64">
          <DropdownMenuLabel>选择模型</DropdownMenuLabel>
          {MODELS.map((m) => (
            <DropdownMenuItem
              key={m.id}
              disabled={m.status === "maintain"}
              onClick={() => { if (m.status !== "maintain") setCurrent(m.id); }}
              className={cn("gap-2.5 p-2", m.id === current && "bg-[var(--rg-selected-bg)]", m.status === "maintain" && "opacity-50")}
            >
              <ModelGlyph id={m.id} size={16} className="shrink-0 text-[var(--text-2)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{m.name}</div>
                <div className="text-[11px] text-[var(--text-2)]">{m.status === "maintain" ? "通道维护中" : "已开通"}</div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 引导模式：产品身份，保留明面（紧凑） */}
      <button
        onClick={toggleSocratic}
        aria-pressed={socratic || socraticLocked}
        disabled={socraticLocked || savingSocratic}
        title={socraticLocked
          ? "老师已为本班开启引导模式：AI 会陪你想，而不是替你想"
          : "开启后 AI 用提问引导你分步思考，不直接给答案"}
        className={cn(
          "edu-3d-control inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-[13px]",
          socratic || socraticLocked ? "!border-[rgba(54,185,138,0.3)] !bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "text-[var(--text-2)] hover:text-[var(--text)]",
          (socraticLocked || savingSocratic) && "cursor-not-allowed"
        )}
      >
        {savingSocratic ? <Loader2 size={13} className="animate-spin" /> : socraticLocked ? <Lock size={13} /> : <Lightbulb size={13} />} 引导
      </button>

      {/* 更多：低频开关 + 会话级动作（有内容才出现） */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="对话设置与更多操作" className="edu-3d-control relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-[var(--text-2)] hover:text-[var(--text)]">
            <Settings2 size={15} />
            {(knowledgeOn || deepThinkOn) && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--c-edu)]" aria-hidden />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="edu-glass-panel-strong w-64">
          <DropdownMenuLabel>对话设置</DropdownMenuLabel>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleKnowledge(); }} className="gap-2">
            <BookOpen size={14} className="opacity-70" />
            <span className="flex-1">校内知识库</span>
            <span className={cn("text-[11px]", knowledgeOn ? "text-[var(--ok-ink)]" : "text-[var(--text-3)]")}>{knowledgeOn ? "已开启" : "已关闭"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleDeepThink(); }} className="gap-2">
            <Brain size={14} className="opacity-70" />
            <span className="flex-1">深度思考</span>
            <span className={cn("text-[11px]", deepThinkOn ? "text-[var(--ok-ink)]" : "text-[var(--text-3)]")}>{deepThinkOn ? "已开启" : "已关闭"}</span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="gap-2 opacity-60">
            <Globe size={14} className="opacity-70" />
            <span className="flex-1">联网检索</span>
            <span className="text-[11px]">校内未开通</span>
          </DropdownMenuItem>
          {canExport && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void copyAll()} className="gap-2">
                <Copy size={14} className="opacity-70" /> 复制整段对话
              </DropdownMenuItem>
              <DropdownMenuItem disabled={exporting} onClick={() => void exportAll()} className="gap-2">
                <Download size={14} className="opacity-70" /> 导出 Markdown
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
