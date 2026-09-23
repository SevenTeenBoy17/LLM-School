import { MANOR_MISSIONS } from "./missions";

export interface ManorArtifactRecord {
  id: string; evidenceId: string | null; artifactType: string; title: string;
  content: string; visibility: string; revision: number; createdAt: number; updatedAt: number;
  missionId: string | null; evidenceStatus: string | null; evidenceType: string | null;
  evidenceRevision: number | null; answerJson: string | null; teacherFeedback: string | null;
  canonicalArtifactId: string | null; attemptSequence: number | null; reviewedVersion: number | null; reviewedAt: number | null;
  taskRunId?: string | null; acceptedRevision?: number | null; acceptedContentHash?: string | null; acceptedAt?: number | null;
  assignmentId?: string | null; assignmentVersion?: number | null; resourceVersion?: string | null; datasetVersion?: string | null;
  missionSubject?: string | null; projectRunId?: string | null; projectStatus?: string | null; sourcesJson?: string | null;
}

// Both bootstrap and the authorized portfolio reader use exactly the same source and status derivation.
export const MANOR_ARTIFACT_SELECT = `SELECT a.id,a.evidenceId,a.artifactType,a.title,a.content,a.visibility,a.revision,a.createdAt,a.updatedAt,
  a.taskRunId,a.acceptedRevision,a.acceptedContentHash,a.acceptedAt,
  COALESCE(e.assignmentId,r.assignmentId,json_extract(h.runJson,'$.assignmentId'),p.assignmentId) AS assignmentId,
  COALESCE(e.assignmentVersion,r.assignmentVersion,json_extract(h.runJson,'$.assignmentVersion'),pa.assignmentVersion) AS assignmentVersion,
  COALESCE(e.resourceVersion,r.resourceVersion,json_extract(h.runJson,'$.resourceVersion'),pa.resourceVersion) AS resourceVersion,
  COALESCE(e.datasetVersion,r.datasetVersion,json_extract(h.runJson,'$.datasetVersion'),p.datasetVersion) AS datasetVersion,
  COALESCE(e.missionId,r.missionId,h.missionId) AS missionId,json_extract(m.snapshotJson,'$.subject') AS missionSubject,
  p.id AS projectRunId,p.status AS projectStatus,p.contributionsJson AS sourcesJson,
  e.status AS evidenceStatus,e.evidenceType,e.revision AS evidenceRevision,t.answerJson,t.sequence AS attemptSequence,
  (SELECT id FROM learning_artifacts WHERE studentId=a.studentId AND evidenceId=e.id AND artifactType='expression' ORDER BY createdAt,id LIMIT 1) AS canonicalArtifactId,
  decision.reason AS teacherFeedback,decision.version AS reviewedVersion,decision.createdAt AS reviewedAt
  FROM learning_artifacts a LEFT JOIN learning_evidence e ON e.id=a.evidenceId AND e.studentId=a.studentId
  LEFT JOIN manor_task_runs r ON r.id=a.taskRunId AND r.studentId=a.studentId
  LEFT JOIN manor_task_run_history h ON h.id=a.taskRunId AND h.studentId=a.studentId
  LEFT JOIN manor_assignment_missions m ON m.id=COALESCE(e.missionId,r.missionId,h.missionId)
  LEFT JOIN manor_project_runs p ON p.artifactId=a.id AND p.studentId=a.studentId
  LEFT JOIN manor_assignments pa ON pa.id=p.assignmentId
  LEFT JOIN evidence_attempts t ON t.id=e.latestAttemptId AND t.studentId=a.studentId
  LEFT JOIN evidence_decisions decision ON decision.evidenceId=e.id AND decision.version=e.revision
    AND decision.status=e.status AND decision.evaluatorType='teacher' AND decision.evaluatorId=e.evaluatorId
  WHERE a.studentId=? ORDER BY a.updatedAt DESC`;

export function publicManorArtifact(row: ManorArtifactRecord) {
  const { answerJson, canonicalArtifactId, attemptSequence, reviewedVersion, reviewedAt, sourcesJson, missionSubject, ...artifact } = row;
  const submitted = answerJson ? JSON.parse(answerJson) as { content?: string } : null;
  const canonical = row.evidenceType === "expression" && row.artifactType === "expression" && canonicalArtifactId === row.id;
  const archived = row.acceptedRevision != null || canonical && row.evidenceStatus === "accepted_mastery" && reviewedVersion === row.evidenceRevision
    && reviewedAt != null && row.updatedAt <= reviewedAt && row.revision === attemptSequence && submitted?.content === row.content;
  const status = archived ? "archived" : row.projectStatus === "complete" ? "saved" : !row.evidenceId ? "draft" : row.evidenceType === "expression" && row.artifactType === "expression"
    ? row.evidenceStatus === "revise" ? "revise" : row.evidenceStatus === "pending_review" ? "pending_review" : "saved" : "saved";
  return { ...artifact, teacherFeedback: canonical ? artifact.teacherFeedback : null, status, subject: missionSubject ?? MANOR_MISSIONS.find((mission) => mission.id === row.missionId)?.subject ?? null,
    sources: sourcesJson ? JSON.parse(sourcesJson) as Array<{ subject: string; evidenceId: string; artifactId: string }> : [],
    source: "manor" as const, sourceUrl: `/student/manor?artifactId=${encodeURIComponent(row.id)}` };
}
