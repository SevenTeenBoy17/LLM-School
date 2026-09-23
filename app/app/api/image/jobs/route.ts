import { NextResponse } from "next/server";
import fs from "node:fs";
import { getSessionUser } from "@/lib/server/session";
import { listImageJobs, imageJobsToday, pruneImageJobs } from "@/lib/server/db";

/** GET /api/image/jobs —— 本人生图任务列表（不暴露服务器文件路径）。
 *  M5/B6：顺带惰性执行本人保留策略（>30 天 或 超出最近 200 张 → 行与文件同删）。 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    for (const f of pruneImageJobs(user.id)) {
      try { fs.unlinkSync(f); } catch { /* 文件已不存在：行已删即可 */ }
    }
  } catch { /* 清理失败不影响列表返回 */ }
  const jobs = listImageJobs(user.id).map((j) => ({
    id: j.id, prompt: j.prompt, size: j.size, status: j.status,
    error: j.error, createdAt: j.createdAt, finishedAt: j.finishedAt,
  }));
  return NextResponse.json({ jobs, usedToday: imageJobsToday(user.id) });
}
