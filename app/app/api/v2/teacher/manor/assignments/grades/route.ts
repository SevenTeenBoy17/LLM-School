import { z } from "zod";
import { MANOR_GRADE_BANDS } from "@/lib/manor/v7-learning-contracts";
import { manorError, manorMutationResponse } from "@/lib/manor/server-http";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { setManorStudentGrades } from "@/lib/server/manorV2";

export const runtime = "nodejs";
const Body = z.object({ operationId: z.string().min(8).max(80), students: z.array(z.object({
  studentId: z.string().min(1).max(100), gradeBand: z.enum(MANOR_GRADE_BANDS),
}).strict()).min(1).max(200) }).strict();
export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "teacher" || !user.classId) return manorError("FORBIDDEN", 403);
  if (await isDemoSession()) return manorError("DEMO_READONLY", 403);
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return manorError(guard.code, guard.status);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  const result = setManorStudentGrades(user.id, parsed.data);
  return !result.ok && result.code === "FORBIDDEN" ? manorError("FORBIDDEN", 403) : manorMutationResponse(result);
}
