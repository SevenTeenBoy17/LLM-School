import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isDemoSession } from "@/lib/server/session";
import { classifySafety, integrityNegationAmbiguous } from "@/lib/safety/classifyIntent";
import { CRISIS_REPLY, SOFT_CONCERN_REPLY } from "@/lib/safety/hotlines";
import { tutorScaffold } from "@/lib/voice";
import { generateReply, generateReplyStream, semanticIntegrityRecheck } from "@/lib/server/llm";
import { addTicket, addIntegrity, addAudit, getSession, addMessage, touchSession, clearSessionAgent, notifyAdmins, getModelSettings, chatUsageToday, incrementChatUsage, searchKb, getClassPolicy, getUserPrefs, saveChatArtifact, getUploadsForUser } from "@/lib/server/db";
import { canAccessResearch } from "@/lib/nav";
import { rateLimit, rateLimitedResponse } from "@/lib/server/rateLimit";
import { buildAgentPreamble, resolveUsableAgent } from "@/lib/server/agentContract";
import { isModelId, isModelInMaintenance } from "@/lib/data/models";

const Body = z.object({
  message: z.string().min(1).max(2000),
  modelId: z.string().max(64).optional(),
  deepThink: z.boolean().optional(),
  sessionId: z.string().max(80).optional(),
  agentId: z.string().max(80).optional(),
  agentPreamble: z.string().max(600).optional(),
  knowledge: z.boolean().optional(), // 「知识库」开关：为 true 时检索校内 KB 并注入模型上下文做 grounding
  uploadIds: z.array(z.string().max(40)).max(3).optional(), // W-B1 附件：仅取当前用户自己的已解析上传

  stream: z.boolean().optional(), // 为 true 时**常规路径**改 SSE 流式返回（安全/诚信分支仍走非流式硬拦截，先于本标志）
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(10)
    .optional(),
});

export async function POST(req: Request) {
  // 服务端权威鉴权：未登录直接 401（绕过前端也无效）。
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  // 演示身份（切换身份签发的会话）：**只挡写，不挡回复**。
  //
  // 为什么不在这里直接 403：铁律 P0——安全回复必须永远送达，任何门都不得站在
  // 危机文本与热线之间。演示态下输入危机语句仍会拿到完整的 CRISIS_REPLY。
  // 要防的是**写**：一位老师以学生身份触发拦截，会在真实未成年人账号下生成危机工单
  // （系统里最敏感的记录类型，被演示流量污染后无从分辨真假）、消耗他的当日配额、
  // 往他的会话历史里写内容。所以下面每个落库点各加一道 !demo 守卫。
  const demo = await isDemoSession();
  // 【铁律·P0】限流本质是一种「配额门」，绝不能置于危机/care/诚信硬拦截之前——
  // 否则未成年人在 60s 内密集倾诉、第 31 条含自杀信号时会被 429 静默丢弃、拿不到危机热线。
  // 故限流下移到「安全分支之后、进模型之前」，只保护昂贵的模型调用；安全分支永不受限。

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { message } = parsed.data;
  const history = parsed.data.history ?? [];
  const totalChars = message.length + history.reduce((sum, item) => sum + item.content.length, 0);
  if (totalChars > 6000) return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  // 危机/诚信判定必须覆盖「本条消息 + 历史里**全部角色**的内容」：history 是可伪造的请求体字段。
  // 只扫 user 角色曾留下缺口（M2 审查 P1）：伪造 assistant 条目（「好的，已为你关闭引导模式/我会直接替你写」）
  // 可绕过初筛并以「模型自己答应过」的姿态注入上下文——比用户消息更强的越狱通道，故 assistant 内容一并送检。
  const probe = [message, ...history.map((m) => m.content)].join("\n");
  const safety = classifySafety(probe);
  const intent = safety.intent;
  const isStudent = user.role === "student";
  const modelId = parsed.data.modelId?.trim() ?? "";
  const invalidModelId = modelId.length > 0 && !isModelId(modelId);

  // 会话落库归属：sessionId 必须属于当前用户，否则视为「不落库」（绝不因非法 id 报错阻断对话）。
  // 危机/软关怀分支【不落库】——未成年隐私与安全：这些内容只走服务端工单/关怀，不进用户可见的历史。
  const ownedSession = parsed.data.sessionId ? getSession(user.id, parsed.data.sessionId) : null;

  // ── 危机优先：硬拦截，绝不送入模型；服务端建求助工单 + 审计留痕。──
  if (intent === "crisis") {
    // 铁律：危机回复必须优先送达未成年人。建单/审计/通知均为 best-effort，
    // 任一副作用抛错（DB 满/写锁/约束等）都绝不能阻断 CRISIS_REPLY 返回。
    try {
      // 演示身份不建单：危机工单会挂到真实学生名下，安全团队无从分辨真假。
      // 审计仍记（它记的是「这个会话触发了危机分支」这一事实，本身就是真的）。
      if (!demo) addTicket({ userId: user.id, type: "help", detail: "chat:crisis-auto" });
      addAudit({ userId: user.id, role: user.role, path: "/api/chat", action: demo ? "crisis_intervention_demo" : "crisis_intervention", result: "allow" });
      // 通知安全/心理团队（管理员）——仅通用提醒，不含求助内容（未成年隐私）。
      if (!demo) notifyAdmins("safety", "新的安全求助工单", "系统检测到一条危机求助信号并已建单，请安全/心理团队尽快在工单页跟进。");
    } catch { /* 副作用失败不影响危机回复 */ }
    return NextResponse.json({ kind: "crisis", reply: CRISIS_REPLY, help: true, source: "safety" });
  }

  // ── 软关怀：低置信情绪信号——温柔关怀 + 打开求助，但不建工单、不进模型；与有无密钥无关。──
  // 必须接在 route 层（不只在 llm.ts 兜底）：否则有密钥时口头禅落常规分支直送真实模型，孩子拿不到关怀（评审 P1）。
  if (safety.care) {
    return NextResponse.json({ kind: "care", reply: SOFT_CONCERN_REPLY, help: true, source: "care" });
  }

  if (invalidModelId) {
    return NextResponse.json({ error: "invalid_model" }, { status: 400 });
  }
  if (modelId && isModelInMaintenance(modelId)) {
    return NextResponse.json({ error: "model_maintenance", message: "该模型通道维护中，请先换一个模型" }, { status: 400 });
  }

  // ── 学生 + 学术诚信：转学伴分步引导（按学段），不一键代写；服务端记最小频次信号。──
  if (isStudent && intent === "integrity") {
    // 已知 P1 误杀正解落地（内测 [3a]）：关键词初筛保持不动（宁可误杀），仅对「否定歧义」子集
    // （含真诚否定声明但关键词仍判 integrity，如「请给提升建议，但不要替我写整篇」）追加**模型语义复核**。
    // fail-closed 三重保护：①复核限流(6/60s/用户，防拿诱饵否定刷免费模型调用——复核在 chat 主限流之前)
    // ②复核不可用/超时/输出不可解析/判 cheat → 一律维持 scaffold ③复核对象是完整 probe（含 history 的
    // user 内容），历史里藏真代写请求时模型按提示词判 B——不给「历史夹带」开口子。
    let recheckedLegit = false;
    if (integrityNegationAmbiguous(probe)) {
      // 复核成本治理（对抗审查 P2）：复核调真金 minimax 且发生在配额门之前、不计 chatUsage，
      // 若仅 6/60s 滑窗则单账号每日可刷 ~8640 次付费调用且审计不可见。故加**日级上限**并对**每次结果**写审计。
      const rrDay = rateLimit(`integrity-recheck-daily:${user.id}`, 50, 86_400_000);
      const rrMin = rrDay.ok ? rateLimit(`integrity-recheck:${user.id}`, 6, 60_000) : { ok: false };
      if (rrDay.ok && rrMin.ok) {
        const verdict = await semanticIntegrityRecheck(probe); // "legit" | "cheat" | "unavailable"
        recheckedLegit = verdict === "legit";
        // 每次复核都留痕（放行/维持拦截/网关不可用），成本与绕过尝试均可回溯。
        addAudit({ userId: user.id, role: user.role, path: "/api/chat", action: `integrity_recheck:${verdict}`, result: recheckedLegit ? "allow" : "deny" });
      } else {
        // 复核额度耗尽 → 直接维持 scaffold（fail-closed，不放宽拦截），并留痕以便发现刷量。
        addAudit({ userId: user.id, role: user.role, path: "/api/chat", action: "integrity_recheck:limited", result: "deny" });
      }
    }
    if (!recheckedLegit) {
      if (!demo) addIntegrity({ classId: user.classId, kind: "scaffold" }); // 演示流量不计入班级诚信统计
      const scaffold = tutorScaffold(user.stage, message);
      const ids = persistTurn(ownedSession, user.id, message, scaffold, modelId, { source: "integrity-scaffold" }, demo);
      return NextResponse.json({ kind: "scaffold", reply: scaffold, source: "integrity-scaffold", ...ids });
    }
    // 复核判定为正当求助 → 继续走下方常规路径（限流/配额/grounding/真模型），学生拿到有学科价值的真回答。
  }

  const bodyAgentId = parsed.data.agentId?.trim() || undefined;
  const sessionAgentId = ownedSession?.agentId;
  if (bodyAgentId && sessionAgentId && bodyAgentId !== sessionAgentId) {
    return NextResponse.json({ error: "agent_session_mismatch" }, { status: 409 });
  }
  const selectedAgentId = bodyAgentId ?? sessionAgentId;
  if (!selectedAgentId && parsed.data.agentPreamble?.trim()) {
    return NextResponse.json({ error: "invalid_agent_contract" }, { status: 400 });
  }
  const selectedAgent = selectedAgentId ? resolveUsableAgent(user, selectedAgentId) : null;
  if (selectedAgentId && !selectedAgent) {
    if (sessionAgentId && !bodyAgentId && ownedSession) {
      clearSessionAgent(user.id, ownedSession.id);
    } else {
      return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
    }
  }
  const serverAgentPreamble = selectedAgent ? buildAgentPreamble(selectedAgent) : undefined;

  // ── 限流：只保护进模型的 normal 路径（危机/care/诚信已在上方 return，永不受限）。──
  const rl = rateLimit(`chat:${user.id}`, 30, 60_000);
  if (!rl.ok) return rateLimitedResponse(rl.retryAfter);

  // ── 模型级治理（管理端 model_settings 真正生效）：仅约束 normal 分支；
  // 危机/care/诚信已在上方 return，绝不被「未开放/超额」拦住——安全永远优先。──
  const mkey = modelId || "chatgpt";
  const ms = getModelSettings(mkey);
  if (isStudent && !ms.openToStudents) {
    return NextResponse.json({ kind: "blocked", reply: "该模型暂未对学生开放，请切换到其他模型，或联系老师。" });
  }
  // 每日配额：teacher/student 受限；admin/college-admin/researcher 不限；quota=0 视为不限。
  if (user.role === "student" || user.role === "teacher") {
    const limit = user.role === "student" ? ms.quotaStudent : ms.quotaTeacher;
    if (limit > 0 && chatUsageToday(user.id, mkey) >= limit) {
      return NextResponse.json({ kind: "quota", reply: `今日该模型调用已达上限（${limit} 次/日），明日恢复；可切换其他模型继续。` });
    }
  }

  // ── 知识库 grounding（「知识库」开关开启时）：用**当前用户可见范围**检索校内 KB，注入模型上下文。
  // 复用 searchKb 的可见性(userId/isAdmin/classId/stage)，不跨用户泄露；仅在常规路径、安全分支之后执行。
  let knowledgeContext: string | undefined;
  let references: { name: string; meta: string }[] | undefined;
  if (parsed.data.knowledge) {
    const isAdmin = user.role === "admin" || user.role === "college-admin";
    const hits = searchKb(user.id, isAdmin, user.classId, user.stage, message, 4);
    if (hits.length > 0) {
      knowledgeContext = hits.map((h, i) => `【资料${i + 1}·${h.name}】${h.snippet}`).join("\n");
      references = hits.map((h) => ({ name: h.name, meta: h.snippet.slice(0, 60) }));
    }
  }

  // ── W-B1 附件文档注入：走 knowledgeContext 同通道（grounding 指令复用）。
  // 归属过滤在 getUploadsForUser 内（uploadIds 可伪造）；每篇截断额度均分，
  // 截断如实声明在注入文本里——模型知道自己没读全，就不会假装读全了。
  // 安全口径（规格书 §红线评审记录）：危机/诚信分支只由**用户自己的话**触发
  // （message+history，上方已判定）；文档文本在上传时已单独初筛并给 helpNote，
  // 教学材料（文学/新闻）含敏感词不应触发对用户的危机拦截。
  if (parsed.data.uploadIds?.length) {
    const docs = getUploadsForUser(user.id, parsed.data.uploadIds);
    if (docs.length > 0) {
      const per = Math.floor(12_000 / docs.length);
      const docCtx = docs
        .map((d, i) => {
          const t = d.textContent.slice(0, per);
          const trunc = d.textContent.length > per ? "\n（文档较长，以上为截断内容，回答时如实说明）" : "";
          return `【文档${i + 1}·${d.name}·共${d.chars}字】\n${t}${trunc}`;
        })
        .join("\n\n");
      knowledgeContext = knowledgeContext ? `${knowledgeContext}\n\n${docCtx}` : docCtx;
      references = [
        ...(references ?? []),
        ...docs.map((d) => ({ name: d.name, meta: `学生上传文档 · ${d.chars} 字` })),
      ];
    }
  }

  // ── M1/B1 苏格拉底引导「三态」服务端权威判定：教师班级锁定 || 学生自选 → 引导模式。
  // 客户端开关只是 UI 镜像；此判定每请求读库，不信任请求体。叠加于诚信硬拦截之上（上方已 return）。
  const socratic = isStudent && (getClassPolicy(user.classId).socraticLock || getUserPrefs(user.id).socratic);

  // ── 流式分支（stream:true）：SSE 逐片返回真实模型输出，用「相邻分片间超时」替代整段硬超时，根治长回复超时降级。
  // 安全/诚信硬拦截已在上方全部 return（crisis/care/scaffold/blocked/quota/限流），故此处一定是放行后的常规生成。
  if (parsed.data.stream) {
    const encoder = new TextEncoder();
    const startedAtS = Date.now();
    const send = (controller: ReadableStreamDefaultController, event: string, data: unknown) =>
      controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    const sse = new ReadableStream({
      async start(controller) {
        let acc = "";
        let finalSource: "remote" | "local" | "local-fallback" = "local-fallback";
        try {
          for await (const ev of generateReplyStream({
            message, history, user,
            modelId: parsed.data.modelId, deepThink: parsed.data.deepThink,
            agentPreamble: serverAgentPreamble, knowledgeContext, socratic,
          })) {
            if (ev.type === "delta") { acc += ev.text; send(controller, "delta", { text: ev.text }); }
            else { finalSource = ev.source; acc = ev.fullText; }
          }
        } catch {
          // 生成器自身异常（极端）：若已流出内容如实收尾 remote，否则维持兜底标记。
          if (acc.trim()) finalSource = "remote";
        }
        // 落库 + 用量 + kind/references（与非流式路径口径一致）。
        const durationMs = Date.now() - startedAtS;
        if (!demo && (user.role === "student" || user.role === "teacher")) incrementChatUsage(user.id, mkey); // 演示不消耗真实用户配额
        const ids = persistTurn(ownedSession, user.id, message, acc, modelId, { source: finalSource, durationMs }, demo);
        const artifactId = maybeArchiveArtifact(user.role, user.id, ownedSession, acc, ids.messageId);
        const kind = finalSource === "remote" ? "normal" : "degraded";
        const groundedRefs = finalSource === "remote" ? references : undefined;
        send(controller, "done", { kind, source: finalSource, durationMs, references: groundedRefs, ...ids, ...(artifactId ? { artifactId } : {}) });
        controller.close();
      },
    });
    return new Response(sse, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "connection": "keep-alive",
        "x-accel-buffering": "no", // 禁用中间层缓冲，确保分片实时下发
      },
    });
  }

  // ── 常规（非流式）：经 LLM 网关（有密钥走真实模型，否则诚实本地兜底）。──
  // 走到这里说明 message+history 均无危机/诚信信号，故不会把危机历史透传给模型。
  const startedAt = Date.now();
  const reply = await generateReply({
    message,
    history,
    user,
    socratic,
    modelId: parsed.data.modelId,
    deepThink: parsed.data.deepThink,
    agentPreamble: serverAgentPreamble,
    knowledgeContext,
  });
  const durationMs = Date.now() - startedAt;
  if (!demo && (user.role === "student" || user.role === "teacher")) incrementChatUsage(user.id, mkey); // 演示不消耗真实用户配额
  const ids = persistTurn(ownedSession, user.id, message, reply.text, modelId, { source: reply.source, durationMs }, demo);
  const artifactId = maybeArchiveArtifact(user.role, user.id, ownedSession, reply.text, ids.messageId);
  // kind 必须与 source 一致：只有真实模型(remote)才算 normal；本地兜底/无密钥降级一律标 degraded，
  // 否则按 kind 聚合的质量/AB 统计会把降级样本误计为正常模型样本（内测 P2：kind=normal 与 local-fallback 并存）。
  // 前端展示以 source 为准（不因此变化），此改动仅让 API 的 kind 字段自洽、供统计正确归类。
  const kind = reply.source === "remote" ? "normal" : "degraded";
  // references 仅在【真实模型确实拿到并据 KB 作答，即 source=remote】时返回：本地/兜底路径根本不消费 knowledgeContext，
  // 若仍带 references 就是"假装引用"（铁律③不编造来源）。检索命中(hits>0)≠回答用了资料，故按 source 而非按命中门控。（对抗审查确认修复）
  const groundedRefs = reply.source === "remote" ? references : undefined;
  return NextResponse.json({ kind, reply: reply.text, source: reply.source, durationMs, references: groundedRefs, ...ids, ...(artifactId ? { artifactId } : {}) });
}

// 落库一轮对话（用户消息 + 助手回复），并 bump/命名会话。返回消息 id 供前端接收藏/反馈。
// ownedSession 为 null（无 sessionId 或非法/越权）时静默跳过——对话本身照常返回。
// 备课产物自动归档（调研反模式 2 的反向实现：教师产出自动入库防丢失，与 Claude 的
// 手动 Publish 相反）。**旁路，try/catch 全包**：归档失败绝不影响对话主链路——
// 本路由的第一职责是安全与对话可用性，产物库是增值层。
// 收档范围与 /research/artifacts 库页的可见角色同源（canAccessResearch，单一真相源），
// 阈值 600 字符过滤寒暄短答；同一 messageId 幂等（库层 UNIQUE 闩）。
function maybeArchiveArtifact(
  role: Parameters<typeof canAccessResearch>[0],
  userId: string,
  ownedSession: { id: string } | null,
  assistantText: string,
  messageId?: string,
): string | null {
  try {
    if (!ownedSession || !messageId) return null;
    if (!canAccessResearch(role)) return null;
    if (assistantText.length < 600) return null;
    // V3：返回 id 给响应层做回执 chip——静默写数据而不告知是反模式
    //（对照 ChatGPT 的「Memory updated」回执）。失败仍静默（旁路语义不变）。
    return saveChatArtifact(userId, ownedSession.id, messageId, assistantText);
  } catch { return null; /* 旁路静默：归档失败不打断对话 */ }
}

/** 落库收口。演示会话传 demo=true 时整体跳过——不往真实用户的会话历史里写东西。 */
function persistTurn(
  ownedSession: { id: string } | null,
  userId: string,
  userText: string,
  assistantText: string,
  modelId: string,
  assistantMeta: Parameters<typeof addMessage>[4] = {},
  demo = false,
): { userMessageId?: string; messageId?: string } {
  if (!ownedSession || demo) return {};
  const um = addMessage(ownedSession.id, "user", userText, modelId);
  const am = addMessage(ownedSession.id, "assistant", assistantText, modelId, assistantMeta);
  touchSession(userId, ownedSession.id, userText);
  return { userMessageId: um.id, messageId: am.id };
}
