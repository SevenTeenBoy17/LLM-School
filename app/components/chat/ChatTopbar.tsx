"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, BookOpen, Brain, Globe, Download, Copy, Check, Lightbulb, Lock, PanelLeftClose, PanelLeftOpen, Settings2 } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { exportConversation, conversationToMarkdown, type ExportFormat } from "@/lib/client/exportChat";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { useModelStore } from "@/lib/store/useModelStore";
import { ModelGlyph } from "@/components/common/ModelGlyph";
import { GenerationProgress } from "@/components/common/GenerationProgress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrefsStore, type AssistantRole } from "@/lib/store/usePrefsStore";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const ROLES: { id: AssistantRole; label: string }[] = [
  { id: "teacher",  label: "教师助手" },
  { id: "student",  label: "学生助手" },
  { id: "research", label: "科研助手" },
  { id: "admin",    label: "行政助手" },
];

function copyWithTextarea(text: string): boolean {
  if (typeof document.execCommand !== "function") return false;
  const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    textarea.remove();
    previousActive?.focus({ preventScroll: true });
  }
  return copied;
}

async function copyTextToClipboard(text: string) {
  if (copyWithTextarea(text)) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error("Clipboard API unavailable");
}

interface ChatTopbarProps {
  messages?: ChatMessage[];
  title?: string;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export function ChatTopbar({ messages, title, sidebarOpen = true, onToggleSidebar }: ChatTopbarProps) {
  const { current, setCurrent, knowledgeOn, deepThinkOn, toggleKnowledge, toggleDeepThink } = useModelStore();
  const userRole = useSessionRole(); // 服务端会话角色优先（避免 SSR 默认 teacher 残留，T5 P1）
  // M1/B1 苏格拉底引导三态（学生端 UI 镜像；生效判定在服务端 /api/chat 每请求读库）
  const [socratic, setSocratic] = useState(false);
  const [socraticLocked, setSocraticLocked] = useState(false);
  useEffect(() => {
    if (userRole !== "student") return;
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
  }, [userRole]);
  const toggleSocratic = async () => {
    if (socraticLocked) return;
    const next = !socratic;
    setSocratic(next);
    try {
      await fetch("/api/user/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socratic: next }) });
    } catch { setSocratic(!next); }
  };
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [copyDraft, setCopyDraft] = useState<string | null>(null);
  const settled = (messages ?? []).filter((m) => !m.streaming);
  const canExport = settled.length > 0;

  // 每轮标注发言者（我 / AI·模型名），导出与复制共用。
  const buildTurns = () => settled.map((m) => ({
    speaker: m.role === "user" ? "我" : `AI · ${MODELS.find((x) => x.id === m.modelId)?.name || "助手"}`,
    content: m.content,
  }));

  // 会话级整段导出：把整场对话导出为 md/txt/html/Word/PPT，复用消息级同一管线。
  const doExportConversation = async (fmt: ExportFormat) => {
    if (exporting || !canExport) return;
    setExporting(fmt);
    setExportNotice(`正在导出整段对话 ${fmt.toUpperCase()} 文件...`);
    const tid = toast.loading(`正在生成整段对话 ${fmt.toUpperCase()} 文件…`);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      await exportConversation(buildTurns(), fmt, title);
      setExportNotice(`已导出整段对话为 ${fmt.toUpperCase()} 文件`);
      toast.success(`已导出整段对话为 ${fmt.toUpperCase()} 文件`, { id: tid });
    } catch {
      setExportNotice("导出失败，请重试");
      toast.error("导出失败，请重试", { id: tid });
    } finally {
      setExporting(null);
    }
  };

  // 会话级复制：把整场对话（Markdown）复制到剪贴板。
  const doCopyConversation = async () => {
    if (!canExport) return;
    const markdown = conversationToMarkdown(buildTurns(), title);
    try {
      await copyTextToClipboard(markdown);
      toast.success(`已复制整段对话（${settled.length} 条）到剪贴板`);
    } catch {
      setCopyDraft(markdown);
      toast("自动复制受限，已打开手动复制文本");
    }
  };
  const retryCopyDraft = async () => {
    if (!copyDraft) return;
    try {
      await copyTextToClipboard(copyDraft);
      toast.success("已复制整段对话到剪贴板");
      setCopyDraft(null);
    } catch {
      toast.error("仍无法自动复制，请手动选中文本复制");
    }
  };
  const assistantRole = usePrefsStore((s) => s.assistantRole);
  const setAssistantRole = usePrefsStore((s) => s.setAssistantRole);
  // 学生锁定「学生助手」并隐藏其他助手 tab（评审 P0-2）；其余角色可自由切换（userRole 已在组件顶部声明）
  const isStudent = userRole === "student";
  const roleTabs = isStudent ? ROLES.filter((r) => r.id === "student") : ROLES;
  const activeAssistant: AssistantRole = isStudent ? "student" : assistantRole;
  const model = MODELS.find((m) => m.id === current) || MODELS[0];

  return (
    <div data-testid="chat-topbar" className="edu-chat-topbar edu-glass-panel-strong relative z-40 flex flex-wrap items-center gap-3 border-x-0 border-t-0 px-5 py-3">
      {onToggleSidebar && (
        <button
          type="button"
          data-testid="chat-sidebar-toggle"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "隐藏会话侧栏" : "显示会话侧栏"}
          aria-expanded={sidebarOpen}
          aria-controls="chat-conversation-sidebar"
          aria-keyshortcuts={"Control+\\ Meta+\\"}
          title={sidebarOpen ? "隐藏会话侧栏" : "显示会话侧栏"}
          className="edu-3d-control hidden h-12 w-12 shrink-0 place-items-center rounded-[12px] text-[var(--text-2)] md:grid"
        >
          {sidebarOpen ? <PanelLeftClose size={18} aria-hidden /> : <PanelLeftOpen size={18} aria-hidden />}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`当前模型 ${model.name}，点击切换模型`}
            className="edu-chat-model-control edu-3d-control flex min-h-[48px] items-center gap-2.5 rounded-[12px] px-3 py-1.5"
          >
              <div className="edu-chat-model-avatar edu-chat-avatar grid h-9 w-9 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(model) }}>
              <ModelGlyph id={model.id} size={20} />
            </div>
            <div className="edu-chat-model-meta text-left leading-tight">
              <div className="text-[13px] font-semibold">{model.name}</div>
              <div className="edu-chat-model-subtitle text-[11px] text-[var(--text-2)]">已连接校内知识库</div>
            </div>
            <ChevronDown size={12} className="text-[var(--text-3)]" />
          </button>
        </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="edu-glass-panel-strong w-72">
          <DropdownMenuLabel>选择模型</DropdownMenuLabel>
          {MODELS.map((m) => (
            <DropdownMenuItem
              key={m.id}
              disabled={m.status === "maintain"}
              onClick={() => { if (m.status !== "maintain") setCurrent(m.id); }}
              className={cn("gap-3 p-2", m.id === current && "bg-[var(--rg-selected-bg)]", m.status === "maintain" && "opacity-50")}
            >
                <div className="edu-chat-avatar grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundImage: MODEL_GRADIENT_CSS(m) }}>
                <ModelGlyph id={m.id} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">{m.name}</div>
                <div className="text-[11px] text-[var(--text-2)]">{m.status === "maintain" ? "通道维护中" : m.status === "request" ? "需申请开通" : "已开通"}</div>
              </div>
              {m.id === current && <Check size={14} className="text-[var(--c-edu)]" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* H1 学生端减法：知识库/深度思考/联网三枚低频开关收进「更多」菜单（教师保持平铺）。
          引导模式保留在明面——它是产品身份不是设置项。 */}
      {!isStudent && <button
        onClick={toggleKnowledge}
        aria-pressed={knowledgeOn}
        aria-label={knowledgeOn ? "关闭知识库" : "开启知识库"}
        className={cn(
          "edu-chat-feature-control flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold transition",
          knowledgeOn ? "bg-[var(--rg-selected-bg)] text-[var(--c-primary)]" : "border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]"
        )}
      >
        <BookOpen size={14} /> <span className="edu-chat-control-label">知识库</span>
      </button>}
      {!isStudent && <button
        onClick={toggleDeepThink}
        aria-pressed={deepThinkOn}
        aria-label={deepThinkOn ? "关闭深度思考" : "开启深度思考"}
        className={cn(
          "edu-chat-feature-control flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold transition",
          deepThinkOn ? "bg-[var(--proc-bg)] text-[var(--proc-ink)]" : "border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]"
        )}
      >
        <Brain size={14} /> <span className="edu-chat-control-label">深度思考</span>
      </button>}
      {userRole === "student" && (
        <button
          onClick={toggleSocratic}
          aria-pressed={socratic || socraticLocked}
          disabled={socraticLocked}
          title={socraticLocked
            ? "老师已为本班开启引导模式：AI 会陪你想，而不是替你想"
            : "开启后 AI 用提问引导你分步思考，不直接给答案"}
          className={cn(
            "flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold transition",
            socratic || socraticLocked
              ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]"
              : "border border-[var(--border-2)] text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]",
            socraticLocked && "cursor-not-allowed"
          )}
        >
          {socraticLocked ? <Lock size={14} /> : <Lightbulb size={14} />} 引导模式
          {socraticLocked && <span className="text-[11px] opacity-80">· 班级开启</span>}
        </button>
      )}
      {!isStudent && <button
        type="button"
        disabled
        title="校内未开通联网检索（面向未成年人，仅使用校内可信来源）"
        aria-label="联网检索：校内未开通"
        className="edu-chat-feature-control edu-chat-network-control flex min-h-[40px] cursor-not-allowed items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] px-3 py-2 text-[13px] text-[var(--text-3)] opacity-60"
      >
        <Globe size={14} /> <span className="edu-chat-control-label">联网 · 未开通</span>
      </button>}
      {isStudent && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
          <button className="edu-3d-control flex min-h-[40px] items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold text-[var(--text-2)]">
              <Settings2 size={14} /> 更多
              {(knowledgeOn || deepThinkOn) && <span className="h-1.5 w-1.5 rounded-full bg-[var(--c-edu)]" aria-hidden />}
            </button>
          </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="edu-glass-panel-strong w-64">
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
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="edu-chat-assistant-tabs hidden lg:block">
        <Tabs value={activeAssistant} onValueChange={(v) => { if (!isStudent) setAssistantRole(v as AssistantRole); }}>
          <TabsList>
            {roleTabs.map((r) => (<TabsTrigger key={r.id} value={r.id}>{r.label}</TabsTrigger>))}
          </TabsList>
        </Tabs>
      </div>

      {/* 会话级动作：复制/导出已接通「整段对话」真实操作；收藏（置顶用左栏📌）/更多仍诚实禁用。 */}
      <div className="edu-chat-session-actions ml-auto flex items-center gap-1">
        {/* 此处原有一个 disabled 的「收藏」星标按钮。它的两个真实替代都已存在——会话置顶在左侧栏、单条收藏在消息下方——所以这个死按钮是纯噪声；而那句指路说明只写在 title 里，触屏用户拿不到。删。 */}
        {canExport ? (
          <button type="button" onClick={doCopyConversation} aria-label="复制整段对话到剪贴板" title="复制整段对话（Markdown）到剪贴板" className="edu-3d-control grid h-12 w-12 place-items-center rounded-[12px] text-[var(--text-2)] hover:text-[var(--text)]">
            <Copy size={16} />
          </button>
        ) : isStudent ? null : (
          <button type="button" disabled aria-label="复制（当前对话为空）" title="当前对话为空；发送消息后可复制整段对话，或用每条消息下方「复制」" className="grid h-12 w-12 cursor-not-allowed place-items-center rounded-[12px] text-[var(--text-3)] opacity-50">
            <Copy size={16} />
          </button>
        )}
        {canExport ? (
          <div className="relative z-50 inline-block">
          <button type="button" disabled={!!exporting} onClick={() => void doExportConversation("md")} aria-label="导出整段对话" title="导出整段对话为 Markdown 文件" className="edu-3d-control flex min-h-[40px] cursor-pointer list-none items-center gap-1.5 rounded-[12px] px-3 py-2 text-[13px] font-semibold text-[var(--text-2)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50">
              <Download size={14} /> <span className="edu-chat-export-label">导出</span>
            </button>
          </div>
        ) : isStudent ? null : (
          <button type="button" disabled aria-label="导出（当前对话为空）" title="当前对话为空；发送消息后可整段导出 md / txt / html / Word / PPT，或用每条消息下方导出单条" className="flex min-h-[40px] cursor-not-allowed items-center gap-1.5 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--text-3)] opacity-50">
            <Download size={14} /> 导出
          </button>
        )}
        {/* 此处原有一个 disabled 的「更多」按钮，title 写「更多会话操作未开通」。纯图标 + 无替代 + 无标签 = 只能靠点一下才知道点不了。删。 */}
      </div>
      {exporting && (
        <GenerationProgress
          label={`正在导出整段对话 ${exporting.toUpperCase()} 文件`}
          detail="正在本地准备下载文件"
          className="order-last min-w-0 w-full basis-full !py-1"
        />
      )}
      {exportNotice && !exporting && (
        <div role="status" className="order-last min-w-0 w-full basis-full break-words text-[12px] font-semibold text-[var(--text)]">
          {exportNotice}
        </div>
      )}
      {copyDraft && (
        <div className="fixed inset-0 z-[var(--z-app-modal)] flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="手动复制整段对话"
          className="edu-glass-panel-strong w-full max-w-2xl overflow-hidden rounded-[20px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-2)] px-4 py-3">
              <div>
                <div className="text-[14px] font-semibold text-[var(--text)]">手动复制整段对话</div>
                <div className="text-[12px] text-[var(--text-2)]">浏览器限制了自动剪贴板写入，下面文本已包含完整 Markdown。</div>
              </div>
              <button
                type="button"
                onClick={() => setCopyDraft(null)}
                className="min-h-[40px] rounded-[12px] border border-[var(--border-2)] px-3 py-2 text-[12px] text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]"
              >
                关闭
              </button>
            </div>
            <div className="space-y-3 p-4">
              <textarea
                readOnly
                value={copyDraft}
                onFocus={(e) => e.currentTarget.select()}
                className="h-[46vh] w-full resize-none rounded-[12px] border border-[var(--border-2)] bg-[var(--rg-control-bg)] p-3 font-mono text-[12px] leading-5 text-[var(--text)] outline-none focus:border-[var(--c-edu)]"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={retryCopyDraft}
                  className="min-h-[40px] rounded-[12px] bg-[var(--text)] px-3 py-2 text-[12px] font-semibold text-[var(--bg)]"
                >
                  重新尝试复制
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
