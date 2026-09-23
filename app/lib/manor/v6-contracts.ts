export const MANOR_TASK_PHASES = ["evidence", "outcome", "reflection", "summary"] as const;
export type ManorTaskPhase = typeof MANOR_TASK_PHASES[number];

export interface ManorTaskRun {
  id: string;
  missionId: string;
  phase: ManorTaskPhase;
  answer: string;
  reflection: string;
  evidenceId: string | null;
  artifactId: string | null;
  revision: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  assignmentId?: string | null;
  assignmentVersion?: number | null;
  resourceVersion?: string | null;
  datasetVersion?: string | null;
}

export interface SaveManorTaskRunInput {
  operationId: string;
  missionId: string;
  phase: ManorTaskPhase;
  answer?: string;
  reflection?: string;
  evidenceId?: string;
  expectedRevision: number;
  assignmentId?: string;
  restart?: boolean;
}

export interface ManorTaskRunHistory extends ManorTaskRun {
  archivedAt: number;
}

export interface ManorReviewActionInput {
  operationId: string;
  action: "complete" | "defer";
  answer?: string;
  strategy?: string;
  expectedRevision: number;
}

export interface ManorReviewFeedback {
  correct: boolean;
  explanation: string;
}

export interface ManorOperationReceipt<T = unknown> {
  ok: true;
  status: "committed";
  operationId: string;
  result: T;
  createdAt: number;
}
