import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { listArtifacts, deleteArtifact, setArtifactVisibility, listClassArtifacts } from "@/lib/server/db";
import { canAccessResearch } from "@/lib/nav";

/**
 * /api/artifacts —— 教学产物库（V1 归档/管理 + V2 显式发布）。
 *
 * 权限口径：
 * · 教研侧（canAccessResearch）：GET 自己的全部产物；PATCH 发布/撤回；DELETE 删除。
 *   三者的 owner 判定都在 SQL 层（WHERE ... AND ownerId），非本人操作影响行数为 0。
 * · 学生：GET 返回**本班已发布**产物（scope="class"）。classId 取自会话（服务端权威），
 *   不接受任何客户端传入的班级参数——学生不能翻别班的墙，教师也不能替别班发布。
 * · 发布目标班级同理来自**教师会话的 classId**，PATCH 体里没有 classId 字段。
 */

const patchSchema = z.object({
  id: z.string().min(1),
  visibility: z.enum(["private", "class"]),
});

function jsonNoStore(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set("cache-control", "no-store");
  return res;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (canAccessResearch(user.role)) {
    return jsonNoStore({ scope: "own", artifacts: listArtifacts(user.id) });
  }
  if (user.role === "student") {
    return jsonNoStore({ scope: "class", artifacts: listClassArtifacts(user.classId) });
  }
  return jsonNoStore({ error: "forbidden" }, { status: 403 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  let json: unknown;
  try { json = await request.json(); } catch { return jsonNoStore({ error: "invalid_input" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });
  const ok = setArtifactVisibility(
    user.id,
    parsed.data.id,
    parsed.data.visibility,
    parsed.data.visibility === "class" ? user.classId : null,
  );
  return jsonNoStore(ok ? { ok: true } : { error: "not_found" }, ok ? undefined : { status: 404 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonNoStore({ error: "invalid_input" }, { status: 400 });
  const ok = deleteArtifact(user.id, id);
  return jsonNoStore(ok ? { ok: true } : { error: "not_found" }, ok ? undefined : { status: 404 });
}
