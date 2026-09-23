"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, MessageSquare, Sparkles, Bot, CornerDownLeft, Loader2 } from "lucide-react";
import { apiSearch, type SearchHit } from "@/lib/client/shellApi";

const KIND_META: Record<SearchHit["kind"], { label: string; icon: typeof Bot }> = {
  session: { label: "历史会话", icon: MessageSquare },
  prompt: { label: "提示词", icon: Sparkles },
  agent: { label: "智能体", icon: Bot },
};

// 窄屏全局搜索弹层（H7 后仅移动端兜底）：Topbar 移动图标派发 "eduai:open-search" 打开。
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开的一刻重置查询态（渲染期「上一次状态」模式，避免在 effect 里 setState）
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) { setQ(""); setHits([]); setLoading(false); }
  }

  useEffect(() => {
    // H7：⌘K 归桌面内联搜索（InlineSearch）；本弹层只作窄屏兜底，经移动图标事件打开
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("eduai:open-search", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("eduai:open-search", onOpen); };
  }, []);

  // 打开时聚焦输入框（纯 DOM 副作用，无 setState）
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // 防抖搜索：setState 只发生在异步定时器回调里（不在 effect 同步体内）
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (!term) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await apiSearch(term);
      if (!cancelled) { setHits(r); setLoading(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  const shownHits = q.trim() ? hits : [];

  const go = useCallback((hit: SearchHit) => {
    setOpen(false);
    if (hit.kind === "session") router.push(`/chat?session=${encodeURIComponent(hit.id)}`);
    else if (hit.kind === "prompt") router.push(`/chat?prompt=${encodeURIComponent(hit.id)}`);
    else router.push(`/chat?agent=${encodeURIComponent(hit.id)}`);
  }, [router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-app-modal)] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="全局搜索">
      <div className="absolute inset-0 bg-slate-950/20 backdrop-blur-md" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-[20px] border border-[var(--border-2)] bg-[var(--card)]/95 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <div className="flex items-center gap-2.5 border-b border-[var(--border-2)] px-4">
          <Search size={16} className="text-[var(--text-3)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="搜索会话、提示词、智能体"
            placeholder="搜索历史会话、提示词、智能体…"
            className="focus-quiet h-12 flex-1 bg-transparent text-[14px] placeholder:text-[var(--text-3)]"
          />
          {loading && q.trim() && <Loader2 size={15} className="animate-spin text-[var(--text-3)]" />}
          <kbd className="rounded-md border border-[var(--border)] bg-[var(--rg-control-bg)] px-1.5 py-0.5 text-[11px] text-[var(--text-3)]">Esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {!q.trim() && (
            <p className="px-3 py-6 text-center text-[13px] text-[var(--text-3)]">输入关键词，跨会话 / 提示词 / 智能体搜索（校内关键词检索，非向量语义）</p>
          )}
          {q.trim() && !loading && shownHits.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-[13px] text-[var(--text-3)]">没有匹配「{q.trim()}」的结果</p>
          )}
          {(["session", "prompt", "agent"] as SearchHit["kind"][]).map((kind) => {
            const group = shownHits.filter((h) => h.kind === kind);
            if (!group.length) return null;
            const Meta = KIND_META[kind];
            const Icon = Meta.icon;
            return (
              <div key={kind} className="mb-1">
                <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--text-3)]">{Meta.label}</div>
                {group.map((h) => (
                  <button key={`${h.kind}-${h.id}`} type="button" onClick={() => go(h)}
                    className="flex min-h-[44px] w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left hover:bg-[var(--rg-hover-bg)]">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-primary)]"><Icon size={13} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{h.title}</span>
                      {h.sub && <span className="block truncate text-[11px] text-[var(--text-2)]">{h.sub}</span>}
                    </span>
                    <CornerDownLeft size={12} className="shrink-0 text-[var(--text-3)]" />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
