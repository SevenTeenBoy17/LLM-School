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

/**
 * H7 · 顶栏内联搜索（用户拍板：不再单独弹出）。GitHub/Notion 式原位检索——
 * 直接在顶栏输入，结果面板贴挂在输入框正下方（毛玻璃卡，与 H6 弹层同质感）。
 * ⌘K 聚焦本输入框；Esc 清空并收起；点外/失焦收起；Enter 直达第一条结果。
 * 窄屏（<md）本组件隐藏，由移动端图标触发的 CommandPalette 弹层兜底。
 */
export function InlineSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K：聚焦内联输入（桌面不再开弹层）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        // 窄屏本组件不可见（hidden md:flex）——交给移动弹层的监听，不抢事件
        if (rootRef.current && rootRef.current.offsetParent === null) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 点外收起
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // 防抖搜索（空词不清态：展示层用 q.trim() 派生过滤，避免 effect 内同步 setState——React 纯度规则）
  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const r = await apiSearch(term);
      if (!cancelled) { setHits(r); setLoading(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  const go = useCallback((hit: SearchHit) => {
    setFocused(false);
    setQ("");
    if (hit.kind === "session") router.push(`/chat?session=${encodeURIComponent(hit.id)}`);
    else if (hit.kind === "prompt") router.push(`/chat?prompt=${encodeURIComponent(hit.id)}`);
    else router.push(`/chat?agent=${encodeURIComponent(hit.id)}`);
  }, [router]);

  const showPanel = focused && q.trim().length > 0;
  const shownHits = q.trim() ? hits : [];
  const grouped = (["session", "prompt", "agent"] as const)
    .map((kind) => ({ kind, items: shownHits.filter((h) => h.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <div ref={rootRef} className="relative hidden min-w-0 max-w-[520px] flex-1 md:block md:ml-6">
      <div className="flex h-[52px] items-center gap-2.5 rounded-[var(--rg-control-radius)] border border-transparent bg-[var(--rg-control-bg)] px-3.5 text-[13px] transition focus-within:border-[var(--border)] focus-within:bg-[var(--card)] hover:border-[var(--border)] hover:bg-[var(--card)]">
        <Search size={15} className="shrink-0 text-[var(--text-3)]" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setQ(""); setFocused(false); inputRef.current?.blur(); }
            if (e.key === "Enter" && shownHits.length > 0) go(shownHits[0]);
          }}
          role="combobox" aria-autocomplete="list" aria-expanded={showPanel} aria-controls="inline-search-results" aria-label="全局搜索：智能体、知识库、历史对话或课程资料"
          placeholder="搜索智能体、知识库、历史对话或课程资料..."
          className="focus-quiet h-full min-w-0 flex-1 bg-transparent text-[var(--text)] placeholder:text-[var(--text-3)]"
        />
        {loading && q.trim() && <Loader2 size={14} className="shrink-0 animate-spin text-[var(--text-3)]" />}
        <kbd className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--card)] px-1.5 py-0.5 text-[11px] text-[var(--text-3)]">⌘ K</kbd>
      </div>

      {/* 结果面板：贴挂输入框正下方（与 H6 同质感白霜卡），非模态 */}
      {showPanel && (
        <div id="inline-search-results" className="absolute left-0 right-0 top-full z-[var(--z-app-modal)] mt-2 overflow-hidden rounded-[20px] border border-[var(--border-2)] bg-[var(--card)]/95 shadow-[0_24px_64px_rgba(15,23,42,0.18)] backdrop-blur-xl">
          <div className="max-h-[52vh] overflow-y-auto p-2">
            {!loading && grouped.length === 0 && (
              <p role="status" className="px-3 py-5 text-center text-[13px] text-[var(--text-3)]">没有匹配「{q.trim()}」的结果</p>
            )}
            {grouped.map(({ kind, items }) => {
              const Meta = KIND_META[kind];
              const Icon = Meta.icon;
              return (
                <div key={kind} className="mb-1">
                  <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--text-3)]">{Meta.label}</div>
                  {items.map((h) => (
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
      )}
    </div>
  );
}
