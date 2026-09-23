import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { MANOR_CROP_STAGE_MAX, MANOR_PLOT_COUNT } from "@/lib/gamify";
import { MANOR_MISSIONS, manorReviewQuestion, publicManorMission, type ManorMission } from "@/lib/manor/missions";
import { MANOR_GRADE_BANDS, MANOR_PROJECT_SUBJECTS, type ManorGradeBand, type ManorAssignment, type PublishManorAssignmentInput, type SaveManorArtifactInput, type ManorLearningSource, type ManorPlantingCycle, type ManorPlantingCyclePage, type ManorProjectRun, type SaveManorProjectInput } from "@/lib/manor/v7-learning-contracts";
import { MANOR_TASK_PHASES, type ManorTaskRun, type ManorTaskRunHistory, type SaveManorTaskRunInput, type ManorReviewActionInput, type ManorReviewFeedback, type ManorOperationReceipt } from "@/lib/manor/v6-contracts";
import { MANOR_ARTIFACT_SELECT, publicManorArtifact, type ManorArtifactRecord } from "@/lib/manor/artifacts";
import { manorOpenPlotCount } from "@/lib/server/manorV7Scene";
import {
  classBuildState,
  bjDay,
  manorFarmState,
  manorFarmStateReadOnly,
  manorNeighbors,
  manorState,
  manorStateReadOnly,
  manorV2Database,
} from "@/lib/server/db";

export const MANOR_SCHEMA_VERSION = "manor.v2";
const MANOR_POLICY_VERSION = "manor-policy-2026.09-v7";
const MANOR_RUBRIC_VERSION = "objective-choice-v1";

export type ManorPlotStatus = "locked" | "empty" | "planted" | "review_due" | "needs_support" | "ready";

interface ManorProfileRow {
  studentId: string;
  preferencesJson: string;
  weeklyGoal: number;
  personalized: number;
  quietUntil: number | null;
  endedAt: number | null;
  revision: number;
  stateVersion: number;
  updatedAt: number;
}

function ensureProfile(studentId: string): ManorProfileRow {
  const database = manorV2Database();
  database.prepare(`INSERT OR IGNORE INTO manor_profiles
    (studentId,preferencesJson,weeklyGoal,personalized,quietUntil,endedAt,revision,stateVersion,updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(studentId, "[]", 3, 1, null, null, 1, 1, Date.now());
  return database.prepare("SELECT * FROM manor_profiles WHERE studentId = ?").get(studentId) as unknown as ManorProfileRow;
}

export function manorQuietUntil(studentId: string): number | null {
  const quietUntil = ensureProfile(studentId).quietUntil;
  return quietUntil && quietUntil > Date.now() ? quietUntil : null;
}

function nextBeijingDayStart(now: number) {
  const beijingNow = new Date(now + 8 * 60 * 60 * 1000);
  return Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate() + 1,
  ) - 8 * 60 * 60 * 1000;
}

function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

interface LearningUser { id: string; name: string; role: string; classId: string | null; stage: string }
function learningUser(userId: string) {
  return manorV2Database().prepare("SELECT id,name,role,classId,stage FROM users WHERE id=?").get(userId) as unknown as LearningUser | undefined;
}

export function manorCanonicalGrade(studentId: string): ManorGradeBand | null {
  const user = learningUser(studentId);
  if (!user || user.role !== "student") return null;
  if (user.stage === "junior" || user.stage === "middle_school") return "middle_school";
  if (user.stage === "lower_primary" || user.stage === "upper_primary") return user.stage;
  if (user.stage !== "primary") return null;
  const row = manorV2Database().prepare("SELECT gradeBand FROM manor_student_grades WHERE studentId=? AND classId=?")
    .get(studentId, user.classId) as { gradeBand: ManorGradeBand } | undefined;
  return row?.gradeBand === "lower_primary" || row?.gradeBand === "upper_primary" ? row.gradeBand : null;
}

type AssignmentRow = Omit<ManorAssignment, "missionIds" | "templateIds" | "studentIds"> & { studentIdsJson: string | null };
function publicAssignment(row: AssignmentRow): ManorAssignment {
  const { studentIdsJson, ...assignment } = row;
  const missions = manorV2Database().prepare("SELECT id,templateId FROM manor_assignment_missions WHERE assignmentId=? ORDER BY rowid")
    .all(row.id) as Array<{ id: string; templateId: string }>;
  return { ...assignment, missionIds: missions.map((item) => item.id), templateIds: missions.map((item) => item.templateId),
    studentIds: studentIdsJson ? JSON.parse(studentIdsJson) as string[] : null };
}

function assignmentAccessible(studentId: string, assignmentId: string) {
  const user = learningUser(studentId);
  if (!user || user.role !== "student" || !user.classId) return undefined;
  const row = manorV2Database().prepare(`SELECT a.* FROM manor_assignments a JOIN users t ON t.id=a.teacherId
    WHERE a.id=? AND a.classId=? AND a.status='published' AND t.role='teacher' AND t.classId=a.classId`)
    .get(assignmentId, user.classId) as unknown as AssignmentRow | undefined;
  if (!row || row.gradeBand !== manorCanonicalGrade(studentId)) return undefined;
  if (row.studentIdsJson && !(JSON.parse(row.studentIdsJson) as string[]).includes(studentId)) return undefined;
  return row;
}

function findManorMission(missionId: string): ManorMission | undefined {
  const sample = MANOR_MISSIONS.find((item) => item.id === missionId);
  if (sample) return { ...sample, reward: 0, resourceVersion: "manor-template-v7.1", datasetVersion: sample.projectId ? "water-simulated-v1" : undefined };
  const row = manorV2Database().prepare("SELECT snapshotJson FROM manor_assignment_missions WHERE id=?").get(missionId) as { snapshotJson: string } | undefined;
  return row ? JSON.parse(row.snapshotJson) as ManorMission : undefined;
}

function accessibleMission(studentId: string, missionId: string) {
  const user = learningUser(studentId);
  const mission = findManorMission(missionId);
  if (!user || user.role !== "student" || !mission) return undefined;
  return !mission.assignmentId || assignmentAccessible(studentId, mission.assignmentId) ? mission : undefined;
}

export function readManorAssignments(studentId: string) {
  const user = learningUser(studentId);
  const rows = user?.classId ? manorV2Database().prepare("SELECT * FROM manor_assignments WHERE classId=? AND status='published' ORDER BY publishedAt DESC")
    .all(user.classId) as unknown as AssignmentRow[] : [];
  const assignments = rows.filter((row) => assignmentAccessible(studentId, row.id)).map(publicAssignment);
  return { assignments, missions: assignments.flatMap((assignment) => assignment.missionIds.map((missionId) => publicManorMission(findManorMission(missionId)!))),
    sampleMissions: MANOR_MISSIONS.map(publicManorMission) };
}

export function teacherManorAssignments(teacherId: string) {
  const teacher = learningUser(teacherId);
  if (!teacher || teacher.role !== "teacher" || !teacher.classId) return null;
  const database = manorV2Database();
  const students = (database.prepare("SELECT id,name FROM users WHERE role='student' AND classId=? ORDER BY name,id").all(teacher.classId) as Array<{ id: string; name: string }>)
    .map((student) => ({ ...student, gradeBand: manorCanonicalGrade(student.id) }));
  return { schemaVersion: MANOR_SCHEMA_VERSION, ownerId: teacherId, classes: [{ id: teacher.classId, label: teacher.classId, students }],
    templates: MANOR_MISSIONS.map(publicManorMission),
    assignments: (database.prepare("SELECT * FROM manor_assignments WHERE classId=? ORDER BY publishedAt DESC").all(teacher.classId) as unknown as AssignmentRow[]).map(publicAssignment) };
}

export function setManorStudentGrades(teacherId: string, input: { operationId: string; students: Array<{ studentId: string; gradeBand: ManorGradeBand }> }) {
  const database = manorV2Database();
  database.exec("BEGIN IMMEDIATE");
  try {
    const teacher = learningUser(teacherId);
    if (!teacher || teacher.role !== "teacher" || !teacher.classId) { database.exec("ROLLBACK"); return { ok: false as const, code: "FORBIDDEN" }; }
    if (!input.students.length || new Set(input.students.map((s) => s.studentId)).size !== input.students.length || input.students.some((student) => {
      const user = learningUser(student.studentId);
      return !user || user.role !== "student" || user.classId !== teacher.classId || !MANOR_GRADE_BANDS.includes(student.gradeBand)
        || (user.stage === "primary" ? student.gradeBand === "middle_school" : manorCanonicalGrade(user.id) !== student.gradeBand);
    })) { database.exec("ROLLBACK"); return { ok: false as const, code: "INVALID_INPUT" }; }
    const actionKey = `student-grades:${teacher.classId}:${hashPayload(input)}`;
    const replay = replayOperation<Record<string, unknown>>(teacherId, input.operationId, actionKey);
    if (replay) { database.exec("ROLLBACK"); return replay === "conflict" ? { ok: false as const, code: "OPERATION_CONFLICT" } : { ok: true as const, response: replay }; }
    for (const student of input.students) database.prepare(`INSERT INTO manor_student_grades (studentId,classId,gradeBand,teacherId,updatedAt) VALUES (?,?,?,?,?)
      ON CONFLICT(studentId) DO UPDATE SET classId=excluded.classId,gradeBand=excluded.gradeBand,teacherId=excluded.teacherId,updatedAt=excluded.updatedAt`)
      .run(student.studentId, teacher.classId, student.gradeBand, teacherId, Date.now());
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, correlationId: id("corr"), students: input.students };
    recordOperation(teacherId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function publishManorAssignment(teacherId: string, input: PublishManorAssignmentInput) {
  const database = manorV2Database();
  database.exec("BEGIN IMMEDIATE");
  try {
    const teacher = learningUser(teacherId);
    if (!teacher || teacher.role !== "teacher" || !teacher.classId) { database.exec("ROLLBACK"); return { ok: false as const, code: "FORBIDDEN" }; }
    const actionKey = `publish:${teacher.classId}:${hashPayload(input)}`;
    const replay = replayOperation<Record<string, unknown>>(teacherId, input.operationId, actionKey);
    if (replay) { database.exec("ROLLBACK"); return replay === "conflict" ? { ok: false as const, code: "OPERATION_CONFLICT" } : { ok: true as const, response: replay }; }
    const templates = input.missionIds.map((missionId) => MANOR_MISSIONS.find((mission) => mission.id === missionId));
    if (!templates.length || new Set(input.missionIds).size !== templates.length || templates.some((mission) => !mission || (mission.gradeBand ?? "lower_primary") !== input.gradeBand)
      || !MANOR_GRADE_BANDS.includes(input.gradeBand) || !Number.isInteger(input.rewardUnits ?? 0) || (input.rewardUnits ?? 0) < 0 || (input.rewardUnits ?? 0) > 24
      || (templates.some((mission) => mission?.projectId) && !input.datasetVersion)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "INVALID_INPUT" };
    }
    if (input.studentIds && (!input.studentIds.length || new Set(input.studentIds).size !== input.studentIds.length || input.studentIds.some((studentId) => {
      const student = learningUser(studentId);
      return student?.role !== "student" || student.classId !== teacher.classId || manorCanonicalGrade(studentId) !== input.gradeBand;
    }))) { database.exec("ROLLBACK"); return { ok: false as const, code: "INVALID_INPUT" }; }
    const previous = input.supersedesId ? database.prepare("SELECT * FROM manor_assignments WHERE id=? AND classId=? AND teacherId=?")
      .get(input.supersedesId, teacher.classId, teacherId) as unknown as AssignmentRow | undefined : undefined;
    if (input.supersedesId && !previous) { database.exec("ROLLBACK"); return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND" }; }
    if (previous) {
      // A supersession replaces the active version; its content and learning history stay intact.
      const successor = database.prepare("SELECT id FROM manor_assignments WHERE supersedesId=? LIMIT 1").get(previous.id);
      if (previous.status !== "published" || successor) { database.exec("ROLLBACK"); return { ok: false as const, code: "ASSIGNMENT_NOT_PUBLISHED" }; }
      const withdrawn = database.prepare(`UPDATE manor_assignments SET status='withdrawn',revision=revision+1
        WHERE id=? AND teacherId=? AND classId=? AND status='published' AND revision=?`)
        .run(previous.id, teacherId, teacher.classId, previous.revision);
      if (Number(withdrawn.changes) !== 1) { database.exec("ROLLBACK"); return { ok: false as const, code: "ASSIGNMENT_NOT_PUBLISHED" }; }
    }
    const assignmentId = id("assignment");
    const now = Date.now();
    const assignmentVersion = (previous?.assignmentVersion ?? 0) + 1;
    database.prepare(`INSERT INTO manor_assignments (id,title,classId,teacherId,gradeBand,assignmentVersion,resourceVersion,datasetVersion,rewardUnits,studentIdsJson,supersedesId,publishedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(assignmentId, input.title, teacher.classId, teacherId, input.gradeBand, assignmentVersion, input.resourceVersion,
        input.datasetVersion ?? null, input.rewardUnits ?? 0, input.studentIds ? JSON.stringify(input.studentIds) : null, previous?.id ?? null, now);
    for (const template of templates) {
      const mission: ManorMission = { ...template!, id: id("mission"), templateId: template!.id, assignmentId, assignmentVersion,
        gradeBand: input.gradeBand, resourceVersion: input.resourceVersion, datasetVersion: input.datasetVersion, reward: input.rewardUnits ?? 0,
        source: { kind: "assignment", teacherPublished: true, dataKind: "simulated", label: input.title } };
      database.prepare("INSERT INTO manor_assignment_missions (id,assignmentId,templateId,snapshotJson) VALUES (?,?,?,?)")
        .run(mission.id, assignmentId, template!.id, JSON.stringify(mission));
    }
    const assignment = publicAssignment(database.prepare("SELECT * FROM manor_assignments WHERE id=?").get(assignmentId) as unknown as AssignmentRow);
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, correlationId: id("corr"), assignment,
      missions: assignment.missionIds.map((missionId) => publicManorMission(findManorMission(missionId)!)) };
    recordOperation(teacherId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

function learningSource(mission: ManorMission, taskRunId: string | null): ManorLearningSource {
  return { taskRunId, assignmentId: mission.assignmentId ?? null, assignmentVersion: mission.assignmentVersion ?? null,
    resourceVersion: mission.resourceVersion ?? "manor-template-v7.1", datasetVersion: mission.datasetVersion ?? null };
}

function bindEvidenceSource(evidenceId: string, mission: ManorMission, taskRunId: string | null) {
  const source = learningSource(mission, taskRunId);
  manorV2Database().prepare("UPDATE learning_evidence SET taskRunId=?,assignmentId=?,assignmentVersion=?,resourceVersion=?,datasetVersion=? WHERE id=?")
    .run(source.taskRunId, source.assignmentId, source.assignmentVersion, source.resourceVersion, source.datasetVersion, evidenceId);
}

function issueLearningGrant(studentId: string, evidence: EvidenceRow, mission: ManorMission, milestone: "objective" | "expression", corrected: boolean, correlationId: string) {
  if (!mission.assignmentId || mission.reward <= 0) return undefined;
  const database = manorV2Database();
  const milestoneKey = `${mission.assignmentId}:${mission.id}:${milestone}`;
  const units = corrected ? Math.min(8, mission.reward) : mission.reward;
  const purposes = corrected ? ["support_plot", "review"] : ["plot", "artifact", "class_build"];
  const inserted = database.prepare(`INSERT OR IGNORE INTO growth_grants
    (id,studentId,evidenceId,units,remainingUnits,allowedPurposesJson,status,policyVersion,issuedAt,consumedAt,milestoneKey)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id("grant"), studentId, evidence.id, units, units, JSON.stringify(purposes), "available", MANOR_POLICY_VERSION, Date.now(), null, milestoneKey);
  const grant = database.prepare("SELECT * FROM growth_grants WHERE studentId=? AND milestoneKey=?").get(studentId, milestoneKey) as unknown as GrantRow;
  if (Number(inserted.changes)) appendEvent({ studentId, correlationId, eventType: "growth_grant.issued", entityType: "grant", entityId: grant.id,
    payload: { evidenceId: evidence.id, units, milestoneKey, policyVersion: MANOR_POLICY_VERSION } });
  // A new evidence version must not misrepresent an old grant as newly awarded.
  return grant.evidenceId === evidence.id ? grant : undefined;
}

function appendEvent({
  studentId,
  correlationId,
  eventType,
  entityType,
  entityId,
  payload,
}: {
  studentId: string;
  correlationId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: unknown;
}) {
  const database = manorV2Database();
  database.prepare("UPDATE manor_profiles SET stateVersion = stateVersion + 1, updatedAt = ? WHERE studentId = ?")
    .run(Date.now(), studentId);
  const sequence = Number((database.prepare("SELECT stateVersion FROM manor_profiles WHERE studentId = ?").get(studentId) as { stateVersion: number }).stateVersion);
  database.prepare(`INSERT INTO manor_domain_events
    (eventId,studentId,sequence,correlationId,eventType,entityType,entityId,payloadJson,createdAt)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id("evt"), studentId, sequence, correlationId, eventType, entityType, entityId, JSON.stringify(payload), Date.now());
  return sequence;
}

function evidencePayloadHash(input: SubmitManorEvidenceInput) {
  const normalized = JSON.stringify({
    missionId: input.missionId,
    taskRunId: input.taskRunId ?? null,
    answer: input.answer.trim().toUpperCase(),
    hintsUsed: [...input.hintsUsed].map((value) => value.trim()).sort(),
    accommodationCodes: [...input.accommodationCodes].map((value) => value.trim()).sort(),
  });
  return createHash("sha256").update(normalized).digest("hex");
}

interface EvidenceRow extends ManorLearningSource {
  id: string;
  studentId: string;
  evidenceKey: string;
  objectiveId: string;
  missionId: string;
  evidenceType: string;
  latestAttemptId: string | null;
  attemptCount: number;
  status: string;
  rewardClass: string;
  revision: number;
  createdAt: number;
  decidedAt: number | null;
  hintsUsedJson: string;
  accommodationCodesJson: string;
  rubricVersion: string;
  policyVersion: string;
  grantEligibility: string;
}

interface GrantRow {
  id: string;
  studentId: string;
  evidenceId: string;
  units: number;
  remainingUnits: number;
  allowedPurposesJson: string;
  status: string;
  policyVersion: string;
  issuedAt: number;
  consumedAt: number | null;
  milestoneKey: string | null;
}

function publicEvidence(row: EvidenceRow) {
  const database = manorV2Database();
  const attempts = (database.prepare(`SELECT id,sequence,answerJson,submittedAt FROM evidence_attempts
    WHERE evidenceId=? AND studentId=? ORDER BY sequence`).all(row.id, row.studentId) as unknown as Array<{ id: string; sequence: number; answerJson: string; submittedAt: number }>)
    .map(({ answerJson, ...attempt }) => ({ ...attempt, submission: JSON.parse(answerJson) as { content?: string; choice?: string } }));
  const feedback = database.prepare(`SELECT status,reason,version,evaluatorType,createdAt FROM evidence_decisions
    WHERE evidenceId=? ORDER BY version DESC LIMIT 1`).get(row.id) ?? null;
  return {
    id: row.id,
    objectiveId: row.objectiveId,
    missionId: row.missionId,
    missionTitle: findManorMission(row.missionId)?.title ?? row.missionId,
    taskRunId: row.taskRunId,
    assignmentId: row.assignmentId,
    assignmentVersion: row.assignmentVersion,
    resourceVersion: row.resourceVersion,
    datasetVersion: row.datasetVersion,
    evaluationScope: "single_item_practice",
    hintsUsed: JSON.parse(row.hintsUsedJson) as string[],
    accommodationCodes: JSON.parse(row.accommodationCodesJson) as string[],
    rubricVersion: row.rubricVersion,
    rewardDecision: { policyVersion: row.policyVersion, eligibility: row.grantEligibility, rewardClass: row.rewardClass },
    evidenceType: row.evidenceType,
    submission: attempts.at(-1)?.submission ?? null,
    attempts,
    feedback,
    latestAttemptId: row.latestAttemptId,
    attemptCount: row.attemptCount,
    status: row.status,
    rewardClass: row.rewardClass,
    revision: row.revision,
    createdAt: row.createdAt,
    decidedAt: row.decidedAt,
  };
}

function publicGrant(row: GrantRow | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    evidenceId: row.evidenceId,
    units: row.units,
    remainingUnits: row.remainingUnits,
    allowedPurposes: JSON.parse(row.allowedPurposesJson) as string[],
    status: row.status,
    policyVersion: row.policyVersion,
    issuedAt: row.issuedAt,
    consumedAt: row.consumedAt,
    milestoneKey: row.milestoneKey,
  };
}

export interface SubmitManorEvidenceInput {
  operationId: string;
  missionId: string;
  answer: string;
  hintsUsed: string[];
  accommodationCodes: string[];
  taskRunId?: string;
}

export type SubmitManorEvidenceResult =
  | { ok: true; response: ReturnType<typeof evidenceResponse> }
  | { ok: false; code: "OPERATION_CONFLICT" | "MISSION_NOT_FOUND" | "TASK_RUN_NOT_FOUND" | "TASK_RUN_REQUIRED" | "TASK_PHASE_CONFLICT" };

function evidenceResponse({
  stateVersion,
  correlationId,
  evidence,
  grant,
  correct,
  explanation,
}: {
  stateVersion: number;
  correlationId: string;
  evidence: EvidenceRow;
  grant: GrantRow | undefined;
  correct: boolean;
  explanation: string;
}) {
  return {
    ok: true as const,
    schemaVersion: MANOR_SCHEMA_VERSION,
    stateVersion,
    correlationId,
    evidence: publicEvidence(evidence),
    grant: publicGrant(grant),
    feedback: {
      correct,
      title: correct ? evidence.status === "accepted_correction" ? "订正完成" : "证据成立" : "再想一步",
      explanation,
      reward: grant?.units ?? 0,
    },
  };
}

export function submitManorEvidence(studentId: string, input: SubmitManorEvidenceInput): SubmitManorEvidenceResult {
  const mission = accessibleMission(studentId, input.missionId);
  if (!mission) return { ok: false, code: "MISSION_NOT_FOUND" };
  ensureProfile(studentId);
  const database = manorV2Database();
  const payloadHash = evidencePayloadHash(input);
  const actionKey = `evidence:${input.missionId}:${payloadHash}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const operation = database.prepare("SELECT actionKey,resultJson FROM manor_operations WHERE userId = ? AND operationId = ?")
      .get(studentId, input.operationId) as { actionKey: string; resultJson: string } | undefined;
    if (operation) {
      database.exec("ROLLBACK");
      if (operation.actionKey !== actionKey) return { ok: false, code: "OPERATION_CONFLICT" };
      return { ok: true, response: JSON.parse(operation.resultJson) as ReturnType<typeof evidenceResponse> };
    }

    const taskRun = readTaskRuns(studentId).find((run) => input.taskRunId ? run.id === input.taskRunId && run.missionId === mission.id : run.missionId === mission.id);
    if (input.taskRunId && !taskRun) { database.exec("ROLLBACK"); return { ok: false, code: "TASK_RUN_NOT_FOUND" }; }
    if (mission.assignmentId && !taskRun) { database.exec("ROLLBACK"); return { ok: false, code: "TASK_RUN_REQUIRED" }; }
    if (taskRun?.completedAt) { database.exec("ROLLBACK"); return { ok: false, code: "TASK_PHASE_CONFLICT" }; }
    const evidenceKey = `objective:${mission.id}:${taskRun?.id ?? "unbound"}`;
    let evidence = database.prepare("SELECT * FROM learning_evidence WHERE studentId = ? AND evidenceKey = ?")
      .get(studentId, evidenceKey) as unknown as EvidenceRow | undefined;
    const now = Date.now();
    if (!evidence) {
      const evidenceId = id("evidence");
      database.prepare(`INSERT INTO learning_evidence
        (id,studentId,evidenceKey,objectiveId,missionId,evidenceType,latestAttemptId,attemptCount,hintsUsedJson,
         accommodationCodesJson,provenance,status,evaluatorType,evaluatorId,rubricVersion,policyVersion,
         rewardClass,grantEligibility,confidence,revision,createdAt,decidedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(evidenceId, studentId, evidenceKey, mission.objectiveId, mission.id, "mastery", null, 0, "[]", "[]",
          "student", "pending", "rule", "manor-choice-rule", MANOR_RUBRIC_VERSION, MANOR_POLICY_VERSION,
          "none", "ineligible", 1, 1, now, null);
      bindEvidenceSource(evidenceId, mission, taskRun?.id ?? null);
      evidence = database.prepare("SELECT * FROM learning_evidence WHERE id = ?").get(evidenceId) as unknown as EvidenceRow;
    }

    if (acceptedEvidence(evidence.status)) {
      const grant = database.prepare("SELECT * FROM growth_grants WHERE evidenceId = ?").get(evidence.id) as unknown as GrantRow | undefined;
      const response = evidenceResponse({
        stateVersion: Number((database.prepare("SELECT stateVersion FROM manor_profiles WHERE studentId = ?").get(studentId) as { stateVersion: number }).stateVersion),
        correlationId,
        evidence,
        grant,
        correct: true,
        explanation: "这份证据已经通过，成长授权保持不变。",
      });
      database.prepare("INSERT INTO manor_operations (userId,operationId,actionKey,resultJson,createdAt) VALUES (?,?,?,?,?)")
        .run(studentId, input.operationId, actionKey, JSON.stringify(response), now);
      database.exec("COMMIT");
      return { ok: true, response };
    }

    const attemptSequence = evidence.attemptCount + 1;
    const attemptId = id("attempt");
    const answer = input.answer.trim().toUpperCase();
    database.prepare(`INSERT INTO evidence_attempts
      (id,evidenceId,studentId,sequence,answerJson,hintsUsedJson,accommodationCodesJson,operationId,submittedAt)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(attemptId, evidence.id, studentId, attemptSequence, JSON.stringify({ choice: answer }),
        JSON.stringify(input.hintsUsed), JSON.stringify(input.accommodationCodes), input.operationId, now);
    appendEvent({ studentId, correlationId, eventType: "evidence.submitted", entityType: "evidence", entityId: evidence.id, payload: { attemptId, sequence: attemptSequence } });

    const correct = answer === mission.answer;
    const corrected = correct && evidence.attemptCount > 0;
    const status = correct ? corrected ? "accepted_correction" : "accepted_mastery" : "revise";
    const rewardClass = correct && mission.reward > 0 ? corrected ? "correction_support" : "mastery_progress" : "none";
    const grantEligibility = correct && mission.reward > 0 ? "eligible" : "ineligible";
    const revision = evidence.revision + 1;
    database.prepare(`UPDATE learning_evidence SET latestAttemptId = ?, attemptCount = ?, hintsUsedJson = ?,
      accommodationCodesJson = ?, status = ?, rewardClass = ?, grantEligibility = ?, revision = ?, decidedAt = ? WHERE id = ?`)
      .run(attemptId, attemptSequence, JSON.stringify(input.hintsUsed), JSON.stringify(input.accommodationCodes),
        status, rewardClass, grantEligibility, revision, now, evidence.id);
    database.prepare(`INSERT INTO evidence_decisions
      (id,evidenceId,version,evaluatorType,evaluatorId,status,reason,rubricVersion,confidence,createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(id("decision"), evidence.id, revision, "rule", "manor-choice-rule", status,
        correct ? "答案与确定性量规一致。" : mission.scaffold, MANOR_RUBRIC_VERSION, 1, now);
    appendEvent({ studentId, correlationId, eventType: "evidence.evaluated", entityType: "evidence", entityId: evidence.id, payload: { status, rewardClass, revision } });

    let grant: GrantRow | undefined;
    if (correct) grant = issueLearningGrant(studentId, evidence, mission, "objective", corrected, correlationId);
    if (correct && !grant) database.prepare("UPDATE learning_evidence SET grantEligibility='ineligible',rewardClass='none' WHERE id=?").run(evidence.id);

    evidence = database.prepare("SELECT * FROM learning_evidence WHERE id = ?").get(evidence.id) as unknown as EvidenceRow;
    const stateVersion = Number((database.prepare("SELECT stateVersion FROM manor_profiles WHERE studentId = ?").get(studentId) as { stateVersion: number }).stateVersion);
    const response = evidenceResponse({
      stateVersion,
      correlationId,
      evidence,
      grant,
      correct,
      explanation: correct && !grant ? "本题判断符合量规；评价独立于奖励，不代表学科整体掌握。本次未新增成长授权（示例、零奖励政策或里程碑已授予）。" : correct ? corrected
        ? "你根据支架完成了订正。这份授权用于继续支持学习，之后再用一道变式确认独立掌握。"
        : "你找到了能直接支持判断的证据，成长授权已经记入账户。"
        : mission.scaffold,
    });
    database.prepare("INSERT INTO manor_operations (userId,operationId,actionKey,resultJson,createdAt) VALUES (?,?,?,?,?)")
      .run(studentId, input.operationId, actionKey, JSON.stringify(response), now);
    database.exec("COMMIT");
    return { ok: true, response };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function submitManorExpressionEvidence(studentId: string, input: { operationId: string; missionId: string; content: string; hintsUsed: string[]; accommodationCodes: string[]; evidenceId?: string; expectedRevision?: number; taskRunId?: string }) {
  const mission = accessibleMission(studentId, input.missionId);
  if (!mission) return { ok: false as const, code: "MISSION_NOT_FOUND" as const };
  if (!mission.assignmentId) return { ok: false as const, code: "ASSIGNMENT_REQUIRED" as const };
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `expression:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const now = Date.now();
    const taskRun = readTaskRuns(studentId).find((run) => input.taskRunId ? run.id === input.taskRunId && run.missionId === mission.id : run.missionId === mission.id);
    if (!taskRun) { database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_RUN_NOT_FOUND" as const }; }
    const previous = database.prepare("SELECT * FROM learning_evidence WHERE studentId=? AND evidenceType='expression' AND missionId=? AND taskRunId=?")
      .get(studentId, mission.id, taskRun.id) as unknown as EvidenceRow | undefined;
    if (input.evidenceId && previous?.id !== input.evidenceId) { database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const }; }
    if (input.evidenceId && !previous) { database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const }; }
    if (previous && previous.revision !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { evidence: publicEvidence(previous) } };
    }
    if (previous && previous.status !== "revise") {
      database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_REVISABLE" as const };
    }
    const evidenceId = previous?.id ?? id("evidence");
    const attemptId = id("attempt");
    const sequence = (previous?.attemptCount ?? 0) + 1;
    if (previous) {
      database.prepare(`UPDATE learning_evidence SET latestAttemptId=?,attemptCount=?,hintsUsedJson=?,accommodationCodesJson=?,
        status='pending_review',rewardClass='none',grantEligibility='ineligible',revision=revision+1,decidedAt=NULL WHERE id=?`)
        .run(attemptId, sequence, JSON.stringify(input.hintsUsed), JSON.stringify(input.accommodationCodes), evidenceId);
    } else database.prepare(`INSERT INTO learning_evidence
      (id,studentId,evidenceKey,objectiveId,missionId,evidenceType,latestAttemptId,attemptCount,hintsUsedJson,
       accommodationCodesJson,provenance,status,evaluatorType,evaluatorId,rubricVersion,policyVersion,
       rewardClass,grantEligibility,confidence,revision,createdAt,decidedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(evidenceId, studentId, `expression:${taskRun.id}`, mission.objectiveId, mission.id,
        "expression", attemptId, 1, JSON.stringify(input.hintsUsed), JSON.stringify(input.accommodationCodes),
        "student", "pending_review", "teacher", "unassigned", "teacher-expression-v1", MANOR_POLICY_VERSION,
        "none", "ineligible", null, 1, now, null);
    if (!previous) bindEvidenceSource(evidenceId, mission, taskRun.id);
    database.prepare(`INSERT INTO evidence_attempts
      (id,evidenceId,studentId,sequence,answerJson,hintsUsedJson,accommodationCodesJson,operationId,submittedAt)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(attemptId, evidenceId, studentId, sequence, JSON.stringify({ content: input.content }), JSON.stringify(input.hintsUsed), JSON.stringify(input.accommodationCodes), input.operationId, now);
    // The expression draft follows the immutable attempt; only this exact content can later be archived.
    const existingArtifact = database.prepare("SELECT id FROM learning_artifacts WHERE studentId=? AND evidenceId=? AND artifactType='expression' LIMIT 1")
      .get(studentId, evidenceId) as { id: string } | undefined;
    if (existingArtifact) {
      database.prepare("UPDATE learning_artifacts SET content=?,contentHash=?,revision=revision+1,updatedAt=? WHERE id=?")
        .run(input.content, hashPayload(input.content), now, existingArtifact.id);
    } else {
      database.prepare(`INSERT INTO learning_artifacts (id,studentId,evidenceId,artifactType,title,content,visibility,contentHash,revision,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id("artifact"), studentId, evidenceId, "expression", mission.title, input.content, "private", hashPayload(input.content), 1, now, now);
    }
    database.prepare("UPDATE learning_artifacts SET taskRunId=? WHERE studentId=? AND evidenceId=? AND artifactType='expression'").run(taskRun.id, studentId, evidenceId);
    appendEvent({ studentId, correlationId, eventType: "evidence.expression_submitted", entityType: "evidence", entityId: evidenceId, payload: { attemptId, missionId: mission.id, sequence } });
    const evidence = database.prepare("SELECT * FROM learning_evidence WHERE id = ?").get(evidenceId) as unknown as EvidenceRow;
    const response = {
      ok: true,
      schemaVersion: MANOR_SCHEMA_VERSION,
      stateVersion: readStateVersion(studentId),
      correlationId,
      evidence: publicEvidence(evidence),
      grant: null,
      feedback: { correct: null, title: "已送交老师", explanation: "开放表达由任课教师依据作品内容审核，结果不会由模型自动决定。", reward: 0 },
    };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function teacherManorEvidenceQueue(classId: string, status?: string) {
  const database = manorV2Database();
  const rows = database.prepare(`SELECT e.*,u.name AS studentName,a.answerJson
    FROM learning_evidence e
    JOIN users u ON u.id = e.studentId AND u.role = 'student' AND u.classId = ?
    LEFT JOIN evidence_attempts a ON a.id = e.latestAttemptId
    WHERE (? IS NULL OR e.status = ?)
    ORDER BY e.createdAt DESC LIMIT 100`).all(classId, status ?? null, status ?? null) as unknown as Array<EvidenceRow & { studentName: string; answerJson: string | null }>;
  return rows.map((row) => ({ ...publicEvidence(row), studentId: row.studentId, studentName: row.studentName, submission: row.answerJson ? JSON.parse(row.answerJson) : null }));
}

export function decideManorEvidence(teacherId: string, classId: string, evidenceId: string, input: { operationId: string; expectedRevision: number; status: "accepted_mastery" | "revise"; reason: string }) {
  const database = manorV2Database();
  const actionKey = `teacher-decision:${evidenceId}:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    // Authorization is current, even when the operation has an older successful receipt.
    const existingEvidence = database.prepare(`SELECT e.* FROM learning_evidence e JOIN users u ON u.id=e.studentId
      WHERE e.id=? AND u.role='student' AND u.classId=?
      AND EXISTS (SELECT 1 FROM users teacher WHERE teacher.id=? AND teacher.role='teacher' AND teacher.classId=u.classId)`)
      .get(evidenceId, classId, teacherId) as unknown as EvidenceRow | undefined;
    if (!existingEvidence) { database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const }; }
    if (existingEvidence.evidenceType !== "expression" || !existingEvidence.assignmentId || !assignmentAccessible(existingEvidence.studentId, existingEvidence.assignmentId)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const };
    }
    const replay = replayOperation<Record<string, unknown>>(teacherId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    if (existingEvidence.revision !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { evidence: publicEvidence(existingEvidence) } };
    }
    if (existingEvidence.status !== "pending_review" && existingEvidence.status !== "revise") {
      database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_ALREADY_DECIDED" as const, authoritative: { evidence: publicEvidence(existingEvidence) } };
    }
    ensureProfile(existingEvidence.studentId);
    const now = Date.now();
    const revision = existingEvidence.revision + 1;
    const accepted = input.status === "accepted_mastery";
    const mission = accepted ? findManorMission(existingEvidence.missionId) : undefined;
    if (accepted && !mission) {
      database.exec("ROLLBACK");
      return { ok: false as const, code: "MISSION_NOT_FOUND" as const };
    }
    if (accepted) {
      const artifact = database.prepare("SELECT * FROM learning_artifacts WHERE studentId=? AND evidenceId=? AND artifactType='expression' ORDER BY createdAt,id LIMIT 1")
        .get(existingEvidence.studentId, evidenceId) as { id: string; revision: number; content: string; contentHash: string } | undefined;
      const attempt = database.prepare("SELECT answerJson FROM evidence_attempts WHERE id=? AND studentId=?")
        .get(existingEvidence.latestAttemptId, existingEvidence.studentId) as { answerJson: string } | undefined;
      if (!artifact || !attempt || (JSON.parse(attempt.answerJson) as { content: string }).content !== artifact.content || artifact.contentHash !== hashPayload(artifact.content)) {
        database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_VERSION_CONFLICT" as const };
      }
      database.prepare("INSERT INTO manor_artifact_versions (artifactId,revision,studentId,evidenceId,content,contentHash,acceptedAt) VALUES (?,?,?,?,?,?,?)")
        .run(artifact.id, artifact.revision, existingEvidence.studentId, evidenceId, artifact.content, artifact.contentHash, now);
      database.prepare("UPDATE learning_artifacts SET acceptedRevision=revision,acceptedContentHash=contentHash,acceptedAt=? WHERE id=?").run(now, artifact.id);
    }
    database.prepare(`UPDATE learning_evidence SET status=?,evaluatorType='teacher',evaluatorId=?,rewardClass=?,grantEligibility=?,revision=?,decidedAt=? WHERE id=? AND revision=?`)
      .run(input.status, teacherId, accepted && mission?.reward ? "teacher_validated" : "none", accepted && mission?.reward ? "eligible" : "ineligible", revision, now, evidenceId, input.expectedRevision);
    database.prepare(`INSERT INTO evidence_decisions
      (id,evidenceId,version,evaluatorType,evaluatorId,status,reason,rubricVersion,confidence,createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id("decision"), evidenceId, revision, "teacher", teacherId, input.status, input.reason, "teacher-expression-v1", null, now);
    let grant: GrantRow | undefined;
    if (accepted && mission) grant = issueLearningGrant(existingEvidence.studentId, existingEvidence, mission, "expression", false, correlationId);
    if (accepted && !grant) database.prepare("UPDATE learning_evidence SET grantEligibility='ineligible',rewardClass='none' WHERE id=?").run(evidenceId);
    appendEvent({ studentId: existingEvidence.studentId, correlationId, eventType: "evidence.teacher_decided", entityType: "evidence", entityId: evidenceId, payload: { teacherId, status: input.status, reason: input.reason, revision, grantId: grant?.id ?? null } });
    const evidence = database.prepare("SELECT * FROM learning_evidence WHERE id=?").get(evidenceId) as unknown as EvidenceRow;
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(existingEvidence.studentId), correlationId, evidence: publicEvidence(evidence), grant: publicGrant(grant) };
    recordOperation(teacherId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function manorAuditChain(correlationId: string) {
  const database = manorV2Database();
  const events = database.prepare("SELECT eventId,studentId,sequence,correlationId,eventType,entityType,entityId,payloadJson,createdAt FROM manor_domain_events WHERE correlationId=? ORDER BY sequence")
    .all(correlationId) as unknown as Array<{ eventId: string; studentId: string; sequence: number; correlationId: string; eventType: string; entityType: string; entityId: string; payloadJson: string; createdAt: number }>;
  if (!events.length) return null;
  const subject = database.prepare("SELECT id,name,classId FROM users WHERE id=?").get(events[0].studentId) as { id: string; name: string; classId: string } | undefined;
  const consumptions = database.prepare(`SELECT id,grantId,purpose,entityType,entityId,amount,operationId,createdAt
    FROM grant_consumptions WHERE correlationId=? ORDER BY createdAt`).all(correlationId) as Array<Record<string, unknown>>;
  const operations = database.prepare(`SELECT userId,operationId,actionKey,createdAt FROM manor_operations
    WHERE resultJson LIKE ? ORDER BY createdAt`).all(`%${correlationId}%`) as Array<Record<string, unknown>>;
  const eventGrantIds = events.filter((event) => event.entityType === "grant").map((event) => event.entityId);
  const grantIds = [...new Set([...eventGrantIds, ...consumptions.map((row) => String(row.grantId))])];
  const grants = grantIds.map((grantId) => database.prepare(`SELECT id,evidenceId,units,remainingUnits,status,policyVersion,issuedAt,consumedAt
    FROM growth_grants WHERE id=?`).get(grantId)).filter(Boolean) as Array<Record<string, unknown>>;
  const parsedEvents = events.map(({ payloadJson, ...event }) => ({ ...event, payload: JSON.parse(payloadJson) as Record<string, unknown> }));
  const eventEvidenceIds = events.filter((event) => event.entityType === "evidence").map((event) => event.entityId);
  const linkedEvidenceIds = parsedEvents.flatMap((event) => typeof event.payload.evidenceId === "string" ? [event.payload.evidenceId] : []);
  const evidenceIds = [...new Set([...eventEvidenceIds, ...linkedEvidenceIds, ...grants.map((row) => String(row.evidenceId))])];
  const evidence = evidenceIds.map((evidenceId) => database.prepare(`SELECT id,missionId,status,rewardClass,revision,createdAt,decidedAt
    FROM learning_evidence WHERE id=?`).get(evidenceId)).filter(Boolean) as Array<Record<string, unknown>>;
  const decisions = evidenceIds.flatMap((evidenceId) => database.prepare(`SELECT id,evidenceId,version,evaluatorType,evaluatorId,status,reason,rubricVersion,createdAt
    FROM evidence_decisions WHERE evidenceId=? ORDER BY version`).all(evidenceId) as Array<Record<string, unknown>>);
  const artifactIds = events.filter((event) => event.entityType === "artifact").map((event) => event.entityId);
  const artifacts = artifactIds.map((artifactId) => database.prepare(`SELECT id,evidenceId,artifactType,title,visibility,contentHash,revision,createdAt
    FROM learning_artifacts WHERE id=?`).get(artifactId)).filter(Boolean) as Array<Record<string, unknown>>;
  const checks = [
    { id: "events_present", label: "领域事件存在", passed: events.length > 0 },
    { id: "sequence_order", label: "事件序号严格递增", passed: events.every((event, index) => index === 0 || event.sequence > events[index - 1].sequence) },
    { id: "operations_linked", label: "幂等操作记录已关联", passed: operations.length > 0 },
    { id: "grants_resolved", label: "授权引用可解析", passed: grants.length === grantIds.length },
    { id: "consumptions_resolved", label: "消费记录关联授权与领域实体", passed: consumptions.every((row) => grantIds.includes(String(row.grantId)) && events.some((event) => event.entityType === row.entityType && event.entityId === row.entityId)) },
    { id: "artifacts_resolved", label: "作品记录与证据一致", passed: artifacts.length === artifactIds.length && artifacts.every((artifact) => !artifact.evidenceId || evidence.some((source) => source.id === artifact.evidenceId)) },
    { id: "decisions_resolved", label: "教师审核决定可追溯", passed: !events.some((event) => event.eventType === "evidence.teacher_decided") || decisions.length > 0 },
    { id: "teacher_grants_resolved", label: "教师签发授权已进入审计链", passed: parsedEvents.filter((event) => event.eventType === "evidence.teacher_decided" && event.payload.grantId != null).every((event) => typeof event.payload.grantId === "string" && grants.some((grant) => grant.id === event.payload.grantId)) },
  ];
  return {
    schemaVersion: MANOR_SCHEMA_VERSION,
    correlationId,
    subject: subject ?? { id: events[0].studentId, name: "未知用户", classId: "" },
    integrity: { complete: checks.every((check) => check.passed), checks },
    events: parsedEvents,
    operations,
    evidence,
    grants,
    consumptions,
    decisions,
    artifacts,
  };
}

export function recentManorAuditChains(limit = 40) {
  return manorV2Database().prepare(`SELECT e.correlationId,e.studentId,u.name AS studentName,u.classId,
    COUNT(*) AS eventCount,MAX(e.createdAt) AS lastAt,
    (SELECT eventType FROM manor_domain_events latest WHERE latest.correlationId=e.correlationId ORDER BY latest.sequence DESC LIMIT 1) AS latestEvent
    FROM manor_domain_events e LEFT JOIN users u ON u.id=e.studentId
    GROUP BY e.correlationId,e.studentId,u.name,u.classId ORDER BY lastAt DESC LIMIT ?`).all(limit);
}

function plotStatus(plot: { plot: number; cropId: string | null; stage: number; state: string }, studentId: string): ManorPlotStatus {
  if (plot.plot >= manorOpenPlotCount(studentId)) return "locked";
  if (plot.state === "review_due" || plot.state === "needs_support") return plot.state;
  if (!plot.cropId) return "empty";
  return plot.stage >= MANOR_CROP_STAGE_MAX ? "ready" : "planted";
}

interface PlotRow {
  plot: number;
  cropId: string | null;
  stage: number;
  plantedAt: number | null;
  updatedAt: number | null;
  revision: number;
  state: string;
  objectiveId: string | null;
  evidenceId: string | null;
  plantingCycleId: string | null;
}

interface GrantAllocation {
  grantId: string;
  amount: number;
}

function hashPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function readStateVersion(studentId: string) {
  return Number((manorV2Database().prepare("SELECT stateVersion FROM manor_profiles WHERE studentId = ?").get(studentId) as { stateVersion: number }).stateVersion);
}

function readGrowthEnergy(studentId: string) {
  return Number((manorV2Database().prepare("SELECT COALESCE(SUM(remainingUnits),0) AS units FROM growth_grants WHERE studentId = ? AND status IN ('available','partially_consumed')").get(studentId) as { units: number }).units);
}

function acceptedEvidence(status: string) {
  return ["accepted_mastery", "accepted_correction", "accepted_practice"].includes(status);
}

function readManorArtifacts(studentId: string) {
  return (manorV2Database().prepare(MANOR_ARTIFACT_SELECT).all(studentId) as unknown as ManorArtifactRecord[]).map(publicManorArtifact);
}

function readPlot(studentId: string, plotId: number): PlotRow | undefined {
  return manorV2Database().prepare(`SELECT plot,cropId,stage,plantedAt,updatedAt,revision,state,objectiveId,evidenceId,plantingCycleId
    FROM manor_plots WHERE userId = ? AND plot = ?`).get(studentId, plotId) as unknown as PlotRow | undefined;
}

function publicPlot(row: PlotRow, studentId: string) {
  return {
    id: row.plot,
    unlocked: row.plot < manorOpenPlotCount(studentId),
    status: plotStatus(row, studentId),
    cropId: row.cropId,
    stage: row.stage,
    revision: row.revision,
    objectiveId: row.objectiveId,
    evidenceId: row.evidenceId,
    plantingCycleId: row.plantingCycleId,
    plantedAt: row.plantedAt,
    updatedAt: row.updatedAt,
  };
}

function replayOperation<T>(studentId: string, operationId: string, actionKey: string): T | "conflict" | null {
  const row = manorV2Database().prepare("SELECT actionKey,resultJson FROM manor_operations WHERE userId = ? AND operationId = ?")
    .get(studentId, operationId) as { actionKey: string; resultJson: string } | undefined;
  if (!row) return null;
  if (row.actionKey !== actionKey) return "conflict";
  return JSON.parse(row.resultJson) as T;
}

function recordOperation(studentId: string, operationId: string, actionKey: string, response: unknown) {
  manorV2Database().prepare("INSERT INTO manor_operations (userId,operationId,actionKey,resultJson,createdAt) VALUES (?,?,?,?,?)")
    .run(studentId, operationId, actionKey, JSON.stringify(response), Date.now());
}

export function lookupManorOperation(studentId: string, operationId: string): ManorOperationReceipt | null {
  const row = manorV2Database().prepare("SELECT resultJson,createdAt FROM manor_operations WHERE userId=? AND operationId=?")
    .get(studentId, operationId) as { resultJson: string; createdAt: number } | undefined;
  return row ? { ok: true, status: "committed", operationId, result: JSON.parse(row.resultJson), createdAt: row.createdAt } : null;
}

function readTaskRuns(studentId: string) {
  return manorV2Database().prepare(`SELECT id,missionId,phase,answer,reflection,evidenceId,artifactId,revision,createdAt,updatedAt,completedAt,
    assignmentId,assignmentVersion,resourceVersion,datasetVersion
    FROM manor_task_runs WHERE studentId=? ORDER BY updatedAt DESC`).all(studentId) as unknown as ManorTaskRun[];
}

function readTaskRunHistory(studentId: string): ManorTaskRunHistory[] {
  return (manorV2Database().prepare("SELECT runJson,archivedAt FROM manor_task_run_history WHERE studentId=? ORDER BY archivedAt DESC")
    .all(studentId) as unknown as Array<{ runJson: string; archivedAt: number }>)
    .map((row) => ({ ...JSON.parse(row.runJson) as ManorTaskRun, archivedAt: row.archivedAt }));
}

export function saveManorTaskRun(studentId: string, input: SaveManorTaskRunInput) {
  const mission = accessibleMission(studentId, input.missionId);
  if (!mission) return { ok: false as const, code: "MISSION_NOT_FOUND" as const };
  if (input.assignmentId && mission.assignmentId !== input.assignmentId) return { ok: false as const, code: "ASSIGNMENT_NOT_FOUND" as const };
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `task-run:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const current = readTaskRuns(studentId).find((run) => run.missionId === mission.id);
    if ((current?.revision ?? 0) !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { taskRun: current ?? null } };
    }
    const now = Date.now();
    const restarting = Boolean(current && input.phase === "evidence" && (input.restart || current.completedAt != null && bjDay(current.completedAt) < bjDay(now)));
    if (input.restart && (!current || input.phase !== "evidence")) { database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_PHASE_CONFLICT" as const }; }
    if (restarting && (input.answer || input.reflection || input.evidenceId)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "INVALID_INPUT" as const };
    }
    const active = restarting ? undefined : current;
    const runId = active?.id ?? id("task");
    const previousPhase = MANOR_TASK_PHASES.indexOf(active?.phase ?? "evidence");
    const nextPhase = MANOR_TASK_PHASES.indexOf(input.phase);
    if (active?.completedAt != null || nextPhase < previousPhase || nextPhase > previousPhase + 1) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_PHASE_CONFLICT" as const, authoritative: { taskRun: current ?? null } };
    }
    const evidenceId = input.evidenceId ?? active?.evidenceId ?? null;
    const evidence = evidenceId ? database.prepare("SELECT * FROM learning_evidence WHERE id=? AND studentId=? AND missionId=?")
      .get(evidenceId, studentId, mission.id) as unknown as EvidenceRow | undefined : undefined;
    if (evidenceId && !evidence) { database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const }; }
    if (evidence?.taskRunId && evidence.taskRunId !== runId) { database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_FRESH_EVIDENCE_REQUIRED" as const }; }
    if (nextPhase > 0 && (!evidence || !acceptedEvidence(evidence.status))) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_EVIDENCE_REQUIRED" as const };
    }
    if (nextPhase > 0 && evidence) {
      const history = readTaskRunHistory(studentId).filter((run) => run.missionId === mission.id);
      const attempt = database.prepare("SELECT submittedAt FROM evidence_attempts WHERE id=? AND studentId=?")
        .get(evidence.latestAttemptId, studentId) as { submittedAt: number } | undefined;
      if (history.length && (history.some((run) => run.evidenceId === evidence.id) || !attempt || bjDay(attempt.submittedAt) < bjDay(active?.createdAt ?? now))) {
        database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_FRESH_EVIDENCE_REQUIRED" as const };
      }
    }
    const reflection = input.reflection?.trim() ?? active?.reflection ?? "";
    const answer = input.answer ?? active?.answer ?? "";
    let artifactId = active?.artifactId ?? null;
    if (input.phase === "summary") {
      if (reflection.length < 2 || !database.prepare("SELECT id FROM review_schedules WHERE studentId=? AND evidenceId=?").get(studentId, evidenceId)) {
        database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_REFLECTION_REVIEW_REQUIRED" as const };
      }
      artifactId = id("artifact");
      database.prepare(`INSERT INTO learning_artifacts (id,studentId,evidenceId,artifactType,title,content,visibility,contentHash,revision,createdAt,updatedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(artifactId, studentId, evidenceId, "reflection", mission.title, reflection, "private", hashPayload(reflection), 1, now, now);
      appendEvent({ studentId, correlationId, eventType: "artifact.saved", entityType: "artifact", entityId: artifactId, payload: { evidenceId, artifactType: "reflection" } });
      database.prepare("UPDATE learning_artifacts SET taskRunId=? WHERE id=?").run(runId, artifactId);
    }
    const archivedTaskRun = restarting && current ? { ...current, archivedAt: now } : null;
    if (archivedTaskRun) {
      database.prepare("INSERT INTO manor_task_run_history (id,studentId,missionId,runJson,archivedAt) VALUES (?,?,?,?,?)")
        .run(current!.id, studentId, mission.id, JSON.stringify(current), now);
      appendEvent({ studentId, correlationId, eventType: "task_run.restarted", entityType: "task_run", entityId: runId,
        payload: { previousRunId: current!.id, previousRevision: current!.revision, evidenceId: current!.evidenceId, artifactId: current!.artifactId } });
    }
    database.prepare(`INSERT INTO manor_task_runs (id,studentId,missionId,phase,answer,reflection,evidenceId,artifactId,revision,createdAt,updatedAt,completedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(studentId,missionId) DO UPDATE SET id=excluded.id,createdAt=excluded.createdAt,phase=excluded.phase,answer=excluded.answer,
      reflection=excluded.reflection,evidenceId=excluded.evidenceId,artifactId=excluded.artifactId,revision=excluded.revision,updatedAt=excluded.updatedAt,completedAt=excluded.completedAt`)
      .run(runId, studentId, mission.id, input.phase, answer, reflection, evidenceId, artifactId, input.expectedRevision + 1, active?.createdAt ?? now, now, input.phase === "summary" ? now : null);
    database.prepare("UPDATE manor_task_runs SET assignmentId=?,assignmentVersion=?,resourceVersion=?,datasetVersion=? WHERE id=?")
      .run(mission.assignmentId ?? null, mission.assignmentVersion ?? null, mission.resourceVersion ?? "manor-template-v7.1", mission.datasetVersion ?? null, runId);
    if (evidence && !evidence.taskRunId) bindEvidenceSource(evidence.id, mission, runId);
    appendEvent({ studentId, correlationId, eventType: "task_run.saved", entityType: "task_run", entityId: runId, payload: { phase: input.phase, evidenceId, artifactId } });
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(studentId), correlationId, taskRun: readTaskRuns(studentId).find((run) => run.id === runId)!, archivedTaskRun };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

interface ReviewRow {
  id: string; evidenceId: string; missionId: string; strategy: string; dueAt: number;
  status: string; revision: number; createdAt: number; updatedAt: number;
  lastAnswer: string | null; feedbackJson: string | null; completedAt: number | null;
}

function publicReview(row: ReviewRow) {
  const { feedbackJson, ...review } = row;
  const mission = findManorMission(row.missionId);
  const question = mission ? manorReviewQuestion(mission) : undefined;
  return { ...review, title: mission?.title ?? "原学习任务", due: row.status !== "completed" && row.dueAt <= Date.now(),
    question: question ? { question: question.question, prompt: question.prompt, choices: question.choices } : null,
    feedback: feedbackJson ? JSON.parse(feedbackJson) as ManorReviewFeedback : null };
}

function readReviews(studentId: string) {
  return (manorV2Database().prepare(`SELECT id,evidenceId,missionId,strategy,dueAt,status,revision,createdAt,updatedAt,lastAnswer,feedbackJson,completedAt
    FROM review_schedules WHERE studentId=? ORDER BY dueAt`).all(studentId) as unknown as ReviewRow[]).map(publicReview);
}

export function actOnManorReview(studentId: string, reviewId: string, input: ManorReviewActionInput) {
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `review-action:${reviewId}:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const current = readReviews(studentId).find((review) => review.id === reviewId);
    if (!current) { database.exec("ROLLBACK"); return { ok: false as const, code: "REVIEW_NOT_FOUND" as const }; }
    if (current.revision !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { review: current } };
    }
    if (current.status === "completed") { database.exec("ROLLBACK"); return { ok: false as const, code: "REVIEW_ALREADY_COMPLETED" as const }; }
    const now = Date.now();
    if (input.action === "defer") {
      database.prepare("UPDATE review_schedules SET dueAt=?,strategy=?,status='scheduled',revision=revision+1,updatedAt=? WHERE id=? AND studentId=?")
        .run(Math.max(now, current.dueAt) + 86_400_000, input.strategy ?? current.strategy, now, reviewId, studentId);
    } else {
      if (current.dueAt > now) { database.exec("ROLLBACK"); return { ok: false as const, code: "REVIEW_NOT_DUE" as const }; }
      const mission = findManorMission(current.missionId);
      const question = mission ? manorReviewQuestion(mission) : undefined;
      if (!question) { database.exec("ROLLBACK"); return { ok: false as const, code: "MISSION_NOT_FOUND" as const }; }
      const answer = input.answer?.trim().toUpperCase();
      if (!answer || !question.choices.some((choice) => choice.id === answer)) {
        database.exec("ROLLBACK"); return { ok: false as const, code: "INVALID_INPUT" as const };
      }
      const correct = answer === question.answer;
      const feedback: ManorReviewFeedback = { correct, explanation: correct ? "这次变式作答符合量规，已保存复习记录；不代表长期掌握，不发放重复奖励。" : question.scaffold };
      database.prepare("INSERT INTO manor_review_attempts (id,reviewId,studentId,evidenceId,answer,correct,feedbackJson,createdAt) VALUES (?,?,?,?,?,?,?,?)")
        .run(id("review_attempt"), reviewId, studentId, current.evidenceId, answer, Number(correct), JSON.stringify(feedback), now);
      database.prepare("UPDATE review_schedules SET status=?,lastAnswer=?,feedbackJson=?,completedAt=?,strategy=?,revision=revision+1,updatedAt=? WHERE id=? AND studentId=?")
        .run(correct ? "completed" : "scheduled", answer, JSON.stringify(feedback), correct ? now : null, input.strategy ?? current.strategy, now, reviewId, studentId);
    }
    appendEvent({ studentId, correlationId, eventType: `review.${input.action === "defer" ? "deferred" : "attempted"}`, entityType: "review", entityId: reviewId, payload: { evidenceId: current.evidenceId } });
    const review = readReviews(studentId).find((item) => item.id === reviewId)!;
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(studentId), correlationId, review, feedback: review.feedback };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

function consumeGrants({
  studentId,
  allocations,
  allowedPurposes,
  requiredAmount,
  entityType,
  entityId,
  operationId,
  correlationId,
  plantingCycleId,
  plotActionId,
}: {
  studentId: string;
  allocations: GrantAllocation[];
  allowedPurposes: string[];
  requiredAmount: number;
  entityType: string;
  entityId: string;
  operationId: string;
  correlationId: string;
  plantingCycleId?: string;
  plotActionId?: string;
}): { ok: true; consumptions: Array<{ grantId: string; amount: number; purpose: string }>; supportOnly: boolean } | { ok: false; code: "GRANT_INVALID" | "GRANT_INSUFFICIENT" | "PURPOSE_NOT_ALLOWED" } {
  if (allocations.reduce((sum, item) => sum + item.amount, 0) !== requiredAmount) return { ok: false, code: "GRANT_INSUFFICIENT" };
  const database = manorV2Database();
  if (new Set(allocations.map((item) => item.grantId)).size !== allocations.length) {
    return { ok: false, code: "GRANT_INVALID" };
  }
  const rows: Array<{ grant: GrantRow; allocation: GrantAllocation; purpose: string }> = [];
  for (const allocation of allocations) {
    const grant = database.prepare("SELECT * FROM growth_grants WHERE id = ? AND studentId = ?").get(allocation.grantId, studentId) as unknown as GrantRow | undefined;
    if (!grant || !["available", "partially_consumed"].includes(grant.status) || grant.remainingUnits < allocation.amount || !Number.isSafeInteger(allocation.amount) || allocation.amount < 1) return { ok: false, code: "GRANT_INVALID" };
    const purposes = JSON.parse(grant.allowedPurposesJson) as string[];
    const purpose = allowedPurposes.find((candidate) => purposes.includes(candidate));
    if (!purpose) return { ok: false, code: "PURPOSE_NOT_ALLOWED" };
    rows.push({ grant, allocation, purpose });
  }
  const now = Date.now();
  for (const { grant, allocation, purpose } of rows) {
    const remaining = grant.remainingUnits - allocation.amount;
    const updated = database.prepare("UPDATE growth_grants SET remainingUnits = ?, status = ?, consumedAt = ? WHERE id = ? AND remainingUnits = ?")
      .run(remaining, remaining === 0 ? "consumed" : "partially_consumed", remaining === 0 ? now : null, grant.id, grant.remainingUnits);
    if (Number(updated.changes) !== 1) return { ok: false, code: "GRANT_INVALID" };
    database.prepare(`INSERT INTO grant_consumptions
      (id,studentId,grantId,purpose,entityType,entityId,amount,operationId,correlationId,createdAt,plantingCycleId,plotActionId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id("consume"), studentId, grant.id, purpose, entityType, entityId, allocation.amount, operationId, correlationId, now, plantingCycleId ?? null, plotActionId ?? null);
  }
  return {
    ok: true,
    consumptions: rows.map(({ grant, allocation, purpose }) => ({ grantId: grant.id, amount: allocation.amount, purpose })),
    supportOnly: rows.every(({ purpose }) => purpose === "support_plot" || purpose === "review"),
  };
}

export interface ManorPlotActionInput {
  action: "plant" | "plant_and_nurture" | "nurture" | "harvest" | "clear";
  operationId: string;
  expectedRevision: number;
  cropId?: string;
  grantAllocations: GrantAllocation[];
}

export type ManorMutationResult =
  | { ok: true; response: Record<string, unknown> }
  | { ok: false; code: "OPERATION_CONFLICT" | "MANOR_REVISION_CONFLICT" | "PLOT_LOCKED" | "CROP_LOCKED" | "PLOT_UNAVAILABLE" | "GRANT_INVALID" | "GRANT_INSUFFICIENT" | "PURPOSE_NOT_ALLOWED"; authoritative?: unknown };

export function applyManorPlotAction(studentId: string, plotId: number, input: ManorPlotActionInput): ManorMutationResult {
  ensureProfile(studentId);
  manorFarmState(studentId);
  const database = manorV2Database();
  const actionKey = `plot:${plotId}:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false, code: "OPERATION_CONFLICT" }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true, response: replay }; }
    const current = readPlot(studentId, plotId);
    if (!current || plotId >= manorOpenPlotCount(studentId)) { database.exec("ROLLBACK"); return { ok: false, code: "PLOT_LOCKED", authoritative: current ? publicPlot(current, studentId) : null }; }
    if (current.revision !== input.expectedRevision) {
      database.exec("ROLLBACK");
      return { ok: false, code: "MANOR_REVISION_CONFLICT", authoritative: { plot: publicPlot(current, studentId) } };
    }
    const now = Date.now();
    const planting = input.action === "plant" || input.action === "plant_and_nurture";
    const cycleId = planting ? id("cycle") : current.plantingCycleId ?? id("cycle");
    const plotActionId = id("plot_action");
    if (!planting && current.cropId && !current.plantingCycleId) {
      database.prepare("INSERT INTO manor_planting_cycles (id,studentId,plotId,cropId,startedAt,historyComplete) VALUES (?,?,?,?,?,0)")
        .run(cycleId, studentId, plotId, current.cropId, current.plantedAt ?? now);
    }
    let nextCrop = current.cropId;
    let nextStage = current.stage;
    let nextState = current.state;
    let evidenceId = current.evidenceId;
    let harvest: { id: string; cropId: string; plotId: number; evidenceId: string | null; harvestedAt: number; plantingCycleId: string } | null = null;
    let consumptions: Array<{ grantId: string; amount: number; purpose: string }> = [];
    if (input.action === "plant" || input.action === "plant_and_nurture") {
      if (current.cropId || !input.cropId || !["wheat", "tomato", "bean", "rice", "sunflower", "bamboo"].includes(input.cropId)) {
        database.exec("ROLLBACK"); return { ok: false, code: "PLOT_UNAVAILABLE" };
      }
      if (!manorFarmStateReadOnly(studentId).cropAccess.find((crop) => crop.id === input.cropId)?.unlocked) {
        database.exec("ROLLBACK"); return { ok: false, code: "CROP_LOCKED" };
      }
      nextCrop = input.cropId;
      nextStage = 0;
      nextState = "planted";
      if (input.action === "plant_and_nurture") {
        const consumed = consumeGrants({
          studentId, allocations: input.grantAllocations, allowedPurposes: ["plot", "support_plot"], requiredAmount: 8,
          entityType: "plot", entityId: String(plotId), operationId: input.operationId, correlationId, plantingCycleId: cycleId, plotActionId,
        });
        if (!consumed.ok) { database.exec("ROLLBACK"); return consumed; }
        consumptions = consumed.consumptions;
        nextStage = 1;
        nextState = consumed.supportOnly ? "needs_support" : "review_due";
        const sourceGrant = database.prepare("SELECT evidenceId FROM growth_grants WHERE id = ?").get(input.grantAllocations[0].grantId) as { evidenceId: string };
        evidenceId = sourceGrant.evidenceId;
      }
    } else if (input.action === "nurture") {
      if (!current.cropId || current.stage >= MANOR_CROP_STAGE_MAX) { database.exec("ROLLBACK"); return { ok: false, code: "PLOT_UNAVAILABLE" }; }
      const consumed = consumeGrants({
        studentId, allocations: input.grantAllocations, allowedPurposes: ["plot", "support_plot"], requiredAmount: 8,
        entityType: "plot", entityId: String(plotId), operationId: input.operationId, correlationId, plantingCycleId: cycleId, plotActionId,
      });
      if (!consumed.ok) { database.exec("ROLLBACK"); return consumed; }
      consumptions = consumed.consumptions;
      nextStage = Math.min(MANOR_CROP_STAGE_MAX, current.stage + 1);
      nextState = consumed.supportOnly ? "needs_support" : nextStage >= MANOR_CROP_STAGE_MAX ? "ready" : "review_due";
      const sourceGrant = database.prepare("SELECT evidenceId FROM growth_grants WHERE id = ?").get(input.grantAllocations[0].grantId) as { evidenceId: string };
      evidenceId = sourceGrant.evidenceId;
    } else if (input.action === "harvest") {
      if (!current.cropId || current.stage < MANOR_CROP_STAGE_MAX) { database.exec("ROLLBACK"); return { ok: false, code: "PLOT_UNAVAILABLE" }; }
      harvest = { id: id("harvest"), cropId: current.cropId, plotId, evidenceId: current.evidenceId, harvestedAt: now, plantingCycleId: cycleId };
      database.prepare("INSERT INTO manor_harvests (id,userId,cropId,plot,harvestedAt,evidenceId,plantingCycleId) VALUES (?,?,?,?,?,?,?)")
        .run(harvest.id, studentId, current.cropId, plotId, now, current.evidenceId, cycleId);
      nextCrop = null;
      nextStage = 0;
      nextState = "empty";
      evidenceId = null;
    } else {
      if (!current.cropId) { database.exec("ROLLBACK"); return { ok: false, code: "PLOT_UNAVAILABLE" }; }
      nextCrop = null;
      nextStage = 0;
      nextState = "empty";
      evidenceId = null;
    }
    if (planting) database.prepare("INSERT INTO manor_planting_cycles (id,studentId,plotId,cropId,startedAt) VALUES (?,?,?,?,?)").run(cycleId, studentId, plotId, nextCrop, now);
    if (input.action === "clear" || input.action === "harvest") database.prepare("UPDATE manor_planting_cycles SET status=?,endedAt=?,harvestId=? WHERE id=? AND studentId=?")
      .run(input.action === "clear" ? "cleared" : "harvested", now, harvest?.id ?? null, cycleId, studentId);
    database.prepare("INSERT INTO manor_plot_actions (id,studentId,cycleId,action,operationId,correlationId,fromStage,toStage,createdAt) VALUES (?,?,?,?,?,?,?,?,?)")
      .run(plotActionId, studentId, cycleId, input.action, input.operationId, correlationId, current.stage, nextStage, now);
    database.prepare("UPDATE manor_plots SET plantingCycleId=? WHERE userId=? AND plot=?").run(nextCrop ? cycleId : null, studentId, plotId);
    database.prepare(`UPDATE manor_plots SET cropId = ?, stage = ?, state = ?, evidenceId = ?, revision = revision + 1,
      plantedAt = CASE WHEN ? IN ('plant','plant_and_nurture') THEN ? ELSE plantedAt END, updatedAt = ? WHERE userId = ? AND plot = ? AND revision = ?`)
      .run(nextCrop, nextStage, nextState, evidenceId, input.action, now, now, studentId, plotId, input.expectedRevision);
    appendEvent({ studentId, correlationId, eventType: `plot.${input.action}`, entityType: "plot", entityId: String(plotId), payload: { revision: input.expectedRevision + 1, consumptions, evidenceId: harvest?.evidenceId ?? evidenceId, harvest } });
    const updated = readPlot(studentId, plotId)!;
    const response = {
      ok: true,
      schemaVersion: MANOR_SCHEMA_VERSION,
      stateVersion: readStateVersion(studentId),
      correlationId,
      plot: publicPlot(updated, studentId),
      plantingCycle: projectPlantingCycles(studentId, database.prepare("SELECT * FROM manor_planting_cycles WHERE id=? AND studentId=?").all(cycleId, studentId) as unknown as PlantingCycleRow[])[0],
      harvest,
      consumptions,
      resources: { growthEnergy: readGrowthEnergy(studentId) },
    };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true, response };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function scheduleManorReview(studentId: string, input: { operationId: string; evidenceId: string; strategy: string; window: "tomorrow" | "three_days" }) {
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `review:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const evidence = database.prepare("SELECT missionId FROM learning_evidence WHERE id = ? AND studentId = ?").get(input.evidenceId, studentId) as { missionId: string } | undefined;
    if (!evidence) { database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const }; }
    const now = Date.now();
    const dueAt = now + (input.window === "tomorrow" ? 24 : 72) * 60 * 60 * 1000;
    const reviewId = id("review");
    database.prepare(`INSERT INTO review_schedules (id,studentId,evidenceId,missionId,strategy,dueAt,status,revision,createdAt,updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(studentId,evidenceId) DO UPDATE SET strategy=excluded.strategy,dueAt=excluded.dueAt,status='scheduled',completedAt=NULL,lastAnswer=NULL,feedbackJson=NULL,revision=review_schedules.revision+1,updatedAt=excluded.updatedAt`)
      .run(reviewId, studentId, input.evidenceId, evidence.missionId, input.strategy, dueAt, "scheduled", 1, now, now);
    appendEvent({ studentId, correlationId, eventType: "review.scheduled", entityType: "evidence", entityId: input.evidenceId, payload: { strategy: input.strategy, dueAt } });
    const review = readReviews(studentId).find((item) => item.evidenceId === input.evidenceId)!;
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(studentId), correlationId, review };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function saveManorArtifact(studentId: string, input: SaveManorArtifactInput) {
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `artifact:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const current = input.artifactId ? readManorArtifacts(studentId).find((artifact) => artifact.id === input.artifactId) : undefined;
    if (input.artifactId && !current) { database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_NOT_FOUND" as const }; }
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    if (current?.status === "archived") { database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_IMMUTABLE" as const, authoritative: { artifact: current } }; }
    if (current && current.revision !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { artifact: current } };
    }
    if (current && current.artifactType === "expression") { database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_REQUIRES_SUBMISSION" as const }; }
    if (current && database.prepare("SELECT id FROM manor_project_runs WHERE artifactId=? AND studentId=?").get(current.id, studentId)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "PROJECT_RESULT_IMMUTABLE" as const };
    }
    if (current && (current.artifactType !== input.artifactType || input.evidenceId !== undefined && current.evidenceId !== input.evidenceId
      || input.taskRunId !== undefined && current.taskRunId !== input.taskRunId)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_SOURCE_CONFLICT" as const };
    }
    const evidenceId = current?.evidenceId ?? input.evidenceId ?? null;
    const evidence = evidenceId ? database.prepare("SELECT * FROM learning_evidence WHERE id=? AND studentId=?").get(evidenceId, studentId) as unknown as EvidenceRow | undefined : undefined;
    if (evidenceId && !evidence) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "EVIDENCE_NOT_FOUND" as const };
    }
    const taskRunId = current?.taskRunId ?? input.taskRunId ?? evidence?.taskRunId ?? null;
    if (taskRunId && ![...readTaskRuns(studentId), ...readTaskRunHistory(studentId)].some((run) => run.id === taskRunId)) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "TASK_RUN_NOT_FOUND" as const };
    }
    if (evidence?.taskRunId && taskRunId !== evidence.taskRunId) { database.exec("ROLLBACK"); return { ok: false as const, code: "ARTIFACT_SOURCE_CONFLICT" as const }; }
    const artifactId = current?.id ?? id("artifact");
    const now = Date.now();
    if (current) database.prepare("UPDATE learning_artifacts SET title=?,content=?,visibility=?,contentHash=?,revision=revision+1,updatedAt=? WHERE id=? AND studentId=? AND revision=?")
      .run(input.title, input.content, input.visibility, hashPayload(input.content), now, artifactId, studentId, input.expectedRevision!);
    else database.prepare(`INSERT INTO learning_artifacts
      (id,studentId,evidenceId,artifactType,title,content,visibility,contentHash,revision,createdAt,updatedAt,taskRunId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(artifactId, studentId, evidenceId, input.artifactType, input.title, input.content, input.visibility, hashPayload(input.content), 1, now, now, taskRunId);
    appendEvent({ studentId, correlationId, eventType: "artifact.saved", entityType: "artifact", entityId: artifactId, payload: { evidenceId: input.evidenceId ?? null, visibility: input.visibility } });
    const artifact = readManorArtifacts(studentId).find((item) => item.id === artifactId)!;
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(studentId), correlationId, artifact, consumptions: [], resources: { growthEnergy: readGrowthEnergy(studentId) } };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function contributeManorClassBuild(studentId: string, classId: string, input: { operationId: string; amount: number; grantAllocations: GrantAllocation[] }) {
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `class-build:${classId}:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const buildBefore = classBuildState(classId);
    if (buildBefore.done) { database.exec("ROLLBACK"); return { ok: false as const, code: "CLASS_BUILD_COMPLETE" as const }; }
    const accepted = Math.min(input.amount, Math.max(0, buildBefore.cost - buildBefore.raised));
    const acceptedAllocations: GrantAllocation[] = [];
    let remaining = accepted;
    for (const allocation of input.grantAllocations) {
      if (remaining < 1) break;
      const amount = Math.min(allocation.amount, remaining);
      acceptedAllocations.push({ grantId: allocation.grantId, amount });
      remaining -= amount;
    }
    const contributionId = id("contrib");
    const consumed = consumeGrants({ studentId, allocations: acceptedAllocations, allowedPurposes: ["class_build"], requiredAmount: accepted, entityType: "class_build", entityId: classId, operationId: input.operationId, correlationId });
    if (!consumed.ok) { database.exec("ROLLBACK"); return consumed; }
    database.prepare("INSERT INTO class_build_contrib (id,classId,userId,amount,createdAt) VALUES (?,?,?,?,?)")
      .run(contributionId, classId, studentId, accepted, Date.now());
    appendEvent({ studentId, correlationId, eventType: "class_build.contributed", entityType: "class_build", entityId: classId, payload: { requested: input.amount, accepted } });
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: readStateVersion(studentId), correlationId, accepted, build: classBuildState(classId), consumptions: consumed.consumptions, resources: { growthEnergy: readGrowthEnergy(studentId) } };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function endManorSession(studentId: string, input: { operationId: string; expectedRevision: number }) {
  ensureProfile(studentId);
  const database = manorV2Database();
  const actionKey = `session-end:${hashPayload(input)}`;
  const correlationId = id("corr");
  database.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay === "conflict") { database.exec("ROLLBACK"); return { ok: false as const, code: "OPERATION_CONFLICT" as const }; }
    if (replay) { database.exec("ROLLBACK"); return { ok: true as const, response: replay }; }
    const profile = database.prepare("SELECT * FROM manor_profiles WHERE studentId = ?").get(studentId) as unknown as ManorProfileRow;
    if (profile.revision !== input.expectedRevision) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { profile } };
    }
    const now = Date.now();
    const quietUntil = nextBeijingDayStart(now);
    const update = database.prepare("UPDATE manor_profiles SET quietUntil = ?, endedAt = ?, revision = revision + 1, updatedAt = ? WHERE studentId = ? AND revision = ?")
      .run(quietUntil, now, now, studentId, input.expectedRevision);
    if (Number(update.changes) !== 1) {
      const authoritative = database.prepare("SELECT * FROM manor_profiles WHERE studentId = ?").get(studentId) as unknown as ManorProfileRow;
      database.exec("ROLLBACK");
      return { ok: false as const, code: "MANOR_REVISION_CONFLICT" as const, authoritative: { profile: authoritative } };
    }
    appendEvent({ studentId, correlationId, eventType: "session.ended", entityType: "profile", entityId: studentId, payload: { quietUntil } });
    const updated = database.prepare("SELECT * FROM manor_profiles WHERE studentId = ?").get(studentId) as unknown as ManorProfileRow;
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, stateVersion: updated.stateVersion, correlationId, profile: { quietUntil: updated.quietUntil, endedAt: updated.endedAt, revision: updated.revision } };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

type PlantingCycleRow = Omit<ManorPlantingCycle, "actions" | "historyComplete"> & { historyComplete: number };

function projectPlantingCycles(studentId: string, cycles: PlantingCycleRow[]): ManorPlantingCycle[] {
  const database = manorV2Database();
  return cycles.map((cycle) => ({ ...cycle, historyComplete: Boolean(cycle.historyComplete),
    actions: (database.prepare("SELECT id,action,operationId,correlationId,fromStage,toStage,createdAt FROM manor_plot_actions WHERE studentId=? AND cycleId=? ORDER BY createdAt,rowid")
      .all(studentId, cycle.id) as unknown as Array<Omit<ManorPlantingCycle["actions"][number], "allocations">>).map((action) => ({ ...action,
      allocations: database.prepare(`SELECT c.id,c.grantId,c.amount,c.purpose,g.evidenceId,e.missionId,e.taskRunId,e.assignmentId,e.resourceVersion,g.policyVersion
        FROM grant_consumptions c JOIN growth_grants g ON g.id=c.grantId AND g.studentId=c.studentId
        JOIN learning_evidence e ON e.id=g.evidenceId AND e.studentId=c.studentId
        WHERE c.studentId=? AND c.plantingCycleId=? AND c.plotActionId=? ORDER BY c.createdAt,c.id`).all(studentId, cycle.id, action.id) as unknown as ManorPlantingCycle["actions"][number]["allocations"],
    })),
  }));
}

// Kept for existing internal callers. HTTP and bootstrap use the bounded page reader.
export function readManorPlantingCycles(studentId: string, plotId?: number): ManorPlantingCycle[] {
  const cycles = manorV2Database().prepare("SELECT id,plotId,cropId,startedAt,endedAt,status,historyComplete,harvestId FROM manor_planting_cycles WHERE studentId=? AND (? IS NULL OR plotId=?) ORDER BY startedAt DESC,id DESC")
    .all(studentId, plotId ?? null, plotId ?? null) as unknown as PlantingCycleRow[];
  return projectPlantingCycles(studentId, cycles);
}

export function readManorPlantingCyclePage(studentId: string, plotId: number | undefined, options: { cursor?: string; limit?: number } = {}): ManorPlantingCyclePage | null {
  const limit = options.limit ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || plotId !== undefined && (!Number.isInteger(plotId) || plotId < 0 || plotId >= MANOR_PLOT_COUNT)) return null;
  let after: { startedAt: number; id: string } | null = null;
  if (options.cursor !== undefined) {
    if (!options.cursor || options.cursor.length > 600) return null;
    try {
      const value = JSON.parse(Buffer.from(options.cursor, "base64url").toString("utf8")) as Record<string, unknown>;
      if (value.studentId !== studentId || value.plotId !== (plotId ?? null) || !Number.isSafeInteger(value.startedAt) || Number(value.startedAt) < 0
        || typeof value.id !== "string" || !/^cycle_[a-z0-9-]{1,80}$/i.test(value.id)) return null;
      after = { startedAt: value.startedAt as number, id: value.id };
    } catch { return null; }
  }
  const rows = manorV2Database().prepare(`SELECT id,plotId,cropId,startedAt,endedAt,status,historyComplete,harvestId FROM manor_planting_cycles
    WHERE studentId=? AND (? IS NULL OR plotId=?) AND (? IS NULL OR startedAt<? OR (startedAt=? AND id<?))
    ORDER BY startedAt DESC,id DESC LIMIT ?`).all(studentId, plotId ?? null, plotId ?? null, after?.startedAt ?? null,
      after?.startedAt ?? null, after?.startedAt ?? null, after?.id ?? null, limit + 1) as unknown as PlantingCycleRow[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return { items: projectPlantingCycles(studentId, page), hasMore,
    nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ studentId, plotId: plotId ?? null, startedAt: last.startedAt, id: last.id })).toString("base64url") : null };
}

export function readManorProjects(studentId: string): ManorProjectRun[] {
  const database = manorV2Database();
  return readManorAssignments(studentId).assignments.flatMap((assignment) => {
    if (!assignment.datasetVersion) return [];
    const projectIds = [...new Set(assignment.missionIds.map((missionId) => findManorMission(missionId)?.projectId).filter((projectId): projectId is string => Boolean(projectId)))];
    return projectIds.map((projectId) => {
      const projectRunId = `project_${hashPayload([studentId, assignment.id, projectId]).slice(0, 32)}`;
      const row = database.prepare("SELECT * FROM manor_project_runs WHERE id=? AND studentId=?").get(projectRunId, studentId) as {
        revision: number; status: ManorProjectRun["status"]; contributionsJson: string; artifactId: string | null; content: string | null; completedAt: number | null;
      } | undefined;
      return { id: projectRunId, assignmentId: assignment.id, projectId, datasetVersion: assignment.datasetVersion!, status: row?.status ?? "incomplete",
        completionScope: "required_contributions" as const, evaluationStatus: "not_reviewed" as const,
        revision: row?.revision ?? 0, requiredSubjects: MANOR_PROJECT_SUBJECTS,
        contributions: row ? JSON.parse(row.contributionsJson) as ManorProjectRun["contributions"] : [],
        draft: row?.artifactId && row.content && !row.completedAt ? { artifactId: row.artifactId, content: row.content } : null,
        result: row?.artifactId && row.content && row.completedAt ? { artifactId: row.artifactId, content: row.content, completedAt: row.completedAt } : null };
    });
  });
}

export function saveManorProject(studentId: string, projectRunId: string, input: SaveManorProjectInput) {
  const database = manorV2Database();
  ensureProfile(studentId);
  database.exec("BEGIN IMMEDIATE");
  try {
    const project = readManorProjects(studentId).find((item) => item.id === projectRunId);
    if (!project) { database.exec("ROLLBACK"); return { ok: false as const, code: "PROJECT_NOT_FOUND" }; }
    const actionKey = `project:${projectRunId}:${hashPayload(input)}`;
    const replay = replayOperation<Record<string, unknown>>(studentId, input.operationId, actionKey);
    if (replay) { database.exec("ROLLBACK"); return replay === "conflict" ? { ok: false as const, code: "OPERATION_CONFLICT" } : { ok: true as const, response: replay }; }
    if (project.revision !== input.expectedRevision || project.status === "complete") { database.exec("ROLLBACK"); return { ok: false as const, code: "MANOR_REVISION_CONFLICT", authoritative: { project } }; }
    if (input.datasetVersion !== project.datasetVersion) { database.exec("ROLLBACK"); return { ok: false as const, code: "DATASET_VERSION_CONFLICT" }; }
    if (input.contributions.length > 3 || new Set(input.contributions.map((item) => item.subject)).size !== input.contributions.length
      || input.contributions.some((item) => !MANOR_PROJECT_SUBJECTS.includes(item.subject))) {
      database.exec("ROLLBACK"); return { ok: false as const, code: "PROJECT_SOURCE_INVALID" };
    }
    const artifacts = readManorArtifacts(studentId);
    for (const contribution of input.contributions) {
      const evidence = database.prepare("SELECT * FROM learning_evidence WHERE id=? AND studentId=?").get(contribution.evidenceId, studentId) as unknown as EvidenceRow | undefined;
      const artifact = artifacts.find((item) => item.id === contribution.artifactId);
      const mission = evidence ? findManorMission(evidence.missionId) : undefined;
      const objective = evidence?.taskRunId ? database.prepare("SELECT status FROM learning_evidence WHERE studentId=? AND taskRunId=? AND missionId=? AND evidenceType='mastery'")
        .get(studentId, evidence.taskRunId, evidence.missionId) as { status: string } | undefined : undefined;
      if (!evidence || evidence.evidenceType !== "expression" || evidence.status !== "accepted_mastery" || !objective || !acceptedEvidence(objective.status)
        || evidence.assignmentId !== project.assignmentId || evidence.datasetVersion !== project.datasetVersion || mission?.projectId !== project.projectId
        || mission.subject !== contribution.subject || artifact?.evidenceId !== evidence.id || artifact.status !== "archived"
        || artifact.taskRunId !== evidence.taskRunId || artifact.acceptedRevision !== artifact.revision || artifact.acceptedContentHash !== hashPayload(artifact.content)) {
        database.exec("ROLLBACK"); return { ok: false as const, code: "PROJECT_SOURCE_INVALID" };
      }
    }
    const now = Date.now();
    const allContributions = MANOR_PROJECT_SUBJECTS.every((subject) => input.contributions.some((item) => item.subject === subject));
    if (input.intent === "complete" && !allContributions) { database.exec("ROLLBACK"); return { ok: false as const, code: "PROJECT_CONTRIBUTIONS_REQUIRED" }; }
    const complete = input.intent !== "draft" && allContributions;
    const artifactId = project.draft?.artifactId ?? id("artifact");
    const correlationId = id("corr");
    if (project.draft) database.prepare("UPDATE learning_artifacts SET content=?,contentHash=?,revision=revision+1,updatedAt=? WHERE id=? AND studentId=?")
      .run(input.content, hashPayload(input.content), now, artifactId, studentId);
    else database.prepare(`INSERT INTO learning_artifacts (id,studentId,artifactType,title,content,visibility,contentHash,revision,createdAt,updatedAt)
      VALUES (?,?,?,?,?,'private',?,1,?,?)`).run(artifactId, studentId, "project", project.projectId, input.content, hashPayload(input.content), now, now);
    database.prepare(`INSERT INTO manor_project_runs (id,studentId,assignmentId,projectId,datasetVersion,status,revision,contributionsJson,artifactId,content,completedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,revision=excluded.revision,contributionsJson=excluded.contributionsJson,
        artifactId=excluded.artifactId,content=excluded.content,completedAt=excluded.completedAt`).run(projectRunId, studentId, project.assignmentId, project.projectId, project.datasetVersion,
        complete ? "complete" : "incomplete", project.revision + 1, JSON.stringify(input.contributions), artifactId, input.content, complete ? now : null);
    appendEvent({ studentId, correlationId, eventType: complete ? "project.completed" : "project.draft_saved", entityType: "project", entityId: projectRunId,
      payload: { datasetVersion: project.datasetVersion, contributions: input.contributions, artifactId } });
    const response = { ok: true, schemaVersion: MANOR_SCHEMA_VERSION, correlationId, stateVersion: readStateVersion(studentId), project: readManorProjects(studentId).find((item) => item.id === projectRunId)!,
      artifact: readManorArtifacts(studentId).find((item) => item.id === artifactId)! };
    recordOperation(studentId, input.operationId, actionKey, response);
    database.exec("COMMIT");
    return { ok: true as const, response };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

export function manorBootstrap(studentId: string, classId?: string, options: { readOnly?: boolean } = {}) {
  const database = manorV2Database();
  const storedProfile = database.prepare("SELECT * FROM manor_profiles WHERE studentId = ?").get(studentId) as unknown as ManorProfileRow | undefined;
  const profile = options.readOnly
    ? storedProfile ?? { studentId, preferencesJson: "[]", weeklyGoal: 3, personalized: 1, quietUntil: null, endedAt: null, revision: 1, stateVersion: 1, updatedAt: 0 }
    : ensureProfile(studentId);
  const farm = options.readOnly ? manorFarmStateReadOnly(studentId) : manorFarmState(studentId);
  const storedPlots = database.prepare(`SELECT plot,cropId,stage,plantedAt,updatedAt,
    revision,state,objectiveId,evidenceId,plantingCycleId FROM manor_plots WHERE userId = ? ORDER BY plot`).all(studentId) as unknown as Array<{
      plot: number;
      cropId: string | null;
      stage: number;
      plantedAt: number | null;
      updatedAt: number | null;
      revision: number;
      state: string;
      objectiveId: string | null;
      evidenceId: string | null;
      plantingCycleId: string | null;
    }>;
  const plotRows = storedPlots.length === MANOR_PLOT_COUNT ? storedPlots : farm.plots.map((plot) => ({
    ...plot,
    revision: 1,
    state: plot.cropId ? "planted" : "empty",
    objectiveId: null,
    evidenceId: null,
    plantingCycleId: null,
  }));
  const decoration = options.readOnly ? manorStateReadOnly(studentId) : manorState(studentId);
  const today = bjDay();
  const taskRuns = readTaskRuns(studentId);
  const todayCompleted = taskRuns.some((run) => run.completedAt != null && bjDay(run.completedAt) === today);
  const subject = database.prepare("SELECT id,name,department FROM users WHERE id=?").get(studentId) as { id: string; name: string; department: string } | undefined;
  const plantingPage = readManorPlantingCyclePage(studentId, undefined)!;

  return {
    schemaVersion: MANOR_SCHEMA_VERSION,
    stateVersion: profile.stateVersion,
    correlationId: `corr_${randomUUID()}`,
    subject: { ...(subject ?? { id: studentId, name: "学生", department: "" }), gradeBand: manorCanonicalGrade(studentId) },
    daily: { day: today, completed: todayCompleted },
    taskRuns,
    taskRunHistory: readTaskRunHistory(studentId),
    profile: {
      preferences: JSON.parse(profile.preferencesJson) as string[],
      weeklyGoal: profile.weeklyGoal,
      personalized: Boolean(profile.personalized),
      quietUntil: profile.quietUntil,
      endedAt: profile.endedAt,
      revision: profile.revision,
    },
    policy: {
      version: MANOR_POLICY_VERSION,
      unlockedPlotCount: manorOpenPlotCount(studentId),
      plotCount: MANOR_PLOT_COUNT,
      maxStage: MANOR_CROP_STAGE_MAX,
      rankingEnabled: false,
      inactivityPenalty: false,
      artifactSaveCost: 0,
      reviewCost: 0,
      plotUnlock: { kind: "fixed_availability", unlockedCount: manorOpenPlotCount(studentId), remainingReason: "其余地块暂未开放，不以成长值解锁。" },
    },
    ...readManorAssignments(studentId),
    projects: readManorProjects(studentId),
    plantingCycles: plantingPage.items,
    plantingCyclePagination: { nextCursor: plantingPage.nextCursor, hasMore: plantingPage.hasMore },
    historyCoverage: {
      legacyConsumptionCount: Number((database.prepare("SELECT COUNT(*) AS n FROM grant_consumptions WHERE studentId=? AND entityType='plot' AND plantingCycleId IS NULL").get(studentId) as { n: number }).n),
      legacyHarvestCount: Number((database.prepare("SELECT COUNT(*) AS n FROM manor_harvests WHERE userId=? AND plantingCycleId IS NULL").get(studentId) as { n: number }).n),
    },
    plots: plotRows.map((plot) => ({
      id: plot.plot,
      unlocked: plot.plot < manorOpenPlotCount(studentId),
      status: plotStatus(plot, studentId),
      cropId: plot.cropId,
      stage: plot.stage,
      revision: plot.revision,
      objectiveId: plot.objectiveId,
      evidenceId: plot.evidenceId,
      plantingCycleId: plot.plantingCycleId,
      plantedAt: plot.plantedAt,
      updatedAt: plot.updatedAt,
    })),
    resources: {
      growthEnergy: Number((database.prepare("SELECT COALESCE(SUM(remainingUnits),0) AS units FROM growth_grants WHERE studentId = ? AND status IN ('available','partially_consumed')").get(studentId) as { units: number }).units),
      points: decoration.balance,
      availableByPurpose: Object.fromEntries(["plot", "support_plot", "class_build", "review"].map((purpose) => [purpose,
        (database.prepare("SELECT * FROM growth_grants WHERE studentId=? AND status IN ('available','partially_consumed')").all(studentId) as unknown as GrantRow[])
          .filter((grant) => (JSON.parse(grant.allowedPurposesJson) as string[]).includes(purpose)).reduce((total, grant) => total + grant.remainingUnits, 0)])),
      harvestedTotal: farm.harvestedTotal,
      harvests: farm.harvests,
    },
    cropAccess: farm.cropAccess,
    harvestHistory: database.prepare("SELECT id,cropId,plot AS plotId,evidenceId,harvestedAt,plantingCycleId FROM manor_harvests WHERE userId=? ORDER BY harvestedAt DESC").all(studentId),
    inventory: decoration.items,
    neighbors: classId ? manorNeighbors(classId, studentId) : [],
    classBuild: classId ? classBuildState(classId) : null,
    reviews: readReviews(studentId),
    artifacts: readManorArtifacts(studentId),
    grants: (database.prepare("SELECT * FROM growth_grants WHERE studentId = ? ORDER BY issuedAt").all(studentId) as unknown as GrantRow[]).map(publicGrant),
    evidence: (database.prepare("SELECT * FROM learning_evidence WHERE studentId = ? ORDER BY createdAt DESC").all(studentId) as unknown as EvidenceRow[]).map(publicEvidence),
  };
}
