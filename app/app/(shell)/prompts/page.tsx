"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import { Search, Plus, Send, Copy, Star, MessageCircle, Award, Trash2, Check, PencilLine, Wand2 } from "lucide-react";
import { Reveal } from "@/components/common/EduArt";
import {
  TeacherFeatureGlyph,
  featureGlyphForPrompt,
  featureGlyphForPromptCategory,
} from "@/components/common/TeacherFeatureGlyph";
import { PROMPT_CATEGORIES, PROMPTS as SEED_PROMPTS } from "@/lib/data/prompts";
import { apiListPrompts, apiDeletePrompt, type ClientPrompt } from "@/lib/client/libraryApi";
import { apiSetFavorite } from "@/lib/client/chatApi";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { emptyCopy } from "@/lib/data/emptyStates";
import { cn } from "@/lib/utils";
import type { PromptCategory } from "@/lib/types";

// 用当前变量输入渲染提示词正文（{key} → 值）。
function resolveBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{([^}]+)\}/g, (m, k) => (vars[k]?.trim() ? vars[k] : m));
}

export default function PromptsPage() {
  const router = useRouter();
  const [prompts, setPrompts] = useState<ClientPrompt[]>(SEED_PROMPTS);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState("");
  const [cat, setCat] = useState<PromptCategory>("all");
  const [active, setActive] = useState<string>("");
  const [query, setQuery] = useState("");
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const { prompts: list, favorites: favs, userId: uid } = await apiListPrompts();
      if (!alive) return;
      if (list.length) setPrompts(list);
      setFavorites(new Set(favs));
      setUserId(uid);
      setActive((cur) => cur || (list[0]?.id ?? SEED_PROMPTS[0].id));
    })();
    return () => { alive = false; };
  }, []);

  const list = useMemo(() => {
    const q = query.trim();
    return prompts.filter((p) => {
      if (cat === "featured" && !p.featured) return false;
      if (cat === "star" && !favorites.has(p.id)) return false;
      if (cat !== "all" && cat !== "featured" && cat !== "star" && p.category !== cat) return false;
      if (q && !(p.title.includes(q) || p.description.includes(q) || p.scene.includes(q) || p.role.includes(q))) return false;
      return true;
    });
  }, [prompts, cat, query, favorites]);

  const detail = prompts.find((p) => p.id === active) || list[0] || prompts[0];
  const detailVars = detail?.variables ?? [];
  const publicCount = prompts.filter((p) => p.status !== "draft").length;
  const currentVars = useMemo(() => {
    const base: Record<string, string> = {};
    for (const v of detail?.variables ?? []) base[v.key] = varValues[`${detail?.id}:${v.key}`] ?? v.defaultValue;
    return base;
  }, [detail, varValues]);

  // 无正文不再落到「你是{角色}…」通用兜底——那段兜底让 9/10 详情页长得一模一样，
  // 正是被用户实锤的同质化来源。没有正文就如实说没有，发送按钮同步禁用。
  const rawBody = detail?.body ?? "";
  const resolvedBody = resolveBody(rawBody, currentVars);

  const toggleFav = async (id: string) => {
    const on = !favorites.has(id);
    setFavorites((cur) => { const n = new Set(cur); if (on) n.add(id); else n.delete(id); return n; });
    const meta = prompts.find((p) => p.id === id)?.title;
    const ok = await apiSetFavorite("prompt", id, on, meta);
    if (!ok) { setFavorites((cur) => { const n = new Set(cur); if (on) n.delete(id); else n.add(id); return n; }); setNotice("收藏操作失败"); }
    else setNotice(on ? "已收藏到「我的收藏」" : "已取消收藏");
  };

  const copyBody = async () => {
    try { await navigator.clipboard.writeText(resolvedBody); setNotice("提示词正文已复制"); }
    catch { setNotice("复制失败，请手动选择"); }
  };

  const sendToChat = (id = detail?.id) => { if (id) router.push(`/chat?prompt=${encodeURIComponent(id)}`); };
  const editPrompt = (id: string) => router.push(`/prompts/${encodeURIComponent(id)}/edit`);

  const removePrompt = async (id: string) => {
    const ok = await apiDeletePrompt(id);
    if (!ok) { setNotice("删除失败（仅可删除自己创建的）"); return; }
    setPrompts((cur) => cur.filter((p) => p.id !== id));
    if (active === id) setActive("");
    setNotice("已删除该提示词");
  };

  return (
    <div className="flex flex-1 min-w-0">
      {/* Left categories */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col gap-1 border-r border-[var(--border-2)] bg-[var(--card)]/40 p-4 backdrop-blur-sm">
        <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">提示词分类</div>
        {PROMPT_CATEGORIES.map((c) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Ic = (Icons as any)[c.icon] as React.ComponentType<{ size?: number }>;
          const count = c.id === "all" ? prompts.length
            : c.id === "featured" ? prompts.filter((p) => p.featured).length
            : c.id === "star" ? favorites.size
            : prompts.filter((p) => p.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              aria-pressed={cat === c.id}
              className={cn(
                "teacher-feature-surface flex items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left text-[13px] transition-colors",
                cat === c.id ? "bg-[var(--rg-selected-bg)] text-[var(--c-primary)] font-semibold" : "text-[var(--text-2)] hover:bg-[var(--rg-hover-bg)]"
              )}
            >
              <TeacherFeatureGlyph name={featureGlyphForPromptCategory(c.id)} size={32} fallback={Ic} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[11px] text-[var(--text-3)]">{count}</span>
            </button>
          );
        })}

        <div className="mt-4 rounded-[12px] p-4" style={{ backgroundImage: "linear-gradient(135deg,var(--accent-tint),var(--rg-hover-bg))" }}>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--c-primary)]">
            <Award size={13} /> 校园精选
          </div>
          <div className="mt-1.5 text-[12px] leading-[1.7] text-[var(--text-2)]">
            由教研组审核的高质量模板，覆盖教学、科研与行政多个场景。
          </div>
          <Button size="sm" variant="ghost" className="mt-2.5" onClick={() => setCat("featured")}>查看精选</Button>
        </div>
      </aside>

      {/* Middle list */}
      <div className="flex flex-1 min-w-0 flex-col">
        <div className="border-b border-[var(--border-2)] bg-[var(--card)]/40 p-5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <TeacherFeatureGlyph name="prompt-library" size={54} fallback={Wand2} priority />
              <div>
                <h1 className="text-[24px] font-semibold tracking-tight">提示词中心</h1>
                <p className="text-[13px] text-[var(--text-2)]">沉淀高质量 AI 使用模板，快速启动教学、科研与管理任务</p>
              </div>
            </div>
            <div className="flex h-[40px] min-w-[220px] flex-1 max-w-md items-center gap-2 rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[var(--text-3)]">
              <Search size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="搜索提示词" className="h-full w-full bg-transparent text-[13px] outline-none" placeholder="搜索教案生成、论文润色、试题设计、学情分析..." />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-bg)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--warn-ink)]">
              <Award size={11} /> 校内模板 {publicCount} 个
            </span>
            <Button asChild variant="grad" size="sm" className="gap-1.5">
              <Link href="/prompts/new"><Plus size={14} /> 新建提示词</Link>
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-5">
          <Reveal className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {list.map((p) => (
              <PromptCard
                key={p.id}
                prompt={p}
                active={p.id === active}
                favored={favorites.has(p.id)}
                owned={!!userId && p.ownerId === userId}
                onClick={() => setActive(p.id)}
                onSend={() => sendToChat(p.id)}
                onEdit={() => editPrompt(p.id)}
                onFav={() => toggleFav(p.id)}
                onDelete={() => removePrompt(p.id)}
              />
            ))}
            {list.length === 0 && (
              /* 四分型空态（UI 调研 top1）：原先是一句灰字「没有匹配的提示词」，
                 把两种完全不同的成因混成一句——收藏夹为空是 first-use（需要告诉他
                 怎么产生第一条），筛选无命中是 no-results（需要给清空筛选的出口）。
                 文案取自 lib/data/emptyStates.ts，不在页面里硬编码。 */
              <div role="status" aria-live="polite" className="col-span-full">
                {(() => {
                  const copy = emptyCopy(cat === "star" ? "prompts.noFavorites" : "prompts.noMatch");
                  return (
                    <EmptyState
                      kind={copy.kind}
                      title={copy.title}
                      description={copy.description}
                      action={
                        cat === "star" ? null : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[40px]"
                            onClick={() => { setCat("all"); setQuery(""); }}
                          >
                            清空筛选，看全部模板
                          </Button>
                        )
                      }
                    />
                  );
                })()}
              </div>
            )}
          </Reveal>
        </ScrollArea>
        {notice && <div role="status" aria-live="polite" className="border-t border-[var(--border-2)] px-5 py-2 text-[12px] text-[var(--text-2)]">{notice}</div>}
      </div>

      {/* Right detail */}
      {detail && (
        <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-[var(--border-2)] bg-[var(--card)]/40 backdrop-blur-sm">
          <ScrollArea className="flex-1">
            <Reveal delay={0.08} className="p-5">
              <div className="flex items-start gap-3">
                <TeacherFeatureGlyph name={featureGlyphForPrompt(detail.id)} size={50} fallback={Award} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold leading-tight">{detail.title}</h3>
                  <div className="mt-1 text-[12px] text-[var(--text-2)]">{detail.scene} · {detail.role} · 推荐 {detail.recommendedModel}</div>
                  {detail.status === "draft" && (
                    <div className="mt-1 inline-flex rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn-ink)]">
                      草稿 · 仅自己可见
                    </div>
                  )}
                </div>
                <button
                  onClick={() => toggleFav(detail.id)}
                  aria-label={favorites.has(detail.id) ? "取消收藏" : "收藏此提示词"}
                  aria-pressed={favorites.has(detail.id)}
                  className={cn("grid h-8 w-8 place-items-center rounded-[12px] hover:bg-[var(--rg-control-bg)]", favorites.has(detail.id) ? "text-[var(--c-gold)]" : "text-[var(--text-2)]")}
                >
                  <Star size={14} className={favorites.has(detail.id) ? "fill-current" : ""} />
                </button>
              </div>

              <PdSection label="使用说明">
                <p className="text-[13px] leading-[1.75] text-[var(--text-2)]">{detail.description}</p>
              </PdSection>

              {detailVars.length > 0 && (
                <PdSection label="变量填写">
                  <div className="space-y-2">
                    {detailVars.map((v) => (
                      <div key={v.key} className="grid grid-cols-[88px_1fr] items-center gap-2">
                        <label htmlFor={`pv-${v.key}`} className="text-[12px] text-[var(--text-2)]">{v.key}</label>
                        <input
                          id={`pv-${v.key}`}
                          className="h-8 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]"
                          value={currentVars[v.key] ?? ""}
                          onChange={(e) => setVarValues((cur) => ({ ...cur, [`${detail.id}:${v.key}`]: e.target.value }))}
                          placeholder={`输入${v.key}`}
                        />
                      </div>
                    ))}
                  </div>
                </PdSection>
              )}

              <PdSection label="提示词正文（已按变量渲染）" action={
                <button onClick={copyBody} className="inline-flex min-h-[24px] items-center gap-1 px-1 text-[11px] font-semibold text-[var(--c-edu)] hover:underline">
                  <Copy size={11} /> 复制
                </button>
              }>
                {rawBody ? (
                  <pre className="rounded-[12px] bg-[var(--code-bg)] p-3 text-[12px] leading-[1.7] text-white whitespace-pre-wrap font-mono">
                    {resolvedBody.split(/(\{[^}]+\})/g).map((s, i) =>
                      s.startsWith("{") ? <span key={i} className="text-[var(--accent-focus)]">{s}</span> : <span key={i}>{s}</span>
                    )}
                  </pre>
                ) : (
                  <p className="rounded-[12px] border border-dashed border-[var(--border-2)] p-3 text-[12px] text-[var(--text-3)]">
                    该提示词还没有模板正文。作者补全前无法发送到对话。
                  </p>
                )}
              </PdSection>

              {detail.outputExample && (
                <PdSection label="示例说明与使用要点">
                  <div className="whitespace-pre-wrap rounded-[12px] bg-[var(--rg-control-bg)] p-3 text-[12px] leading-[1.7] text-[var(--text-2)]">
                    {detail.outputExample}
                  </div>
                </PdSection>
              )}

              <div className="mt-5 flex gap-2">
                <Button onClick={() => sendToChat()} disabled={!rawBody} variant="grad" className="flex-1 gap-1.5"><Send size={13} /> 一键发送到对话</Button>
                <Button onClick={copyBody} aria-label="复制提示词正文" variant="outline" size="icon"><Copy size={14} /></Button>
              </div>
              {!!userId && detail.ownerId === userId && (
                <Button onClick={() => editPrompt(detail.id)} variant="outline" size="sm" className="mt-2 w-full gap-1.5">
                  <PencilLine size={13} /> {detail.status === "draft" ? "编辑并发布" : "编辑模板"}
                </Button>
              )}
              {!!userId && detail.ownerId === userId && (
                <Button onClick={() => removePrompt(detail.id)} variant="ghost" size="sm" className="mt-2 w-full gap-1.5 text-[var(--c-alert)]">
                  <Trash2 size={13} /> 删除此提示词
                </Button>
              )}
            </Reveal>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}

function PdSection({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[1.2px] text-[var(--text-3)]">{label}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function PromptCard({ prompt, active, favored, owned, onClick, onSend, onEdit, onFav, onDelete }: {
  prompt: ClientPrompt; active: boolean; favored: boolean; owned: boolean;
  onClick: () => void; onSend: () => void; onEdit: () => void; onFav: () => void; onDelete: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ic = (Icons as any)[prompt.icon] as React.ComponentType<{ size?: number }>;
  return (
    <div
      className={cn(
        "teacher-feature-surface surface-card group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]",
        active && "ring-2 ring-[var(--c-edu)]/40"
      )}
    >
      {/* 布局修正：原来把 ★精选 徽章和三颗 48px 动作按钮都塞在右上角，标题被 pr-44
          （154px）挤到只剩两个字（「结…」）——用户截图里就有。重构为：角上只留徽章，
          动作按钮移到底部统计行同一行（40px 触达达标且不嵌进主按钮，避免可交互嵌套）。 */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5">
        {prompt.featured && (
          <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn-ink)]">★ 精选</span>
        )}
        {prompt.status === "draft" && (
          <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warn-ink)]">草稿</span>
        )}
      </div>
      <button onClick={onClick} className="w-full text-left">
        <div className={cn("flex items-start gap-3", (prompt.featured || prompt.status === "draft") && "pr-16")}>
          <TeacherFeatureGlyph name={featureGlyphForPrompt(prompt.id)} size={48} fallback={Ic} />
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-[var(--text)] line-clamp-1">
              {prompt.title}
              {owned && <span className="ml-1 text-[11px] font-normal text-[var(--c-edu)]">· 我创建</span>}
              {prompt.status === "draft" && <span className="ml-1 text-[11px] font-normal text-[var(--warn-ink)]">· 仅自己可见</span>}
            </div>
            <div className="mt-1 text-[12px] leading-[1.7] text-[var(--text-2)] line-clamp-2">{prompt.description}</div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-[var(--rg-control-bg)] px-2 py-0.5 text-[11px] text-[var(--text-2)]">{prompt.scene}</span>
          <span className="rounded-full bg-[var(--rg-control-bg)] px-2 py-0.5 text-[11px] text-[var(--text-2)]">{prompt.role}</span>
          <span className="rounded-full bg-[var(--rg-selected-bg)] px-2 py-0.5 text-[11px] text-[var(--c-primary)]">{prompt.recommendedModel}</span>
          <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[11px] text-[var(--warn-ink)]">{prompt.level}</span>
        </div>
      </button>
      <div className="mt-3 flex items-center gap-2.5 whitespace-nowrap border-t border-[var(--border-2)] pt-2 text-[11px] text-[var(--text-2)]">
        <span className="inline-flex shrink-0 items-center gap-1"><MessageCircle size={11} /> <span className="text-num font-semibold text-[var(--text)]">{prompt.uses.toLocaleString()}</span> 调用</span>
        <span className="inline-flex shrink-0 items-center gap-1"><Star size={11} /> <span className="text-num font-semibold text-[var(--text)]">{prompt.favorites}</span> 收藏</span>
        {active && <span className="inline-flex shrink-0 items-center gap-1 text-[var(--c-edu)]"><Check size={11} /> 查看中</span>}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onFav} aria-label={favored ? "取消收藏" : "收藏"} aria-pressed={favored}
            className={cn("grid h-10 w-10 place-items-center rounded-[12px] hover:bg-[var(--rg-control-bg)]", favored ? "text-[var(--c-gold)]" : "text-[var(--text-3)]")}>
            <Star size={14} className={favored ? "fill-current" : ""} />
          </button>
          <button type="button" onClick={onSend} aria-label={`发送 ${prompt.title} 到对话`}
            className="grid h-10 w-10 place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--rg-selected-bg)] hover:text-[var(--c-edu)]">
            <Send size={14} />
          </button>
          {owned && (
            <button type="button" onClick={onDelete} aria-label={`删除 ${prompt.title}`}
              className="grid h-10 w-10 place-items-center rounded-[12px] text-[var(--text-3)] hover:bg-[var(--err-bg)] hover:text-[var(--c-alert)]">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {owned && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-2)] pt-3">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[12px] font-semibold text-[var(--c-edu)] transition-colors hover:bg-[var(--rg-selected-bg)]"
          >
            <PencilLine size={14} /> {prompt.status === "draft" ? "编辑并发布" : "编辑模板"}
          </button>
        </div>
      )}
    </div>
  );
}
