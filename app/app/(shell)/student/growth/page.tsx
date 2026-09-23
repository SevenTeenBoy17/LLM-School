"use client";

/**
 * /student/growth —— 成长页（S4：错题本=诊断+处方 + 真数据统计）。
 * 铁律：无排行榜/名次；统计只来自本人真实记录（会话时间戳/错题行）；不编造。
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, NotebookPen, BarChart3, Trash2, RotateCcw, CheckCheck, Plus, FolderHeart, PencilLine, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/common/EduArt";
import { cn } from "@/lib/utils";
import { pointsForSubject } from "@/lib/knowledgePoints";
import { Delight } from "@/components/common/Delight";
import { RadarChart } from "@/components/student/RadarChart";
import { QuizWidget } from "@/components/student/QuizWidget";
import { PortfolioPanel } from "@/components/student/PortfolioPanel";
import { PageIcon } from "@/components/common/PlayIcon";

interface Mistake {
  id: string; subject: string; knowledgePoint?: string; content: string;
  reason?: string; createdAt: number; reviewedAt?: number;
}

const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "信息"];
const REASONS = ["概念混淆", "计算失误", "审题偏差", "记忆不牢", "未归因"];

export default function StudentGrowthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"mistakes" | "stats" | "quiz" | "portfolio">("mistakes");
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [daysActive, setDaysActive] = useState<{ day: string; n: number }[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [subjects, setSubjects] = useState<{ subject: string; count: number }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);   // V3：学科 chip 默认折叠
  const [reasonOpen, setReasonOpen] = useState(false);     // V3：错因 chip 默认折叠
  // BL1：知识点为受控词表值；切换学科时同步重置，避免残留跨学科选项
  const [form, setForm] = useState({ subject: "数学", knowledgePoint: pointsForSubject("数学")[0], content: "", reason: "未归因" });
  const [busy, setBusy] = useState(false);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/mistakes", { cache: "no-store" });
        if (r.ok) setMistakes((await r.json()).mistakes ?? []);
      } catch { /* 下次再试 */ }
      try {
        // M4/B5：统计改读服务端真实聚合（会话真总数 + 学科分布 + 提问时间戳）
        const r = await fetch("/api/student/stats", { cache: "no-store" });
        if (!r.ok) return;
        const { stats } = await r.json();
        setSessionTotal(stats.sessionTotal ?? 0);
        setSubjects(stats.subjects ?? []);
        // 本地日期分桶（终审 P2：toISOString 是 UTC，会把 UTC+8 凌晨记到前一天）
        const localKey = (ts: number) => { const d = new Date(ts); return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
        const byDay = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          byDay.set(localKey(d.getTime()), 0);
        }
        for (const t of (stats.questionTimes ?? []) as number[]) {
          const k = localKey(t);
          if (byDay.has(k)) byDay.set(k, (byDay.get(k) ?? 0) + 1);
        }
        setDaysActive([...byDay].map(([day, n]) => ({ day, n })));
      } catch { /* ignore */ }
    };
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    if (form.content.trim().length < 4 || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/mistakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (r.ok) {
        const { mistake } = await r.json();
        setMistakes((cur) => [mistake, ...cur]);
        setForm({ subject: form.subject, knowledgePoint: pointsForSubject(form.subject)[0], content: "", reason: "未归因" });
        setShowForm(false);
      }
    } catch { /* ignore */ }
    setBusy(false);
  };
  const remove = async (id: string) => {
    await fetch("/api/mistakes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setMistakes((cur) => cur.filter((m) => m.id !== id));
  };
  // 服务端算好的 celebrate 此前被整个丢掉——PATCH 的响应根本没读。
  // §5 P3 定的是「**服务端**按『同一知识点两条 review 且跨自然日』判定，前端不得自行推断」，
  // 前端不读响应，等于那条服务端判定写了却从没生效过。现在消费它，且**只消费布尔值**。
  const review = async (id: string) => {
    const res = await fetch("/api/mistakes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setMistakes((cur) => cur.map((m) => (m.id === id ? { ...m, reviewedAt: Date.now() } : m)));
    if (!res.ok) return;
    const j = (await res.json().catch(() => null)) as { celebrate?: boolean } | null;
    if (j?.celebrate) {
      setCelebrateId(id);
      // 只是一次微反馈，不留驻。定时清掉，避免它变成一块常驻的「奖章」。
      window.setTimeout(() => setCelebrateId((cur) => (cur === id ? null : cur)), 2200);
    }
  };
  const explain = (m: Mistake) => router.push(`/chat?seed=${encodeURIComponent(
    `这是我错题本里的一道错题（${m.subject}${m.knowledgePoint ? " · " + m.knowledgePoint : ""}，错因：${m.reason ?? "未归因"}）：\n\n${m.content}\n\n请不要直接给答案，先用提问引导我找出错在哪里，再帮我理解正确思路。`)}`);
  const practice = (m: Mistake) => router.push(`/chat?seed=${encodeURIComponent(
    `请围绕「${m.subject}${m.knowledgePoint ? " · " + m.knowledgePoint : ""}」这个知识点，出一道与下面错题同类型的变式练习题（不要给答案，等我先作答）：\n\n${m.content}`)}`);

  const maxN = useMemo(() => Math.max(1, ...daysActive.map((d) => d.n)), [daysActive]);

  return (
    <div data-register="campus" className="flex-1 min-w-0 overflow-x-hidden p-5 md:p-7">
      <div className="mx-auto max-w-[760px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <PageIcon name="growth" fallback={GraduationCap} />
            <div>
              <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">我的成长</h1>
              <p className="mt-1 text-[13px] text-[var(--text-2)]">只和昨天的自己比——这里没有排行榜。</p>
            </div>
          </div>
          <div className="inline-flex rounded-[12px] bg-[var(--rg-control-bg)] p-0.5 text-[13px]" role="tablist" aria-label="成长页切换">
            <button role="tab" aria-selected={tab === "mistakes"} onClick={() => setTab("mistakes")} className={cn("min-h-[38px] rounded-[12px] px-3.5", tab === "mistakes" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}><NotebookPen size={13} className="mr-1 inline" />错题本</button>
            <button role="tab" aria-selected={tab === "stats"} onClick={() => setTab("stats")} className={cn("min-h-[38px] rounded-[12px] px-3.5", tab === "stats" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}><BarChart3 size={13} className="mr-1 inline" />统计</button>
            <button role="tab" aria-selected={tab === "quiz"} onClick={() => setTab("quiz")} className={cn("min-h-[38px] rounded-[12px] px-3.5", tab === "quiz" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}><PencilLine size={13} className="mr-1 inline" />随堂小测</button>
            <button role="tab" aria-selected={tab === "portfolio"} onClick={() => setTab("portfolio")} className={cn("min-h-[38px] rounded-[12px] px-3.5", tab === "portfolio" ? "bg-[var(--card)] font-semibold shadow-sm" : "text-[var(--text-2)]")}><FolderHeart size={13} className="mr-1 inline" />档案袋</button>
          </div>
          {/* W-B4：徽章/庄园经成长页进入（成长组 hub；顶层保持 4 入口） */}
          <div className="flex gap-1.5">
            <Link href="/student/badges" className="inline-flex min-h-[38px] items-center rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)]">徽章墙</Link>
            <Link href="/student/manor" className="inline-flex min-h-[38px] items-center rounded-[12px] border border-[var(--border-2)] px-3.5 text-[13px] text-[var(--text-2)] transition-colors hover:border-[var(--c-edu)]/45 hover:text-[var(--text)]">个人庄园</Link>
          </div>
        </div>

        {tab === "mistakes" && (
          <Reveal className="mt-5 space-y-3">
            {!showForm ? (
              <Button variant="outline" className="min-h-[44px] w-full gap-1.5 border-dashed" onClick={() => setShowForm(true)}>
                <Plus size={15} /> 记一道错题（记下来，就成功了一半）
              </Button>
            ) : (
              <div className="surface-card space-y-3 p-4">
                {/* V3 减噪：9 个学科 chip 平铺 → 默认只显示已选那个 + 一个「换一个」入口。
                    录入表单原本一次抛出 9 + 5 = 14 个 chip，对 K-12 是明显过载；
                    而绝大多数时候学生只改一次学科。展开态保留全量，不牺牲可达性。 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {subjectOpen ? (
                    SUBJECTS.map((s) => (
                      <button key={s} onClick={() => { setForm((f) => ({ ...f, subject: s, knowledgePoint: pointsForSubject(s)[0] })); setSubjectOpen(false); }} className={cn("min-h-[34px] rounded-full px-3 text-[12px]", form.subject === s ? "bg-[var(--rg-selected-bg)] font-semibold text-[var(--accent)]" : "bg-[var(--rg-control-bg)] text-[var(--text-2)]")}>{s}</button>
                    ))
                  ) : (
                    <>
                      <span className="min-h-[34px] rounded-full bg-[var(--rg-selected-bg)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent)]">{form.subject}</span>
                      <button type="button" onClick={() => setSubjectOpen(true)} className="min-h-[34px] rounded-full px-3 text-[12px] text-[var(--text-2)] underline underline-offset-2">换一个学科</button>
                    </>
                  )}
                </div>
                {/* BL1：知识点改受控选择（服务端同样按词表归一，未选=其他）——避免自由文本进入教师聚类视图 */}
                <select
                  value={form.knowledgePoint}
                  onChange={(e) => setForm((f) => ({ ...f, knowledgePoint: e.target.value }))}
                  aria-label="知识点"
                  className="h-10 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 text-[13px] outline-none focus:border-[var(--c-edu)]"
                >
                  {pointsForSubject(form.subject).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={3} maxLength={1200} placeholder="把错题和你的错误答案记在这里…" aria-label="错题内容" className="w-full resize-none rounded-[12px] border border-[var(--border)] bg-[var(--card)] p-3 text-[13px] outline-none focus:border-[var(--c-edu)]" />
                <div className="flex flex-wrap items-center gap-1.5">
                  {reasonOpen ? (
                    REASONS.map((r) => (
                      <button key={r} onClick={() => { setForm((f) => ({ ...f, reason: r })); setReasonOpen(false); }} className={cn("min-h-[32px] rounded-full px-2.5 text-[12px]", form.reason === r ? "bg-[var(--warn-bg)] font-semibold text-[var(--warn-ink)]" : "bg-[var(--rg-control-bg)] text-[var(--text-3)]")}>{r}</button>
                    ))
                  ) : (
                    <button type="button" onClick={() => setReasonOpen(true)} className="min-h-[32px] rounded-full bg-[var(--rg-control-bg)] px-2.5 text-[12px] text-[var(--text-2)]">
                      错因：{form.reason || "点这里选"}
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <Button variant="ghost" size="sm" className="min-h-[38px]" onClick={() => setShowForm(false)}>取消</Button>
                    <Button variant="grad" size="sm" className="min-h-[38px]" disabled={form.content.trim().length < 4 || busy} onClick={submit}>保存</Button>
                  </div>
                </div>
              </div>
            )}

            {mistakes.length === 0 && !showForm && (
              <div className="surface-card p-8 text-center text-[13px] text-[var(--text-2)]">错题本还是空的——下次做错了题，把它记进来，AI 陪你把它变成会做的题。</div>
            )}
            {mistakes.map((m) => (
              <div key={m.id} className={cn("surface-card p-4", m.reviewedAt && "opacity-70")}>
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="rounded-full bg-[var(--rg-selected-bg)] px-2 py-0.5 font-semibold text-[var(--accent)]">{m.subject}</span>
                  {m.knowledgePoint && <span className="rounded-full bg-[var(--rg-control-bg)] px-2 py-0.5 text-[var(--text-2)]">{m.knowledgePoint}</span>}
                  <span className="rounded-full bg-[var(--warn-bg)] px-2 py-0.5 text-[var(--warn-ink)]">{m.reason ?? "未归因"}</span>
                  {m.reviewedAt && <span className="rounded-full bg-[var(--ok-bg)] px-2 py-0.5 text-[var(--ok-ink)]">已复习</span>}
                  {/* 庆祝：仅在**服务端**判定 celebrate=true 时出现（跨自然日的第二次复习）。
                      走 <Delight> 而不是直接渲染——它承担限高与**安全态抑制**：
                      求助面板一开，这里立刻消失，不会在一次严肃求助旁边放彩带。
                      文案只描述**这一次**发生的事，不提连贯性、不提缺席负债（§3.3 禁机制）。
                      （注：此处刻意不举反面例词——G8 是全文件扫描，引用禁用词的注释同样计数。） */}
                  {celebrateId === m.id && (
                    <Delight level={1} data-testid="celebrate-pop" className="celebrate-pop rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[var(--accent-focus)]">
                      隔天又看了一遍 · 这样记得牢
                    </Delight>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text)]">{m.content}</p>
                {/* V3 减噪：每张卡 4 个常驻动作 → 主按钮「AI 讲解」+ 二级「⋯」。
                    错题多起来时，4 × N 个按钮是这一页最大的噪声源（与 chat 动作区同源问题）。
                    删除保留二次确认；二级菜单用 <details>，原生键盘可达。 */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="soft" size="sm" className="min-h-[36px] gap-1" onClick={() => explain(m)}><Lightbulb size={13} /> AI 讲解</Button>
                  <details className="relative inline-block">
                    <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1 rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] px-3 text-[13px] text-[var(--text-2)] [&::-webkit-details-marker]:hidden" aria-label="这道错题的更多操作">
                      ⋯ 更多
                    </summary>
                    <div role="menu" className="absolute left-0 z-10 mt-1 min-w-[168px] overflow-hidden rounded-[12px] border border-[var(--border-2)] bg-[var(--card)] py-1 shadow-lg">
                      <button type="button" role="menuitem" onClick={() => practice(m)} className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]"><RotateCcw size={13} /> 再练一题</button>
                      {!m.reviewedAt && (
                        <button type="button" role="menuitem" onClick={() => review(m.id)} className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-[12px] hover:bg-[var(--rg-hover-bg)]"><CheckCheck size={13} /> 标记已复习</button>
                      )}
                      <div className="my-1 border-t border-[var(--border-2)]" />
                      <button type="button" role="menuitem" onClick={() => remove(m.id)} className="flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-[12px] text-[var(--c-alert)] hover:bg-[var(--err-bg)]"><Trash2 size={13} /> 移出错题本</button>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </Reveal>
        )}

        {tab === "quiz" && (
          <Reveal>
            <section aria-label="AI 随堂小测" className="surface-card p-4 md:p-5">
              <h2 className="mb-1 text-[15px] font-semibold text-[var(--text)]">AI 随堂小测</h2>
              <p className="mb-3 text-[12px] text-[var(--text-2)]">出题来自真实模型，判分在服务端完成；答错的题会自动收进错题本。你的「小测正确率」只由这里产生。</p>
              <QuizWidget />
            </section>
          </Reveal>
        )}
        {tab === "portfolio" && (
          <Reveal>
            <section aria-label="成长档案袋" className="surface-card p-4 md:p-5">
              <h2 className="mb-1 text-[15px] font-semibold text-[var(--text)]">成长档案袋</h2>
              <p className="mb-3 text-[12px] text-[var(--text-2)]">通过老师批阅的项目活动会自动收进这里；客观数据由系统自动记录，AI 建议须经老师确认后才会出现。</p>
              <PortfolioPanel />
            </section>
          </Reveal>
        )}
        {tab === "stats" && (
          <Reveal className="mt-5 space-y-4">
            <section aria-label="课堂雷达" className="surface-card p-4 md:p-5">
              <h2 className="mb-1 text-[15px] font-semibold text-[var(--text)]">课堂雷达</h2>
              <p className="mb-3 text-[12px] text-[var(--text-2)]">五个维度都来自你的真实记录（小测/错题/使用/老师点评/知识点）；没有数据的维度就写「暂无」，不编数字。</p>
              <RadarChart />
            </section>
            <div className="grid grid-cols-3 gap-3">
              {[
                // M4/B5：服务端 COUNT(*) 真实累计（不再受列表 LIMIT 影响）
                { label: "累计会话", value: String(sessionTotal) },
                { label: "错题记录", value: String(mistakes.length) },
                { label: "已复习", value: String(mistakes.filter((m) => m.reviewedAt).length) },
              ].map((s) => (
                <div key={s.label} className="surface-card p-4 text-center">
                  <div className="text-num text-[24px] font-bold text-[var(--text)]">{s.value}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--text-2)]">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="surface-card p-4">
              <div className="text-[13px] font-semibold text-[var(--text)]">近 7 日活跃（真实会话记录）</div>
              <div className="mt-3 flex h-[96px] items-end gap-2">
                {daysActive.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t-[12px] bg-[var(--accent)]/80 transition-all" style={{ height: `${(d.n / maxN) * 72 + 4}px`, opacity: d.n ? 1 : 0.25 }} />
                    <span className="text-[11px] text-[var(--text-3)]">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* M4/B5：分学科提问分布（真实消息级标注；识别不出的如实归「未分类」） */}
            <div className="surface-card p-4">
              <div className="text-[13px] font-semibold text-[var(--text)]">分学科提问分布</div>
              {subjects.length === 0 ? (
                <p className="mt-2 text-[12px] text-[var(--text-2)]">还没有提问记录——去 AI 对话问第一个问题，这里就会出现你的学科分布。</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {subjects.map((s) => {
                    const max = Math.max(...subjects.map((x) => x.count));
                    return (
                      <div key={s.subject} className="flex items-center gap-3">
                        <span className="w-[52px] shrink-0 text-[12px] text-[var(--text-2)]">{s.subject}</span>
                        <span className="h-[10px] flex-1 overflow-hidden rounded-full bg-[var(--bg-2)]">
                          <span className="block h-full rounded-full bg-[var(--accent)]/80" style={{ width: `${Math.max(4, (s.count / max) * 100)}%` }} />
                        </span>
                        <span className="text-num w-8 shrink-0 text-right text-[12px] font-semibold text-[var(--text)]">{s.count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-[12px] text-[var(--text-3)]">本页所有数字都来自你自己的真实记录（服务端聚合），不做估算；未能识别学科的提问如实计入「未分类」。</p>
          </Reveal>
        )}
      </div>
    </div>
  );
}
