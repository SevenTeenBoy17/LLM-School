import { NextResponse } from "next/server";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { addAudit, getKbFile, deleteKbFile } from "@/lib/server/db";
import { canAccessResearch } from "@/lib/nav";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

type Ctx = { params: Promise<{ id: string }> };

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

// GET —— 文件详情 + 文本预览（仅可见者）。
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  const file = getKbFile(user.id, isAdmin, user.classId, user.stage, id);
  if (!file) return jsonNoStore({ error: "not_found" }, { status: 404 });
  return jsonNoStore({ file });
}

// DELETE —— 删除（仅上传者本人）。
export async function DELETE(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return jsonNoStore({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return jsonNoStore({ error: guard.code, message: guard.message }, { status: guard.status });
  const { id } = await params;
  const ok = deleteKbFile(user.id, id);
  if (!ok) {
    addAudit({ userId: user.id, role: user.role, path: "/api/knowledge", action: "kb_delete", result: "deny" });
    return jsonNoStore({ error: "not_found" }, { status: 404 });
  }
  addAudit({ userId: user.id, role: user.role, path: "/api/knowledge", action: "kb_delete", result: "allow" });
  return jsonNoStore({ ok: true });
}
