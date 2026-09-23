import { z } from "zod";
import { MANOR_TASK_PHASES } from "@/lib/manor/v6-contracts";
import { manorError, manorMutationResponse, manorMutationUser } from "@/lib/manor/server-http";
import { saveManorTaskRun } from "@/lib/server/manorV2";

export const runtime = "nodejs";
const Body = z.object({
  operationId: z.string().min(8).max(80), missionId: z.string().min(1).max(80), phase: z.enum(MANOR_TASK_PHASES),
  answer: z.string().max(2000).optional(), reflection: z.string().trim().max(2000).optional(),
  evidenceId: z.string().min(8).max(100).optional(), expectedRevision: z.number().int().min(0),
  assignmentId: z.string().min(8).max(100).optional(), restart: z.boolean().optional(),
}).strict();

export async function POST(request: Request) {
  const access = await manorMutationUser(request);
  if (access.response) return access.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(saveManorTaskRun(access.user.id, parsed.data));
}
