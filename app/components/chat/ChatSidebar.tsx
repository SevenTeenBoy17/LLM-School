"use client";

import { Bot, Check, ChevronDown, History, Loader2, MoreHorizontal, Pencil, Pin, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SessionSummary } from "@/lib/client/chatApi";
import { cn } from "@/lib/utils";
import { useSessionRole } from "@/components/shell/SessionRoleProvider";
import { gradientCss } from "@/lib/data/gradientKeys";
import { MODELS, MODEL_GRADIENT_CSS } from "@/lib/data/models";
import { PanelResizeHandle, usePersistentPanelWidth } from "@/components/shell/PanelResizeHandle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AGENTS = [
  // V2 §3.1 R1：原为 4 个智能体各配一条自造渐变（颜色表达「归属」）。
  // 改走与数据层同一套枚举键（lib/data/gradientKeys.ts），渲染时由键查 token。
  { name: "班主任助手", gradientKey: "accent" as const },
  { name: "教研助手", gradientKey: "info" as const },
  { name: "论文润色助手", gradientKey: "calm" as const },
  { name: "课件生成助手", gradientKey: "warm" as const },
];

function timeAgo(ts: number) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}


interface Props {
  open: boolean;
  sessions: SessionSummary[];
  activeId: string | null;
  loading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onRename: (id: string, title: string) => Promise<boolean> | boolean;
}

export function ChatSidebar({ open, sessions, activeId, loading, onSelect, onNew, onDelete, onTogglePin, onRename }: Props) {
  const role = useSessionRole();
  const isStudentRole = role === "student";
  const panelWidth = usePersistentPanelWidth({
    storageKey: `eduai.chat.sidebar-width.v1.${role}`,
    defaultWidth: 288,
    minWidth: 240,
    maxWidth: 400,
  });
  const [filter, setFilter] = useState("");
  const [recentOpen, setRecentOpen] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const q = filter.trim();
  const list = sessions.filter(
    (s) => !q || s.title.includes(q) || (s.preview ?? "").includes(q)
  );

  const beginRename = (s: SessionSummary) => {
    setRenamingId(s.id);
    setRenameValue(s.title || "新对话");
  };
  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };
  const submitRename = async (id: string) => {
    const title = renameValue.replace(/\s+/g, " ").trim();
    if (!title) return;
    const ok = await onRename(id, title);
    if (ok) cancelRename();
  };

  return (
    <div
      id="chat-conversation-sidebar"
      data-testid="chat-conversation-sidebar"
      data-open={open ? "true" : "false"}
      aria-hidden={!open}
      inert={!open}
      style={{ width: panelWidth.width, flexBasis: panelWidth.width }}
      className="edu-chat-sidebar-shell relative hidden h-full shrink-0 md:block"
    >
    <aside aria-label="会话工作区" className="edu-chat-sidebar flex h-full min-w-0 w-full flex-col gap-3 border-r p-4">
      <Button variant="ghost" size="lg" className="edu-3d-control edu-3d-primary h-[52px] min-h-[52px] w-full gap-2 rounded-[12px]" onClick={onNew}>
        <Plus size={16} /> 发起新对话
      </Button>
      <div className="edu-glass-inset flex min-h-[44px] items-center gap-2 rounded-[12px] px-3 text-[13px] text-[var(--text-3)]">
        <Search size={14} />
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setRecentOpen(true);
          }}
          aria-label="搜索历史会话"
          className="h-10 min-w-0 w-full bg-transparent outline-none placeholder:text-[var(--text-3)]"
          placeholder="搜索历史会话"
        />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden -mx-1 pr-1">
        <button
          type="button"
          onClick={() => setRecentOpen((value) => !value)}
          aria-expanded={recentOpen}
          aria-controls="chat-recent-sessions"
          className="edu-chat-sidebar-section-trigger mt-1 flex min-h-[44px] w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-semibold text-[var(--text-2)]"
        >
          <History size={15} aria-hidden />
          <span className="min-w-0 flex-1">最近会话</span>
          <span className="edu-chat-sidebar-count" aria-label={`${list.length} 个会话`}>{list.length}</span>
          <ChevronDown size={15} aria-hidden />
        </button>
        <div id="chat-recent-sessions" hidden={!recentOpen} className="mt-1.5 space-y-1">
          {loading && (
            <div className="flex items-center gap-2 px-2 py-6 text-[12px] text-[var(--text-3)]">
              <Loader2 size={14} className="animate-spin" /> 正在载入会话...
            </div>
          )}
          {!loading && list.map((s) => (
            <div
              key={s.id}
              data-active={activeId === s.id ? "true" : "false"}
              className={cn(
                "edu-session-row group relative flex min-h-[68px] min-w-0 w-full items-start gap-2 rounded-[12px] px-2 py-2",
                activeId === s.id && "text-[var(--text)]"
              )}
            >
              {renamingId === s.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRename(s.id);
                  }}
                >
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    aria-label={`重命名会话 ${s.title}`}
                    className="edu-glass-inset h-12 min-w-0 flex-1 rounded-[12px] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]"
                    autoFocus
                  />
                  <button type="submit" aria-label="保存重命名" title="保存" className="edu-3d-control grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[var(--ok-ink)]">
                    <Check size={15} />
                  </button>
                  <button type="button" onClick={cancelRename} aria-label="取消重命名" title="取消" className="edu-3d-control grid h-11 w-11 shrink-0 place-items-center rounded-[12px] text-[var(--text-3)]">
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <>
                  <button
                    onClick={() => onSelect(s.id)}
                    className="flex min-h-[48px] min-w-0 flex-1 items-start gap-2.5 text-left"
                    aria-current={activeId === s.id ? "true" : undefined}
                  >
                    <div className="edu-chat-avatar grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[12px] font-semibold text-white"
                      style={{ backgroundImage: MODEL_GRADIENT_CSS(MODELS.find((m) => m.id === s.modelId) || MODELS[0]) }}
                    >
                      {(s.title || "新").charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {s.pinned && <Pin size={11} className="shrink-0 text-[var(--c-edu)]" />}
                        <span className="truncate text-[13px] font-semibold">{s.title || "新对话"}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-[var(--text-2)]">{s.preview || "暂无消息"}</div>
                      <div className="mt-1 text-[11px] text-[var(--text-3)]">{timeAgo(s.updatedAt)}</div>
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`${s.title || "新对话"}的会话操作`}
                        title="会话操作"
                        className={cn(
                          "edu-3d-control grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-[var(--text-3)] transition-opacity group-hover:opacity-100 focus:opacity-100",
                          activeId === s.id ? "opacity-100" : "opacity-0"
                        )}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="edu-glass-panel-strong w-44">
                      <DropdownMenuItem onClick={() => beginRename(s)}>
                        <Pencil size={14} /> 重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onTogglePin(s.id, !s.pinned)}>
                        <Pin size={14} className={s.pinned ? "fill-current" : ""} /> {s.pinned ? "取消置顶" : "置顶会话"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(s.id)} className="text-[var(--err-ink)] focus:bg-[var(--err-bg)]">
                        <Trash2 size={14} /> 删除会话
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ))}
          {!loading && list.length === 0 && (
            <p role="status" aria-live="polite" className="px-2 py-6 text-center text-[12px] text-[var(--text-3)]">
              {sessions.length === 0 ? "还没有对话，点上方「发起新对话」开始吧" : "未找到匹配的会话"}
            </p>
          )}
        </div>

        {/* H1：四个智能体捷径全是教师侧人设（班主任/教研/论文/课件），学生端纯噪声——隐藏（少即是多） */}
        {!isStudentRole && (<>
        <button
          type="button"
          onClick={() => setAgentsOpen((value) => !value)}
          aria-expanded={agentsOpen}
          aria-controls="chat-agent-shortcuts"
          className="edu-chat-sidebar-section-trigger mt-4 flex min-h-[44px] w-full items-center gap-2 rounded-[10px] px-2 text-left text-[12px] font-semibold text-[var(--text-2)]"
        >
          <Bot size={15} aria-hidden />
          <span className="min-w-0 flex-1">智能体</span>
          <span className="edu-chat-sidebar-count" aria-label={`${AGENTS.length} 个智能体`}>{AGENTS.length}</span>
          <ChevronDown size={15} aria-hidden />
        </button>
        <div id="chat-agent-shortcuts" hidden={!agentsOpen} className="mt-1.5 space-y-1">
          {AGENTS.map((a) => (
            <Link
              key={a.name}
              href="/agent"
              className="edu-session-row group flex min-h-[52px] min-w-0 w-full items-center gap-2.5 overflow-hidden rounded-[12px] px-2 py-2 text-left"
            >
              <div className="edu-chat-avatar grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundImage: gradientCss(a.gradientKey) }}>
                <Bot size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">{a.name}</div>
                <div className="text-[12px] text-[var(--text-2)]">前往智能体中心</div>
              </div>
            </Link>
          ))}
        </div>
        </>)}
      </div>
    </aside>
    {open && (
      <PanelResizeHandle
        testId="chat-sidebar-resize-handle"
        label="调整会话侧栏宽度"
        edge="end"
        width={panelWidth.width}
        minWidth={panelWidth.minWidth}
        maxWidth={panelWidth.maxWidth}
        onResize={panelWidth.resize}
        onCommit={panelWidth.commit}
        onReset={panelWidth.reset}
      />
    )}
    </div>
  );
}
