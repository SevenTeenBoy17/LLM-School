import type { ManorAssignment, ManorLearningSource, ManorProjectRun, SaveManorProjectInput } from "@/lib/manor/v7-learning-contracts";
import type { ManorSceneSnapshot } from "@/lib/manor/v7-scene-contracts";

export type MissionSubject = string;

export interface LearningMission {
  id: string;
  objectiveId: string;
  subject: MissionSubject;
  title: string;
  durationMinutes: number;
  question: string;
  prompt: string;
  choices: Array<{ id: "A" | "B" | "C"; text: string }>;
  reward: number;
  gradeBand?: string;
  projectTitle?: string;
  drivingQuestion?: string;
  contribution?: string;
  sourceLabel?: string;
  source?: { kind: string; label: string; dataKind?: string; teacherPublished?: boolean };
  projectId?: string | null;
  assignmentId?: string;
  assignmentVersion?: number;
  datasetVersion?: string;
  resourceVersion?: string;
}

export interface ManorGrant {
  id: string;
  evidenceId: string;
  units: number;
  remainingUnits: number;
  allowedPurposes: string[];
  status: string;
}

export interface EvidenceResult {
  correct: boolean;
  title: string;
  explanation: string;
  reward: number;
  evidenceId: string;
  evidenceRevision: number;
  rewardClass: string;
  grant: ManorGrant | null;
}

export interface ReviewItem {
  id: string;
  evidenceId: string;
  missionId: string;
  title?: string;
  dueAt: number;
  dueLabel?: string;
  strategy: string;
  status: string;
  revision?: number;
  question?: Pick<LearningMission, "question" | "prompt" | "choices">;
  completedAt?: number | null;
  lastAnswer?: string | null;
  feedback?: { correct: boolean; explanation: string } | null;
}

export type MissionPhase = "evidence" | "outcome" | "reflection" | "summary";

export interface TaskRun {
  id: string;
  missionId: string;
  phase: MissionPhase;
  answer: string;
  reflection: string;
  evidenceId: string | null;
  artifactId?: string | null;
  revision: number;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number | null;
}

export interface ManorEvidence extends Partial<ManorLearningSource> {
  id: string;
  missionId: string;
  taskRunId?: string | null;
  status: string;
  rewardClass: string;
  revision: number;
  evidenceType?: string;
  missionTitle?: string;
  submission?: { content?: string; choice?: string } | null;
  attempts?: Array<{ sequence?: number; submission?: { content?: string; choice?: string }; submittedAt?: number }>;
  feedback?: { reason: string; status: string; version: number; evaluatorType?: string } | null;
}

export interface ManorArtifact extends Partial<ManorLearningSource> {
  id: string;
  taskRunId?: string | null;
  evidenceId?: string;
  artifactType: string;
  title: string;
  content: string;
  status?: string;
  revision?: number;
  acceptedRevision?: number | null;
  sourceUrl?: string;
}

export interface PortfolioItem extends Partial<ManorLearningSource> {
  id: string;
  taskRunId?: string | null;
  evidenceId?: string;
  artifactType?: string;
  title: string;
  detail: string;
  content?: string;
  subject: MissionSubject;
  status?: string;
  revision?: number;
  sourceUrl?: string;
}

export interface ManorBootstrap {
  scene?: ManorSceneSnapshot;
  schemaVersion: "manor.v2";
  stateVersion: number;
  subject: { id: string; name: string; department: string; gradeBand?: string | null };
  daily: { day: number; completed: boolean };
  profile: { quietUntil: number | null; endedAt: number | null; revision: number };
  missions: LearningMission[];
  sampleMissions?: LearningMission[];
  assignments?: ManorAssignment[];
  projects?: ManorProjectRun[];
  plots: Array<{ id: number; unlocked: boolean; status: string; cropId: string | null; stage: number; revision: number; evidenceId: string | null }>;
  resources: { growthEnergy: number; points: number; harvestedTotal: number; harvests: Record<string, number> };
  inventory: Array<{ partId: string }>;
  neighbors: Array<{ id: string; name: string }>;
  classBuild: { raised: number; cost: number; done: boolean; title?: string } | null;
  reviews: ReviewItem[];
  artifacts: ManorArtifact[];
  grants: ManorGrant[];
  evidence: ManorEvidence[];
  taskRuns?: TaskRun[];
  taskRunHistory?: Array<TaskRun & { archivedAt?: number }>;
  cropAccess?: Array<{ id: string; unlocked: boolean; source?: string; progress?: number; need?: number }>;
  policy?: { unlockedPlotCount?: number; plotCount?: number; maxStage?: number; version?: string; plotUnlock?: { kind: string } };
  harvestHistory?: Array<{ id: string; cropId: string; plotId: number; evidenceId: string | null; harvestedAt: number }>;
}

export class ManorApiError extends Error {
  code: string;
  status: number;
  authoritative?: unknown;
  operationId?: string;

  constructor(code: string, message: string, status: number, authoritative?: unknown) {
    super(message);
    this.name = "ManorApiError";
    this.code = code;
    this.status = status;
    this.authoritative = authoritative;
  }
}

const inMemoryOperations = new Map<string, string>();

async function pendingOperationId(subjectId: string, url: string, payload: Record<string, unknown>) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hash = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  const key = `eduai.manor.pending.v6.${encodeURIComponent(subjectId)}.${hash}`;
  let stored = inMemoryOperations.get(key);
  try { stored ??= globalThis.sessionStorage?.getItem(key) ?? undefined; } catch { /* storage can be disabled */ }
  let previous: { value: string; payload: Record<string, unknown> } | undefined;
  try {
    const parsed = stored ? JSON.parse(stored) : null;
    if (typeof parsed?.value === "string" && parsed.payload && typeof parsed.payload === "object") previous = parsed;
  } catch { /* Ignore a malformed record without using its identity. */ }
  const pending = previous ?? { value: `manor-${globalThis.crypto.randomUUID()}`, payload };
  if (!previous) {
    const serialized = JSON.stringify(pending);
    inMemoryOperations.set(key, serialized);
    try { globalThis.sessionStorage?.setItem(key, serialized); } catch { /* memory fallback remains active */ }
  }
  return { key, ...pending, existing: Boolean(previous), changed: JSON.stringify(pending.payload) !== JSON.stringify(payload) };
}

function clearPendingOperation(key: string) {
  inMemoryOperations.delete(key);
  try { globalThis.sessionStorage?.removeItem(key); } catch { /* no-op */ }
}

async function apiJson<T>(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Bound both headers and body reads, including a transport that ignores abort.
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ManorApiError("REQUEST_TIMEOUT", "连接超时，正在确认保存结果。", 408));
    }, timeoutMs);
  });
  try {
    return await Promise.race([timeout, (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal, headers: { "content-type": "application/json", ...init.headers } });
      const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; authoritative?: unknown }; authoritative?: unknown } | null;
      if (!response.ok) throw new ManorApiError(body?.error?.code ?? "REQUEST_FAILED", body?.error?.message ?? "服务暂时不可用。", response.status, body?.error?.authoritative ?? body?.authoritative);
      if (!body || typeof body !== "object") throw new ManorApiError("INVALID_RESPONSE", "保存回执无法读取。", 502);
      return body as T;
    })()]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function reviewQueueState(review: ReviewItem, now = Date.now()): "scheduled" | "due" | "completed" {
  if (review.status === "completed" || review.completedAt != null) return "completed";
  return review.dueAt <= now ? "due" : "scheduled";
}

export function evidenceStatusLabel(status: string): string {
  return ({ pending_review: "待老师反馈", revise: "需要修订", accepted_mastery: "已接受", accepted_correction: "订正已记录", accepted_practice: "练习已完成", draft: "草稿", saved: "已保存", archived: "已入册", needs_support: "继续尝试" } as Record<string, string>)[status] ?? "已记录";
}

export function portfolioFromArtifact(artifact: ManorArtifact, evidence: readonly ManorEvidence[], missions: readonly LearningMission[]): PortfolioItem {
  const source = evidence.find((item) => item.id === artifact.evidenceId);
  return { ...artifact, taskRunId: artifact.taskRunId ?? source?.taskRunId, detail: artifact.content, subject: missions.find((item) => item.id === source?.missionId)?.subject ?? "未关联学科" };
}

export function expressionForTaskRun(evidence: readonly ManorEvidence[], missionId: string, taskRunId?: string): ManorEvidence | undefined {
  if (!taskRunId) return undefined;
  return evidence.filter((item) => item.missionId === missionId && item.taskRunId === taskRunId && item.evidenceType === "expression")
    .sort((a, b) => b.revision - a.revision)[0];
}

export function eligibleGrants(grants: readonly ManorGrant[], purpose: string, amount: number, evidenceId?: string): ManorGrant[] {
  return grants.filter((grant) => ["available", "partially_consumed"].includes(grant.status) && grant.remainingUnits >= amount && grant.allowedPurposes.includes(purpose) && (!evidenceId || grant.evidenceId === evidenceId));
}

export function allocateManorGrants(grants: readonly ManorGrant[], purposes: readonly string[], amount: number, evidenceId?: string): Array<{ grantId: string; amount: number }> | null {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const allocations: Array<{ grantId: string; amount: number }> = [];
  const seen = new Set<string>();
  let remaining = amount;
  for (const grant of grants) {
    if (seen.has(grant.id) || !["available", "partially_consumed"].includes(grant.status) || !Number.isSafeInteger(grant.remainingUnits) || grant.remainingUnits <= 0 || !purposes.some((purpose) => grant.allowedPurposes.includes(purpose)) || (evidenceId && grant.evidenceId !== evidenceId)) continue;
    seen.add(grant.id);
    const used = Math.min(remaining, grant.remainingUnits);
    allocations.push({ grantId: grant.id, amount: used });
    remaining -= used;
    if (remaining === 0) return allocations;
  }
  return null;
}

export interface ManorLearningRepository {
  bootstrap(): Promise<ManorBootstrap>;
  projects(): Promise<{ projects: ManorProjectRun[] }>;
  saveProject(id: string, input: Omit<SaveManorProjectInput, "operationId">): Promise<{ project: ManorProjectRun }>;
  evaluateEvidence(missionId: string, answer: string): Promise<EvidenceResult>;
  scheduleReview(evidenceId: string, strategy: string): Promise<ReviewItem>;
  saveTaskRun(input: { missionId: string; phase: MissionPhase; answer?: string; reflection?: string; evidenceId?: string; expectedRevision: number; restart?: boolean }): Promise<TaskRun>;
  submitExpression(input: { missionId: string; taskRunId: string; content: string; evidenceId?: string; expectedRevision?: number }): Promise<{ evidence: ManorEvidence }>;
  reviewAction(id: string, input: { action: "complete" | "defer"; answer?: string; strategy?: string; expectedRevision: number }): Promise<{ review: ReviewItem; feedback?: ReviewItem["feedback"] }>;
  contributeToClass(amount: number, grantId: string | Array<{ grantId: string; amount: number }>): Promise<{ accepted: number; message: string; growthEnergy: number; progress: number }>;
  saveArtifact(input: { artifactId?: string; expectedRevision?: number; taskRunId?: string; evidenceId?: string; grantId?: string; artifactType: "explanation" | "observation"; title: string; content: string }): Promise<{ item: PortfolioItem; growthEnergy: number }>;
  endSession(expectedRevision: number): Promise<{ quietUntil: number; revision: number }>;
  plotAction(plotId: number, input: { action: "plant" | "plant_and_nurture" | "nurture" | "harvest" | "clear"; expectedRevision: number; cropId?: string; grantId?: string; amount?: number; grantAllocations?: Array<{ grantId: string; amount: number }> }): Promise<{ plot: ManorBootstrap["plots"][number]; growthEnergy: number }>;
}

export type ManorLearningOperation = "bootstrap" | "projects" | "saveProject" | "evaluateEvidence" | "scheduleReview" | "contributeToClass" | "saveArtifact" | "endSession" | "plotAction" | "saveTaskRun" | "submitExpression" | "reviewAction";

export interface ManorLearningRepositoryOptions {
  failOperations?: readonly ManorLearningOperation[];
  subjectId?: string;
  timeoutMs?: number;
}

export function createManorLearningRepository(options: ManorLearningRepositoryOptions = {}): ManorLearningRepository {
  let subjectId = options.subjectId;
  let snapshot: ManorBootstrap | undefined;
  const read = <T>(url: string, init?: RequestInit) => apiJson<T>(url, init, options.timeoutMs);
  const readBootstrap = async () => {
    const latest = await read<ManorBootstrap>("/api/v2/manor/bootstrap", { cache: "no-store" });
    if (subjectId && subjectId !== latest.subject.id) throw new ManorApiError("OWNER_CHANGED", "当前账号已变更，请重新打开庄园。", 403);
    snapshot = latest;
    subjectId = snapshot.subject.id;
    return snapshot;
  };
  const receipt = <T>(id: string) => read<{ status: string; result?: T }>(`/api/v2/manor/operations/${encodeURIComponent(id)}`, { cache: "no-store" });
  const mutationJson = async <T>(url: string, _prefix: string, payload: Record<string, unknown>): Promise<T> => {
    if (!subjectId) await readBootstrap();
    if (!subjectId) throw new ManorApiError("AUTH_REQUIRED", "请重新登录后继续，输入仍保留。", 401);
    const pending = await pendingOperationId(subjectId, url, payload);
    const confirmedResult = (result: T) => {
      if (pending.changed) throw new ManorApiError("PREVIOUS_OPERATION_COMMITTED", "上一次操作已经保存。请核对刷新后的记录，再提交本次修改；当前输入仍保留。", 409, result);
      return result;
    };
    const recover = async () => {
      try {
        const found = await receipt<T>(pending.value);
        if (found.status === "committed" && found.result != null) {
          clearPendingOperation(pending.key);
          return { recovered: true as const, result: found.result };
        }
      } catch { /* A missing receipt never proves that a mutation was not committed. */ }
      return { recovered: false as const };
    };
    if (pending.existing) {
      const found = await recover();
      if (found.recovered) return confirmedResult(found.result);
    }
    try {
      // Finish an uncertain operation with its original body before accepting edits.
      const result = await read<T>(url, { method: "POST", body: JSON.stringify({ operationId: pending.value, ...pending.payload }) });
      clearPendingOperation(pending.key);
      return confirmedResult(result);
    } catch (error) {
      if (error instanceof ManorApiError && error.code === "PREVIOUS_OPERATION_COMMITTED") throw error;
      const definitive = error instanceof ManorApiError && error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
      // Manor CAS checks run after the transaction's replay lookup, so this response proves no prior commit for this id.
      const rejectedAfterReplay = error instanceof ManorApiError && error.code === "MANOR_REVISION_CONFLICT" && error.status === 409 && error.authoritative != null;
      // A rejection of this retry says nothing about a previous request whose result was lost.
      if (definitive && (!pending.existing || rejectedAfterReplay)) { clearPendingOperation(pending.key); throw error; }
      const found = await recover();
      if (found.recovered) return confirmedResult(found.result);
      if (definitive) { error.operationId = pending.value; throw error; }
      const unknown = new ManorApiError("OPERATION_UNKNOWN", "暂时无法确认保存结果。输入已保留，重试会先核对原操作。", 0);
      unknown.operationId = pending.value;
      throw unknown;
    }
  };
  const guard = (operation: ManorLearningOperation) => {
    if (options.failOperations?.includes(operation)) throw new ManorApiError("SIMULATED_FAILURE", "测试故障已触发。", 503);
  };
  return {
    async projects() {
      guard("projects");
      return read<{ projects: ManorProjectRun[] }>("/api/v2/manor/projects", { cache: "no-store" });
    },
    async saveProject(id, input) {
      guard("saveProject");
      return mutationJson<{ project: ManorProjectRun }>(`/api/v2/manor/projects/${encodeURIComponent(id)}`, "project", input);
    },
    async bootstrap() {
      guard("bootstrap");
      return readBootstrap();
    },
    async evaluateEvidence(missionId, answer) {
      guard("evaluateEvidence");
      const result = await mutationJson<{ evidence: { id: string; revision: number; rewardClass: string }; grant: ManorGrant | null; feedback: { correct: boolean; title: string; explanation: string; reward: number } }>("/api/v2/manor/evidence", "evidence", { missionId, answer, hintsUsed: [], accommodationCodes: [] });
      return { ...result.feedback, evidenceId: result.evidence.id, evidenceRevision: result.evidence.revision, rewardClass: result.evidence.rewardClass, grant: result.grant };
    },
    async scheduleReview(evidenceId, strategy) {
      guard("scheduleReview");
      const result = await mutationJson<{ review: ReviewItem }>("/api/v2/manor/reviews", "review", { evidenceId, strategy, window: "tomorrow" });
      return result.review;
    },
    async saveTaskRun(input) {
      guard("saveTaskRun");
      return (await mutationJson<{ taskRun: TaskRun }>("/api/v2/manor/task-runs", "task-run", input)).taskRun;
    },
    async submitExpression(input) {
      guard("submitExpression");
      return mutationJson<{ evidence: ManorEvidence }>("/api/v2/manor/evidence", "expression", { evidenceType: "expression", ...input, hintsUsed: [], accommodationCodes: [] });
    },
    async reviewAction(id, input) {
      guard("reviewAction");
      return mutationJson<{ review: ReviewItem; feedback?: ReviewItem["feedback"] }>(`/api/v2/manor/reviews/${encodeURIComponent(id)}/actions`, "review-action", input);
    },
    async contributeToClass(amount, grantId) {
      guard("contributeToClass");
      const result = await mutationJson<{ accepted: number; build: { raised: number; cost: number; done: boolean }; resources: { growthEnergy: number } }>("/api/v2/manor/class-build/contributions", "class", { amount, grantAllocations: typeof grantId === "string" ? [{ grantId, amount }] : grantId });
      return { accepted: result.accepted, message: `${result.accepted} 点成长能量已经加入班级树屋。`, growthEnergy: result.resources.growthEnergy, progress: result.build.done ? 100 : Math.round((result.build.raised / Math.max(1, result.build.cost)) * 100) };
    },
    async saveArtifact(input) {
      guard("saveArtifact");
      const result = await mutationJson<{ artifact: ManorArtifact; resources: { growthEnergy: number } }>("/api/v2/manor/artifacts", "artifact", { ...(input.artifactId ? { artifactId: input.artifactId, expectedRevision: input.expectedRevision } : {}), ...(input.taskRunId ? { taskRunId: input.taskRunId } : {}), ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}), artifactType: input.artifactType, title: input.title, content: input.content, visibility: "private" });
      return { item: portfolioFromArtifact(result.artifact, snapshot?.evidence ?? [], [...(snapshot?.missions ?? []), ...(snapshot?.sampleMissions ?? [])]), growthEnergy: result.resources.growthEnergy };
    },
    async endSession(expectedRevision) {
      guard("endSession");
      const result = await mutationJson<{ profile: { quietUntil: number; revision: number } }>("/api/v2/manor/session/end", "session", { expectedRevision });
      return result.profile;
    },
    async plotAction(plotId, input) {
      guard("plotAction");
      const amount = input.amount ?? 8;
      const result = await mutationJson<{ plot: ManorBootstrap["plots"][number]; resources: { growthEnergy: number } }>(`/api/v2/manor/plots/${plotId}/actions`, `plot-${input.action}`, { action: input.action, expectedRevision: input.expectedRevision, ...(input.cropId ? { cropId: input.cropId } : {}), grantAllocations: input.grantAllocations ?? (input.grantId ? [{ grantId: input.grantId, amount }] : []) });
      return { plot: result.plot, growthEnergy: result.resources.growthEnergy };
    },
  };
}

export type LearningEnergyTransactionResult = "committed" | "insufficient" | "unavailable" | "refunded";

export function transactLearningEnergy({
  plotId,
  availablePlotIds,
  amount,
  spendEnergy,
  nurturePlot,
  refundEnergy,
}: {
  plotId: number;
  availablePlotIds: readonly number[];
  amount: number;
  spendEnergy: (amount: number) => boolean;
  nurturePlot: (plotId: number) => boolean;
  refundEnergy: (amount: number) => void;
}): LearningEnergyTransactionResult {
  if (!availablePlotIds.includes(plotId)) return "unavailable";
  if (!spendEnergy(amount)) return "insufficient";
  if (nurturePlot(plotId)) return "committed";
  refundEnergy(amount);
  return "refunded";
}
