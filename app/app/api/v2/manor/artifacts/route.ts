import { manorError, manorMutationResponse, manorMutationUser } from "@/lib/manor/server-http";
import { saveManorArtifact } from "@/lib/server/manorV2";
import { ArtifactBody } from "./input";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const access = await manorMutationUser(request);
  if (access.response) return access.response;
  const parsed = ArtifactBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(saveManorArtifact(access.user.id, parsed.data));
}
