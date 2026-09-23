"use client";

/**
 * /class —— 教师「班级学情 · 诚信」页（评审 P1-1/P1-3 + 苏格拉底裁决）。
 * 数据来自 /api/class（服务端权威 + 按角色脱敏）：教师拿实名诊断、科研拿已脱敏 payload。
 * 前端不再持有原始 PII，脱敏不可被客户端绕过。诊断按「需关注」排序，无名次榜；诚信仅聚合趋势、非点名。
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Target, FileCheck2, TrendingUp, TrendingDown, Minus, ShieldQuestion, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { QuickEvalPanel } from "@/components/class/QuickEvalPanel";
import { ActivityTeacherPanel } from "@/components/class/ActivityTeacherPanel";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/common/EduArt";
import { TeacherFeatureIcon } from "@/components/common/TeacherNavIcon";
import { INTEGRITY_TREND } from "@/lib/data/classroom";

type StudentRow =
  | { id: string; name: string; mastery: number; trend: number; weakest: string; needHelp: boolean }
  | { id: string; label: string; bucket: string };
type PendingRow = { id: string; subject: string; title: string; submittedAt: number; student: string };
interface ClassData {
  masked: boolean;
  overview: { className: string; students: number; avgMastery: number; pendingGrading: number };
  students: StudentRow[];
  pending: PendingRow[];
  integrityWeekly: number;
}

function Trend({ v }: { v: number }) {
  if (v > 0) return <span className="inline-flex items-center gap-0.5 text-[var(--ok-ink)]"><TrendingUp size={12} /> {v}</span>;
  if (v < 0) return <span className="inline-flex items-center gap-0.5 text-[var(--err-ink)]"><TrendingDown size={12} /> {v}</span>;
  return <span className="inline-flex items-center gap-0.5 text-[var(--text-3)]"><Minus size={12} /> 0</span>;
}
function ago(ts: number): string {
  const h = Math.round((Date.now() - ts) / 3_600_000);
  return h < 1 ? "刚刚" : `${h} 小时前`;
}

function pendingSeed(item: PendingRow, masked: boolean): string {
  const target = masked ? item.student : `${item.student}同学`;
  return [
    `请帮我处理一份待批改作业：${item.title}。`,
    `学科：${item.subject}；对象：${target}。`,
    "请先给出批改关注点，再给出分层反馈话术、可追问的问题和下一步补救建议。",
  ].join("\n");
}

export default function ClassPage() {
  const [data, setData] = useState<ClassData | null>(null);
  const [err, setErr] = useState(false);
  const [clusters, setClusters] = useState<Array<{ subject: string; knowledgePoint: string; count: number }>>([]);
  const [socraticLock, setSocraticLock] = useState<boolean | null>(null); // null=未加载
  const [savingLock, setSavingLock] = useState(false);
  // BL2 班级级守护：effective=生效值（含来源），override=本班是否有自定义行
  const [guardian, setGuardian] = useState<{ limitMin: number; curfewStart: number; curfewEnd: number; source: string } | null>(null);
  const [hasOverride, setHasOverride] = useState(false);
  const [gForm, setGForm] = useState({ limitMin: 40, curfewStart: 22, curfewEnd: 6 });
  const [gSaving, setGSaving] = useState(false);
  const [gNotice, setGNotice] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/class")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: ClassData) => { if (alive) setData(d); })
      .catch(() => { if (alive) setErr(true); });
    // S4 错题聚类（服务端仅回传去标识计数）
    fetch("/api/mistakes?cluster=1")
      .then((r) => (r.ok ? r.json() : { clusters: [] }))
      .then((j) => { if (alive) setClusters(j.clusters ?? []); })
      .catch(() => {});
    // M1/B1 班级苏格拉底锁定策略
    fetch("/api/class/policy")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j) setSocraticLock(!!j.policy?.socraticLock); })
      .catch(() => {});
    // BL2 班级级守护：生效值 + 本班是否已有覆盖
    fetch("/api/guardian")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.guardian) return;
        setGuardian(j.guardian);
        setGForm({ limitMin: j.guardian.limitMin, curfewStart: j.guardian.curfewStart, curfewEnd: j.guardian.curfewEnd });
        setHasOverride(j.guardian.source === "class");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const saveGuardian = async () => {
    setGSaving(true); setGNotice("");
    try {
      const r = await fetch("/api/guardian", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gForm) });
      if (r.ok) {
        const j = await r.json();
        setGuardian(j.guardian); setHasOverride(true);
        setGNotice("已为本班保存——学生端最迟 60 秒内生效。");
      } else setGNotice("保存失败：参数无效或权限不足。");
    } catch { setGNotice("网络异常，稍后再试。"); }
    setGSaving(false);
  };
  const clearGuardian = async () => {
    setGSaving(true); setGNotice("");
    try {
      const r = await fetch("/api/guardian", { method: "DELETE" });
      if (r.ok) {
        const j = await r.json();
        setGuardian(j.guardian); setHasOverride(false);
        setGForm({ limitMin: j.guardian.limitMin, curfewStart: j.guardian.curfewStart, curfewEnd: j.guardian.curfewEnd });
        setGNotice("已撤销本班自定义，回落全校策略。");
      }
    } catch { setGNotice("网络异常，稍后再试。"); }
    setGSaving(false);
  };
  const gNum = (v: string, lo: number, hi: number, fallback: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
  };

  const toggleLock = async () => {
    if (socraticLock === null || savingLock) return;
    const next = !socraticLock;
    setSavingLock(true);
    try {
      const r = await fetch("/api/class/policy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ socraticLock: next }) });
      if (r.ok) setSocraticLock(next);
    } catch { /* 保持原状 */ }
    setSavingLock(false);
  };

  const kpis = data ? [
    { label: "班级人数", value: data.overview.students, icon: Users, tint: "var(--info-bg)", ink: "var(--info-ink)" },
    { label: "平均掌握率", value: `${data.overview.avgMastery}%`, icon: Target, tint: "var(--ok-bg)", ink: "var(--ok-ink)" },
    { label: "待批改", value: data.overview.pendingGrading, icon: FileCheck2, tint: "var(--warn-bg)", ink: "var(--warn-ink)" },
  ] : [];

  return (
    <div className="teacher-workspace flex-1 min-w-0 p-5 md:p-7 max-w-full overflow-x-hidden space-y-4">
      <div className="teacher-page-header flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeacherFeatureIcon name="class" size={50} fallback={Users} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">班级学情 · {data?.overview.className ?? "…"}</h1>
            <p className="mt-1 text-[13px] text-[var(--text-2)]">以「谁需要帮助」为导向的诊断视图——用于补差，不用于排名。</p>
          </div>
        </div>
      </div>

      {err && (
        <div className="surface-card p-6 text-center text-[13px] text-[var(--text-2)]">无法加载班级数据，请确认已登录为教师 / 科研角色。</div>
      )}
      {!err && !data && (
        <div className="surface-card flex items-center justify-center gap-2 p-10 text-[var(--text-3)]" role="status" aria-live="polite">
          <Loader2 size={18} className="animate-spin" /> 正在加载班级学情…
        </div>
      )}

      {data && (
        <>
          <Reveal className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="teacher-kpi surface-card flex items-center gap-3 p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px]" style={{ background: k.tint, color: k.ink }}><k.icon size={18} /></span>
                <div>
                  <div className="text-num text-[18px] font-bold text-[var(--text)]">{k.value}</div>
                  <div className="text-[12px] text-[var(--text-2)]">{k.label}</div>
                </div>
              </div>
            ))}
          </Reveal>

          {/* W-B2：快捷点评（进学生雷达「教师评价」维与成长记录；名册来自服务端本班数据） */}
          <Reveal delay={0.06}>
            <QuickEvalPanel students={data.students.filter((s): s is Extract<StudentRow, { name: string }> => "name" in s).map((s) => ({ id: s.id, name: s.name }))} />
            <ActivityTeacherPanel students={data.students.filter((s): s is Extract<StudentRow, { name: string }> => "name" in s).map((s) => ({ id: s.id, name: s.name }))} />
          </Reveal>

          <Reveal delay={0.08} className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader>
                <CardTitle>学生知识点掌握度</CardTitle>
                <Badge variant="primary">按需关注排序</Badge>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {data.students.map((s) => {
                    const full = "name" in s;
                    const display = full ? s.name : s.label;
                    return (
                      <div key={s.id} className={`flex items-center gap-3 rounded-[12px] border p-2.5 ${full && s.needHelp ? "border-[var(--warn)]/40 bg-[var(--warn-bg)]/40" : "border-[var(--border-2)]"}`}>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--bg-2)] text-[11px] font-bold text-[var(--text-2)]">{display.slice(0, 1)}</span>
                        <span className="w-16 shrink-0 truncate text-[13px] font-semibold text-[var(--text)]">{display}</span>
                        {full ? (
                          <>
                            <div className="flex-1">
                              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
                                <div className="h-full rounded-full" style={{ width: `${s.mastery}%`, background: s.needHelp ? "var(--warn)" : "var(--ok)" }} />
                              </div>
                            </div>
                            <span className="w-10 shrink-0 text-num text-right text-[13px] font-semibold text-[var(--text)]">{s.mastery}%</span>
                            <span className="w-10 shrink-0 text-right text-[12px]"><Trend v={s.trend} /></span>
                            <span className="hidden w-24 shrink-0 truncate text-[11px] text-[var(--text-3)] sm:block">薄弱：{s.weakest}</span>
                            {s.needHelp && <Badge variant="gold">需关注</Badge>}
                          </>
                        ) : (
                          <span className="flex-1 text-[12px] text-[var(--text-2)]">掌握度：<span className="font-semibold text-[var(--text)]">{s.bucket}</span></span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[12px] text-[var(--text-3)]">仅你和该生可见其掌握详情；此页用于教学补差，不对学生公开、不生成排名。{data.masked && " 科研视图已由服务端对学生姓名脱敏并最小化展示。"}</p>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle><ShieldQuestion size={15} className="mr-1.5 inline text-[var(--c-edu)]" /> 学术诚信 · 趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-[12px] text-[var(--text-2)]">近 7 日「学伴引导」触发</div>
                  <div className="text-num text-[24px] font-bold text-[var(--text)]">{data.integrityWeekly} <span className="text-[12px] text-[var(--text-3)]">次</span></div>
                  {data.integrityWeekly === 0 && (
                    <p className="mt-1 text-[11px] text-[var(--text-3)]">近 7 日暂无先思考引导记录——学伴会在合适时机鼓励学生独立思考。</p>
                  )}
                  <p className="mt-2 rounded-[12px] bg-[var(--info-bg)] px-3 py-2 text-[11px] leading-relaxed text-[var(--info-ink)]">{INTEGRITY_TREND.note}</p>
                  <Link href="/knowledge" className="mt-2 inline-flex min-h-[24px] items-center gap-1 text-[12px] font-semibold text-[var(--c-edu)] hover:underline">了解学伴引导与诚信培养策略 <ChevronRight size={13} /></Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>苏格拉底引导 · 班级锁定</CardTitle><Badge variant={socraticLock ? "green" : undefined}>{socraticLock === null ? "…" : socraticLock ? "已开启" : "未开启"}</Badge></CardHeader>
                <CardContent>
                  <p className="text-[12px] leading-relaxed text-[var(--text-2)]">开启后本班学生的 AI 对话强制进入引导模式：AI 用提问带学生分步思考、不直接给答案。学生端会看到锁形标识与说明（可见可解释）。</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!!socraticLock}
                    disabled={socraticLock === null || savingLock}
                    onClick={toggleLock}
                    className={`mt-3 inline-flex min-h-[40px] items-center gap-2 rounded-[12px] px-4 text-[13px] font-semibold transition ${socraticLock ? "bg-[var(--ok-bg)] text-[var(--ok-ink)]" : "bg-[var(--rg-control-bg)] text-[var(--text-2)] hover:bg-[var(--rg-control-hover)]"}`}
                  >
                    {savingLock ? "保存中…" : socraticLock ? "已为本班开启 · 点击关闭" : "为本班开启引导模式"}
                  </button>
                </CardContent>
              </Card>

              {/* BL2：班级级守护微调（班级策略优先于全校；可一键撤销回落） */}
              <Card>
                <CardHeader>
                  <CardTitle>守护策略 · 本班</CardTitle>
                  <Badge variant={hasOverride ? "green" : undefined}>
                    {!guardian ? "…" : hasOverride ? "本班自定义" : guardian.source === "global" ? "沿用全校" : "默认策略"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <p className="text-[12px] leading-relaxed text-[var(--text-2)]">
                    不同年级作息不同，可为本班单独设置休息提醒与夜间时段；未设置则沿用全校策略。危机「安全求助」任何时段都可用，不受此设置影响。
                  </p>
                  <div className="mt-3 space-y-2">
                    <label className="block">
                      <span className="text-[12px] text-[var(--text-2)]">休息提醒阈值（10–120 分钟）</span>
                      <input type="number" min={10} max={120} value={gForm.limitMin}
                        onChange={(e) => setGForm((c) => ({ ...c, limitMin: gNum(e.target.value, 10, 120, c.limitMin) }))}
                        className="mt-1 h-9 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]" />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[12px] text-[var(--text-2)]">宵禁开始（0–23）</span>
                        <input type="number" min={0} max={23} value={gForm.curfewStart}
                          onChange={(e) => setGForm((c) => ({ ...c, curfewStart: gNum(e.target.value, 0, 23, c.curfewStart) }))}
                          className="mt-1 h-9 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]" />
                      </label>
                      <label className="block">
                        <span className="text-[12px] text-[var(--text-2)]">宵禁结束（0–23）</span>
                        <input type="number" min={0} max={23} value={gForm.curfewEnd}
                          onChange={(e) => setGForm((c) => ({ ...c, curfewEnd: gNum(e.target.value, 0, 23, c.curfewEnd) }))}
                          className="mt-1 h-9 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-2.5 text-[13px] outline-none focus:border-[var(--c-edu)]" />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button type="button" disabled={!guardian || gSaving} onClick={saveGuardian}
                        className="min-h-[36px] rounded-[12px] bg-[var(--rg-selected-bg)] px-3 text-[13px] font-semibold text-[var(--accent)] disabled:opacity-50">
                        {gSaving ? "保存中…" : "为本班保存"}
                      </button>
                      {hasOverride && (
                        <button type="button" disabled={gSaving} onClick={clearGuardian}
                          className="min-h-[36px] rounded-[12px] bg-[var(--rg-control-bg)] px-3 text-[13px] text-[var(--text-2)] disabled:opacity-50">
                          撤销自定义
                        </button>
                      )}
                      {gNotice && <span role="status" className="text-[12px] text-[var(--text-2)]">{gNotice}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>班级错题聚类</CardTitle><Badge>去标识计数</Badge></CardHeader>
                <CardContent>
                  {clusters.length === 0 ? (
                    <p className="text-[12px] leading-relaxed text-[var(--text-2)]">学生错题本尚无记录——学生在成长页记录错题后，这里会按「学科 × 知识点」聚合计数（不含任何原文与姓名），帮你定位补差重点。</p>
                  ) : (
                    <div className="space-y-1.5">
                      {clusters.slice(0, 6).map((c) => (
                        <div key={`${c.subject}-${c.knowledgePoint}`} className="flex items-center gap-2 rounded-[12px] bg-[var(--rg-hover-bg)] px-3 py-2 text-[12px]">
                          <span className="font-semibold text-[var(--text)]">{c.subject}</span>
                          <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">{c.knowledgePoint}</span>
                          <span className="text-num shrink-0 font-bold text-[var(--warn-ink)]">{c.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>待批改作业</CardTitle><Badge variant="gold">{data.pending.length}</Badge></CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.pending.map((g) => (
                      <Link key={g.id} href={`/chat?seed=${encodeURIComponent(pendingSeed(g, data.masked))}`} className="flex items-center gap-2.5 rounded-[12px] border border-[var(--border-2)] p-2.5 transition hover:border-[var(--c-edu)]/40 hover:bg-[var(--rg-hover-bg)]">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-[var(--text)]">{g.title}</span>
                          <span className="text-[11px] text-[var(--text-3)]">{g.student} · {g.subject} · {ago(g.submittedAt)}</span>
                        </span>
                        <ChevronRight size={15} className="text-[var(--text-3)]" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}
