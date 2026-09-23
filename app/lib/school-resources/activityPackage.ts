import { fileExtension, GRADES, MAX_HTML_BYTES, requireResourceCrypto, SUBJECTS, type SchoolResource } from "./model";
import { readActivityHtml } from "./htmlRuntime";

export const PACKAGE_EXTENSION = ".eduactivity";
export const MAX_PACKAGE_BYTES = 8 * 1024 * 1024;
export interface ActivityBrief { audience: string; instructions: string; question: string; }
export interface ActivityPackage {
  schema: "eduai-activity-package/v1"; id: string; createdAt: string;
  title: string; fileName: string; subject: string; grade: string; description: string;
  brief: ActivityBrief; sha256: string; base64: string;
}
export function validateBrief(brief: ActivityBrief) {
  if (!brief.audience.trim() || brief.audience.length > 100) throw new Error("请填写适用对象，最多 100 字，不填写学生姓名。");
  if (!brief.instructions.trim() || brief.instructions.length > 1000) throw new Error("请填写活动任务，最多 1000 字。");
  if (!brief.question.trim() || brief.question.length > 500) throw new Error("请填写观察或反思问题，最多 500 字。");
}
export async function sha256Blob(blob: Blob) {
  const hash = await requireResourceCrypto().subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export function sourceBlob(resource: SchoolResource) {
  if (resource.blob) return resource.blob;
  if (resource.origin === "example" && typeof resource.body === "string") return new Blob([resource.body], { type: resource.mimeType });
  throw new Error("本机原文件不可用，请重新添加。");
}
export async function createActivityPackage(resource: SchoolResource, brief: ActivityBrief): Promise<ActivityPackage> {
  validateBrief(brief);
  if (!["html", "htm"].includes(fileExtension(resource.fileName))) throw new Error("活动包仅支持单文件 HTML。");
  const blob = sourceBlob(resource);
  await readActivityHtml(blob);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { schema: "eduai-activity-package/v1", id: requireResourceCrypto().randomUUID(), createdAt: new Date().toISOString(),
    title: resource.title, fileName: resource.fileName, subject: resource.subject, grade: resource.grade, description: resource.description,
    brief: { audience: brief.audience.trim(), instructions: brief.instructions.trim(), question: brief.question.trim() },
    sha256: await sha256Blob(blob), base64: btoa(binary) };
}
const bounded = (value: unknown, limit: number, required = true): value is string => typeof value === "string" && value.length <= limit && (!required || Boolean(value.trim()));
export async function readActivityPackage(file: Blob): Promise<{ resource: SchoolResource; brief: ActivityBrief; packageId: string }> {
  if (!file.size || file.size > MAX_PACKAGE_BYTES) throw new Error("活动包为空或超过 8 MB。");
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error("活动包格式损坏，无法读取。"); }
  if (!data || data.schema !== "eduai-activity-package/v1" || !bounded(data.id, 80) || !bounded(data.title, 100)
    || !bounded(data.fileName, 255) || !["html", "htm"].includes(fileExtension(data.fileName))
    || !bounded(data.description, 500, false) || !SUBJECTS.includes(data.subject) || !GRADES.includes(data.grade)
    || !data.brief || !bounded(data.brief.audience, 100) || !bounded(data.brief.instructions, 1000) || !bounded(data.brief.question, 500)
    || !bounded(data.sha256, 64) || !/^[a-f0-9]{64}$/.test(data.sha256)
    || !bounded(data.base64, Math.ceil(MAX_HTML_BYTES / 3) * 4) || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error("活动包字段不完整或版本不支持。");
  let binary;
  try { binary = atob(data.base64); } catch { throw new Error("活动文件编码损坏。"); }
  const blob = new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: "text/html" });
  await readActivityHtml(blob);
  if (await sha256Blob(blob) !== data.sha256) throw new Error("活动文件校验不一致，请重新向教师获取文件。");
  return { resource: { id: `import-${requireResourceCrypto().randomUUID()}`, origin: "local", title: data.title, kind: "activity", subject: data.subject, grade: data.grade,
    description: data.description, author: "外部活动包（身份未验证）", scope: "private", rights: "licensed", updatedAt: Date.now(), revision: 1,
    fileName: data.fileName, fileSize: blob.size, mimeType: "text/html", sha256: data.sha256, blob },
    brief: { audience: data.brief.audience, instructions: data.brief.instructions, question: data.brief.question }, packageId: data.id };
}
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = fileName.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
