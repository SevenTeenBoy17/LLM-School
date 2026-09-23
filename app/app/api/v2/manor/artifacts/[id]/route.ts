import { manorError, manorMutationResponse, manorMutationUser } from "@/lib/manor/server-http";
import { saveManorArtifact } from "@/lib/server/manorV2";
import { ArtifactBody } from "../input";

export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await manorMutationUser(request);
  if (access.response) return access.response;
  const json = await request.json().catch(() => null) as Record<string, unknown> | null;
  const artifactId = (await params).id;
  if (!json || typeof json !== "object" || Array.isArray(json) || (json.artifactId !== undefined && json.artifactId !== artifactId)) return manorError("INVALID_INPUT", 400);
  const parsed = ArtifactBody.safeParse({ ...json, artifactId });
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(saveManorArtifact(access.user.id, parsed.data));
}
