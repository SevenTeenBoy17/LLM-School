"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, BookOpen, BrainCircuit, Check, Clock3, Copy, FilePlus2, FileText, HeartPulse, LoaderCircle, NotebookPen, RefreshCw, Save, Send, Sprout, Users, X } from "lucide-react";
import {
  allocateManorGrants, createManorLearningRepository, evidenceStatusLabel, ManorApiError,
  expressionForTaskRun, portfolioFromArtifact, reviewQueueState,
  type EvidenceResult, type LearningMission, type ManorBootstrap, type ManorEvidence,
  type ManorGrant, type MissionPhase, type PortfolioItem, type ReviewItem, type TaskRun,
} from "../model/manor-learning";
import sceneStyles from "../manor.module.css";
import styles from "./learning-hub.module.css";
import { V7ProjectContributions, type V7ProjectDraft } from "./V7ProjectContributions";
import { V7TaskProvenance } from "./V7TaskProvenance";

export type LearningPanel = "mission" | "greenhouse" | "workshop" | "class" | "portfolio" | "wellbeing";

interface LearningHubProps {
  panel: LearningPanel | null;
  studentName: string;
  missions: LearningMission[];
  grants: ManorGrant[];
  initialReviews: ReviewItem[];
  initialPortfolio: PortfolioItem[];
  profileRevision: number;
  quietUntil: number | null;
  initialClassProgress: number;
  growthEnergy: number;
  missionProgress: number;
  onOpen: (panel: LearningPanel) => void;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  availablePlotIds: number[];
  onNurturePlot: (plotId: number, grantId: string) => Promise<void>;
  onGrowthEnergy: (growthEnergy: number) => void;
  onProfileRevision: (revision: number) => void;
  onQuietUntil: (quietUntil: number) => void;
  onMissionComplete: () => void;
  simulateRepositoryFailure?: boolean;
  bootstrap?: ManorBootstrap | null;
}

const PANEL_TITLES: Record<LearningPanel, string> = {
  mission: "今日学习任务", greenhouse: "记忆温室", workshop: "创作工坊",
  class: "班级共建", portfolio: "学习成果", wellbeing: "健康节奏",
};
const PHASES: Array<{ id: MissionPhase; label: string }> = [
  { id: "evidence", label: "学习与证据" }, { id: "outcome", label: "查看反馈" },
  { id: "reflection", label: "反思与复习" }, { id: "summary", label: "本次记录" },
];
const GRADE_LABELS: Record<string, string> = { lower_primary: "小学低段", upper_primary: "小学高段", middle_school: "初中" };
type Draft = { answer?: string; reflection?: string; content?: string; title?: string; sourceId?: string; kind?: "explanation" | "observation"; artifactId?: string; expectedRevision?: number };

function dateLabel(time: number) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(time);
}

function safeSourceUrl(url?: string) {
  return url?.startsWith("/student/") && !/[\\\r\n]/.test(url) ? url : undefined;
}

export function LearningHub(props: LearningHubProps) {
  const [loaded, setLoaded] = useState<ManorBootstrap | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (props.bootstrap) return;
    let active = true;
    createManorLearningRepository().bootstrap().then((value) => { if (active) setLoaded(value); }).catch(() => { if (active) setLoadError("学习记录暂不可用。"); });
    return () => { active = false; };
  }, [props.bootstrap, reload]);
  const owner = props.bootstrap ?? loaded;
  // Identity changes discard the previous learner's editors and in-flight UI state.
  if (!owner) return <div role="status">{loadError || "正在读取学习记录"}{loadError && <button type="button" onClick={() => setReload((value) => value + 1)}>重试</button>}</div>;
  return <LearningWorkspace key={owner.subject.id} {...props} resolvedBootstrap={owner} />;
}

function LearningWorkspace(props: LearningHubProps & { resolvedBootstrap: ManorBootstrap }) {
  const { panel, onOpen, onClose, resolvedBootstrap: bootstrap } = props;
  const [snapshot, setSnapshot] = useState<ManorBootstrap | null>(null);
  const data = snapshot && (!bootstrap || snapshot.stateVersion > bootstrap.stateVersion) ? snapshot : bootstrap;
  const repository = useMemo(() => createManorLearningRepository({
    subjectId: bootstrap?.subject.id,
    failOperations: props.simulateRepositoryFailure ? ["evaluateEvidence", "scheduleReview", "contributeToClass", "saveArtifact", "endSession", "plotAction", "saveTaskRun", "submitExpression", "reviewAction"] : [],
  }), [bootstrap?.subject.id, props.simulateRepositoryFailure]);
  const suppliedMissions = data?.missions ?? props.missions;
  const formalMissions = suppliedMissions.filter((item) => Boolean(item.assignmentId || item.source?.teacherPublished));
  const sampleMissions = data?.sampleMissions ?? suppliedMissions.filter((item) => !formalMissions.includes(item));
  const missions = [...formalMissions, ...sampleMissions];
  const evidence = data?.evidence ?? [];
  const grants = data?.grants ?? props.grants;
  const [missionId, setMissionId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("missionId") ?? "");
  const [linkedEvidenceId, setLinkedEvidenceId] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("evidenceId") ?? "");
  const [missionScope, setMissionScope] = useState<"assigned" | "sample">(() => sampleMissions.some((item) => item.id === missionId) ? "sample" : "assigned");
  const visibleMissions = missionScope === "assigned" ? formalMissions : sampleMissions;
  const resumableMissionId = data?.taskRuns?.find((item) => item.phase !== "summary" && visibleMissions.some((entry) => entry.id === item.missionId))?.missionId;
  const mission = visibleMissions.find((item) => item.id === (missionId || resumableMissionId)) ?? visibleMissions.find((item) => Boolean(data?.subject.gradeBand) && item.gradeBand === data?.subject.gradeBand) ?? (missionScope === "assigned" ? visibleMissions[0] : undefined);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [artifactConflict, setArtifactConflict] = useState<PortfolioItem | null>(null);
  const [savedArtifacts, setSavedArtifacts] = useState<Record<string, PortfolioItem>>({});
  const [projectDrafts, setProjectDrafts] = useState<Record<string, V7ProjectDraft>>({});
  const [savedRuns, setSavedRuns] = useState<Record<string, TaskRun>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, EvidenceResult>>({});
  const [reviewEdits, setReviewEdits] = useState<Record<string, string>>({});
  const [reviewResults, setReviewResults] = useState<Record<string, ReviewItem>>({});
  const [reviewFilter, setReviewFilter] = useState<"due" | "scheduled" | "completed">("due");
  const [activeReview, setActiveReview] = useState("");
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const returnFocus = useRef<HTMLElement | null>(null);
  const entryRef = useRef<HTMLButtonElement>(null);
  const currentId = mission?.id ?? "";
  const serverRun = data?.taskRuns?.find((item) => item.missionId === currentId);
  const localRun = savedRuns[currentId];
  const run = localRun && (!serverRun || localRun.revision > serverRun.revision) ? localRun : serverRun;
  const phase = run?.phase ?? "evidence";
  const draftKey = run?.id ?? `${currentId}:new`;
  const draft = drafts[draftKey] ?? {};
  const answer = draft.answer ?? run?.answer ?? "";
  const reflection = draft.reflection ?? run?.reflection ?? "";
  const runDirty = answer !== (run?.answer ?? "") || reflection !== (run?.reflection ?? "");
  const feedback = feedbacks[currentId];
  const sourceEvidence = evidence.find((item) => item.id === run?.evidenceId);
  const expression = expressionForTaskRun(evidence, currentId, run?.id);
  const content = draft.content ?? expression?.submission?.content ?? "";
  const expressionDirty = Boolean(expression) && content !== (expression?.submission?.content ?? "");
  const workshopTitle = draft.title ?? mission?.title ?? "";
  const sourceId = draft.sourceId ?? "";
  const reviews = (data?.reviews ?? props.initialReviews).map((item) => {
    const local = reviewResults[item.id];
    return local && (local.revision ?? 0) > (item.revision ?? 0) ? local : item;
  });
  const serverPortfolio = data ? data.artifacts.map((item) => portfolioFromArtifact(item, evidence, missions)) : props.initialPortfolio;
  const portfolio = [...serverPortfolio.map((item) => (savedArtifacts[item.id]?.revision ?? 0) > (item.revision ?? 0) ? savedArtifacts[item.id] : item), ...Object.values(savedArtifacts).filter((item) => !serverPortfolio.some((entry) => entry.id === item.id))];
  const editedArtifact = portfolio.find((item) => item.id === draft.artifactId);
  const artifactReadOnly = Boolean(editedArtifact?.status === "archived" || editedArtifact?.artifactType === "expression");
  const currentReview = reviews.find((item) => item.id === activeReview);
  const selectedReviews = reviews.filter((item) => reviewQueueState(item, now) === reviewFilter);
  const relatedReview = reviews.find((item) => item.evidenceId === run?.evidenceId);
  const classAllocation = allocateManorGrants(grants, ["class_build"], 2);
  const classBuild = data?.classBuild;
  const classProgress = classBuild ? Math.min(100, Math.round(classBuild.raised / Math.max(1, classBuild.cost) * 100)) : props.initialClassProgress;
  const quietUntil = data?.profile.quietUntil ?? props.quietUntil;
  const quietActive = Boolean(quietUntil && quietUntil > now);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!panel) return;
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, [panel]);

  useEffect(() => {
    if (panel !== "portfolio") return;
    const artifactId = new URLSearchParams(window.location.search).get("artifactId");
    if (!artifactId) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`manor-artifact-${artifactId}`);
      if (target) { target.scrollIntoView({ block: "center" }); target.focus(); }
      else setError("该成果不存在，或当前账号无权查看。");
    });
    return () => cancelAnimationFrame(frame);
  }, [panel, data?.stateVersion]);

  const edit = (values: Partial<Draft>) => {
    setDrafts((previous) => ({ ...previous, [draftKey]: { ...previous[draftKey], ...values } }));
    setMessage("");
  };

  const refresh = async () => {
    const latest = await repository.bootstrap();
    if (!mounted.current) return;
    setSnapshot(latest);
    await props.onRefresh();
  };

  const refreshConfirmed = async () => {
    try { await refresh(); } catch {
      if (mounted.current) setError("本次操作已保存，但总览尚未同步。请刷新记录，不必重复提交。");
    }
  };

  const perform = async (key: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(key); setError(""); setMessage("");
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", signal: AbortSignal.timeout(12000) });
      const identity = await response.json();
      if (!mounted.current) return;
      if (!response.ok || identity.user?.id !== bootstrap.subject.id) throw new Error("当前账号已变更，尚未提交。");
      await action();
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error ? failure.message : "暂时未能保存，输入已保留。");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy("");
    }
  };

  const persistRun = async (nextPhase: MissionPhase, previous = run, evidenceId = previous?.evidenceId ?? undefined) => {
    if (!mounted.current) throw new Error("学习面板已关闭。");
    if (!mission) throw new Error("暂无已分配的任务。");
    const result = await repository.saveTaskRun({ missionId: mission.id, phase: nextPhase, answer, reflection, ...(evidenceId ? { evidenceId } : {}), expectedRevision: previous?.revision ?? 0 });
    if (mounted.current) {
      setSavedRuns((items) => ({ ...items, [result.missionId]: result }));
      if (!previous) setDrafts((items) => ({ ...items, [result.id]: items[draftKey] ?? {} }));
    } else throw new Error("学习账号已变更。");
    return result;
  };

  const submitAnswer = () => perform("evidence", async () => {
    if (!mission || !answer) return;
    const saved = await persistRun("evidence");
    const result = await repository.evaluateEvidence(mission.id, answer);
    if (!mounted.current) return;
    setFeedbacks((items) => ({ ...items, [mission.id]: result }));
    if (result.correct) await persistRun("outcome", saved, result.evidenceId);
    await refreshConfirmed();
  });

  const saveReflection = () => perform("reflection", async () => {
    await persistRun("reflection");
    setMessage("反思已保存。");
    await refreshConfirmed();
  });

  const finishMission = () => perform("finish", async () => {
    const saved = await persistRun("reflection");
    if (!saved.evidenceId) throw new Error("还没有可关联的学习证据。");
    if (!relatedReview) await repository.scheduleReview(saved.evidenceId, reflection);
    await persistRun("summary", saved);
    if (!mounted.current) return;
    props.onMissionComplete();
    await refreshConfirmed();
  });

  const saveArtifact = () => perform("artifact", async () => {
    if (artifactReadOnly) throw new Error("该版本已锁定。");
    if (draft.artifactId && draft.expectedRevision == null) throw new Error("作品版本尚未同步，当前输入已保留。");
    let result;
    try {
      result = await repository.saveArtifact({ ...(draft.artifactId ? { artifactId: draft.artifactId, expectedRevision: draft.expectedRevision } : run ? { taskRunId: run.id } : {}), ...(sourceId ? { evidenceId: sourceId } : {}), artifactType: draft.kind ?? "explanation", title: workshopTitle.trim(), content: content.trim() });
    } catch (failure) {
      if (failure instanceof ManorApiError && failure.status === 409 && draft.artifactId) {
        try {
          const latest = await repository.bootstrap();
          const item = latest.artifacts.find((entry) => entry.id === draft.artifactId);
          if (mounted.current && item) setArtifactConflict(portfolioFromArtifact(item, latest.evidence, [...latest.missions, ...(latest.sampleMissions ?? [])]));
        } catch { /* Keep the original conflict and editor when refresh is unavailable. */ }
      }
      throw failure;
    }
    if (!mounted.current) return;
    setSavedArtifacts((items) => ({ ...items, [result.item.id]: result.item }));
    edit({ artifactId: result.item.id, expectedRevision: result.item.revision });
    setArtifactConflict(null);
    props.onGrowthEnergy(result.growthEnergy);
    setMessage(result.item.status === "archived" ? "作品已入册。" : "作品已保存。");
    await refreshConfirmed();
  });

  const submitExpression = () => perform("expression", async () => {
    if (!mission) return;
    const activeRun = run ?? await persistRun("evidence");
    await repository.submitExpression({ missionId: mission.id, taskRunId: activeRun.id, content: content.trim(), ...(expression?.status === "revise" ? { evidenceId: expression.id, expectedRevision: expression.revision } : {}) });
    if (!mounted.current) return;
    setMessage("表达已提交，等待老师反馈。");
    await refreshConfirmed();
  });

  const actOnReview = (review: ReviewItem, action: "complete" | "defer") => perform(`review-${review.id}`, async () => {
    if (review.revision == null) throw new Error("复习版本尚未同步，请先刷新记录。");
    const result = await repository.reviewAction(review.id, { action, expectedRevision: review.revision, ...(action === "complete" ? { answer: reviewEdits[review.id] ?? "" } : {}) });
    if (!mounted.current) return;
    setReviewResults((items) => ({ ...items, [review.id]: result.review }));
    if (action === "defer") { setActiveReview(""); setMessage("复习已延期。下次时间已更新。"); }
    else if (reviewQueueState(result.review) === "completed") setMessage("这次复习已完成。");
    await refreshConfirmed();
  });

  const selectScope = (scope: "assigned" | "sample") => { setMissionScope(scope); setMissionId(""); setError(""); setMessage(""); setArtifactConflict(null); };
  const missionSelector = <>
    <div className={styles.filters} role="group" aria-label="任务来源">
      <button type="button" aria-pressed={missionScope === "assigned"} disabled={Boolean(busy)} onClick={() => selectScope("assigned")}>正式任务 {formalMissions.length}</button>
      <button type="button" aria-pressed={missionScope === "sample"} disabled={Boolean(busy)} onClick={() => selectScope("sample")}>示例练习 {sampleMissions.length}</button>
    </div>
    {missionScope === "sample" && <p className={styles.muted}>示例练习 · 无成长奖励</p>}
    {visibleMissions.length > 0 && <label className={styles.field}>
    <span>学习任务</span>
    <select aria-label="学习任务" value={currentId} disabled={Boolean(busy)} onChange={(event) => {
      const nextId = event.target.value;
      setMissionId(nextId); setError(""); setMessage(""); setArtifactConflict(null);
    }}>
      <option value="" disabled>选择适合的学习任务</option>
      {visibleMissions.map((item) => <option key={item.id} value={item.id}>{item.gradeBand ? `${GRADE_LABELS[item.gradeBand] ?? item.gradeBand} · ` : ""}{item.subject} · {item.title}</option>)}
    </select>
  </label>}</>;

  const missionEmpty = <section className={styles.empty} aria-label="任务状态"><p>{missionScope === "assigned" ? "暂无正式分派" : visibleMissions.length ? "尚未选择示例" : "暂无示例练习"}</p><div className={styles.actions}>
    {missionScope === "assigned" && sampleMissions.length > 0 && <button type="button" onClick={() => selectScope("sample")}><BookOpen size={18} />查看示例练习</button>}
    <button type="button" onClick={() => onOpen("portfolio")}><FileText size={18} />查看已有成果</button>
  </div></section>;

  const evidenceFeedback = (item: ManorEvidence | undefined) => item && <section className={styles.feedback} aria-label="证据与反馈">
    <div className={styles.meta}><span>{evidenceStatusLabel(item.status)}</span><span>版本 {item.revision}</span></div>
    {item.taskRunId && item.taskRunId !== run?.id && <V7TaskProvenance taskRunId={item.taskRunId} />}
    {item.feedback && <><h4>{item.feedback.evaluatorType === "teacher" ? "老师反馈" : "评价反馈"}</h4><p>{item.feedback.reason}</p><small>反馈版本 {item.feedback.version}</small></>}
  </section>;

  const missionBody = !mission ? <>{missionSelector}{missionEmpty}</> : <>
    {missionSelector}
    <div className={styles.meta}><span>{mission.subject}</span>{mission.gradeBand && <span>{GRADE_LABELS[mission.gradeBand] ?? mission.gradeBand}</span>}{mission.source?.dataKind === "simulated" && <span>模拟数据</span>}<span><Clock3 size={16} />预计 {mission.durationMinutes} 分钟</span></div>
    <h3>{mission.title}</h3>
    {mission.assignmentId && <p className={styles.muted}>正式分派 · 发布版本 {mission.assignmentVersion ?? "待同步"}</p>}
    {mission.projectTitle && <p>{mission.projectTitle}</p>}
    {mission.drivingQuestion && <p>{mission.drivingQuestion}</p>}
    {mission.contribution && <p>{mission.contribution}</p>}
    <ol className={styles.steps} aria-label="任务进度">{PHASES.map((step, index) => <li key={step.id} aria-current={step.id === phase ? "step" : undefined}><span>{index + 1}</span>{step.label}</li>)}</ol>
    {phase === "evidence" && <>
      <p className={styles.reading}>{mission.prompt}</p>
      <fieldset className={styles.choices} disabled={Boolean(busy) || quietActive}>
        <legend>{mission.question}</legend>
        {mission.choices.map((choice) => <label key={choice.id} data-selected={answer === choice.id}>
          <input type="radio" name={`mission-${mission.id}`} value={choice.id} checked={answer === choice.id} onChange={() => edit({ answer: choice.id })} data-testid={`answer-${choice.id.toLowerCase()}`} />
          <span>{choice.id}. {choice.text}</span>
        </label>)}
      </fieldset>
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={!answer || Boolean(busy) || quietActive} onClick={submitAnswer} data-testid="evidence-submit"><Send size={18} />提交证据</button>
        <button type="button" disabled={!answer || Boolean(busy)} onClick={() => perform("draft", async () => { await persistRun("evidence"); setMessage("答案草稿已保存。"); })}><Save size={18} />保存待继续</button>
      </div>
      {feedback && <div className={styles.feedback} role="status" data-testid="evidence-feedback"><strong>{feedback.title}</strong><p>{feedback.explanation}</p>
        {feedback.correct && <button type="button" disabled={Boolean(busy)} onClick={() => perform("phase", async () => { await persistRun("outcome", run, feedback.evidenceId); })}><ArrowRight size={18} />继续</button>}
      </div>}
    </>}
    {phase === "outcome" && <>
      <h4>学习证据已记录</h4>
      {evidenceFeedback(sourceEvidence)}
      {feedback && <p>{feedback.explanation}</p>}
      <div className={styles.actions}>
        <button className={styles.primary} type="button" disabled={Boolean(busy)} onClick={() => perform("phase", async () => { await persistRun("reflection"); })}><NotebookPen size={18} />写下反思</button>
        <button type="button" onClick={() => onOpen("workshop")}><FileText size={18} />创作作品</button>
      </div>
    </>}
    {phase === "reflection" && <>
      <label className={styles.field}><span>哪种方法帮助了你？下次准备怎样验证？</span><textarea value={reflection} onChange={(event) => edit({ reflection: event.target.value })} maxLength={120} rows={5} disabled={Boolean(busy)} /></label>
      {relatedReview && <p className={styles.meta}><BrainCircuit size={18} />{reviewQueueState(relatedReview, now) === "completed" ? "关联复习已完成" : `复习时间：${dateLabel(relatedReview.dueAt)}`}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={reflection.trim().length < 2 || Boolean(busy)} onClick={saveReflection}><Save size={18} />保存反思</button>
        <button className={styles.primary} type="button" disabled={reflection.trim().length < 2 || Boolean(busy) || quietActive} onClick={finishMission}><Check size={18} />{relatedReview ? "结束本次任务" : "安排复习并结束本次任务"}</button>
      </div>
    </>}
    {phase === "summary" && <section data-testid="learning-summary" className={styles.summary}>
      <Check size={28} /><h4>本次任务已完成</h4><p>{run?.reflection}</p>
      {relatedReview && <p>{reviewQueueState(relatedReview, now) === "completed" ? "关联复习已完成" : `下次复习：${dateLabel(relatedReview.dueAt)}`}</p>}
      <div className={styles.actions}><button type="button" onClick={() => onOpen("portfolio")}><BookOpen size={18} />查看成果</button><button type="button" onClick={() => onOpen("greenhouse")}><BrainCircuit size={18} />查看复习</button></div>
      {run?.completedAt && <button type="button" disabled={Boolean(busy) || quietActive} onClick={() => perform("restart-task", async () => {
        const restarted = await repository.saveTaskRun({ missionId: mission.id, phase: "evidence", expectedRevision: run.revision, restart: true });
        if (!mounted.current) return;
        setSavedRuns((items) => ({ ...items, [mission.id]: restarted }));
        setDrafts((items) => ({ ...items, [restarted.id]: {} }));
        setArtifactConflict(null);
        setFeedbacks((items) => { const next = { ...items }; delete next[mission.id]; return next; });
        setMessage("新一轮任务已开始，以往成果仍保留。"); await refreshConfirmed();
      })}><RefreshCw size={18} />开始新一轮任务</button>}
    </section>}
    {run && <p className={styles.saved}>{runDirty ? <Save size={15} /> : <Check size={15} />}{runDirty ? "当前修改未保存" : "已保存"} · 已存版本 {run.revision}</p>}
    <V7TaskProvenance assignmentId={mission.assignmentId} taskRunId={run?.id} resourceVersion={mission.resourceVersion} datasetVersion={mission.datasetVersion} sourceLabel={mission.source?.label ?? mission.sourceLabel} />
  </>;

  const greenhouseBody = <>
    <div className={styles.filters} role="group" aria-label="复习状态">
      {([['due', '待复习'], ['scheduled', '已安排'], ['completed', '已完成']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={reviewFilter === value} onClick={() => { setReviewFilter(value); setActiveReview(""); }}>{label} {reviews.filter((item) => reviewQueueState(item, now) === value).length}</button>)}
    </div>
    {selectedReviews.length === 0 && <section className={styles.empty}><p>{reviewFilter === "due" ? "现在没有到期的复习。" : reviewFilter === "scheduled" ? "还没有后续复习安排。" : "还没有已完成的复习。"}</p><div className={styles.actions}>
      {reviewFilter === "due" && reviews.some((item) => reviewQueueState(item, now) === "scheduled") && <button type="button" onClick={() => setReviewFilter("scheduled")}><Clock3 size={18} />查看已安排复习</button>}
      <button type="button" onClick={() => onOpen("mission")}><BookOpen size={18} />查看学习任务</button>
    </div></section>}
    <ul className={styles.list}>{selectedReviews.map((item) => <li key={item.id}>
      <div><h3>{item.title ?? missions.find((entry) => entry.id === item.missionId)?.title ?? "学习复习"}</h3><p>{dateLabel(item.dueAt)}</p><p>{item.strategy}</p></div>
      <div className={styles.actions}>
        <button type="button" onClick={() => setActiveReview(item.id)}><BookOpen size={18} />{reviewFilter === "due" ? "开始复习" : "查看记录"}</button>
        {reviewFilter !== "completed" && <button type="button" disabled={Boolean(busy)} onClick={() => actOnReview(item, "defer")}><Clock3 size={18} />延期</button>}
      </div>
    </li>)}</ul>
    {currentReview && <section className={styles.reviewEditor} aria-label="复习作答" data-testid="review-editor">
      <h3>{currentReview.title ?? "复习记录"}</h3>
      {currentReview.question ? <>
        <p>{currentReview.question.prompt}</p>
        <fieldset className={styles.choices} disabled={reviewQueueState(currentReview, now) !== "due" || Boolean(busy)}>
          <legend>{currentReview.question.question}</legend>
          {currentReview.question.choices.map((choice) => <label key={choice.id} data-selected={(reviewEdits[currentReview.id] ?? currentReview.lastAnswer ?? "") === choice.id}>
            <input type="radio" name={`review-${currentReview.id}`} checked={(reviewEdits[currentReview.id] ?? currentReview.lastAnswer ?? "") === choice.id} onChange={() => setReviewEdits((items) => ({ ...items, [currentReview.id]: choice.id }))} /><span>{choice.id}. {choice.text}</span>
          </label>)}
        </fieldset>
      </> : <p>题目暂未同步，请刷新记录。</p>}
      {currentReview.feedback && <div className={styles.feedback} role="status"><strong>{currentReview.feedback.correct ? "本次复习已完成" : "再想一想"}</strong><p>{currentReview.feedback.explanation}</p></div>}
      {reviewQueueState(currentReview, now) === "due" && <button className={styles.primary} type="button" disabled={!reviewEdits[currentReview.id] || !currentReview.question || Boolean(busy)} onClick={() => actOnReview(currentReview, "complete")}><Send size={18} />提交复习</button>}
    </section>}
  </>;

  const workshopBody = <>
    {missionSelector}
    {!mission && <p className={styles.muted}>自由创作 · 未关联任务</p>}
      <div className={styles.meta}>{mission && <span>{mission.subject}</span>}{mission?.gradeBand && <span>{GRADE_LABELS[mission.gradeBand] ?? mission.gradeBand}</span>}{mission?.source?.dataKind === "simulated" && <span>模拟数据</span>}<span>{expressionDirty ? "当前修改未提交" : expression ? evidenceStatusLabel(expression.status) : "草稿"}</span>{draft.artifactId && <span>作品版本 {draft.expectedRevision ?? "待同步"}</span>}</div>
      {mission?.assignmentId && <p className={styles.muted}>正式分派 · 发布版本 {mission.assignmentVersion ?? "待同步"}</p>}
      {run && <p className={styles.muted}>已存版本 {run.revision}</p>}
      {mission && <p className={styles.reading}>{mission.prompt}</p>}
      <label className={styles.field}><span>作品形式</span><select value={draft.kind ?? "explanation"} disabled={Boolean(busy)} onChange={(event) => edit({ kind: event.target.value as Draft["kind"] })}><option value="explanation">证据讲解</option><option value="observation">观察记录</option></select></label>
      <label className={styles.field}><span>作品标题</span><input value={workshopTitle} onChange={(event) => edit({ title: event.target.value })} maxLength={80} disabled={Boolean(busy)} /></label>
      <label className={styles.field}><span>关联证据</span><select value={sourceId} onChange={(event) => edit({ sourceId: event.target.value })} disabled={Boolean(busy)}><option value="">未关联 · 保存为草稿</option>{evidence.filter((item) => item.id === sourceId || (!currentId || item.missionId === currentId) && (!item.taskRunId || item.taskRunId === run?.id)).map((item) => <option key={item.id} value={item.id}>{item.missionTitle ?? mission?.title ?? "学习证据"} · {item.evidenceType === "expression" ? "表达" : "作答"} · {evidenceStatusLabel(item.status)} · v{item.revision}</option>)}</select></label>
      {evidenceFeedback(expression)}
      <label className={styles.field}><span>{expression?.status === "revise" ? "修订后的表达" : "我的发现、证据与解释"}</span><textarea value={content} onChange={(event) => edit({ content: event.target.value })} rows={8} maxLength={2000} disabled={Boolean(busy)} aria-label="作品内容" /></label>
      <p className={styles.muted}>{content.length} / 2000</p>
      {artifactConflict && artifactConflict.id === draft.artifactId && <section className={styles.feedback} aria-label="作品版本冲突">
        <h4>服务器版本 {artifactConflict.revision} · 本稿已保留</h4><p>{artifactConflict.content ?? artifactConflict.detail}</p>
        {artifactConflict.status !== "archived" && artifactConflict.artifactType !== "expression" && <button type="button" disabled={Boolean(busy)} onClick={() => { edit({ expectedRevision: artifactConflict.revision }); setArtifactConflict(null); setError(""); }}><RefreshCw size={18} />保留本稿并采用版本 {artifactConflict.revision}</button>}
      </section>}
      <div className={styles.actions}>
        <button type="button" disabled={Boolean(busy) || artifactReadOnly || artifactConflict?.id === draft.artifactId && Boolean(draft.artifactId) || content.trim().length < 4 || workshopTitle.trim().length < 2} onClick={saveArtifact}><Save size={18} />保存作品</button>
        {mission?.assignmentId && <button className={styles.primary} type="button" disabled={Boolean(busy) || quietActive || content.trim().length < 8 || expression?.status === "pending_review" || expression?.status?.startsWith("accepted_")} onClick={submitExpression}><Send size={18} />{expression?.status === "revise" ? "提交修订" : expression?.status === "pending_review" ? "等待老师反馈" : expression?.status?.startsWith("accepted_") ? "老师已接受" : "提交老师"}</button>}
        <button type="button" disabled={Boolean(busy) || !content.trim()} onClick={() => { edit({ content, title: `${workshopTitle.slice(0, 76)} 副本`, sourceId, artifactId: undefined, expectedRevision: undefined }); setArtifactConflict(null); setError(""); setMessage("副本草稿 · 尚未保存"); }}><Copy size={18} />另存副本</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => { if (content && !window.confirm("新建作品？当前未保存的作品内容将清空。")) return; edit({ content: "", title: "", sourceId: "", artifactId: undefined, expectedRevision: undefined }); setArtifactConflict(null); setError(""); }}><FilePlus2 size={18} />新建作品</button>
      </div>
      <V7TaskProvenance assignmentId={mission?.assignmentId} taskRunId={run?.id} resourceVersion={mission?.resourceVersion} datasetVersion={mission?.datasetVersion} sourceLabel={mission?.source?.label ?? mission?.sourceLabel} />
      {expression?.attempts && expression.attempts.length > 1 && <details className={styles.history}><summary>提交记录 · {expression.attempts.length} 版</summary>{expression.attempts.map((item, index) => <section key={item.sequence ?? index}><h4>第 {item.sequence ?? index + 1} 版</h4><p>{item.submission?.content ?? "已保留的提交记录"}</p></section>)}</details>}
  </>;

  const continueArtifact = (item: PortfolioItem, copy = false) => {
    const source = evidence.find((entry) => entry.id === item.evidenceId);
    const target = missions.some((entry) => entry.id === source?.missionId) ? source!.missionId : currentId;
    const targetRun = savedRuns[target] && (!data?.taskRuns?.find((entry) => entry.missionId === target) || savedRuns[target].revision > (data?.taskRuns?.find((entry) => entry.missionId === target)?.revision ?? 0)) ? savedRuns[target] : data?.taskRuns?.find((entry) => entry.missionId === target);
    const key = targetRun?.id ?? `${target}:new`;
    if (drafts[key]?.content && !window.confirm("打开这份作品？当前未保存的作品内容将替换。")) return;
    setMissionId(target);
    if (target) setMissionScope(formalMissions.some((entry) => entry.id === target) ? "assigned" : "sample");
    setDrafts((items) => ({ ...items, [key]: { ...items[key], content: item.content ?? item.detail, title: copy ? `${item.title.slice(0, 76)} 副本` : item.title, sourceId: item.evidenceId ?? "", kind: item.artifactType === "observation" ? "observation" : "explanation", artifactId: copy ? undefined : item.id, expectedRevision: copy ? undefined : item.revision } }));
    setArtifactConflict(null); setError(""); setMessage(""); onOpen("workshop");
  };

  const portfolioBody = <>
    {portfolio.length === 0 ? <section className={styles.empty}><p>还没有已保存的作品。</p><button type="button" onClick={() => onOpen("mission")}><BookOpen size={18} />查看学习任务</button></section> : <ul className={styles.list} data-testid="portfolio-list">{portfolio.map((item) => <li key={item.id} id={`manor-artifact-${item.id}`} tabIndex={-1}>
      <div className={styles.meta}><span>{item.subject}</span><span>{item.status ? evidenceStatusLabel(item.status) : "已保存"}</span>{item.revision && <span>版本 {item.revision}</span>}</div>
      <h3>{item.title}</h3><p className={styles.preserve}>{item.content ?? item.detail}</p>
      {item.evidenceId && <p className={styles.muted}>来源：{evidence.find((entry) => entry.id === item.evidenceId)?.missionTitle ?? missions.find((entry) => entry.id === evidence.find((record) => record.id === item.evidenceId)?.missionId)?.title ?? "关联学习证据"}</p>}
      {item.assignmentVersion && <p className={styles.muted}>发布版本 {item.assignmentVersion}</p>}
      <V7TaskProvenance assignmentId={item.assignmentId} taskRunId={item.taskRunId} resourceVersion={item.resourceVersion} datasetVersion={item.datasetVersion} />
      <div className={styles.actions}>{item.status !== "archived" && (!item.artifactType || ["explanation", "observation"].includes(item.artifactType)) && <button type="button" disabled={Boolean(busy)} onClick={() => continueArtifact(item)}><NotebookPen size={18} />继续创作</button>}
      {item.artifactType === "project" && <button type="button" onClick={() => onOpen("class")}><Users size={18} />查看共同成果</button>}
      <button type="button" disabled={Boolean(busy)} onClick={() => continueArtifact(item, true)}><Copy size={18} />另存副本</button></div>
      {safeSourceUrl(item.sourceUrl) && <a href={safeSourceUrl(item.sourceUrl)}>查看来源 <ArrowRight size={16} /></a>}
    </li>)}</ul>}
    <div className={styles.actions}><button type="button" onClick={() => onOpen("workshop")}><FileText size={18} />创作作品</button></div>
  </>;

  const classBody = <>
    <V7ProjectContributions bootstrap={data ?? bootstrap} drafts={projectDrafts} onDraftChange={(id, value) => setProjectDrafts((items) => ({ ...items, [id]: value }))} onRefresh={refreshConfirmed} />
    <h3>{classBuild?.title ?? "班级共同目标"}</h3>
    {data && !classBuild ? <section className={styles.empty}><p>暂时没有进行中的班级共建。</p><button type="button" onClick={() => onOpen("mission")}><BookOpen size={18} />查看正式任务</button></section> : <>
      <div className={styles.progress}><progress max={100} value={classProgress} aria-label="班级共建进度" /><span>{classProgress}%</span></div>
      <p>可用成长授权：{data?.resources.growthEnergy ?? props.growthEnergy}</p>
      <button className={styles.primary} type="button" disabled={!classAllocation || Boolean(busy) || quietActive || classBuild?.done} onClick={() => perform("class", async () => {
        if (!classAllocation) return;
        const result = await repository.contributeToClass(2, classAllocation);
        if (!mounted.current) return;
        props.onGrowthEnergy(result.growthEnergy); setMessage(result.message); await refreshConfirmed();
      })}><Users size={18} />自愿贡献 2 点成长授权</button>
      {!classAllocation && <><p className={styles.muted}>可用于班级共建的成长授权不足 2 点。</p><button type="button" onClick={() => { selectScope("assigned"); onOpen("mission"); }}><BookOpen size={18} />查看正式任务</button></>}
    </>}
    <details className={styles.history}><summary>查看授权来源</summary><ul className={styles.list}>{grants.length ? grants.map((grant) => <li key={grant.id}><strong>{evidence.find((item) => item.id === grant.evidenceId)?.missionTitle ?? "学习证据授权"}</strong><p>剩余 {grant.remainingUnits} / {grant.units}</p><p>{grant.allowedPurposes.filter((purpose) => ["plot", "support_plot", "class_build"].includes(purpose)).map((purpose) => ({ plot: "知识田", support_plot: "知识田", class_build: "班级共建" })[purpose]).join("、") || "无可选庄园用途"}</p></li>) : <li>还没有成长授权。</li>}</ul></details>
  </>;

  const wellbeingBody = <>
    <HeartPulse size={28} /><h3>今天到这里也很好</h3>
    <p>已保存的任务、反思和作品会保留。</p>
    <div className={styles.actions}><button type="button" onClick={() => onOpen("mission")}><Save size={18} />返回任务保存</button><button className={styles.primary} type="button" disabled={Boolean(busy)} onClick={quietActive ? onClose : () => perform("end-session", async () => {
      const result = await repository.endSession(data?.profile.revision ?? props.profileRevision);
      if (!mounted.current) return;
      props.onProfileRevision(result.revision); props.onQuietUntil(result.quietUntil);
      setMessage("今日学习已结束，进入舒缓模式。"); await refreshConfirmed();
    })}><Check size={18} />{quietActive ? "回到庄园" : "确认结束今日学习"}</button></div>
    {quietActive && <p className={styles.muted}>当前处于舒缓时段，已保存的记录仍可查看。</p>}
  </>;

  const linkedEvidence = evidence.find((item) => item.id === linkedEvidenceId);
  const linkedMission = missions.find((item) => item.id === linkedEvidence?.missionId);
  const linkedRun = [...(data?.taskRunHistory ?? []), ...(data?.taskRuns ?? [])].find((item) => item.evidenceId === linkedEvidenceId);
  const historicalEvidenceBody = <section className={styles.summary} data-testid="historical-evidence">
    <h3>{linkedMission?.title ?? "学习来源"}</h3>
    {linkedEvidence ? <><p className={styles.muted}>只读学习证据 · {linkedEvidence.id}</p>
      <p className={styles.reading}>{linkedMission?.prompt}</p>
      <h4>当时提交的内容</h4><p className={styles.preserve}>{linkedEvidence.submission?.content ?? linkedEvidence.submission?.choice ?? "已记录"}</p>
      {evidenceFeedback(linkedEvidence)}
      {linkedRun?.reflection && <><h4>当时的反思</h4><p className={styles.preserve}>{linkedRun.reflection}</p></>}
      <button onClick={() => { setMissionId(linkedEvidence.missionId); setMissionScope(formalMissions.some((item) => item.id === linkedEvidence.missionId) ? "assigned" : "sample"); setLinkedEvidenceId(""); }}><ArrowRight size={18} />进入当前学习任务</button>
    </> : <p role="alert">该证据不存在，或当前账号无权查看。</p>}
  </section>;
  const panelBody = panel === "mission" ? linkedEvidenceId ? historicalEvidenceBody : missionBody : panel === "greenhouse" ? greenhouseBody : panel === "workshop" ? workshopBody : panel === "portfolio" ? portfolioBody : panel === "class" ? classBody : wellbeingBody;

  return <>
    {!props.bootstrap && <section className={sceneStyles.missionBoard} data-testid="learning-mission-board" aria-label="今日学习任务">
      <div className={sceneStyles.missionBoardTop}><span><Sprout size={17} />今日成长</span><b data-testid="mission-progress">{data?.daily.completed ? "本次已完成" : "继续学习"}</b></div>
      <strong>{mission?.projectTitle ?? mission?.title ?? (missions.length ? "选择学习任务" : "等待学习任务")}</strong>
      <div className={sceneStyles.missionBoardBottom}><span>{mission ? `预计 ${mission.durationMinutes} 分钟` : `${missions.length} 项任务`}</span><button ref={entryRef} type="button" data-testid="mission-entry" onClick={() => onOpen("mission")}>{run ? "继续上次任务" : "打开学习任务"}</button></div>
    </section>}
    <Dialog.Root open={Boolean(panel)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal><Dialog.Overlay className={styles.shade} />
        <Dialog.Content className={styles.workspace} aria-describedby={undefined} data-testid="learning-panel"
          onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
          onCloseAutoFocus={(event) => { event.preventDefault(); (returnFocus.current?.isConnected ? returnFocus.current : entryRef.current)?.focus(); }}>
          <header className={styles.header}><Sprout size={24} /><div><small>{props.studentName}的个人庄园</small><Dialog.Title>{panel ? PANEL_TITLES[panel] : "学习任务"}</Dialog.Title></div><Dialog.Close className={styles.iconButton} title="关闭学习面板" aria-label="关闭学习面板"><X size={22} /></Dialog.Close></header>
          <nav className={styles.navigation} aria-label="学习工作区">{([['mission', BookOpen], ['greenhouse', BrainCircuit], ['workshop', NotebookPen], ['portfolio', FileText]] as const).map(([value, Icon]) => <button key={value} type="button" aria-current={panel === value ? "page" : undefined} onClick={() => onOpen(value)}><Icon size={18} />{PANEL_TITLES[value]}</button>)}</nav>
          <div className={styles.body} aria-busy={Boolean(busy)}>
            <div className={styles.syncBar}><span role="status">{busy ? <><LoaderCircle className={styles.spinner} size={16} />正在保存</> : "学习记录"}</span><button className={styles.iconButton} type="button" title="刷新学习记录" aria-label="刷新学习记录" disabled={Boolean(busy)} onClick={() => perform("refresh", refresh)}><RefreshCw size={18} /></button></div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {message && <p className={styles.notice} role="status"><Check size={18} />{message}</p>}
            {panelBody}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </>;
}
