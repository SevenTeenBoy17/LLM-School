export type ManorScenario = "normal" | "loading" | "empty" | "failure" | "conflict" | "offline" | "disabled" | "rejected_bootstrap" | "rejected_operation";
export type Subject = "语文" | "数学" | "科学" | "综合实践";
export type SceneNodeStatus = "available" | "active" | "needs_evidence" | "pending_review" | "revise" | "verified" | "showcase";
export type EvidenceRelation = "supports" | "contradicts" | "context" | "method";
export type ActionStatus = "success" | "validation_error" | "conflict" | "offline" | "disabled" | "error";

export interface LearningObjective {
  id: string;
  subject: Subject;
  label: string;
  successCriteria: string;
}

export interface Project {
  id: string;
  title: string;
  drivingQuestion: string;
  description: string;
  progress: number;
  totalMilestones: number;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  subject: Subject;
  objectiveIds: string[];
  order: number;
  status: SceneNodeStatus;
}

export interface SceneNode {
  id: string;
  milestoneId: string;
  title: string;
  shortLabel: string;
  status: SceneNodeStatus;
  position: { x: number; y: number };
  evidenceCount: number;
  nextAction: string;
}

export interface Evidence {
  id: string;
  milestoneId: string;
  subject: Subject;
  title: string;
  method: string;
  finding: string;
  source: string;
  createdAt: string;
}

export interface EvidenceLink {
  id: string;
  evidenceId: string;
  objectiveId: string;
  milestoneId: string;
  relation: EvidenceRelation;
  sharedProblem: string;
  reason: string;
}

export interface Claim {
  id: string;
  milestoneId: string;
  conclusion: string;
  evidenceIds: string[];
  reasoning: string;
  limitation: string;
  revision: number;
  status: "revise" | "accepted";
}

export interface ReviewDecision {
  id: string;
  claimId: string;
  status: "revise" | "accepted";
  reason: string;
  rubric: string;
  decidedAt: string;
}

export interface Artifact {
  id: string;
  claimId: string;
  title: string;
  summary: string;
  visibility: "private" | "class";
  publishedAt: string;
}

export interface Reflection {
  id: string;
  milestoneId: string;
  text: string;
  createdAt: string;
}

export interface ManorExperienceSnapshot {
  project: Project;
  objectives: LearningObjective[];
  milestones: Milestone[];
  sceneNodes: SceneNode[];
  evidence: Evidence[];
  links: EvidenceLink[];
  claims: Claim[];
  decisions: ReviewDecision[];
  artifacts: Artifact[];
  reflections: Reflection[];
}

export interface ActionResult<T> {
  operationId: string;
  stateVersion: number;
  status: ActionStatus;
  message: string;
  authoritativeEntity: T | null;
  snapshot: ManorExperienceSnapshot;
  nextActions: string[];
  fieldErrors?: Record<string, string>;
}

export interface RecordEvidenceInput {
  milestoneId: string;
  subject: Subject;
  title: string;
  method: string;
  finding: string;
  source: string;
}

export interface LinkEvidenceInput {
  evidenceId: string;
  objectiveId: string;
  milestoneId: string;
  relation: EvidenceRelation;
  sharedProblem: string;
  reason: string;
}

export interface SubmitClaimInput {
  milestoneId: string;
  conclusion: string;
  evidenceIds: string[];
  reasoning: string;
  limitation: string;
}

export interface ReviseClaimInput extends SubmitClaimInput {
  claimId: string;
}

export interface PublishArtifactInput {
  claimId: string;
  title: string;
  summary: string;
  visibility: "private" | "class";
  reflection: string;
}

export interface ManorExperienceAdapter {
  bootstrap(): Promise<ActionResult<ManorExperienceSnapshot>>;
  recordEvidence(input: RecordEvidenceInput): Promise<ActionResult<Evidence>>;
  linkEvidence(input: LinkEvidenceInput): Promise<ActionResult<EvidenceLink>>;
  submitClaim(input: SubmitClaimInput): Promise<ActionResult<Claim>>;
  reviseClaim(input: ReviseClaimInput): Promise<ActionResult<Claim>>;
  publishArtifact(input: PublishArtifactInput): Promise<ActionResult<Artifact>>;
}

const FIXED_TIME = "2026-08-25T09:00:00.000Z";
const RELATIONS: EvidenceRelation[] = ["supports", "contradicts", "context", "method"];

const project: Project = {
  id: "water-saving-campus",
  title: "校园节水行动",
  drivingQuestion: "怎样用可靠证据让校园每天少浪费一桶水？",
  description: "从真实观察出发，完成测量、分析、表达、行动与复盘。",
  progress: 3,
  totalMilestones: 7,
};

const objectives: LearningObjective[] = [
  { id: "obj-question", subject: "语文", label: "提出可调查的问题", successCriteria: "问题清楚、具体，并能通过校园观察回答。" },
  { id: "obj-method", subject: "科学", label: "设计公平的测量方法", successCriteria: "控制时间、位置和测量单位，记录误差来源。" },
  { id: "obj-data", subject: "数学", label: "整理并解释数据", successCriteria: "统一单位，使用表格或图形比较变化。" },
  { id: "obj-explain", subject: "语文", label: "用证据支持结论", successCriteria: "结论、证据、推理和局限完整对应。" },
  { id: "obj-action", subject: "综合实践", label: "设计并验证改进方案", successCriteria: "方案可执行，并用前后数据检验效果。" },
];

const milestones: Milestone[] = [
  { id: "question", projectId: project.id, title: "问题泉", summary: "发现校园用水中的真实问题", subject: "语文", objectiveIds: ["obj-question"], order: 1, status: "active" },
  { id: "method", projectId: project.id, title: "数据温室", summary: "制定可重复的测量方案", subject: "科学", objectiveIds: ["obj-method"], order: 2, status: "available" },
  { id: "observe", projectId: project.id, title: "观察天文台", summary: "记录时间、地点、现象和误差", subject: "科学", objectiveIds: ["obj-method"], order: 3, status: "needs_evidence" },
  { id: "analyse", projectId: project.id, title: "数学梯田", summary: "统一单位并比较用水变化", subject: "数学", objectiveIds: ["obj-data"], order: 4, status: "pending_review" },
  { id: "explain", projectId: project.id, title: "故事树屋", summary: "形成有证据的节水主张", subject: "语文", objectiveIds: ["obj-explain"], order: 5, status: "revise" },
  { id: "act", projectId: project.id, title: "共建水库", summary: "实施方案并复测效果", subject: "综合实践", objectiveIds: ["obj-action"], order: 6, status: "verified" },
  { id: "reflect", projectId: project.id, title: "反思灯塔", summary: "展示成果并说明局限", subject: "综合实践", objectiveIds: ["obj-action", "obj-explain"], order: 7, status: "showcase" },
];

const sceneNodes: SceneNode[] = [
  { id: "node-question", milestoneId: "question", title: "问题泉", shortLabel: "提出问题", status: "active", position: { x: 22, y: 39 }, evidenceCount: 1, nextAction: "补充现场问题" },
  { id: "node-method", milestoneId: "method", title: "数据温室", shortLabel: "测量方案", status: "available", position: { x: 28, y: 18 }, evidenceCount: 0, nextAction: "开始设计方法" },
  { id: "node-observe", milestoneId: "observe", title: "观察天文台", shortLabel: "科学观察", status: "needs_evidence", position: { x: 77, y: 22 }, evidenceCount: 0, nextAction: "记录一条证据" },
  { id: "node-analyse", milestoneId: "analyse", title: "数学田区", shortLabel: "数据分析", status: "pending_review", position: { x: 54, y: 21 }, evidenceCount: 2, nextAction: "等待模拟审核" },
  { id: "node-explain", milestoneId: "explain", title: "故事树屋", shortLabel: "证据表达", status: "revise", position: { x: 24, y: 71 }, evidenceCount: 1, nextAction: "按反馈订正" },
  { id: "node-act", milestoneId: "act", title: "节水田区", shortLabel: "实施验证", status: "verified", position: { x: 52, y: 81 }, evidenceCount: 3, nextAction: "查看验证记录" },
  { id: "node-reflect", milestoneId: "reflect", title: "反思工坊", shortLabel: "成果展示", status: "showcase", position: { x: 79, y: 71 }, evidenceCount: 2, nextAction: "发布成果" },
];

const initialEvidence: Evidence[] = [
  { id: "evidence-question-1", milestoneId: "question", subject: "语文", title: "午休后洗手池仍在滴水", method: "定点观察", finding: "12:40 到 12:50 共观察到 31 次滴水。", source: "教学楼二层观察记录", createdAt: FIXED_TIME },
  { id: "evidence-data-1", milestoneId: "analyse", subject: "数学", title: "一周滴水量换算表", method: "单位换算", finding: "按每滴 0.25 毫升估算，一周约浪费 78.1 升。", source: "小组测量表", createdAt: FIXED_TIME },
  { id: "evidence-data-2", milestoneId: "analyse", subject: "科学", title: "三次重复测量", method: "重复测量", finding: "三次一分钟滴数分别为 42、45、43。", source: "科学观察日志", createdAt: FIXED_TIME },
  { id: "evidence-explain-1", milestoneId: "explain", subject: "语文", title: "维修优先级访谈", method: "半结构访谈", finding: "后勤老师建议先报告持续滴漏超过一天的水龙头。", source: "后勤访谈纪要", createdAt: FIXED_TIME },
];

function seedSnapshot(): ManorExperienceSnapshot {
  return {
    project: { ...project },
    objectives: structuredClone(objectives),
    milestones: structuredClone(milestones),
    sceneNodes: structuredClone(sceneNodes),
    evidence: structuredClone(initialEvidence),
    links: [{
      id: "link-data-1",
      evidenceId: "evidence-data-1",
      objectiveId: "obj-data",
      milestoneId: "analyse",
      relation: "supports",
      sharedProblem: project.drivingQuestion,
      reason: "统一单位后的估算支持判断滴漏问题的实际规模。",
    }],
    claims: [{
      id: "claim-explain-1",
      milestoneId: "explain",
      conclusion: "应优先维修持续滴漏的水龙头。",
      evidenceIds: ["evidence-explain-1"],
      reasoning: "持续滴漏可被稳定观察，且后勤流程允许优先报告。",
      limitation: "目前只有一次访谈，需要补充维修前后的数据比较。",
      revision: 1,
      status: "revise",
    }],
    decisions: [{
      id: "decision-explain-1",
      claimId: "claim-explain-1",
      status: "revise",
      reason: "请补充一条测量证据，并说明估算误差。",
      rubric: "claim-evidence-reasoning-limit-v1",
      decidedAt: FIXED_TIME,
    }],
    artifacts: [],
    reflections: [],
  };
}

function cloneSnapshot(snapshot: ManorExperienceSnapshot) {
  return structuredClone(snapshot);
}

export function validateEvidenceLink(input: LinkEvidenceInput, snapshot: ManorExperienceSnapshot) {
  const errors: Record<string, string> = {};
  const evidence = snapshot.evidence.find((item) => item.id === input.evidenceId);
  const objective = snapshot.objectives.find((item) => item.id === input.objectiveId);
  const milestone = snapshot.milestones.find((item) => item.id === input.milestoneId);
  if (!evidence) errors.evidenceId = "请选择已经记录的证据。";
  if (!objective) errors.objectiveId = "请选择明确的学习目标。";
  if (!milestone) errors.milestoneId = "请选择项目里程碑。";
  if (!RELATIONS.includes(input.relation)) errors.relation = "请选择证据关系。";
  if (input.sharedProblem.trim() !== snapshot.project.drivingQuestion) errors.sharedProblem = "跨学科关联必须回到同一个项目问题。";
  if (input.reason.trim().length < 12) errors.reason = "请说明证据怎样支持方法、背景、反例或结论，不能只写主题相似。";
  if (snapshot.links.some((item) => item.evidenceId === input.evidenceId && item.objectiveId === input.objectiveId && item.milestoneId === input.milestoneId && item.relation === input.relation)) {
    errors.evidenceId = "这条证据关系已经存在，无需重复关联。";
  }
  if (objective && evidence && objective.subject !== evidence.subject && !/(测量|数据|观察|访谈|单位|变化|误差|结论)/.test(input.reason)) {
    errors.reason = "跨学科关联需要指出共享证据、测量方法或推理作用。";
  }
  return errors;
}

export function validateClaim(input: SubmitClaimInput, snapshot: ManorExperienceSnapshot) {
  const errors: Record<string, string> = {};
  if (!snapshot.milestones.some((item) => item.id === input.milestoneId)) errors.milestoneId = "请选择有效里程碑。";
  if (input.conclusion.trim().length < 8) errors.conclusion = "结论需要清楚回答项目问题。";
  if (input.evidenceIds.length === 0 || input.evidenceIds.some((id) => !snapshot.evidence.some((item) => item.id === id))) errors.evidenceIds = "至少选择一条有效证据。";
  if (input.reasoning.trim().length < 16) errors.reasoning = "请解释证据为什么能够支持结论。";
  if (input.limitation.trim().length < 12) errors.limitation = "请说明样本、方法或估算中的局限。";
  return errors;
}

export function createMockManorExperienceAdapter(options: { scenario?: ManorScenario; delayMs?: number } = {}): ManorExperienceAdapter {
  const scenario = options.scenario ?? "normal";
  const delayMs = options.delayMs ?? (scenario === "loading" ? 1_200 : 520);
  let snapshot = seedSnapshot();
  let stateVersion = 1;
  let sequence = 0;

  if (scenario === "empty") {
    snapshot.evidence = [];
    snapshot.links = [];
    snapshot.claims = [];
    snapshot.decisions = [];
    snapshot.artifacts = [];
    snapshot.sceneNodes = snapshot.sceneNodes.map((node, index) => ({ ...node, evidenceCount: 0, status: index === 0 ? "active" : "available" }));
  }

  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  const operationId = (kind: string) => `mock-${kind}-${String(++sequence).padStart(3, "0")}`;

  function blocked<T>(kind: string): ActionResult<T> | null {
    if (scenario === "rejected_bootstrap" && kind === "bootstrap") throw new Error("Mock bootstrap promise rejected.");
    if (scenario === "rejected_operation" && kind !== "bootstrap") throw new Error("Mock operation promise rejected.");
    const status: ActionStatus | null = scenario === "failure" ? "error" : scenario === "conflict" ? "conflict" : scenario === "offline" ? "offline" : scenario === "disabled" ? "disabled" : null;
    if (!status) return null;
    const operation = operationId(kind);
    const messages: Record<ActionStatus, string> = {
      success: "操作成功。",
      validation_error: "请补全信息。",
      conflict: "场景状态已变化，请核对最新状态后重试。",
      offline: "当前处于离线演练，内容未提交。",
      disabled: "此操作在当前演练状态中不可用。",
      error: "模拟服务暂时没有返回正确结果，请重试。",
    };
    return { operationId: operation, stateVersion, status, message: messages[status], authoritativeEntity: null, snapshot: cloneSnapshot(snapshot), nextActions: ["重试", "查看当前状态"] };
  }

  async function mutate<T>(kind: string, mutation: (operation: string) => { entity: T; message: string; nextActions: string[] } | { errors: Record<string, string> }): Promise<ActionResult<T>> {
    await wait();
    const denied = blocked<T>(kind);
    if (denied) return denied;
    const operation = operationId(kind);
    const original = snapshot;
    snapshot = cloneSnapshot(snapshot);
    const outcome = mutation(operation);
    if ("errors" in outcome) {
      snapshot = original;
      return { operationId: operation, stateVersion, status: "validation_error", message: "证据链仍有缺口，请按提示补全。", authoritativeEntity: null, snapshot: cloneSnapshot(original), nextActions: ["修正表单"], fieldErrors: outcome.errors };
    }
    stateVersion += 1;
    return { operationId: operation, stateVersion, status: "success", message: outcome.message, authoritativeEntity: structuredClone(outcome.entity), snapshot: cloneSnapshot(snapshot), nextActions: outcome.nextActions };
  }

  return {
    async bootstrap() {
      await wait();
      const denied = blocked<ManorExperienceSnapshot>("bootstrap");
      if (denied) return denied;
      return { operationId: operationId("bootstrap"), stateVersion, status: "success", message: "学习庄园已准备好。", authoritativeEntity: cloneSnapshot(snapshot), snapshot: cloneSnapshot(snapshot), nextActions: ["查看当前项目", "记录新证据"] };
    },

    recordEvidence(input) {
      return mutate<Evidence>("record", () => {
        const errors: Record<string, string> = {};
        if (!snapshot.milestones.some((item) => item.id === input.milestoneId)) errors.milestoneId = "请选择场景节点。";
        if (input.title.trim().length < 4) errors.title = "请写清证据标题。";
        if (input.method.trim().length < 4) errors.method = "请说明观察或测量方法。";
        if (input.finding.trim().length < 10) errors.finding = "请记录具体数字、现象或原话。";
        if (input.source.trim().length < 4) errors.source = "请注明证据来源。";
        if (Object.keys(errors).length) return { errors };
        const evidence: Evidence = { ...input, id: `evidence-${String(snapshot.evidence.length + 1).padStart(3, "0")}`, createdAt: FIXED_TIME };
        const draft = snapshot as ManorExperienceSnapshot;
        draft.evidence.push(evidence);
        const node = draft.sceneNodes.find((item) => item.milestoneId === input.milestoneId);
        if (node) {
          node.evidenceCount += 1;
          if (node.status !== "verified" && node.status !== "showcase") {
            node.status = "active";
            node.nextAction = "关联学习目标";
          }
        }
        return { entity: evidence, message: "证据已记录，并进入待关联状态。", nextActions: ["关联学习目标", "继续观察"] };
      });
    },

    linkEvidence(input) {
      return mutate<EvidenceLink>("link", () => {
        const errors = validateEvidenceLink(input, snapshot);
        if (Object.keys(errors).length) return { errors };
        const link: EvidenceLink = { ...input, id: `link-${String(snapshot.links.length + 1).padStart(3, "0")}` };
        const draft = snapshot as ManorExperienceSnapshot;
        draft.links.push(link);
        const node = draft.sceneNodes.find((item) => item.milestoneId === input.milestoneId);
        if (node) { node.status = "active"; node.nextAction = "形成主张"; }
        return { entity: link, message: "证据已与目标建立可解释关联。", nextActions: ["形成主张", "查看证据链"] };
      });
    },

    submitClaim(input) {
      return mutate<Claim>("claim", () => {
        const errors = validateClaim(input, snapshot);
        if (Object.keys(errors).length) return { errors };
        const claim: Claim = { ...input, id: `claim-${String(snapshot.claims.length + 1).padStart(3, "0")}`, revision: 1, status: "revise" };
        const draft = snapshot as ManorExperienceSnapshot;
        draft.claims.push(claim);
        draft.decisions.push({ id: `decision-${String(draft.decisions.length + 1).padStart(3, "0")}`, claimId: claim.id, status: "revise", reason: "主张结构完整。请再补充一条不同方法的证据，并说明估算误差。", rubric: "claim-evidence-reasoning-limit-v1", decidedAt: FIXED_TIME });
        const node = draft.sceneNodes.find((item) => item.milestoneId === input.milestoneId);
        if (node) { node.status = "revise"; node.nextAction = "按审核意见订正"; }
        return { entity: claim, message: "模拟审核已返回订正建议，尚未判定通过。", nextActions: ["查看审核意见", "订正主张"] };
      });
    },

    reviseClaim(input) {
      return mutate<Claim>("revise", () => {
        const errors = validateClaim(input, snapshot);
        const existing = snapshot.claims.find((item) => item.id === input.claimId);
        if (!existing) errors.claimId = "没有找到需要订正的主张。";
        if (existing && input.milestoneId !== existing.milestoneId) errors.milestoneId = "主张所属里程碑不能在订正时更改。";
        if (Object.keys(errors).length) return { errors };
        const draft = snapshot as ManorExperienceSnapshot;
        const claim = draft.claims.find((item) => item.id === input.claimId)!;
        Object.assign(claim, {
          conclusion: input.conclusion,
          evidenceIds: [...input.evidenceIds],
          reasoning: input.reasoning,
          limitation: input.limitation,
          revision: claim.revision + 1,
          status: "accepted" as const,
        });
        draft.decisions.push({ id: `decision-${String(draft.decisions.length + 1).padStart(3, "0")}`, claimId: claim.id, status: "accepted", reason: "证据来源互补，推理与局限说明完整，可以进入成果展示。", rubric: "claim-evidence-reasoning-limit-v1", decidedAt: FIXED_TIME });
        const node = draft.sceneNodes.find((item) => item.milestoneId === claim.milestoneId);
        if (node) { node.status = "verified"; node.nextAction = "发布成果"; }
        return { entity: claim, message: "订正通过，场景节点已更新为已验证。", nextActions: ["发布成果", "写下反思"] };
      });
    },

    publishArtifact(input) {
      return mutate<Artifact>("publish", () => {
        const errors: Record<string, string> = {};
        const claim = snapshot.claims.find((item) => item.id === input.claimId);
        if (!claim || claim.status !== "accepted") errors.claimId = "只有通过审核的主张才能展示。";
        if (input.title.trim().length < 4) errors.title = "请填写成果标题。";
        if (input.summary.trim().length < 12) errors.summary = "请用一句完整的话说明成果价值。";
        if (input.reflection.trim().length < 12) errors.reflection = "请说明本次证据链最可靠之处和仍需改进之处。";
        if (Object.keys(errors).length) return { errors };
        const artifact: Artifact = { claimId: input.claimId, title: input.title, summary: input.summary, visibility: input.visibility, id: `artifact-${String(snapshot.artifacts.length + 1).padStart(3, "0")}`, publishedAt: FIXED_TIME };
        const draft = snapshot as ManorExperienceSnapshot;
        draft.artifacts.push(artifact);
        draft.reflections.push({ id: `reflection-${String(draft.reflections.length + 1).padStart(3, "0")}`, milestoneId: claim!.milestoneId, text: input.reflection, createdAt: FIXED_TIME });
        const node = draft.sceneNodes.find((item) => item.milestoneId === claim!.milestoneId);
        if (node) { node.status = "showcase"; node.nextAction = "查看展示成果"; }
        return { entity: artifact, message: "成果与反思已加入班级作品展，未发送到任何外部服务。", nextActions: ["查看作品展", "回看完整证据链"] };
      });
    },
  };
}

export function sceneStatusLabel(status: SceneNodeStatus) {
  return ({ available: "可开始", active: "进行中", needs_evidence: "待补证", pending_review: "待审核", revise: "需订正", verified: "已验证", showcase: "可展示" } satisfies Record<SceneNodeStatus, string>)[status];
}

export const MANOR_SCENARIO_LABELS: Record<ManorScenario, string> = {
  normal: "正常演练",
  loading: "慢速加载",
  empty: "空状态",
  failure: "失败状态",
  conflict: "版本冲突",
  offline: "离线状态",
  disabled: "禁用状态",
  rejected_bootstrap: "启动异常",
  rejected_operation: "操作异常",
};
