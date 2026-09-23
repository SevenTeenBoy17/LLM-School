import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { manorError, manorMutationResponse } from "@/lib/manor/server-http";
import { readManorScenePolicy, publishManorScenePolicy } from "@/lib/server/manorV7Scene";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Body = z.object({ operationId: z.string().min(8).max(80), classId: z.string().min(1).max(100), expectedRevision: z.number().int().nonnegative(), unlockedCount: z.number().int().min(10).max(24) }).strict();
export async function GET() {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "teacher") return manorError("FORBIDDEN", 403);
  const policy = readManorScenePolicy(user.id);
  return policy ? NextResponse.json({ policy }, { headers: { "cache-control": "no-store" } }) : manorError("CLASS_NOT_FOUND", 404);
}
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "teacher" || await isDemoSession()) return manorError("FORBIDDEN", 403);
  if (request.headers.get("x-manor-owner") !== user.id) return manorError("IDENTITY_CHANGED", 409);
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return manorError(guard.code, guard.status);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return manorError("INVALID_INPUT", 400);
  return manorMutationResponse(publishManorScenePolicy(user.id, parsed.data));
}
