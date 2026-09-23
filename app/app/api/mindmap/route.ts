import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { generateReply } from "@/lib/server/llm";
import { getUploadsForUser } from "@/lib/server/db";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";

/**
 * W-B2 · AI 思维导图（调研启示③：LLM 受约束 Markdown → markmap 前端渲染，零自研布局）。
 * 双入口：主题生成 / 从已上传文档生成（复用 W-B1 解析地基）。
 * schema 校验硬约束：深度 ≤4、节点 ≤50——LLM 输出越界先重试一次，仍越界则**截断修剪**
 * 并如实告知（clamped: true），绝不渲染爆炸或空树。
 * 产物常驻「AI 生成」标识由前端承担（规格红线 R3），导出 Markdown 头部也写入标识。
 */

export const runtime = "nodejs";

const Body = z.object({
  topic: z.string().max(120).optional(),
  uploadId: z.string().max(40).optional(),
}).refine((v) => Boolean(v.topic?.trim()) || Boolean(v.uploadId), { message: "topic_or_upload_required" });

export interface MindmapValidation { ok: boolean; md: string; nodes: number; depth: number; clamped: boolean }

/** 校验并按需修剪：只认 #..#### 标题行与 -/空格缩进列表行；深度>4 的行提升到 4，节点>50 截断 */
export function validateMindmapMd(raw: string): MindmapValidation {
  const lines = raw.replace(/```(?:markdown|md)?|```/g, "").split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
  const out: string[] = [];
  let nodes = 0;
  let maxDepth = 0;
  let clamped = false;
  for (const line of lines) {
    let depth = 0;
    let text = "";
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^(\s*)-\s+(.*)$/);
    if (h) { depth = h[1].length; text = h[2]; }
    else if (li) { depth = Math.min(6, Math.floor(li[1].length / 2) + 2); text = li[2]; }
    else continue; // 非结构行（说明性废话）直接丢弃
    if (!text.trim()) continue;
    if (depth > 4) { depth = 4; clamped = true; }
    if (nodes >= 50) { clamped = true; break; }
    nodes += 1;
    maxDepth = Math.max(maxDepth, depth);
    out.push(depth <= 4 ? `${"#".repeat(depth)} ${text.trim()}` : text.trim());
  }
  return { ok: nodes >= 3 && maxDepth >= 2, md: out.join("\n"), nodes, depth: maxDepth, clamped };
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const rl = rateLimit(`mindmap:${user.id}`, 6, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  let source = parsed.data.topic?.trim() ?? "";
  let sourceName = "";
  if (parsed.data.uploadId) {
    const doc = getUploadsForUser(user.id, [parsed.data.uploadId])[0];
    if (!doc) return NextResponse.json({ error: "upload_not_found" }, { status: 404 });
    source = doc.textContent.slice(0, 6000);
    sourceName = doc.name;
  }
  if (!source) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const prompt = `请把${sourceName ? `下面这份文档《${sourceName}》的内容` : `主题「${source}」`}整理成思维导图大纲。
硬性要求：只输出 Markdown 标题大纲（# 一级到 #### 四级），不超过 4 层、总节点不超过 40 个，
每个节点一行、短语化（≤14 字），不要任何解释文字、不要列表符号。
${sourceName ? `文档内容：\n${source}` : ""}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await generateReply({ message: prompt, history: [], user });
    if (reply.source !== "remote") break; // 本地兜底不是知识源，不产出导图（R6 诚实降级）
    const v = validateMindmapMd(reply.text);
    if (v.ok) {
      const md = `# ${sourceName || source}\n${v.md.replace(/^# .*\n?/, "")}`;
      return NextResponse.json({ md, nodes: v.nodes, depth: v.depth, clamped: v.clamped, source: "remote" });
    }
  }
  return NextResponse.json({ error: "generation_unavailable", message: "暂时无法生成导图，请稍后再试" }, { status: 503 });
}
