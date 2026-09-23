import { NextResponse } from "next/server";
import { manorBootstrap } from "@/lib/server/manorV2";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { manorSceneSnapshot } from "@/lib/server/manorV7Scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: "AUTH_REQUIRED", message: "请重新登录。" } }, { status: 401 });
  if (user.role !== "student") return NextResponse.json({ error: { code: "FORBIDDEN", message: "当前账号不能查看学生庄园。" } }, { status: 403 });
  const learning = manorBootstrap(user.id, user.classId, { readOnly: await isDemoSession() });
  const scene = manorSceneSnapshot(user.id);
  return NextResponse.json({ ...learning, scene, neighbors: scene.neighbors }, {
    headers: { "cache-control": "no-store" },
  });
}
