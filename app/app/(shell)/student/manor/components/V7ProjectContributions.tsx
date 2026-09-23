"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Clock3, RefreshCw, Save, Send } from "lucide-react";
import type { ManorProjectContribution, ManorProjectRun } from "@/lib/manor/v7-learning-contracts";
import { createManorLearningRepository, ManorApiError, type ManorBootstrap } from "../model/manor-learning";
import styles from "./learning-hub.module.css";
import { V7TaskProvenance } from "./V7TaskProvenance";

export interface V7ProjectDraft {
  content: string;
  selections: Partial<Record<ManorProjectContribution["subject"], string>>;
  expectedRevision: number;
  conflict?: ManorProjectRun;
}
interface ProjectProps {
  bootstrap: ManorBootstrap;
  drafts: Record<string, V7ProjectDraft>;
  onDraftChange: (id: string, value: V7ProjectDraft) => void;
  onRefresh: () => Promise<void>;
}

function draftFromProject(project: ManorProjectRun): V7ProjectDraft {
  return { content: project.result?.content ?? project.draft?.content ?? "", selections: Object.fromEntries(project.contributions.map((item) => [item.subject, item.artifactId])), expectedRevision: project.revision };
}

function candidatesFor(bootstrap: ManorBootstrap, project: ManorProjectRun, subject: ManorProjectContribution["subject"]) {
  return bootstrap.artifacts.flatMap((artifact) => {
    const evidence = bootstrap.evidence.find((item) => item.id === artifact.evidenceId);
    const mission = bootstrap.missions.find((item) => item.id === evidence?.missionId);
    const objective = bootstrap.evidence.find((item) => item.evidenceType === "mastery" && item.taskRunId === evidence?.taskRunId && item.missionId === evidence?.missionId && ["accepted_mastery", "accepted_correction", "accepted_practice"].includes(item.status));
    if (!evidence?.taskRunId || evidence.evidenceType !== "expression" || evidence.status !== "accepted_mastery" || !objective || mission?.subject !== subject || mission.projectId !== project.projectId
      || evidence.assignmentId !== project.assignmentId || evidence.datasetVersion !== project.datasetVersion || artifact.assignmentId !== project.assignmentId || artifact.datasetVersion !== project.datasetVersion
      || artifact.artifactType !== "expression" || artifact.status !== "archived" || artifact.taskRunId !== evidence.taskRunId || artifact.acceptedRevision !== artifact.revision || artifact.revision == null || artifact.content !== evidence.submission?.content) return [];
    return [{ artifact, evidence }];
  });
}

export function V7ProjectContributions({ bootstrap, drafts, onDraftChange, onRefresh }: ProjectProps) {
  const ownerId = bootstrap.subject.id;
  const repository = useMemo(() => createManorLearningRepository({ subjectId: ownerId }), [ownerId]);
  const [snapshot, setSnapshot] = useState<{ ownerId: string; projects: ManorProjectRun[] } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [reload, setReload] = useState(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const identity = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(12000) });
        const auth = await identity.json();
        if (!identity.ok || auth.user?.id !== ownerId) throw new Error("当前账号已变更。");
        const body = await repository.projects();
        if (active) { setSnapshot({ ownerId, projects: body.projects }); setError(""); }
      } catch (failure) { if (active) setError(failure instanceof Error ? failure.message : "项目记录暂不可用。"); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [ownerId, bootstrap.stateVersion, repository, reload]);
  const projects = snapshot?.ownerId === ownerId ? snapshot.projects : bootstrap.projects ?? [];
  const save = async (project: ManorProjectRun, draft: V7ProjectDraft, intent: "draft" | "complete") => {
    if (busyRef.current || project.status === "complete") return;
    busyRef.current = true; setBusy(project.id); setError(""); setMessage("");
    try {
      const identity = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const auth = await identity.json();
      if (!mounted.current) return;
      if (!identity.ok || auth.user?.id !== ownerId) throw new Error("当前账号已变更，尚未提交。");
      const contributions: ManorProjectContribution[] = [];
      for (const subject of project.requiredSubjects) {
        const id = draft.selections[subject];
        if (!id) continue;
        const selected = candidatesFor(bootstrap, project, subject).find((item) => item.artifact.id === id);
        if (!selected) throw new Error(`${subject}贡献版本待核对，输入已保留。`);
        contributions.push({ subject, evidenceId: selected.evidence.id, artifactId: selected.artifact.id });
      }
      const result = await repository.saveProject(project.id, { intent, expectedRevision: draft.expectedRevision, datasetVersion: project.datasetVersion, contributions, content: draft.content.trim() });
      if (!mounted.current) return;
      setSnapshot({ ownerId, projects: projects.map((item) => item.id === project.id ? result.project : item) });
      onDraftChange(project.id, draftFromProject(result.project));
      setMessage(result.project.status === "complete" && result.project.result ? "共同成果已汇合 · 尚未评价" : "成果草稿已保存");
      try { await onRefresh(); } catch { if (mounted.current) setError("成果已保存，总览尚未同步。"); }
    } catch (failure) {
      if (!mounted.current) return;
      if (failure instanceof ManorApiError && failure.status === 409) {
        const conflict = (failure.authoritative as { project?: ManorProjectRun } | undefined)?.project;
        if (conflict?.id === project.id) onDraftChange(project.id, { ...draft, conflict });
      }
      setError(failure instanceof Error ? failure.message : "成果尚未保存，输入已保留。");
    } finally { busyRef.current = false; if (mounted.current) setBusy(""); }
  };
  return <section className={styles.summary} aria-label="项目贡献状态" aria-busy={Boolean(busy)}>
    <div className={styles.syncBar}><h3>共同成果</h3><button className={styles.iconButton} type="button" title="刷新项目贡献" aria-label="刷新项目贡献" disabled={loading || Boolean(busy)} onClick={() => { setLoading(true); setReload((value) => value + 1); }}><RefreshCw size={18} /></button></div>
    {loading && <p role="status">正在读取项目记录</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.notice}>{message}</p>}
    {!loading && !error && !projects.length && <p className={styles.muted}>暂无正式项目分派</p>}
    <ul className={styles.list}>{projects.map((project) => {
      const draft = drafts[project.id] ?? draftFromProject(project);
      const complete = project.status === "complete" && Boolean(project.result);
      const update = (values: Partial<V7ProjectDraft>) => { onDraftChange(project.id, { ...draft, ...values }); setMessage(""); };
      const allSelected = project.requiredSubjects.every((subject) => Boolean(draft.selections[subject]));
      const invalidSelection = project.requiredSubjects.some((subject) => draft.selections[subject] && !candidatesFor(bootstrap, project, subject).some((item) => item.artifact.id === draft.selections[subject]));
      const cannotSave = Boolean(busy) || Boolean(draft.conflict) || invalidSelection || draft.content.trim().length < 8;
      return <li key={project.id}>
        <div className={styles.meta}><span>{complete ? "共同成果已汇合" : "共同成果尚待补充"}</span><span>尚未评价</span><span>已存版本 {project.revision}</span></div>
        <V7TaskProvenance assignmentId={project.assignmentId} datasetVersion={project.datasetVersion} />
        {project.requiredSubjects.map((subject) => {
          const contribution = project.contributions.find((item) => item.subject === subject);
          const candidates = candidatesFor(bootstrap, project, subject);
          return <div key={subject} className={styles.summary}>
            <div className={styles.meta}>{contribution ? <Check size={16} /> : <Clock3 size={16} />}<span>{subject} · {contribution ? "贡献已记录" : "尚待补充"}</span></div>
            {!complete && <label className={styles.field}><span>{subject}贡献</span><select aria-label={`${subject}贡献`} value={draft.selections[subject] ?? ""} disabled={Boolean(busy)} onChange={(event) => update({ selections: { ...draft.selections, [subject]: event.target.value } })}>
              <option value="">尚待补充</option>
              {draft.selections[subject] && !candidates.some((item) => item.artifact.id === draft.selections[subject]) && <option value={draft.selections[subject]}>已选来源版本待核对</option>}
              {candidates.map(({ artifact, evidence }) => <option key={artifact.id} value={artifact.id}>{artifact.title} · 作品 v{artifact.revision} · 表达 v{evidence.revision}</option>)}
            </select></label>}
            {(draft.selections[subject] || contribution) && <a href={`/student/manor?artifactId=${encodeURIComponent(draft.selections[subject] || contribution!.artifactId)}`}>查看{subject}贡献来源 <ArrowRight size={16} /></a>}
          </div>;
        })}
        {!complete && <>
          <label className={styles.field}><span>共同成果内容</span><textarea aria-label="共同成果内容" rows={6} maxLength={2000} value={draft.content} disabled={Boolean(busy)} onChange={(event) => update({ content: event.target.value })} /></label>
          {draft.conflict && <section className={styles.feedback} aria-label="共同成果版本冲突"><h4>服务器版本 {draft.conflict.revision} · 本稿已保留</h4><p>{draft.conflict.result?.content ?? draft.conflict.draft?.content ?? "尚无成果内容"}</p>{draft.conflict.status !== "complete" && <button type="button" disabled={Boolean(busy)} onClick={() => { update({ expectedRevision: draft.conflict!.revision, conflict: undefined }); setError(""); }}><RefreshCw size={18} />保留本稿并采用成果版本 {draft.conflict.revision}</button>}</section>}
          <div className={styles.actions}><button type="button" disabled={cannotSave} onClick={() => void save(project, draft, "draft")}><Save size={18} />保存成果草稿</button><button type="button" className={styles.primary} disabled={cannotSave || !allSelected} onClick={() => void save(project, draft, "complete")}><Send size={18} />提交共同成果</button></div>
        </>}
        {project.result && <><p className={styles.preserve}>{project.result.content}</p><a href={`/student/manor?artifactId=${encodeURIComponent(project.result.artifactId)}`}>查看共同成果 <ArrowRight size={16} /></a></>}
        {complete && draft.content !== project.result?.content && <details className={styles.history}><summary>本机未保存的成果草稿</summary><p>{draft.content}</p></details>}
      </li>;
    })}</ul>
  </section>;
}
