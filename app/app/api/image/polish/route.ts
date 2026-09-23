import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/server/session";
import { generateReply } from "@/lib/server/llm";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { imagePromptGate } from "@/lib/server/imagegen";
import { CRISIS_REPLY } from "@/lib/safety/hotlines";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";

/**
 * H8 · 生图提示词「AI 一键润色」——真实调网关改写，不落库（纯改写服务）。
 * 润色算法固化在系统模板里（五要素补齐 + 校园风格默认 + 安全剔除 + 长度钳制）；
 * 网关不可用一律 503 诚实报错——本地兜底改写不是审美判断力，冒充润色比不润色更糟（R6）。
 * 安全边界双层：模板要求剔除违规元素只是第一层，生成端 /api/image/generate 的
 * 服务端安全门（先审后画）才是权威拦截——本路由不替代它。
 */

export const runtime = "nodejs";

const Body = z.object({ prompt: z.string().trim().min(4).max(600) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return NextResponse.json({ error: guard.code, message: guard.message }, { status: guard.status });

  let json: unknown;
  try { json = await req.json(); } catch { return NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input", message: "先写几个字的描述再润色" }, { status: 400 });
  const gate = imagePromptGate(parsed.data.prompt);
  if (gate.verdict === "crisis") return NextResponse.json({ kind: "crisis", reply: CRISIS_REPLY });
  if (gate.verdict === "blocked") {
    return NextResponse.json({ error: "unsafe_prompt", message: `这个描述不适合校园生图（${gate.reason}），请换成学习或创作主题。` }, { status: 400 });
  }
  const rl = rateLimit(`img-polish:${user.id}`, 6, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  const instruction = `你是校内学生生图工作台的提示词优化器。把下面的简短描述改写成一条高质量的中文生图提示词。
改写算法（按序执行）：
1. 保留原描述的核心主题与意图，不新增主题；
2. 补齐五要素：主体细节 → 场景背景 → 构图视角 → 配色与光线 → 风格与质量词（如「高清插画、色彩明亮、细节丰富」）；
3. 面向校园学习场景：未指明风格时默认卡通插画/简洁示意图风格；
4. 安全剔除：若含真人肖像、血腥、成人内容等元素，改写时剔除；
5. 只输出这一条提示词本身：中文、不超过 120 字、不要解释、不要引号、不要分行列点。
学生描述：「${parsed.data.prompt}」`;

  const reply = await generateReply({ message: instruction, history: [], user });
  if (reply.source !== "remote") {
    return NextResponse.json({ error: "llm_unavailable", message: "润色服务暂时不可用，请稍后再试" }, { status: 503 });
  }
  const polished = reply.text.replace(/[\r\n]+/g, "，").replace(/^["「『\s]+|["」』\s]+$/g, "").slice(0, 300);
  if (polished.length < 4) {
    return NextResponse.json({ error: "llm_unavailable", message: "润色服务暂时不可用，请稍后再试" }, { status: 503 });
  }
  if (imagePromptGate(polished).verdict !== "ok") {
    return NextResponse.json({ error: "unsafe_output", message: "润色结果未通过校园安全校验，请调整原描述。" }, { status: 502 });
  }
  return NextResponse.json({ polished, source: reply.source });
}
