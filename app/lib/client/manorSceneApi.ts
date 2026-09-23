import type { ManorSceneCommand, ManorSceneSnapshot } from "@/lib/manor/v7-scene-contracts";

type Command = ManorSceneCommand extends infer T ? T extends ManorSceneCommand ? Omit<T, "operationId"> : never : never;
type Result = { ok: true; scene: ManorSceneSnapshot; correlationId: string; operationId: string };
const memory = new Map<string, ManorSceneCommand>();
class SceneIdentityError extends Error {}
const key = (id: string) => `eduai.manor.v7.scene.pending.${id}`;
function pending(id: string) {
  if (memory.has(id)) return memory.get(id);
  try { const saved = sessionStorage.getItem(key(id)); return saved ? JSON.parse(saved) as ManorSceneCommand : undefined; } catch { return undefined; }
}
function clear(id: string) { memory.delete(id); try { sessionStorage.removeItem(key(id)); } catch { /* In-memory recovery remains supported. */ } }
const messages: Record<string, string> = {
  INSUFFICIENT_POINTS: "积分不足，未扣款。", SLOT_OCCUPIED: "这个位置已有装饰，请选择其他位置。",
  LAYOUT_REVISION_CONFLICT: "布置已在其他窗口更新，请刷新后重新确认位置。",
  PUBLICATION_REVISION_CONFLICT: "公开状态已更新，请刷新后重试。", CLASS_REQUIRED: "加入班级后才能向同班伙伴公开。",
  BADGE_REQUIREMENT: "尚未满足此装饰的徽章条件。", AUTH_REQUIRED: "登录已失效，请重新登录。", SESSION_QUIET: "舒缓模式中不兑换或布置，已有物品会保留。",
  IDENTITY_CHANGED: "登录账号已变化，请刷新页面后操作。",
  CLASS_CHANGED: "当前班级已变化，请刷新后重新决定公开范围。",
};
export async function readManorScene(userId?: string): Promise<ManorSceneSnapshot> {
  const response = await fetch("/api/v2/manor/scene", { cache: "no-store", headers: userId ? { "x-manor-owner": userId } : undefined, signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if ([401, 403].includes(response.status) || result.error?.code === "IDENTITY_CHANGED") throw new SceneIdentityError("登录账号已变化或失效。请回到原账号后恢复待确认操作。");
  if (!response.ok) throw new Error(messages[result.error?.code] ?? "庄园装扮尚未同步，请重试。");
  return result;
}
export async function commandManorScene(userId: string, input?: Command): Promise<Result> {
  let operation = pending(userId);
  if (operation && input) {
    const { operationId: _id, ...prior } = operation;
    void _id;
    if (JSON.stringify(prior) !== JSON.stringify(input)) throw new Error("上一操作的结果尚未确认，请先恢复待确认操作。");
  }
  if (!operation) {
    if (!input) throw new Error("没有待确认的操作。");
    operation = { ...input, operationId: `scene-${crypto.randomUUID()}` } as ManorSceneCommand;
    memory.set(userId, operation);
    try { sessionStorage.setItem(key(userId), JSON.stringify(operation)); } catch { /* Keep the same operation in memory. */ }
  }
  try {
    await readManorScene(userId);
    const receipt = await fetch(`/api/v2/manor/operations/${encodeURIComponent(operation.operationId)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (receipt.ok) {
      const body = await receipt.json();
      const scene = await readManorScene(userId);
      clear(userId);
      return { ...body.result, scene } as Result;
    }
    if (receipt.status !== 404) throw new Error("暂时无法确认上一操作。");
    const response = await fetch("/api/v2/manor/scene", { method: "POST", headers: { "content-type": "application/json", "x-manor-owner": userId }, body: JSON.stringify(operation), signal: AbortSignal.timeout(15000) });
    const body = await response.json();
    if (!response.ok) {
      const identityFailure = [401, 403].includes(response.status) || body.error?.code === "IDENTITY_CHANGED";
      if (identityFailure) throw new SceneIdentityError("登录账号已变化或失效。请回到原账号后恢复待确认操作。");
      if (response.status < 500 && ![408, 429].includes(response.status)) clear(userId);
      throw new Error(messages[body.error?.code] ?? "操作尚未保存，请刷新后重试。");
    }
    clear(userId);
    return body as Result;
  } catch (error) {
    if (error instanceof SceneIdentityError) throw error;
    if (pending(userId)) throw new Error("结果尚未确认。请恢复待确认操作，不要重复兑换。");
    throw error;
  }
}
export function hasPendingManorScene(userId: string) { return Boolean(pending(userId)); }
