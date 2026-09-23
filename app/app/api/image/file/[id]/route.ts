import { NextResponse } from "next/server";
import fs from "node:fs";
import { getSessionUser } from "@/lib/server/session";
import { getImageJob } from "@/lib/server/db";

/** GET /api/image/file/[id] —— 仅本人（或管理员）可取图；路径来自 DB 记录，不接受任意文件名。 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const job = getImageJob(id);
  if (!job || job.status !== "done" || !job.filePath) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  // 终审 P2：非本人统一返回 404（与「不存在」同响应），消除他人任务存在性/完成态探测预言机
  if (job.userId !== user.id && !isAdmin) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let buf: Buffer;
  try { buf = fs.readFileSync(job.filePath); } catch { return NextResponse.json({ error: "gone" }, { status: 404 }); }
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" },
  });
}
