"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, LoaderCircle, RefreshCw, Send } from "lucide-react";
import type { ManorAssignment, ManorGradeBand, PublishManorAssignmentInput } from "@/lib/manor/v7-learning-contracts";
import type { LearningMission } from "@/app/(shell)/student/manor/model/manor-learning";
import styles from "./manor-assignments-panel.module.css";

interface AssignmentCatalog {
  ownerId: string;
  classes: Array<{ id: string; label: string; students: Array<{ id: string; name: string; gradeBand: ManorGradeBand | null }> }>;
  templates: LearningMission[];
  assignments: ManorAssignment[];
}
interface PanelProps { ownerId?: string; onPublished?: () => void }
const ENDPOINT = "/api/v2/teacher/manor/assignments";
const GRADES: Record<ManorGradeBand, string> = { lower_primary: "小学低段", upper_primary: "小学高段", middle_school: "初中" };
class AssignmentError extends Error { constructor(message: string, readonly status: number) { super(message); } }

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, signal: AbortSignal.timeout(12000), headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new AssignmentError(body.error?.message ?? "任务分派暂不可用。", response.status);
  return body as T;
}

export function ManorAssignmentsPanel({ ownerId, onPublished }: PanelProps) {
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const next = await readJson<AssignmentCatalog>(ENDPOINT);
      if (current !== sequence.current) return;
      if (!next.ownerId || ownerId && next.ownerId !== ownerId) { setCatalog(null); throw new Error("当前账号已变更。"); }
      setCatalog(next); setError("");
    } catch (failure) {
      if (current !== sequence.current) return;
      if (failure instanceof AssignmentError && [401, 403].includes(failure.status)) setCatalog(null);
      setError(failure instanceof Error ? failure.message : "任务分派读取失败。");
    } finally { if (current === sequence.current) setLoading(false); }
  }, [ownerId]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void load(); });
    return () => { active = false; sequence.current += 1; };
  }, [load]);
  const classroom = catalog?.classes[0];
  return <section className={styles.panel} aria-label="庄园任务分派" data-testid="manor-assignments-panel">
    <header className={styles.header}><h2><BookOpen size={20} />庄园任务分派</h2><button type="button" aria-label="刷新任务分派" title="刷新任务分派" disabled={loading} onClick={() => { setLoading(true); void load(); }}><RefreshCw size={18} /></button></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading && <p role="status"><LoaderCircle size={18} />正在读取任务分派</p>}
    {catalog && classroom && (!ownerId || ownerId === catalog.ownerId) && <AssignmentEditor key={`${catalog.ownerId}:${classroom.id}`} catalog={catalog} onReload={load} onPublished={onPublished} />}
    {!loading && catalog && !classroom && <p>暂无可发布的班级</p>}
  </section>;
}

function AssignmentEditor({ catalog, onReload, onPublished }: { catalog: AssignmentCatalog; onReload: () => Promise<void>; onPublished?: () => void }) {
  const classroom = catalog.classes[0];
  const [title, setTitle] = useState("");
  const [gradeBand, setGradeBand] = useState<ManorGradeBand | "">("");
  const [missionIds, setMissionIds] = useState<string[]>([]);
  const [resourceVersion, setResourceVersion] = useState("");
  const [datasetVersion, setDatasetVersion] = useState("");
  const [rewardUnits, setRewardUnits] = useState("0");
  const [targetMode, setTargetMode] = useState<"grade" | "students">("grade");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const storageKey = `eduai.manor.assignment.v7.${encodeURIComponent(catalog.ownerId)}.${encodeURIComponent(classroom.id)}`;
  const [pending, setPending] = useState<PublishManorAssignmentInput | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      return value && typeof value.operationId === "string" && Array.isArray(value.missionIds) && typeof value.title === "string" ? value : null;
    } catch { return null; }
  });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const templates = catalog.templates.filter((item) => (item.gradeBand ?? "lower_primary") === gradeBand);
  const targets = classroom.students.filter((item) => item.gradeBand === gradeBand);
  const selectedTemplates = templates.filter((item) => missionIds.includes(item.id));
  const valid = Boolean(title.trim().length >= 2 && gradeBand && selectedTemplates.length && selectedTemplates.length === missionIds.length && resourceVersion.trim() && Number.isInteger(Number(rewardUnits)) && Number(rewardUnits) >= 0 && Number(rewardUnits) <= 24 && targets.length && (targetMode === "grade" || studentIds.length && studentIds.every((id) => targets.some((item) => item.id === id))));
  const locked = busy || Boolean(pending);
  const rememberPending = (value: PublishManorAssignmentInput | null) => {
    setPending(value);
    try { if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey); } catch { /* In-memory retry retains the same command. */ }
  };
  const publish = async () => {
    if (busyRef.current || !pending && !valid) return;
    busyRef.current = true; setBusy(true); setError(""); setNotice("");
    const command = pending ?? { operationId: `assignment-${crypto.randomUUID()}`, title: title.trim(), missionIds, gradeBand: gradeBand as ManorGradeBand, resourceVersion: resourceVersion.trim(), ...(datasetVersion.trim() ? { datasetVersion: datasetVersion.trim() } : {}), rewardUnits: Number(rewardUnits), ...(targetMode === "students" ? { studentIds } : {}) };
    let sent = false;
    try {
      const identity = await readJson<{ user: { id: string } | null }>("/api/auth/me");
      const latest = await readJson<AssignmentCatalog>(ENDPOINT);
      if (!mounted.current) return;
      if (identity.user?.id !== catalog.ownerId || latest.ownerId !== catalog.ownerId || latest.classes[0]?.id !== classroom.id) throw new Error("账号或班级已变更，尚未发布。");
      rememberPending(command); sent = true;
      const result = await readJson<{ assignment: ManorAssignment }>(ENDPOINT, { method: "POST", body: JSON.stringify(command) });
      if (!mounted.current) return;
      if (result.assignment?.teacherId !== catalog.ownerId || result.assignment.classId !== classroom.id) throw new Error("发布归属待核对。");
      rememberPending(null);
      setTitle(""); setMissionIds([]); setStudentIds([]);
      setNotice(`已发布：${result.assignment.title} · 版本 ${result.assignment.assignmentVersion}`);
      await onReload();
      if (mounted.current) onPublished?.();
    } catch (failure) {
      if (!mounted.current) return;
      const definitive = failure instanceof AssignmentError && failure.status >= 400 && failure.status < 500 && ![408, 429].includes(failure.status);
      if (sent && definitive) {
        setTitle(command.title); setGradeBand(command.gradeBand); setMissionIds(command.missionIds);
        setResourceVersion(command.resourceVersion); setDatasetVersion(command.datasetVersion ?? "");
        setRewardUnits(String(command.rewardUnits ?? 0));
        setTargetMode(command.studentIds ? "students" : "grade"); setStudentIds(command.studentIds ?? []);
        rememberPending(null);
      }
      setError(sent && !definitive ? "发布结果待确认，原任务已保留。" : failure instanceof Error ? failure.message : "发布失败，内容已保留。");
    } finally { busyRef.current = false; if (mounted.current) setBusy(false); }
  };
  return <div className={styles.content} aria-busy={busy}>
    <p className={styles.meta}>{classroom.label} · {classroom.students.length} 名学生</p>
    <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void publish(); }}>
      <label>任务标题<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} disabled={locked} /></label>
      <div className={styles.row}>
        <label>任务学段<select aria-label="任务学段" value={gradeBand} disabled={locked} onChange={(event) => { setGradeBand(event.target.value as ManorGradeBand); setMissionIds([]); setStudentIds([]); setResourceVersion(""); setDatasetVersion(""); }}><option value="" disabled>尚未确定</option>{Object.entries(GRADES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label>成长奖励<input type="number" min={0} max={24} step={1} value={rewardUnits} disabled={locked} onChange={(event) => setRewardUnits(event.target.value)} /></label>
      </div>
      <fieldset disabled={locked || !gradeBand}><legend>任务内容</legend>
        {templates.map((item) => <label key={item.id} className={styles.check}><input type="checkbox" checked={missionIds.includes(item.id)} onChange={(event) => { setMissionIds((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)); if (event.target.checked) { if (!resourceVersion) setResourceVersion(item.resourceVersion ?? ""); if (!datasetVersion) setDatasetVersion(item.datasetVersion ?? ""); } }} /><span>{item.subject} · {item.title}<small>{item.source?.label ?? "教学示例"}{item.resourceVersion ? ` · ${item.resourceVersion}` : ""}</small></span></label>)}
        {gradeBand && !templates.length && <p>本学段暂无任务内容</p>}
      </fieldset>
      <div className={styles.row}><label>资源版本<input value={resourceVersion} maxLength={120} disabled={locked} onChange={(event) => setResourceVersion(event.target.value)} /></label><label>数据版本<input value={datasetVersion} maxLength={120} disabled={locked} onChange={(event) => setDatasetVersion(event.target.value)} /></label></div>
      <div className={styles.segment} role="group" aria-label="分派范围"><button type="button" aria-pressed={targetMode === "grade"} disabled={locked} onClick={() => setTargetMode("grade")}>本学段全体</button><button type="button" aria-pressed={targetMode === "students"} disabled={locked} onClick={() => setTargetMode("students")}>指定学生</button></div>
      <p className={styles.meta}>符合学段 {targets.length} 人 · 学段待确认 {classroom.students.filter((item) => !item.gradeBand).length} 人</p>
      {targetMode === "students" && <fieldset disabled={locked}><legend>分派学生</legend>{targets.map((student) => <label key={student.id} className={styles.check}><input type="checkbox" checked={studentIds.includes(student.id)} onChange={(event) => setStudentIds((ids) => event.target.checked ? [...ids, student.id] : ids.filter((id) => id !== student.id))} /><span>{student.name}</span></label>)}</fieldset>}
      {pending && <p className={styles.meta}>待确认发布：{pending.title}</p>}
      <button className={styles.primary} type="submit" disabled={busy || !pending && !valid}>{busy ? <LoaderCircle size={18} /> : <Send size={18} />}{pending ? "确认发布结果" : "发布正式任务"}</button>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {notice && <p className={styles.notice} role="status"><Check size={18} />{notice}</p>}
    <section className={styles.published} aria-label="已发布任务"><h3>已发布任务</h3>{catalog.assignments.length ? <ul>{catalog.assignments.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{GRADES[item.gradeBand]} · 发布版本 {item.assignmentVersion} · {item.status === "published" ? "已发布" : "已撤回"}</span><span>资源 {item.resourceVersion}{item.datasetVersion ? ` · 数据 ${item.datasetVersion}` : ""}</span><span>{item.studentIds ? `${item.studentIds.length} 名指定学生` : "本学段全体"} · 成长奖励 {item.rewardUnits}</span></li>)}</ul> : <p>暂无正式分派</p>}</section>
  </div>;
}
