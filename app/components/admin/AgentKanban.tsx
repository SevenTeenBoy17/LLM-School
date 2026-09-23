"use client";

/**
 * AgentKanban — 智能体发布审批看板（对标 Hawk 参考图，UI 文档 §5.10/§11.4）。
 * 4 列生命周期（草稿→待审核→已发布→已下线），列头彩色下划线（Hawk 标志）。
 * 状态流转用「按钮驱动状态机」而非拖拽（审批场景更安全、可达，见 §11.4）。
 * Console 严肃调；类别色编码 + 创建者头像堆叠 + 调用/评分。
 */
import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Star, Phone } from "lucide-react";
import { toast } from "sonner";
import { AGENTS } from "@/lib/data/agents";
import type { AgentItem } from "@/lib/types";

type Status = AgentItem["status"]; // draft | review | pub | disabled

// 列下划线用**状态语义色**：草稿=中性、待审核=告警、已发布=成功、已下线=错误。
// 这一组不适用 R1（颜色不表达归属）——它编码的是**流转状态**不是身份，
// 与全站 badge/告警共用同一套语义令牌才能保证「同一状态到处同色」。
const COLUMNS: { key: Status; label: string; underline: string; hint: string }[] = [
  { key: "draft",    label: "草稿",    underline: "var(--text-3)", hint: "编辑中" },
  { key: "review",   label: "待审核",  underline: "var(--warn)",   hint: "等待教研组/校办审批" },
  { key: "pub",      label: "已发布",  underline: "var(--ok)",     hint: "面向师生开放" },
  { key: "disabled", label: "已下线",  underline: "var(--err)",    hint: "暂停使用" },
];

// 状态机：每个状态可触发的流转（按钮）
const TRANSITIONS: Record<Status, { to: Status; label: string; primary?: boolean }[]> = {
  draft:    [{ to: "review",   label: "提交审核", primary: true }],
  review:   [{ to: "pub",      label: "通过发布", primary: true }, { to: "draft", label: "退回" }],
  pub:      [{ to: "disabled", label: "下线" }],
  disabled: [{ to: "pub",      label: "重新发布", primary: true }],
};

const CATEGORY: Record<string, { bg: string; ink: string }> = {
  教学: { bg: "var(--info-bg)",  ink: "var(--info-ink)" },
  科研: { bg: "var(--proc-bg)",  ink: "var(--proc-ink)" },
  // 另外三项早已走令牌，只有这一项漏了——四选一的裸值最容易被当成「本来就这样」。
  行政: { bg: "var(--accent-tint)", ink: "var(--accent-focus)" },
  学习: { bg: "var(--ok-bg)",    ink: "var(--ok-ink)" },
};

export function AgentKanban() {
  const [items, setItems] = useState<AgentItem[]>(AGENTS);

  const move = (id: string, to: Status, label: string, name: string) => {
    setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status: to } : a)));
    toast.success(`「${name}」已${label}`); // 直接传名，避免读陈旧闭包（code-review P1-1）
  };

  const grouped = useMemo(() => {
    const g: Record<Status, AgentItem[]> = { draft: [], review: [], pub: [], disabled: [] };
    for (const a of items) g[a.status].push(a);
    return g;
  }, [items]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => (
        <section key={col.key} aria-label={`${col.label} 列，${grouped[col.key].length} 个智能体`} className="flex min-w-0 flex-col">
          {/* 列头 + 彩色下划线（Hawk 标志） */}
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-[var(--text)]">{col.label}</span>
                <span className="rounded-full bg-[var(--bg-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                  {grouped[col.key].length}
                </span>
              </div>
              {/* 此处原有一个 24px 的纯图标「列操作」按钮，disabled 且说明只写在 title 里。纯图标死控件没有标签可保留——用户根本看不出它本该做什么，所以「留着标注路线图」的理由不成立，直接删（沿用 V1a 对 chat 死按钮的处置）。 */}
            </div>
            <div className="mt-1.5 h-[3px] w-full rounded-full" style={{ background: col.underline }} />
            <div className="mt-1 text-[11px] text-[var(--text-3)]">{col.hint}</div>
          </div>

          {/* 卡片列 */}
          <div role="list" className="flex flex-col gap-2.5">
            {grouped[col.key].map((a) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Ic = (Icons as any)[a.icon] as React.ComponentType<{ size?: number }>;
              const cat = CATEGORY[a.category] ?? { bg: "var(--bg-2)", ink: "var(--text-2)" };
              return (
                <article key={a.id} role="listitem" className="rounded-[var(--r-md)] border border-[var(--border-2)] bg-[var(--card)] p-3 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: cat.bg, color: cat.ink }}>
                      {a.category}
                    </span>
                    {a.unread ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)]">
                        <Phone size={10} /> {a.unread} 待处理
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-start gap-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-white" style={{ backgroundImage: a.gradient }}>
                      {Ic && <Ic size={14} />}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[var(--text)]">{a.name}</div>
                      <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--text-2)]">{a.description}</div>
                    </div>
                  </div>

                  {/* 元信息 */}
                  <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-2)] pt-2 text-[11px] text-[var(--text-2)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--bg-2)] text-[9px] font-bold text-[var(--text-2)]">
                        {a.creator.slice(0, 1)}
                      </span>
                      {a.creator}
                    </span>
                    <span className="inline-flex items-center gap-2.5">
                      <span className="text-num">{a.calls.toLocaleString()} 次</span>
                      <span className="inline-flex items-center gap-0.5 text-[var(--warn-ink)]"><Star size={11} /> {a.score}</span>
                    </span>
                  </div>

                  {/* 状态流转按钮（状态机） */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {TRANSITIONS[a.status].map((t) => (
                      <button
                        key={t.to}
                        onClick={() => move(a.id, t.to, t.label, a.name)}
                        className={
                          t.primary
                            ? "rounded-[12px] bg-[var(--c-primary)] px-2.5 py-1 text-[12px] font-semibold text-white transition hover:bg-[var(--c-primary-2)]"
                            : "rounded-[12px] border border-[var(--border)] px-2.5 py-1 text-[12px] font-semibold text-[var(--text-2)] transition hover:border-[var(--c-edu)]/40 hover:text-[var(--c-edu)]"
                        }
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}

            {grouped[col.key].length === 0 && (
              <div className="rounded-[var(--r-md)] border border-dashed border-[var(--border)] py-8 text-center text-[12px] text-[var(--text-3)]">
                暂无智能体
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
