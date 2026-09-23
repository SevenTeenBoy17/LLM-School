import "server-only";
import { NextResponse } from "next/server";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { manorQuietUntil } from "@/lib/server/manorV2";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

export async function manorMutationUser(request: Request, options: { allowQuiet?: boolean } = {}) {
  const user = await getSessionUser();
  if (!user) return { response: manorError("AUTH_REQUIRED", 401) };
  if (user.role !== "student") return { response: manorError("FORBIDDEN", 403) };
  if (await isDemoSession()) return { response: manorError("DEMO_READONLY", 403) };
  const guard = validateJsonMutationRequest(request);
  if (!guard.ok) return { response: manorError(guard.code, guard.status) };
  if (!options.allowQuiet && manorQuietUntil(user.id)) return { response: manorError("SESSION_QUIET", 423) };
  return { user };
}

export function manorError(code: string, status: number, authoritative?: unknown) {
  return NextResponse.json({ error: { code, message: "当前操作未保存，请检查输入或同步最新状态。", authoritative } }, { status, headers: { "cache-control": "no-store" } });
}

export function manorMutationResponse(result: { ok: true; response: unknown } | { ok: false; code: string; authoritative?: unknown }) {
  if (result.ok) return NextResponse.json(result.response, { headers: { "cache-control": "no-store" } });
  return manorError(result.code, result.code.endsWith("_NOT_FOUND") ? 404 : result.code === "INVALID_INPUT" ? 400 : 409, result.authoritative);
}
