import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { imagePromptGate, generateImageB64 } from "@/lib/server/imagegen";
import { CRISIS_REPLY } from "@/lib/safety/hotlines";
import { addAudit, addTicket, createImageJob, finishImageJob, imageJobsToday } from "@/lib/server/db";
import { validateJsonMutationRequest, validateMutationOrigin } from "@/lib/server/requestGuard";

/**
 * POST /api/image/generate —— S3 生图管线入口。
 * 顺序（铁律：安全门先于外部 API，危机响应永不被配额/限流拦截）：
 *   ①鉴权 ②安全门（危机→关怀响应+工单+审计；黑名单→拦截+教育向替代建议）
 *   ③限流 ④配额（学生 8/日、教师 30/日，公平使用非计费；科研/管理不限）
 *   ⑤建 pending 任务立即返回 jobId，后台调 gpt-image-2（55-70s）落盘 .data/images。
 */

const Body = z.object({
  prompt: z.string().trim().min(4, "描述太短").max(600, "描述过长"),
  size: z.enum(["1024x1024", "1536x1024", "1024x1536"]).default("1024x1024"),
});

const QUOTA: Record<string, number> = { student: 8, teacher: 30, researcher: 40, admin: 40, "college-admin": 40 };
const MAX_REQUEST_BYTES = 8 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_ACTIVE_JOBS = 2;
let activeImageJobs = 0;

const IMAGES_DIR = path.join(process.env.EDUAI_ASSET_DIR || process.env.EDUAI_DB_DIR || path.join(process.cwd(), ".data"), "images");

async function readBoundedJson(req: Request): Promise<unknown> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_REQUEST_BYTES) throw new Error("request_too_large");
  if (!req.body) return null;
  const reader = req.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new Error("request_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

function decodeGeneratedPng(b64: string): Buffer {
  const buffer = Buffer.from(b64, "base64");
  if (buffer.length < 8 || buffer.length > MAX_IMAGE_BYTES) throw new Error("img_invalid_size");
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!png.every((byte, index) => buffer[index] === byte)) throw new Error("img_invalid_format");
  return buffer;
}

async function runJob(jobId: string, prompt: string, size: string): Promise<void> {
  activeImageJobs += 1;
  try {
    const b64 = await generateImageB64(prompt, size);
    const image = decodeGeneratedPng(b64);
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const file = path.join(IMAGES_DIR, `${jobId}.png`);
    fs.writeFileSync(file, image, { flag: "wx" });
    finishImageJob(jobId, { status: "done", filePath: file });
  } catch (e) {
    finishImageJob(jobId, { status: "failed", error: e instanceof Error ? e.message : "img_failed" });
  } finally {
    activeImageJobs = Math.max(0, activeImageJobs - 1);
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const originGuard = validateMutationOrigin(req);
  if (!originGuard.ok) return NextResponse.json({ error: originGuard.code, message: originGuard.message }, { status: originGuard.status });
  // 演示身份：与 /api/chat 同规矩——危机响应仍可达，只挡写与真实生成。
  const demo = await isDemoSession();

  let raw: { prompt?: unknown } | null;
  try {
    raw = await readBoundedJson(req) as { prompt?: unknown } | null;
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "request_too_large";
    return NextResponse.json({ kind: "invalid", reply: tooLarge ? "描述内容过长" : "请求内容无法读取" }, { status: tooLarge ? 413 : 400 });
  }
  // 终审 P2 修复：危机预检先于 zod——超长/超短的自伤倾诉文本必须得到关怀响应而非「参数无效」400。
  const rawPrompt = typeof raw?.prompt === "string" ? raw.prompt : "";
  if (rawPrompt && imagePromptGate(rawPrompt).verdict === "crisis") {
    // 建单跳过、危机回复照常返回（铁律 P0：任何门都不得站在危机文本与热线之间）。
    if (!demo) addTicket({ userId: user.id, type: "help", detail: "image:crisis-auto" });
    addAudit({ userId: user.id, role: user.role, path: "/api/image/generate", action: demo ? "crisis_intervention_demo" : "crisis_intervention", result: "allow" });
    return NextResponse.json({ kind: "crisis", reply: CRISIS_REPLY });
  }

  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ kind: "invalid", reply: parsed.error.issues[0]?.message ?? "参数无效" }, { status: 400 });
  }
  const { prompt, size } = parsed.data;

  // ② 安全门（先于限流/配额：危机响应永远可达）
  const gate = imagePromptGate(prompt);
  if (gate.verdict === "crisis") {
    // 建单跳过、危机回复照常返回（铁律 P0：任何门都不得站在危机文本与热线之间）。
    if (!demo) addTicket({ userId: user.id, type: "help", detail: "image:crisis-auto" });
    addAudit({ userId: user.id, role: user.role, path: "/api/image/generate", action: demo ? "crisis_intervention_demo" : "crisis_intervention", result: "allow" });
    return NextResponse.json({ kind: "crisis", reply: CRISIS_REPLY });
  }
  if (gate.verdict === "blocked") {
    addAudit({ userId: user.id, role: user.role, path: "/api/image/generate", action: "image_prompt_blocked", result: "deny" });
    return NextResponse.json({
      kind: "blocked",
      reply: `这个描述不适合在校园生图中使用（${gate.reason}）。换个方向试试：科普示意图、课文场景插画、手抄报装饰元素都很棒。`,
    });
  }

  // 演示身份到此为止：两道危机分支与内容安全门都已跑完（回复该给的都给了），
  // 再往下就是限流、配额、建任务——那些都会写到**真实用户**名下。
  // 生图会消耗这位同学的当日额度并把作品挂到他的画廊里，而操作者不是他本人。
  if (demo) {
    return NextResponse.json(
      {
        kind: "demo-blocked",
        reply: "你正处在演示身份里，生图未执行——它会消耗这位同学的当日额度并把作品挂到他名下。请退回自己的身份后再试。",
      },
      { status: 403 },
    );
  }

  // ③ 限流 ④ 配额
  const rl = rateLimit(`image:${user.id}`, 3, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);
  const limit = QUOTA[user.role] ?? 0;
  if (limit > 0 && imageJobsToday(user.id) >= limit) {
    return NextResponse.json({ kind: "quota", reply: `今日生图已达公平使用上限（${limit} 张/日），明天恢复。已生成的图片仍可在下方画廊查看。` });
  }
  if (activeImageJobs >= MAX_ACTIVE_JOBS) {
    return NextResponse.json({ kind: "busy", reply: "当前生图队列较忙，请稍后再试。" }, { status: 503, headers: { "retry-after": "15" } });
  }

  // ⑤ 建任务 + 后台生成
  const job = createImageJob(user.id, user.role, prompt, size);
  addAudit({ userId: user.id, role: user.role, path: "/api/image/generate", action: `image_generate:${job.id}`, result: "allow" });
  void runJob(job.id, prompt, size);
  return NextResponse.json({ kind: "ok", jobId: job.id });
}
