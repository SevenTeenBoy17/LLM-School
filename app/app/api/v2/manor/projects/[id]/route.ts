import { z } from "zod";
import { MANOR_PROJECT_SUBJECTS } from "@/lib/manor/v7-learning-contracts";
import { manorError, manorMutationResponse, manorMutationUser } from "@/lib/manor/server-http";
import { saveManorProject } from "@/lib/server/manorV2";

export const runtime = "nodejs";
const Body = z.object({
  operationId: z.string().min(8).max(80), expectedRevision: z.number().int().min(0),
  datasetVersion: z.string().trim().min(1).max(100), content: z.string().trim().min(8).max(2000),
  intent: z.enum(["draft", "complete"]).optional(),
  contributions: z.array(z.object({ subject: z.enum(MANOR_PROJECT_SUBJECTS), evidenceId: z.string().min(8).max(100), artifactId: z.string().min(8).max(100) }).strict()).max(3),
}).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await manorMutationUser(request);
  if (access.response) return access.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(saveManorProject(access.user.id, (await params).id, parsed.data));
}
