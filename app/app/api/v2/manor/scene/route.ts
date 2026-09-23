import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { manorError, manorMutationUser, manorMutationResponse } from "@/lib/manor/server-http";
import { MANOR_LAYOUT_SLOTS } from "@/lib/manor/v7-scene-contracts";
import { manorSceneSnapshot, manorSceneVisit, mutateManorScene } from "@/lib/server/manorV7Scene";
import { manorQuietUntil } from "@/lib/server/manorV2";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const operationId = z.string().min(8).max(80);
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("purchase"), operationId, partId: z.string().min(1).max(60) }).strict(),
  z.object({ action: z.literal("layout"), operationId, itemId: z.string().min(1).max(100), slotId: z.enum(MANOR_LAYOUT_SLOTS.map((slot) => slot.id)).nullable(), expectedRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("publication"), operationId, enabled: z.boolean(), expectedRevision: z.number().int().nonnegative(), expectedClassId: z.string().min(1).max(100).nullable() }).strict(),
]);
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "student") return manorError("FORBIDDEN", 403);
  if (request.headers.has("x-manor-owner") && request.headers.get("x-manor-owner") !== user.id) return manorError("IDENTITY_CHANGED", 409);
  const visit = new URL(request.url).searchParams.get("visit");
  const result = visit ? manorSceneVisit(user.id, visit) : manorSceneSnapshot(user.id);
  return result ? NextResponse.json(result, { headers: { "cache-control": "no-store" } }) : manorError("PUBLICATION_NOT_FOUND", 404);
}
export async function POST(request: Request) {
  const auth = await manorMutationUser(request, { allowQuiet: true });
  if (auth.response) return auth.response;
  if (request.headers.get("x-manor-owner") !== auth.user.id) return manorError("IDENTITY_CHANGED", 409);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  // Privacy withdrawal remains available after the student ends the session.
  if (!(parsed.data.action === "publication" && !parsed.data.enabled) && manorQuietUntil(auth.user.id)) return manorError("SESSION_QUIET", 423);
  return manorMutationResponse(mutateManorScene(auth.user.id, parsed.data));
}
