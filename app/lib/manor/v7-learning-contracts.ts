export const MANOR_GRADE_BANDS = ["lower_primary", "upper_primary", "middle_school"] as const;
export type ManorGradeBand = typeof MANOR_GRADE_BANDS[number];

export interface ManorAssignment {
  id: string;
  title: string;
  classId: string;
  teacherId: string;
  gradeBand: ManorGradeBand;
  assignmentVersion: number;
  resourceVersion: string;
  datasetVersion: string | null;
  missionIds: string[];
  templateIds: string[];
  rewardUnits: number;
  status: "published" | "withdrawn";
  revision: number;
  publishedAt: number;
  studentIds: string[] | null;
  supersedesId: string | null;
}

export interface PublishManorAssignmentInput {
  operationId: string;
  title: string;
  missionIds: string[];
  gradeBand: ManorGradeBand;
  resourceVersion: string;
  datasetVersion?: string;
  rewardUnits?: number;
  studentIds?: string[];
  supersedesId?: string;
}

export interface SaveManorArtifactInput {
  operationId: string;
  artifactId?: string;
  expectedRevision?: number;
  evidenceId?: string;
  taskRunId?: string;
  artifactType: string;
  title: string;
  content: string;
  visibility: "private" | "class";
  grantAllocations?: Array<{ grantId: string; amount: number }>;
}

export interface ManorLearningSource {
  taskRunId: string | null;
  assignmentId: string | null;
  assignmentVersion: number | null;
  resourceVersion: string | null;
  datasetVersion: string | null;
}

export const MANOR_PROJECT_SUBJECTS = ["数学", "科学", "语文"] as const;
export interface ManorProjectContribution {
  subject: typeof MANOR_PROJECT_SUBJECTS[number];
  evidenceId: string;
  artifactId: string;
}
export interface SaveManorProjectInput {
  operationId: string;
  expectedRevision: number;
  datasetVersion: string;
  contributions: ManorProjectContribution[];
  intent?: "draft" | "complete";
  content: string;
}
export interface ManorProjectRun {
  id: string;
  assignmentId: string;
  projectId: string;
  datasetVersion: string;
  status: "incomplete" | "complete";
  completionScope: "required_contributions";
  evaluationStatus: "not_reviewed";
  revision: number;
  requiredSubjects: readonly (typeof MANOR_PROJECT_SUBJECTS[number])[];
  contributions: ManorProjectContribution[];
  draft: { content: string; artifactId: string } | null;
  result: { content: string; artifactId: string; completedAt: number } | null;
}

export interface ManorPlantingCycle {
  id: string;
  plotId: number;
  cropId: string;
  startedAt: number;
  endedAt: number | null;
  status: "active" | "harvested" | "cleared";
  historyComplete: boolean;
  harvestId: string | null;
  actions: Array<{
    id: string; action: string; operationId: string; correlationId: string;
    fromStage: number; toStage: number; createdAt: number;
    allocations: Array<{
      id: string; grantId: string; amount: number; purpose: string;
      evidenceId: string; missionId: string; taskRunId: string | null;
      assignmentId: string | null; resourceVersion: string | null; policyVersion: string;
    }>;
  }>;
}

export interface ManorPlantingCyclePage {
  items: ManorPlantingCycle[];
  nextCursor: string | null;
  hasMore: boolean;
}
