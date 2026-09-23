import { NextResponse } from "next/server";
import { z } from "zod";
import { GRADIENT_KEYS } from "@/lib/data/gradientKeys";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { validateJsonMutationRequest } from "@/lib/server/requestGuard";
import { getAgent, updateAgent, deleteAgent, setAgentStatus, incrementAgentCalls, addAudit, notifyAdmins, notifyUser } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

function jsonNoStore(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  return NextResponse.json(body, { ...init, headers });
}

const MODEL = z.enum(["chatgpt", "claude", "gpt-image", "gemini", "minimax", "deepseek", "glm"]);
const CATEGORY = z.enum(["教学", "科研", "行政", "学习"]);

// GET —— 单个智能体，只读。调用计数由显式 POST 写入。
// 治理：status=disabled 的智能体对「非创建者且非管理员」不可读——否则 admin 停用形同虚设，
// 仍能被 /chat?agent= 载入身份。创建者/管理员仍可读（用于编辑/复核）。
export async function GET(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return jsonNoStore({ error: "not_found" }, { status: 404 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  if (!isAdmin && agent.ownerId !== user.id && agent.status !== "pub") {
    return jsonNoStore({ error: "not_found" }, { status: 404 });
  }
  return jsonNoStore({ agent });
}

const UseBody = z.object({ action: z.literal("use") }).strict();

export async function POST(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  if (await isDemoSession()) return jsonNoStore({ error: "demo_read_only" }, { status: 403 });
  const guard = validateJsonMutationRequest(req);
  if (!guard.ok) return jsonNoStore({ error: guard.code, message: guard.message }, { status: guard.status });
  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  if (!UseBody.safeParse(json).success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });
  const { id } = await params;
  const agent = getAgent(id);
  if (!agent) return jsonNoStore({ error: "not_found" }, { status: 404 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  const canUse = agent.status !== "disabled" && (agent.status === "pub" || isAdmin || agent.ownerId === user.id);
  if (!canUse) return jsonNoStore({ error: "not_found" }, { status: 404 });
  incrementAgentCalls(id);
  return jsonNoStore({ agent: getAgent(id) ?? agent });
}

const PutBody = z.object({
  name: z.string().min(1).max(40).optional(),
  category: CATEGORY.optional(),
  description: z.string().min(1).max(400).optional(),
  systemPrompt: z.string().max(6000).optional(),
  recommendedModel: MODEL.optional(),
  knowledgeBase: z.string().max(60).optional(),
  capabilities: z.array(z.string().max(20)).max(12).optional(),
  icon: z.string().max(40).optional(),
  // V0：由 z.string().max(120) 收成枚举——旧写法允许任意 CSS 直接进 style={{ backgroundImage }}，
  // 既是样式注入面，也让数据层渐变躲过源码色彩守卫（方案 §4.2.1）。
  gradient: z.enum(GRADIENT_KEYS).optional(),
});

// PUT —— 更新（仅创建者本人）。
export async function PUT(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = PutBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  const existing = getAgent(id);
  if (!existing) return jsonNoStore({ error: "not_found" }, { status: 404 });
  if (existing.ownerId !== user.id) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  const runtimeFields = ["name", "description", "systemPrompt", "recommendedModel", "knowledgeBase", "capabilities"] as const;
  const changesBehavior = runtimeFields.some(key => parsed.data[key] !== undefined
    && JSON.stringify(parsed.data[key]) !== JSON.stringify(existing[key] ?? (key === "capabilities" ? [] : "")));
  if (changesBehavior && existing.status !== "draft") {
    return jsonNoStore({ error: "instructions_locked", message: "仅草稿可修改运行配置；请先撤回审核，或另建修订草稿。" }, { status: 409 });
  }
  const agent = updateAgent(user.id, id, parsed.data);
  return jsonNoStore({ agent });
}

const PatchBody = z.object({ status: z.enum(["draft", "review", "pub", "disabled"]) });

// PATCH —— 状态流转：owner 仅可 draft↔review（提交/撤回审核）；admin 可审批为 pub/disabled/任意。
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  let json: unknown;
  try { json = await req.json(); } catch { return jsonNoStore({ error: "bad_request" }, { status: 400 }); }
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) return jsonNoStore({ error: "invalid_input" }, { status: 400 });

  const existing = getAgent(id);
  if (!existing) return jsonNoStore({ error: "not_found" }, { status: 404 });
  const isAdmin = user.role === "admin" || user.role === "college-admin";
  const isOwner = existing.ownerId === user.id;
  const target = parsed.data.status;
  // owner 只允许两条自有草稿流转：draft→review（提交审核）、review→draft（撤回）。
  // 【必须校验 existing.status】否则 owner 能把 admin 停用(disabled)的智能体拉回 draft/review 复活，
  // 或把 admin 已发布(pub)的拉回 draft 变相下架——发布/停用属审批权（admin）。
  const ownerAllowed = isOwner && (
    (existing.status === "draft" && target === "review") ||
    (existing.status === "review" && target === "draft")
  );
  if (!isAdmin && !ownerAllowed) return jsonNoStore({ error: "forbidden" }, { status: 403 });

  const agent = setAgentStatus(id, target);
  addAudit({ userId: user.id, role: user.role, path: `/api/agents/${id}`, action: `agent_status_${target}`, result: "allow" });
  // 通知生成：提交审核→通知管理员；审批发布/停用→通知创建者。
  if (target === "review") notifyAdmins("agent_review", "智能体待审核", `「${existing.name}」已提交发布审核，请前往智能体监控复核。`);
  else if (target === "pub" && isAdmin) notifyUser(existing.ownerId, "agent_pub", "智能体已通过审核", `你的「${existing.name}」已发布，面向师生开放。`);
  else if (target === "disabled" && isAdmin) notifyUser(existing.ownerId, "agent_disabled", "智能体被停用", `你的「${existing.name}」已被管理员停用，如有疑问请联系信息中心。`);
  return jsonNoStore({ agent });
}

// DELETE —— 删除（仅创建者本人）。
export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return jsonNoStore({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const existing = getAgent(id);
  if (!existing) return jsonNoStore({ error: "not_found" }, { status: 404 });
  if (existing.ownerId !== user.id) return jsonNoStore({ error: "forbidden" }, { status: 403 });
  deleteAgent(user.id, id);
  return jsonNoStore({ ok: true });
}
