import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { updateUserProfile, getUserPrefs, findUserById, toSessionUser, addAudit } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

const PutBody = z.object({
  name: z.string().min(1).max(40).optional(),
  bio: z.string().max(200).optional(),
});

// PUT /api/profile/account —— 更新姓名 / 个性简介（仅本人）。姓名写 users，简介写 user_prefs。
export async function PUT(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`account:${user.id}`, 20, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  updateUserProfile(user.id, parsed.data);
  addAudit({ userId: user.id, role: user.role, path: "/api/profile/account", action: "profile_update", result: "allow" });
  const fresh = findUserById(user.id);
  return NextResponse.json({ user: fresh ? toSessionUser(fresh) : user, bio: getUserPrefs(user.id).bio });
}
