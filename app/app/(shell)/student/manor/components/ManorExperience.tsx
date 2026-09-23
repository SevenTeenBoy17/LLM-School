"use client";

import Link from "next/link";
import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  BookOpenCheck,
  Brain,
  Brush,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Compass,
  Eye,
  FileCheck2,
  Focus,
  HelpCircle,
  Link2,
  ListTree,
  LoaderCircle,
  Menu,
  MessageCircle,
  Microscope,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Telescope,
  Users,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ManorScene } from "./ManorScene";
import {
  MANOR_SCENARIO_LABELS,
  createMockManorExperienceAdapter,
  sceneStatusLabel,
  type ActionResult,
  type EvidenceRelation,
  type ManorExperienceAdapter,
  type ManorExperienceSnapshot,
  type ManorScenario,
  type SceneNode,
  type Subject,
} from "../model/manor-experience";
import styles from "../manor.module.css";

type FlyoutId = "project" | "today" | "memory" | "workshop" | "wellbeing" | "activities" | "collaboration" | "support" | "scenarios" | "mobile-more";
type WorkspaceId = "node" | "observe" | "record" | "link" | "submit" | "revise" | "publish" | "navigator";
type OperationRunner = <T>(label: string, operation: () => Promise<ActionResult<T>>) => Promise<ActionResult<T> | undefined>;

interface EntryDefinition {
  id: FlyoutId;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface ToolDefinition {
  id: WorkspaceId | "support";
  label: string;
  icon: LucideIcon;
}

const SYSTEM_ENTRIES: EntryDefinition[] = [
  { id: "today", label: "今日任务", description: "聚焦当前一步", icon: Compass },
  { id: "memory", label: "记忆温室", description: "回看反馈", icon: Brain },
  { id: "workshop", label: "创作工坊", description: "整理成果", icon: Brush },
  { id: "wellbeing", label: "健康节奏", description: "自然收束", icon: Clock3 },
];

const ACTIVITY_ENTRIES: Array<{ label: string; description: string; icon: LucideIcon; flyout: FlyoutId }> = [
  { label: "当前项目", description: "校园节水行动", icon: Waves, flyout: "activities" },
  { label: "班级共建", description: "3 位同学协作", icon: Users, flyout: "collaboration" },
  { label: "作品展", description: "已验证后展示", icon: BookOpenCheck, flyout: "workshop" },
  { label: "消息", description: "1 条教师反馈", icon: MessageCircle, flyout: "memory" },
];

const TOOLS: ToolDefinition[] = [
  { id: "observe", label: "观察", icon: Eye },
  { id: "record", label: "记录", icon: Telescope },
  { id: "link", label: "关联证据", icon: Link2 },
  { id: "support", label: "获得支持", icon: HelpCircle },
  { id: "submit", label: "提交主张", icon: Send },
  { id: "publish", label: "展示成果", icon: Sparkles },
];

const RELATION_LABELS: Record<EvidenceRelation, string> = {
  supports: "支持结论",
  contradicts: "形成反例",
  context: "补充背景",
  method: "说明方法",
};

const subscribeToClient = () => () => undefined;

function flyoutTitle(id: FlyoutId) {
  if (id === "project" || id === "activities") return "项目里程碑";
  if (id === "collaboration") return "班级协作";
  if (id === "support") return "证据支持";
  if (id === "scenarios") return "状态预览";
  if (id === "mobile-more") return "更多学习入口";
  return SYSTEM_ENTRIES.find((entry) => entry.id === id)?.label ?? "学习面板";
}

function statusTone(status: ActionResult<unknown>["status"]) {
  if (status === "success") return "success";
  if (status === "validation_error") return "warning";
  return "error";
}

function ResultBanner({ result }: { result: ActionResult<unknown> | null }) {
  if (!result) return null;
  return (
    <div className={styles.resultBanner} data-tone={statusTone(result.status)} role={result.status === "success" ? "status" : "alert"} data-testid="operation-result">
      {result.status === "success" ? <CheckCircle2 size={19} aria-hidden="true" /> : <CircleAlert size={19} aria-hidden="true" />}
      <div>
        <strong>{result.message}</strong>
        <small>操作编号 {result.operationId} · 状态版本 {result.stateVersion}</small>
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className={styles.fieldError}>{message}</span> : null;
}

function EvidenceWorkspace({ snapshot, milestoneId, mode, pending, runOperation, adapter, result }: {
  snapshot: ManorExperienceSnapshot;
  milestoneId: string;
  mode: "observe" | "record";
  pending: boolean;
  runOperation: OperationRunner;
  adapter: ManorExperienceAdapter;
  result: ActionResult<unknown> | null;
}) {
  const milestone = snapshot.milestones.find((item) => item.id === milestoneId) ?? snapshot.milestones[0];
  const [subject, setSubject] = useState<Subject>(milestone.subject);
  const [title, setTitle] = useState(mode === "observe" ? "午休后水龙头滴漏观察" : "一周节水测量记录");
  const [method, setMethod] = useState(mode === "observe" ? "定点观察并计数" : "同一时段重复测量三次");
  const [finding, setFinding] = useState(mode === "observe" ? "十分钟内记录到 31 次滴水，间隔基本稳定。" : "三次一分钟滴数分别为 42、45、43，平均为 43.3。" );
  const [source, setSource] = useState(mode === "observe" ? "教学楼二层洗手池观察单" : "节水小组测量表");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runOperation("record", () => adapter.recordEvidence({ milestoneId: milestone.id, subject, title, method, finding, source }));
  }

  return (
    <form className={styles.workspaceForm} onSubmit={submit}>
      <div className={styles.formIntro}>
        <Microscope size={24} aria-hidden="true" />
        <div><strong>{mode === "observe" ? "把观察变成可检查的证据" : "记录证据的来源与方法"}</strong><p>{milestone.title} · {milestone.summary}</p></div>
      </div>
      <div className={styles.formGrid}>
        <label><span>学科视角</span><select value={subject} onChange={(event) => setSubject(event.target.value as Subject)}>{["语文", "数学", "科学", "综合实践"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>证据标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className={styles.fullField}><span>观察或测量方法</span><input value={method} onChange={(event) => setMethod(event.target.value)} /></label>
        <label className={styles.fullField}><span>具体发现</span><textarea rows={3} value={finding} onChange={(event) => setFinding(event.target.value)} /></label>
        <label className={styles.fullField}><span>来源</span><input value={source} onChange={(event) => setSource(event.target.value)} /></label>
      </div>
      <ResultBanner result={result} />
      {result?.fieldErrors && <div className={styles.errorList}>{Object.values(result.fieldErrors).map((message) => <FieldError key={message} message={message} />)}</div>}
      <button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? <><LoaderCircle className={styles.spin} size={18} />正在等待记录结果</> : <><FileCheck2 size={18} />确认记录证据</>}</button>
    </form>
  );
}

function LinkWorkspace({ snapshot, milestoneId, pending, runOperation, adapter, result }: {
  snapshot: ManorExperienceSnapshot;
  milestoneId: string;
  pending: boolean;
  runOperation: OperationRunner;
  adapter: ManorExperienceAdapter;
  result: ActionResult<unknown> | null;
}) {
  const milestone = snapshot.milestones.find((item) => item.id === milestoneId) ?? snapshot.milestones[0];
  const [evidenceId, setEvidenceId] = useState(snapshot.evidence.at(-1)?.id ?? "");
  const [objectiveId, setObjectiveId] = useState(milestone.objectiveIds[0] ?? snapshot.objectives[0]?.id ?? "");
  const [relation, setRelation] = useState<EvidenceRelation>("supports");
  const [reason, setReason] = useState("这条测量记录用统一单位说明了滴漏规模，因此能够支持节水行动的优先级判断。");

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runOperation("link", () => adapter.linkEvidence({ evidenceId, objectiveId, milestoneId: milestone.id, relation, sharedProblem: snapshot.project.drivingQuestion, reason }));
  }

  return (
    <form className={styles.workspaceForm} onSubmit={submit}>
      <div className={styles.chainQuestion}><strong>共同项目问题</strong><p>{snapshot.project.drivingQuestion}</p></div>
      <div className={styles.formGrid}>
        <label><span>原始证据</span><select value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)}>{snapshot.evidence.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label><span>学习目标</span><select value={objectiveId} onChange={(event) => setObjectiveId(event.target.value)}>{snapshot.objectives.map((item) => <option key={item.id} value={item.id}>{item.subject} · {item.label}</option>)}</select></label>
        <label><span>关系角色</span><select value={relation} onChange={(event) => setRelation(event.target.value as EvidenceRelation)}>{Object.entries(RELATION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>项目里程碑</span><input value={milestone.title} readOnly /></label>
        <label className={styles.fullField}><span>为什么这条关联成立</span><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </div>
      <ResultBanner result={result} />
      {result?.fieldErrors && <div className={styles.errorList}>{Object.values(result.fieldErrors).map((message) => <FieldError key={message} message={message} />)}</div>}
      <button className={styles.primaryButton} type="submit" disabled={pending || snapshot.evidence.length === 0}>{pending ? <><LoaderCircle className={styles.spin} size={18} />正在验证关联质量</> : <><Link2 size={18} />建立可解释关联</>}</button>
    </form>
  );
}

function ClaimWorkspace({ snapshot, milestoneId, mode, pending, runOperation, adapter, result }: {
  snapshot: ManorExperienceSnapshot;
  milestoneId: string;
  mode: "submit" | "revise";
  pending: boolean;
  runOperation: OperationRunner;
  adapter: ManorExperienceAdapter;
  result: ActionResult<unknown> | null;
}) {
  const revisable = snapshot.claims.find((item) => item.status === "revise");
  const milestone = snapshot.milestones.find((item) => item.id === (mode === "revise" && revisable ? revisable.milestoneId : milestoneId)) ?? snapshot.milestones[0];
  const [conclusion, setConclusion] = useState(revisable?.conclusion ?? "应优先维修持续滴漏的水龙头，并在一周后复测节水效果。");
  const [reasoning, setReasoning] = useState(mode === "revise" ? "重复测量表明滴漏持续存在，单位换算说明浪费规模，后勤访谈又证明方案可执行，三类证据共同支持维修优先级。" : "观察和单位换算共同说明滴漏持续且规模值得优先处理。" );
  const [limitation, setLimitation] = useState(mode === "revise" ? "当前样本只覆盖一栋教学楼，滴水体积采用估算值，后续要增加量杯实测并比较维修前后数据。" : "样本只覆盖一处水龙头，后续需要扩大观察范围。" );
  const [evidenceIds, setEvidenceIds] = useState<string[]>(mode === "revise" ? Array.from(new Set([...(revisable?.evidenceIds ?? []), ...snapshot.evidence.slice(0, 3).map((item) => item.id)])) : snapshot.evidence.slice(0, 2).map((item) => item.id));

  function toggleEvidence(id: string) {
    setEvidenceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "revise" && revisable) {
      await runOperation("revise", () => adapter.reviseClaim({ claimId: revisable.id, milestoneId: milestone.id, conclusion, evidenceIds, reasoning, limitation }));
    } else {
      await runOperation("claim", () => adapter.submitClaim({ milestoneId: milestone.id, conclusion, evidenceIds, reasoning, limitation }));
    }
  }

  return (
    <form className={styles.workspaceForm} onSubmit={submit}>
      {mode === "revise" && snapshot.decisions.at(-1) && <div className={styles.reviewNote}><MessageCircle size={20} aria-hidden="true" /><div><strong>模拟审核意见</strong><p>{snapshot.decisions.at(-1)?.reason}</p></div></div>}
      <label className={styles.fullField}><span>结论</span><textarea rows={2} value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></label>
      <fieldset className={styles.evidencePicker}><legend>用于支持主张的证据</legend>{snapshot.evidence.map((item) => <label key={item.id}><input type="checkbox" checked={evidenceIds.includes(item.id)} onChange={() => toggleEvidence(item.id)} /><span><strong>{item.title}</strong><small>{item.subject} · {item.method}</small></span></label>)}</fieldset>
      <label className={styles.fullField}><span>推理</span><textarea rows={3} value={reasoning} onChange={(event) => setReasoning(event.target.value)} /></label>
      <label className={styles.fullField}><span>局限与下一步</span><textarea rows={3} value={limitation} onChange={(event) => setLimitation(event.target.value)} /></label>
      <ResultBanner result={result} />
      {result?.fieldErrors && <div className={styles.errorList}>{Object.values(result.fieldErrors).map((message) => <FieldError key={message} message={message} />)}</div>}
      <button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? <><LoaderCircle className={styles.spin} size={18} />正在等待审核结果</> : mode === "revise" ? <><RotateCcw size={18} />提交订正版</> : <><Send size={18} />提交主张</>}</button>
    </form>
  );
}

function PublishWorkspace({ snapshot, pending, runOperation, adapter, result }: {
  snapshot: ManorExperienceSnapshot;
  pending: boolean;
  runOperation: OperationRunner;
  adapter: ManorExperienceAdapter;
  result: ActionResult<unknown> | null;
}) {
  const accepted = snapshot.claims.find((item) => item.status === "accepted");
  const [title, setTitle] = useState("校园滴漏节水证据卡");
  const [summary, setSummary] = useState("我们用重复测量、单位换算和访谈说明维修优先级，并如实标注样本与估算局限。");
  const [visibility, setVisibility] = useState<"private" | "class">("class");
  const [reflection, setReflection] = useState("重复测量和单位换算让结论更可靠；样本仍只覆盖一栋教学楼，下一轮要增加量杯实测和维修后对照。" );

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runOperation("publish", () => adapter.publishArtifact({ claimId: accepted?.id ?? "", title, summary, visibility, reflection }));
  }

  return (
    <form className={styles.workspaceForm} onSubmit={submit}>
      {!accepted && <div className={styles.blockedNotice}><ShieldCheck size={22} aria-hidden="true" /><div><strong>成果尚不能展示</strong><p>先完成主张订正并获得“已验证”结果。展示按钮不会绕过证据审核。</p></div></div>}
      <div className={styles.formGrid}>
        <label className={styles.fullField}><span>成果标题</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className={styles.fullField}><span>成果摘要</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
        <label className={styles.fullField}><span>项目反思</span><textarea rows={3} value={reflection} onChange={(event) => setReflection(event.target.value)} /></label>
        <label><span>可见范围</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "class")}><option value="private">仅自己与教师</option><option value="class">班级作品展</option></select></label>
      </div>
      <ResultBanner result={result} />
      {result?.fieldErrors && <div className={styles.errorList}>{Object.values(result.fieldErrors).map((message) => <FieldError key={message} message={message} />)}</div>}
      <button className={styles.primaryButton} type="submit" disabled={pending || !accepted}>{pending ? <><LoaderCircle className={styles.spin} size={18} />正在确认展示结果</> : <><Sparkles size={18} />加入作品展</>}</button>
    </form>
  );
}

function SceneNavigator({ snapshot, onSelect }: { snapshot: ManorExperienceSnapshot; onSelect: (node: SceneNode, trigger: HTMLButtonElement) => void }) {
  return (
    <div className={styles.navigatorList} data-testid="scene-navigator">
      {snapshot.sceneNodes.map((node, index) => (
        <button key={node.id} type="button" onClick={(event) => onSelect(node, event.currentTarget)}>
          <span className={styles.navigatorIndex}>{index + 1}</span>
          <span><strong>{node.title}</strong><small>{node.nextAction} · {node.evidenceCount} 条证据</small></span>
          <span className={styles.statusPill} data-status={node.status}>{sceneStatusLabel(node.status)}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export function ManorExperience() {
  const portalReady = useSyncExternalStore(subscribeToClient, () => true, () => false);
  const [scenario, setScenario] = useState<ManorScenario>("normal");
  const [snapshot, setSnapshot] = useState<ManorExperienceSnapshot | null>(null);
  const [bootResult, setBootResult] = useState<ActionResult<ManorExperienceSnapshot> | null>(null);
  const [bootFailure, setBootFailure] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ActionResult<unknown> | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [flyout, setFlyout] = useState<FlyoutId | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceId | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-question");
  const [toast, setToast] = useState<string | null>(null);
  const [qaControls, setQaControls] = useState(false);
  const [activityCollapsed, setActivityCollapsed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [adapter, setAdapter] = useState<ManorExperienceAdapter>(() => createMockManorExperienceAdapter());
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLElement>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const bootstrapSequenceRef = useRef(0);
  const rejectionSequenceRef = useRef(0);

  const selectedNode = useMemo(() => snapshot?.sceneNodes.find((node) => node.id === selectedNodeId) ?? snapshot?.sceneNodes[0] ?? null, [selectedNodeId, snapshot]);
  const revisableClaim = snapshot?.claims.find((claim) => claim.status === "revise") ?? null;

  const bootstrap = useCallback(async (nextScenario: ManorScenario) => {
    const requestSequence = ++bootstrapSequenceRef.current;
    const nextAdapter = createMockManorExperienceAdapter({ scenario: nextScenario });
    setAdapter(nextAdapter);
    setSnapshot(null);
    setBootResult(null);
    setBootFailure(null);
    setLastResult(null);
    setPendingAction("bootstrap");
    try {
      const result = await nextAdapter.bootstrap();
      if (requestSequence !== bootstrapSequenceRef.current) return;
      setBootResult(result);
      setSnapshot(result.snapshot);
      setToast(result.message);
    } catch {
      if (requestSequence !== bootstrapSequenceRef.current) return;
      setBootFailure("场景连接意外中断，界面没有把未返回的数据当作成功。请重试或恢复正常演练。");
      setToast(null);
    } finally {
      if (requestSequence === bootstrapSequenceRef.current) setPendingAction(null);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setQaControls(new URLSearchParams(window.location.search).get("qa") === "1");
      void bootstrap("normal");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bootstrap]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3_800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const closeSurface = useCallback(() => {
    setWorkspace(null);
    setFlyout(null);
    setLastResult(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && (workspace || flyout)) {
        event.preventDefault();
        closeSurface();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeSurface, flyout, workspace]);

  useEffect(() => {
    if (workspace) window.requestAnimationFrame(() => modalRef.current?.querySelector<HTMLElement>("button, input, select, textarea")?.focus());
    else if (flyout) window.requestAnimationFrame(() => flyoutRef.current?.focus());
  }, [flyout, workspace]);

  const runOperation: OperationRunner = async (label, operation) => {
    setPendingAction(label);
    setLastResult(null);
    try {
      const result = await operation();
      setLastResult(result as ActionResult<unknown>);
      setSnapshot(result.snapshot);
      setToast(result.message);
      return result;
    } catch {
      if (!snapshot) {
        setToast("操作连接意外中断，请重新进入工作区后重试。");
        return undefined;
      }
      const result: ActionResult<never> = {
        operationId: `client-${label}-rejected-${String(++rejectionSequenceRef.current).padStart(3, "0")}`,
        stateVersion: lastResult?.stateVersion ?? bootResult?.stateVersion ?? 1,
        status: "error",
        message: "操作连接意外中断，未显示成功，也没有改变证据链。请重试。",
        authoritativeEntity: null,
        snapshot,
        nextActions: ["重试", "检查当前状态"],
      };
      setLastResult(result);
      setToast(result.message);
      return result;
    } finally {
      setPendingAction(null);
    }
  };

  function rememberTrigger(trigger?: HTMLElement | null) {
    if (trigger) lastTriggerRef.current = trigger;
  }

  function openFlyout(id: FlyoutId, trigger: HTMLElement) {
    rememberTrigger(trigger);
    setWorkspace(null);
    setLastResult(null);
    setFlyout((current) => current === id ? null : id);
  }

  function openWorkspace(id: WorkspaceId, trigger?: HTMLElement | null, nodeId?: string) {
    rememberTrigger(trigger);
    if (nodeId) setSelectedNodeId(nodeId);
    setFlyout(null);
    setLastResult(null);
    setWorkspace(id);
  }

  function chooseScenario(next: ManorScenario) {
    setScenario(next);
    setFlyout(null);
    void bootstrap(next);
  }

  function onModalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]"));
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && window.innerWidth >= 768) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 2) pinchRef.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];
    if (points.length === 1) {
      setPan((current) => ({ x: Math.max(-560, Math.min(560, current.x + event.clientX - previous.x)), y: Math.max(-300, Math.min(300, current.y + event.clientY - previous.y)) }));
    } else if (points.length === 2 && pinchRef.current) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      setZoom(Math.max(1, Math.min(1.8, pinchRef.current.zoom * distance / Math.max(1, pinchRef.current.distance))));
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); }

  function renderFlyoutContent() {
    if (!snapshot) return null;
    if (flyout === "project" || flyout === "activities") {
      return <div className={styles.milestoneList}>{snapshot.milestones.map((item) => <button key={item.id} type="button" onClick={(event) => { const node = snapshot.sceneNodes.find((entry) => entry.milestoneId === item.id); if (node) openWorkspace("node", event.currentTarget, node.id); }}><span className={styles.milestoneOrder}>{item.order}</span><span><strong>{item.title}</strong><small>{item.subject} · {item.summary}</small></span><span className={styles.statusPill} data-status={item.status}>{sceneStatusLabel(item.status)}</span></button>)}</div>;
    }
    if (flyout === "today") {
      const current = snapshot.milestones.find((item) => item.status === "active") ?? snapshot.milestones[0];
      return <div className={styles.flyoutNarrative}><strong>{current.title}</strong><p>{current.summary}</p><div className={styles.miniChain}><span>目标</span><ChevronRight size={14} /><span>证据</span><ChevronRight size={14} /><span>主张</span></div><button type="button" className={styles.secondaryButton} onClick={(event) => openWorkspace("observe", event.currentTarget)}>开始当前一步</button></div>;
    }
    if (flyout === "memory") {
      return <div className={styles.feedbackList}>{snapshot.decisions.length ? snapshot.decisions.slice().reverse().map((decision) => <div key={decision.id}><MessageCircle size={18} /><span><strong>{decision.status === "accepted" ? "审核通过" : "需要订正"}</strong><small>{decision.reason}</small></span></div>) : <p>还没有审核反馈。</p>}</div>;
    }
    if (flyout === "workshop") {
      return <div className={styles.flyoutNarrative}><strong>学习成果</strong><p>{snapshot.artifacts.length ? `已有 ${snapshot.artifacts.length} 件通过证据审核的成果。` : "完成订正后，成果才能进入作品展。"}</p><button type="button" className={styles.secondaryButton} onClick={(event) => openWorkspace("publish", event.currentTarget)}>打开成果工作区</button></div>;
    }
    if (flyout === "wellbeing") {
      return <div className={styles.flyoutNarrative}><strong>8 分钟自然收束</strong><p>完成当前一步后可以离开。暂停不会扣除成长，也不会形成连续签到压力。</p><div className={styles.paceRow}><Clock3 size={18} /><span>已专注 6 分钟 · 建议再用 2 分钟写反思</span></div></div>;
    }
    if (flyout === "collaboration") {
      return <div className={styles.collaborationList}><div className={styles.avatarRow}><span>林</span><span>周</span><span>陈</span></div><strong>节水调查小组</strong><p>教师公告：请先核对测量单位，再合并小组数据。这里只展示项目协作者，不公开排名。</p></div>;
    }
    if (flyout === "support") {
      return <div className={styles.rubricList}>{["结论是否回答共同问题", "证据是否来自明确方法", "推理是否解释支持关系", "是否诚实说明局限"].map((item, index) => <div key={item}><span>{index + 1}</span><p>{item}</p></div>)}</div>;
    }
    if (flyout === "scenarios") {
      return <div className={styles.scenarioGrid}>{(Object.keys(MANOR_SCENARIO_LABELS) as ManorScenario[]).map((item) => <button key={item} type="button" aria-pressed={scenario === item} onClick={() => chooseScenario(item)}><span>{MANOR_SCENARIO_LABELS[item]}</span><small>{item === "normal" ? "完整流程" : "用于检查界面状态"}</small></button>)}</div>;
    }
    if (flyout === "mobile-more") {
      return <div className={styles.mobileMoreGrid}>{TOOLS.slice(4).map((tool) => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={(event) => openWorkspace(tool.id as WorkspaceId, event.currentTarget)}><Icon size={21} /><span>{tool.label}</span></button>; })}<button type="button" onClick={(event) => openWorkspace("navigator", event.currentTarget)}><ListTree size={21} /><span>场景列表</span></button><button type="button" onClick={(event) => openFlyout("collaboration", event.currentTarget)}><Users size={21} /><span>班级协作</span></button></div>;
    }
    return null;
  }

  function workspaceTitle() {
    return ({ node: selectedNode?.title ?? "场景节点", observe: "观察现场", record: "记录证据", link: "关联证据", submit: "提交主张", revise: "订正主张", publish: "展示成果", navigator: "场景导航" } satisfies Record<WorkspaceId, string>)[workspace ?? "node"];
  }

  function renderWorkspace() {
    if (!snapshot || !workspace || !selectedNode) return null;
    const milestoneId = selectedNode.milestoneId;
    if (workspace === "node") {
      const milestone = snapshot.milestones.find((item) => item.id === milestoneId)!;
      const objectiveLabels = milestone.objectiveIds.map((id) => snapshot.objectives.find((item) => item.id === id)?.label).filter(Boolean);
      return <div className={styles.nodeWorkspace}><div className={styles.nodeHeadline}><span className={styles.largeStatus} data-status={selectedNode.status}>{sceneStatusLabel(selectedNode.status)}</span><div><strong>{milestone.title}</strong><p>{milestone.summary}</p></div></div><dl><div><dt>学习目标</dt><dd>{objectiveLabels.join("；")}</dd></div><div><dt>已有证据</dt><dd>{selectedNode.evidenceCount} 条</dd></div><div><dt>下一步</dt><dd>{selectedNode.nextAction}</dd></div></dl><div className={styles.workspaceActions}><button type="button" className={styles.primaryButton} onClick={(event) => openWorkspace(selectedNode.status === "revise" ? "revise" : selectedNode.status === "showcase" ? "publish" : "record", event.currentTarget)}>{selectedNode.nextAction}</button><button type="button" className={styles.secondaryButton} onClick={(event) => openWorkspace("link", event.currentTarget)}>查看并关联证据</button></div></div>;
    }
    if (workspace === "observe" || workspace === "record") return <EvidenceWorkspace key={`${workspace}-${milestoneId}`} snapshot={snapshot} milestoneId={milestoneId} mode={workspace} pending={Boolean(pendingAction)} runOperation={runOperation} adapter={adapter} result={lastResult} />;
    if (workspace === "link") return <LinkWorkspace key={`${workspace}-${milestoneId}-${snapshot.evidence.length}`} snapshot={snapshot} milestoneId={milestoneId} pending={Boolean(pendingAction)} runOperation={runOperation} adapter={adapter} result={lastResult} />;
    if (workspace === "submit" || workspace === "revise") return <ClaimWorkspace key={`${workspace}-${snapshot.claims.length}`} snapshot={snapshot} milestoneId={milestoneId} mode={workspace} pending={Boolean(pendingAction)} runOperation={runOperation} adapter={adapter} result={lastResult} />;
    if (workspace === "publish") return <PublishWorkspace key={`${workspace}-${snapshot.claims.filter((claim) => claim.status === "accepted").length}`} snapshot={snapshot} pending={Boolean(pendingAction)} runOperation={runOperation} adapter={adapter} result={lastResult} />;
    if (workspace === "navigator") return <SceneNavigator snapshot={snapshot} onSelect={(node, trigger) => openWorkspace("node", trigger, node.id)} />;
    return null;
  }

  if (!snapshot) {
    const loadingStage = <div className={styles.stage} data-testid="manor-stage" data-scenario={scenario}><div className={styles.loadingScene} aria-live="polite">{bootFailure ? <div className={styles.loadingFailure} role="alert" data-testid="bootstrap-rejection"><CircleAlert size={30} /><strong>庄园加载中断</strong><p>{bootFailure}</p><div className={styles.workspaceActions}><button className={styles.primaryButton} type="button" onClick={() => void bootstrap(scenario)}>重新加载</button><button className={styles.secondaryButton} type="button" onClick={() => { setScenario("normal"); void bootstrap("normal"); }}>恢复正常场景</button></div></div> : <><LoaderCircle className={styles.spin} size={30} /><strong>{pendingAction === "bootstrap" ? "正在整理学习庄园" : "庄园暂时不可用"}</strong><p>等待场景、项目和证据状态返回后再开始。</p></>}</div></div>;
    return portalReady ? createPortal(loadingStage, document.body) : null;
  }

  const activeFlyoutTitle = flyout ? flyoutTitle(flyout) : "";
  const experience = (
    <div className={styles.stage} data-testid="manor-stage" data-scenario={scenario}>
      <ManorScene
        snapshot={snapshot}
        zoom={zoom}
        pan={pan}
        onNode={(nodeId, trigger) => openWorkspace("node", trigger, nodeId)}
        onPlot={(_, nodeId, trigger) => openWorkspace("node", trigger, nodeId)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      <div className={styles.hud} data-testid="manor-hud">
        <div className={styles.projectCompass} data-testid="project-compass">
          <Link href="/student/home" className={styles.iconButton} aria-label="返回学生首页" title="返回学生首页"><ArrowLeft size={20} /></Link>
          <button type="button" className={styles.projectButton} onClick={(event) => openFlyout("project", event.currentTarget)} aria-expanded={flyout === "project"}>
            <span className={styles.projectMark} aria-hidden="true"><Sprout size={22} /></span>
            <span className={styles.projectCopy}><small>跨学科项目</small><strong>{snapshot.project.title}</strong><span><i style={{ width: `${snapshot.project.progress / snapshot.project.totalMilestones * 100}%` }} /> </span></span>
            <b>{snapshot.project.progress}/{snapshot.project.totalMilestones}</b>
          </button>
          <button type="button" className={styles.iconButton} onClick={(event) => openWorkspace("navigator", event.currentTarget)} aria-label="打开场景列表" title="场景列表"><ListTree size={20} /></button>
          {qaControls && <button type="button" className={styles.iconButton} data-testid="scenario-trigger" onClick={(event) => openFlyout("scenarios", event.currentTarget)} aria-label="打开状态预览" title="状态预览"><SlidersHorizontal size={19} /></button>}
        </div>

        <nav className={styles.modeDock} aria-label="长期学习系统" data-testid="mode-dock">
          {SYSTEM_ENTRIES.map((entry) => { const Icon = entry.icon; return <button key={entry.id} type="button" aria-pressed={flyout === entry.id} onClick={(event) => openFlyout(entry.id, event.currentTarget)}><Icon size={24} aria-hidden="true" /><span><strong>{entry.label}</strong><small>{entry.description}</small></span></button>; })}
        </nav>

        <nav className={styles.activityRail} aria-label="学习活动" data-testid="activity-rail" data-collapsed={activityCollapsed}>
          <button type="button" className={styles.activityToggle} onClick={() => setActivityCollapsed((current) => !current)} aria-label={activityCollapsed ? "展开活动栏" : "收起活动栏"} aria-expanded={!activityCollapsed}>
            {activityCollapsed ? <PanelLeftOpen size={21} aria-hidden="true" /> : <PanelLeftClose size={21} aria-hidden="true" />}
            <span><strong>活动时间线</strong><small>{activityCollapsed ? "展开" : "收起"}</small></span>
          </button>
          {ACTIVITY_ENTRIES.map((entry) => { const Icon = entry.icon; return <button key={entry.label} type="button" onClick={(event) => openFlyout(entry.flyout, event.currentTarget)}><Icon size={21} aria-hidden="true" /><span><strong>{entry.label}</strong><small>{entry.description}</small></span></button>; })}
        </nav>

        <button type="button" className={styles.collaborationDock} data-testid="collaboration-dock" onClick={(event) => openFlyout("collaboration", event.currentTarget)} aria-label="打开班级协作抽屉"><span className={styles.avatarStack} aria-hidden="true"><i>林</i><i>周</i><i>陈</i></span><span><strong>协作小组</strong><small>1 条教师反馈</small></span><b>1</b></button>

        <nav className={styles.toolDock} aria-label="学习动作" data-testid="tool-dock">
          {TOOLS.map((tool) => { const Icon = tool.icon; const isRevise = tool.id === "submit" && Boolean(revisableClaim); return <button key={tool.id} type="button" onClick={(event) => tool.id === "support" ? openFlyout("support", event.currentTarget) : openWorkspace(isRevise ? "revise" : tool.id as WorkspaceId, event.currentTarget)} disabled={scenario === "disabled"}><Icon size={23} aria-hidden="true" /><span>{isRevise ? "订正主张" : tool.label}</span>{tool.id === "submit" && revisableClaim && <b aria-label="一条待订正主张">1</b>}</button>; })}
        </nav>

        <div className={styles.mobileTopBar}>
          <Link href="/student/home" className={styles.iconButton} aria-label="返回学生首页"><ArrowLeft size={20} /></Link>
          <button type="button" onClick={(event) => openFlyout("project", event.currentTarget)}><Sprout size={20} /><span><small>当前项目</small><strong>{snapshot.project.title}</strong></span><b>{snapshot.project.progress}/{snapshot.project.totalMilestones}</b></button>
          <button type="button" className={styles.iconButton} onClick={(event) => openWorkspace("navigator", event.currentTarget)} aria-label="场景列表"><ListTree size={20} /></button>
        </div>

        <div className={styles.mobileViewControls} aria-label="场景缩放控制">
          <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.1).toFixed(1))))} aria-label="缩小场景" title="缩小"><ZoomOut size={18} /></button>
          <button type="button" onClick={resetView} aria-label="复位场景" title="复位"><Focus size={18} /></button>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(1))))} aria-label="放大场景" title="放大"><ZoomIn size={18} /></button>
        </div>

        <nav className={styles.mobileNav} aria-label="移动端学习导航" data-testid="mobile-manor-nav">
          {TOOLS.slice(0, 4).map((tool) => { const Icon = tool.icon; return <button key={tool.id} type="button" onClick={(event) => tool.id === "support" ? openFlyout("support", event.currentTarget) : openWorkspace(tool.id as WorkspaceId, event.currentTarget)}><Icon size={22} /><span>{tool.label}</span></button>; })}
          <button type="button" onClick={(event) => openFlyout("mobile-more", event.currentTarget)}><Menu size={22} /><span>更多</span></button>
        </nav>
      </div>

      {flyout && <aside ref={flyoutRef} tabIndex={-1} className={styles.flyout} data-flyout={flyout} data-testid="manor-flyout" aria-label={`${activeFlyoutTitle}面板`}>
        <header><span>{activeFlyoutTitle}</span><button type="button" className={styles.iconButton} onClick={closeSurface} aria-label="关闭浮层"><X size={18} /></button></header>
        {renderFlyoutContent()}
      </aside>}

      {workspace && <div className={styles.modalBackdrop} data-testid="manor-modal-backdrop">
        <div ref={modalRef} className={styles.workspaceModal} role="dialog" aria-modal="true" aria-labelledby="manor-workspace-title" data-testid="manor-workspace" onKeyDown={onModalKeyDown}>
          <header><div><small>校园节水行动</small><h2 id="manor-workspace-title">{workspaceTitle()}</h2></div><button type="button" className={styles.closeButton} onClick={closeSurface} aria-label="关闭工作区"><X size={22} /></button></header>
          <div className={styles.workspaceBody}>{renderWorkspace()}</div>
        </div>
      </div>}

      {bootResult && bootResult.status !== "success" && <div className={styles.bootWarning} role="alert"><CircleAlert size={18} /><span>{bootResult.message}</span><button type="button" onClick={() => void bootstrap(scenario)}>重新加载</button></div>}
      {toast && <div className={styles.toast} role="status" aria-live="polite"><CheckCircle2 size={18} aria-hidden="true" /><span>{toast}</span></div>}
      <div className={styles.srLive} aria-live="polite">{pendingAction ? "正在等待操作结果" : lastResult?.message ?? ""}</div>
    </div>
  );

  return portalReady ? createPortal(experience, document.body) : null;
}
