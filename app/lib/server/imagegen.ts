import "server-only";
import { classifySafety } from "@/lib/safety/classifyIntent";
import { assertPublicOutboundUrl } from "@/lib/server/outboundGuard";

/**
 * S3 生图管线服务端内核：
 *  - imagePromptGate：安全门【先于】外部 API——危机识别复用 classifySafety（危机永远优先响应），
 *    未成年内容黑名单 fail-closed（宁可拦多不拦少）；
 *  - generateImageB64：调 OpenAI 兼容 /images/generations（gpt-image-2，实测 55-70s）。
 */

export type ImageGateVerdict =
  | { verdict: "ok" }
  | { verdict: "crisis" }
  | { verdict: "blocked"; reason: string };

// 未成年生图黑名单（与文本安全策略互补：图像面 additional 风险——写实人像/暴力血腥/成人/惊悚/武器制作/真人肖像）。
// 终审 P1 修复：正则同时跑在原文与归一化 compact 文本上（NFKC+小写+剥零宽+去全部空白），
// 「血 腥」「裸\n体」类插空/换行/零宽绕过失效；并补英文词条（英语学科学生零成本翻译绕过已实证）。
const IMAGE_BLOCK: Array<{ re: RegExp; reason: string }> = [
  { re: /(血腥|残肢|尸体|虐杀|酷刑|处决|斩首|gore|bloody|dismember|corpse)/i, reason: "血腥暴力内容不适合校园场景" },
  { re: /(色情|裸体|裸照|性感|情色|成人内容|涩图|nude|naked|porn|sexual|nsfw|hentai)/i, reason: "涉及成人内容" },
  { re: /(恐怖|吓人|鬼脸|惊悚|阴森|夺命)(的)?(图|画|照片|场景|人)|horror[\s\S]{0,6}(scene|face|image)|jump ?scare/i, reason: "惊悚恐怖内容可能造成心理不适" },
  { re: /(枪支|炸弹|爆炸物|武器)(的)?(制作|图纸|结构|拆解)|(build|make|assembl)[\s\S]{0,10}(gun|bomb|explosive|weapon)/i, reason: "涉及危险物品制作" },
  { re: /(真实|写实)(的)?(同学|老师|校长|明星|名人)(的)?(照片|肖像|头像|人脸)|(realistic|photo ?real)[\s\S]{0,12}(classmate|teacher|celebrity)/i, reason: "不能生成真实人物肖像（隐私与肖像权保护）" },
  { re: /(换脸|深度伪造|deepfake|face ?swap)/i, reason: "涉及深度伪造" },
];

// 自伤/轻生「图像语境」词表（中英双语；内测实证：文本危机分类器识别不了「画一张…跳下去解脱」这类绘图表述，
// 且纯中文词表可被英文 prompt 零成本绕过）。命中一律按危机处理（关怀响应+工单），fail-closed。
const SELF_HARM_IMG =
  /(跳楼|跳下去|自杀|自残|割腕|上吊|轻生|活不下去|结束(自己的)?生命|(解脱|消失)[\s\S]{0,8}(跳|死|离开)|(跳|死|离开)[\s\S]{0,8}(解脱|消失)|suicide|kill(ing)?(my|him|her|your)self|self[-_ ]?harm|cut(ting)?(my)?wrists?|hang(ing)?(my|him|her)self|jump(ing)?off(a)?(building|roof|bridge|cliff)|end(ing)?mylife|want(to)?die|overdose)/i;

// 归一化（与文本链 classifyIntent 同思路）：NFKC + 小写 + 剥零宽 + 去全部空白（compact）。
function normalizeForGate(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/\s+/g, "");
}

export function imagePromptGate(prompt: string): ImageGateVerdict {
  const safety = classifySafety(prompt);
  const compact = normalizeForGate(prompt);
  if (safety.intent === "crisis" || SELF_HARM_IMG.test(prompt) || SELF_HARM_IMG.test(compact)) return { verdict: "crisis" };
  for (const b of IMAGE_BLOCK) {
    if (b.re.test(prompt) || b.re.test(compact)) return { verdict: "blocked", reason: b.reason };
  }
  return { verdict: "ok" };
}

const IMAGE_TIMEOUT_MS = 150_000; // 实测 55-70s，留冗余
const MAX_GATEWAY_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_B64_CHARS = 16 * 1024 * 1024;

function safeGatewayBase(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return false;
    if (process.env.NODE_ENV !== "production" && url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (process.env.NODE_ENV === "production" && (
      host === "localhost" || host === "::1" || host.endsWith(".localhost") ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    )) return false;
    return true;
  } catch {
    return false;
  }
}

async function readJsonWithinLimit(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_GATEWAY_RESPONSE_BYTES) throw new Error("img_gw_response_too_large");
  if (!response.body) throw new Error("img_gw_empty");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_GATEWAY_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("img_gw_response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

function imageGatewayBases(): string[] {
  const configured = [
    process.env.LLM_IMAGE_BASE_URL,
    process.env.LLM_BASE_URL,
    ...(process.env.LLM_FALLBACK_BASE_URLS?.split(",") ?? []),
  ];
  return [...new Set(configured.map((value) => value?.trim().replace(/\/$/, "")).filter((value): value is string => Boolean(value)))]
    .filter(safeGatewayBase);
}

export async function generateImageB64(prompt: string, size: string): Promise<string> {
  const apiKey = process.env.LLM_IMAGE_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("img_no_key");
  const bases = imageGatewayBases();
  if (!bases.length) throw new Error("img_no_base");
  const model = process.env.EDUAI_IMAGE_MODEL || "gpt-image-2";
  let lastErr: unknown = null;
  for (const base of bases) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
    try {
      await assertPublicOutboundUrl(`${base}/images/generations`);
      const res = await fetch(`${base}/images/generations`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, size, n: 1 }),
        signal: controller.signal,
        redirect: "error",
      });
      if (!res.ok) { lastErr = new Error(`img_gw_${res.status}`); continue; }
      const data = (await readJsonWithinLimit(res)) as { data?: { b64_json?: string }[] };
      const b64 = data?.data?.[0]?.b64_json;
      if (b64 && b64.length <= MAX_IMAGE_B64_CHARS) return b64;
      if (b64) throw new Error("img_gw_image_too_large");
      lastErr = new Error("img_gw_empty");
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("img_gw_failed");
}
