import { z } from "zod";
import { manorError, manorMutationResponse, manorMutationUser } from "@/lib/manor/server-http";
import { actOnManorReview } from "@/lib/server/manorV2";

export const runtime = "nodejs";
const Body = z.object({
  operationId: z.string().min(8).max(80), action: z.enum(["complete", "defer"]),
  answer: z.string().trim().min(1).max(32).optional(), strategy: z.string().trim().min(2).max(120).optional(),
  expectedRevision: z.number().int().min(1),
}).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await manorMutationUser(request);
  if (access.response) return access.response;
  const { id } = await context.params;
  if (!z.string().min(8).max(100).safeParse(id).success) return manorError("INVALID_INPUT", 400);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(actOnManorReview(access.user.id, id, parsed.data));
}
