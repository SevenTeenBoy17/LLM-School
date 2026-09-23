import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { getRolePerms, setRolePerms, addAudit } from "@/lib/server/db";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

type Ctx = { params: Promise<{ roleId: string }> };
function isAdmin(role: string) { return role === "admin" || role === "college-admin"; }
// 权限页的 UI 角色集合（白名单）——防止任意字符串写入 role_perms 主键。
const VALID_ROLES = new Set(["sysadmin", "college-admin", "teacher", "student", "guest"]);

// GET /api/admin/permissions/[roleId] —— 角色权限位覆盖（仅管理员；null=用页面默认）。
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { roleId } = await params;
  if (!VALID_ROLES.has(roleId)) return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  return NextResponse.json({ perms: getRolePerms(roleId) });
}

const PutBody = z.object({
  perms: z.record(z.string().max(40), z.boolean()).refine((p) => Object.keys(p).length <= 40, { message: "too_many_keys" }),
});

// PUT —— 保存角色权限位（仅管理员）。
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!isAdmin(user.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return NextResponse.json({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });
  const { roleId } = await params;
  if (!VALID_ROLES.has(roleId)) return NextResponse.json({ error: "invalid_role" }, { status: 400 });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  setRolePerms(roleId, parsed.data.perms);
  addAudit({ userId: user.id, role: user.role, path: `/api/admin/permissions/${roleId}`, action: "role_perms_update", result: "allow" });
  return NextResponse.json({ ok: true, perms: parsed.data.perms });
}
