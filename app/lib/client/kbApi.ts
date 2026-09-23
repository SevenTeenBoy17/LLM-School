// 客户端知识库 API（Phase E）。诚实关键词检索（非向量）。
export interface KbFileDto {
  id: string; ownerId: string; uploader: string; name: string; type: string;
  sizeBytes: number; scope: string; chunkCount: number; hasText: boolean; createdAt: number;
}
export interface KbFileDetail extends KbFileDto { textPreview: string; }
export interface KbHit { fileId: string; name: string; snippet: string; }
export interface KbUploadInput { name: string; type?: string; sizeBytes: number; scope: string; textContent?: string; }

export async function apiListKb(): Promise<{ files: KbFileDto[]; userId: string }> {
  const res = await fetch("/api/knowledge", { cache: "no-store" });
  if (!res.ok) return { files: [], userId: "" };
  return (await res.json()) as { files: KbFileDto[]; userId: string };
}
export async function apiGetKb(id: string): Promise<KbFileDetail | null> {
  const res = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return ((await res.json()) as { file: KbFileDetail }).file;
}
export async function apiUploadKb(input: KbUploadInput): Promise<KbFileDto | null> {
  const res = await fetch("/api/knowledge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  if (!res.ok) return null;
  return ((await res.json()) as { file: KbFileDto }).file;
}
export async function apiDeleteKb(id: string): Promise<boolean> {
  const res = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return res.ok;
}
export async function apiSearchKb(q: string): Promise<KbHit[]> {
  if (!q.trim()) return [];
  const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { hits: KbHit[] }).hits;
}

// 文本类文件客户端读取纯文本（PDF/Word/PPT 等二进制不解析，诚实按文件名/说明检索）。
const TEXT_EXT = new Set(["txt", "md", "markdown", "csv", "json", "log", "text"]);
export function isTextFile(name: string): boolean {
  return TEXT_EXT.has((name.split(".").pop() || "").toLowerCase());
}
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    if (!isTextFile(file.name)) { resolve(""); return; }
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || "").slice(0, 200_000));
    r.onerror = () => resolve("");
    r.readAsText(file);
  });
}
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
