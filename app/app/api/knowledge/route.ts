import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { listKbFiles, addKbFile, addAudit, kbUsage } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { canAccessResearch } from "@/lib/nav";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

// GET /api/knowledge —— 当前用户可见的知识库文件（自己上传的 + 非「仅本人」范围的）。
export async function GET() {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  return jsonNoStore({ files: listKbFiles(user.id, isAdmin, user.classId, user.stage), userId: user.id });
}

const PostBody = z.object({
  name: z.string().min(1).max(160),
  type: z.string().max(8).optional(),
  sizeBytes: z.number().min(0).max(200 * 1024 * 1024),
  scope: z.enum(["self", "course", "college", "all"]).optional().default("self"),
  textContent: z.string().max(200_000).optional(), // 已提取的纯文本（文本类文件客户端读取；二进制则为空）
});

function typeFromName(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "IMG";
  return "TXT";
}

// POST —— 上传一个文件的元数据 + 已提取文本（诚实：无文本的二进制文件仅按文件名/说明检索）。
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (!canAccessResearch(user.role)) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  if (await isDemoSession()) return jsonNoStore({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return jsonNoStore({ error: guard.code, message: guard.message }, { status: guard.status });
  const rl = rateLimit(`kb:${user.id}`, 12, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = PostBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });
  const usage = kbUsage(user.id);
  const incomingTextChars = parsed.data.textContent?.length ?? 0;
  if (usage.files >= 200 || usage.textChars + incomingTextChars > 5_000_000 || usage.bytes + parsed.data.sizeBytes > 2 * 1024 * 1024 * 1024) {
    return jsonNoStore({ error: "knowledge_quota_exceeded", message: "知识库容量已达上限，请先整理旧资料。" }, { status: 413 });
  }

  const file = addKbFile(user.id, user.name, {
    name: parsed.data.name,
    type: parsed.data.type || typeFromName(parsed.data.name),
    sizeBytes: parsed.data.sizeBytes,
    scope: parsed.data.scope,
    textContent: parsed.data.textContent,
    ownerClassId: user.classId, // 记录上传者班级，用于「课程共享」真实成员判定
    ownerStage: user.stage, // 记录上传者学段(学部)，用于「学部共享」真实成员判定
  });
  addAudit({ userId: user.id, role: user.role, path: "/api/knowledge", action: "kb_upload", result: "allow" });
  return jsonNoStore({ file }, { status: 201 });
}
