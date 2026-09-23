import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { lookupManorOperation } from "@/lib/server/manorV2";
import { manorError } from "@/lib/manor/server-http";
import { manorSceneSnapshot } from "@/lib/server/manorV7Scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return manorError("AUTH_REQUIRED", 401);
  if (user.role !== "student") return manorError("FORBIDDEN", 403);
  const { id } = await context.params;
  if (id.length < 8 || id.length > 80) return manorError("INVALID_INPUT", 400);
  const receipt = lookupManorOperation(user.id, id);
  // A transaction receipt must not re-publish classmates who withdrew later.
  if (receipt?.result && typeof receipt.result === "object" && "scene" in receipt.result) {
    receipt.result = { ...receipt.result, scene: manorSceneSnapshot(user.id) };
  }
  return receipt ? NextResponse.json(receipt, { headers: { "cache-control": "no-store" } }) : manorError("OPERATION_NOT_FOUND", 404);
}
