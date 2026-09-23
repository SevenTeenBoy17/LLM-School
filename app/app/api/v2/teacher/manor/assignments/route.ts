import { NextResponse } from "next/server";
import { z } from "zod";
import { MANOR_GRADE_BANDS } from "@/lib/manor/v7-learning-contracts";
import { manorError, manorMutationResponse } from "@/lib/manor/server-http";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { publishManorAssignment, teacherManorAssignments } from "@/lib/server/manorV2";

export const runtime = "nodejs";
const Body = z.object({
  operationId: z.string().min(8).max(80), title: z.string().trim().min(2).max(100),
  missionIds: z.array(z.string().min(1).max(80)).min(1).max(12), gradeBand: z.enum(MANOR_GRADE_BANDS),
  resourceVersion: z.string().trim().min(1).max(100), datasetVersion: z.string().trim().min(1).max(100).optional(),
  rewardUnits: z.number().int().min(0).max(24).default(0),
  studentIds: z.array(z.string().min(1).max(100)).min(1).max(200).optional(),
  supersedesId: z.string().min(8).max(100).optional(),
}).strict();
export async function GET() {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "teacher" || !user.classId) return manorError("FORBIDDEN", 403);
  const response = teacherManorAssignments(user.id);
  return response ? NextResponse.json(response, { headers: { "cache-control": "no-store" } }) : manorError("FORBIDDEN", 403);
}
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "teacher" || !user.classId) return manorError("FORBIDDEN", 403);
  if (await isDemoSession()) return manorError("DEMO_READONLY", 403);
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return manorError(guard.code, guard.status);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  const result = publishManorAssignment(user.id, parsed.data);
  return !result.ok && result.code === "FORBIDDEN" ? manorError("FORBIDDEN", 403) : manorMutationResponse(result);
}
