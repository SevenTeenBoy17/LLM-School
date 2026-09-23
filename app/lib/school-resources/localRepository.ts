import { emptyResourceState, GRADES, KINDS, MAX_LIBRARY_BYTES, SCOPES, SUBJECTS, validateResourceFile, type LocalResourceState, type ResourceEditToken, type SchoolResource } from "./model";

const DB_NAME = "eduai-school-resources-v1";
const STORE = "accounts";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("此浏览器未开放本机存储，无法保存草稿。")); return; }
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    let blocked = false;
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
    request.onerror = () => reject(new Error("本机存储无法打开，请检查浏览器存储权限。"));
    request.onblocked = () => { blocked = true; reject(new Error("另一个页面正在使用旧版存储，请关闭后重试。")); };
  });
}

function checked(value: unknown): LocalResourceState {
  if (value === undefined) return emptyResourceState();
  const state = value as LocalResourceState;
  if (!state || !Array.isArray(state.drafts) || !Array.isArray(state.favoriteIds)
    || state.favoriteIds.some(id => typeof id !== "string")
    || state.drafts.some(r => !validDraft(r, true))) {
    throw new Error("本机草稿数据无法读取，未覆盖已有内容。请保留浏览器数据并联系维护人员。");
  }
  return { drafts: state.drafts.map(r => ({ ...r, revision: r.revision ?? 1 })), favoriteIds: state.favoriteIds };
}
function validDraft(value: unknown, allowLegacy = false): value is SchoolResource {
  if (!value || typeof value !== "object") return false;
  const r = value as SchoolResource;
  return r.origin === "local" && typeof r.id === "string" && r.id.startsWith("local-")
    && typeof r.title === "string" && r.title.trim().length > 0 && r.title.length <= 100
    && Object.hasOwn(KINDS, r.kind) && SUBJECTS.includes(r.subject) && GRADES.includes(r.grade)
    && Object.hasOwn(SCOPES, r.scope) && ["own", "licensed"].includes(r.rights)
    && typeof r.description === "string" && r.description.length <= 500 && typeof r.author === "string"
    && typeof r.fileName === "string" && typeof r.mimeType === "string"
    && Number.isFinite(r.updatedAt) && r.updatedAt > 0
    && ((allowLegacy && r.revision === undefined) || (Number.isSafeInteger(r.revision) && r.revision >= 1))
    && r.blob instanceof Blob && r.fileSize === r.blob.size
    && typeof r.sha256 === "string" && /^[a-f0-9]{64}$/.test(r.sha256)
    && validateResourceFile({ name: r.fileName, size: r.fileSize, type: r.mimeType }) === null;
}

// Read/modify/write is one transaction so simultaneous tabs cannot silently overwrite drafts.
async function transaction(accountId: string, update?: (state: LocalResourceState) => LocalResourceState): Promise<LocalResourceState> {
  if (!accountId) throw new Error("身份失效，请重新登录。");
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    let result: LocalResourceState;
    let failure: Error | null = null;
    const abortWith = (error: unknown) => {
      failure ??= error instanceof Error ? error : new Error("本机保存失败。");
      try { tx.abort(); }
      catch {
        // A browser-aborted transaction may already be inactive; keep the original failure.
        db.close(); reject(failure);
      }
    };
    const request = store.get(accountId);
    request.onsuccess = () => {
      try {
        result = checked(request.result);
        const prefix = `${accountId}:`;
        const legacyKeysRequest = store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}\uffff`));
        legacyKeysRequest.onsuccess = () => {
          const legacyKeys = legacyKeysRequest.result.filter(key => typeof key === "string" && /^\d+$/.test(key.slice(prefix.length)));
          let remaining = legacyKeys.length;
          const finish = () => {
            try {
              if (update) result = update(result);
              if (update || legacyKeys.length) store.put(result, accountId);
              for (const key of legacyKeys) store.delete(key);
            } catch (error) { abortWith(error); }
          };
          if (!remaining) { finish(); return; }
          // Adopt this user's old session namespaces and remove them only on commit.
          for (const key of legacyKeys) {
            const legacyRequest = store.get(key);
            legacyRequest.onsuccess = () => {
              try {
                const legacy = checked(legacyRequest.result);
                const byId = new Map(result.drafts.map(r => [r.id, r]));
                for (const draft of legacy.drafts) {
                  const current = byId.get(draft.id);
                  if (!current || draft.updatedAt > current.updatedAt) byId.set(draft.id, draft);
                }
                result = { drafts: [...byId.values()], favoriteIds: [...new Set([...result.favoriteIds, ...legacy.favoriteIds])] };
                if (--remaining === 0) finish();
              } catch (error) { abortWith(error); }
            };
          }
        };
      } catch (error) { abortWith(error); }
    };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(failure ?? new Error("保存未完成，可能是本机空间不足或浏览器禁止存储。文件未上传。")); };
  });
}

export function loadLocalResources(accountId: string) { return transaction(accountId); }
export function saveLocalResources(accountId: string, incoming: SchoolResource[], expected?: ResourceEditToken) {
  if (!incoming.length || incoming.some(item => !validDraft(item))) return Promise.reject(new Error("草稿信息不完整，未覆盖已有内容。"));
  return transaction(accountId, state => {
    if (expected) {
      const current = state.drafts.find(r => r.id === expected.id);
      if (!current) throw new Error("这份草稿已在其他窗口移除。未恢复已删除文件，请保留需要的输入后关闭窗口。");
      if (current.revision !== expected.revision) throw new Error("这份草稿已在其他窗口更新。本次未覆盖新内容，请保留需要的输入后重新打开最新草稿。");
      if (incoming.length !== 1 || incoming[0].id !== expected.id || incoming[0].revision !== current.revision + 1) throw new Error("草稿版本不匹配，未保存。");
    } else if (incoming.some(r => r.revision !== 1 || state.drafts.some(current => current.id === r.id))) {
      throw new Error("草稿已存在，请重新打开详情后编辑。");
    }
    const incomingIds = new Set(incoming.map(r => r.id));
    const others = state.drafts.filter(r => !incomingIds.has(r.id));
    const hashes = new Set(others.map(r => r.sha256).filter(Boolean));
    for (const item of incoming) {
      if (!item.sha256 || hashes.has(item.sha256)) throw new Error(`“${item.title}”与已有草稿内容重复，未重复保存。`);
      hashes.add(item.sha256);
    }
    const drafts = [...incoming, ...others];
    if (drafts.reduce((sum, r) => sum + r.fileSize, 0) > MAX_LIBRARY_BYTES) throw new Error("本账号本机草稿已超过 200 MB，请先下载并移除不需要的草稿。");
    return { ...state, drafts };
  });
}
export function toggleLocalFavorite(accountId: string, id: string) {
  return transaction(accountId, state => ({ ...state, favoriteIds: state.favoriteIds.includes(id)
    ? state.favoriteIds.filter(value => value !== id) : [...state.favoriteIds, id] }));
}
export function removeLocalResource(accountId: string, id: string) {
  return transaction(accountId, state => ({ drafts: state.drafts.filter(r => r.id !== id), favoriteIds: state.favoriteIds.filter(value => value !== id) }));
}
