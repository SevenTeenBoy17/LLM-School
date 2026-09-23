import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { changePassword, addAudit } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

// 新口令强度：≥8 位，含大小写字母与数字（与登录页提示一致）。
const strong = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

const PostBody = z.object({
  oldPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

// POST /api/profile/password —— 校验旧口令后写入新 salt+PBKDF2（仅本人）。
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`pwd:${user.id}`, 5, 60_000); // 防爆破：每分钟最多 5 次
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (!strong(parsed.data.newPassword)) return NextResponse.json({ error: "weak_password" }, { status: 400 });

  const res = await changePassword(user.id, parsed.data.oldPassword, parsed.data.newPassword);
  if (!res.ok) {
    addAudit({ userId: user.id, role: user.role, path: "/api/profile/password", action: "password_change", result: "deny" });
    return NextResponse.json({ error: res.error === "wrong_password" ? "wrong_password" : "failed" }, { status: 400 });
  }
  addAudit({ userId: user.id, role: user.role, path: "/api/profile/password", action: "password_change", result: "allow" });
  return NextResponse.json({ ok: true });
}
