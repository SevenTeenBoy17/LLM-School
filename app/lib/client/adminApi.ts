// 客户端管理端 API（Phase E-2）。均为管理员操作，服务端二次 RBAC 门控。
import { toast } from "sonner";

export interface ModelSettingsDto {
  modelId: string; openToStudents: boolean; quotaTeacher: number; quotaStudent: number;
  dataIsolation: boolean; allowUpload: boolean; autoDowngrade: boolean;
}

export async function apiGetModelSettings(id: string): Promise<ModelSettingsDto | null> {
  const res = await fetch(`/api/admin/models/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return ((await res.json()) as { settings: ModelSettingsDto }).settings;
}
export async function apiSaveModelSettings(id: string, patch: Partial<Omit<ModelSettingsDto, "modelId">>): Promise<ModelSettingsDto | null> {
  const res = await fetch(`/api/admin/models/${encodeURIComponent(id)}`, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { settings: ModelSettingsDto }).settings;
}
export async function apiGetRolePerms(roleId: string): Promise<Record<string, boolean> | null> {
  const res = await fetch(`/api/admin/permissions/${encodeURIComponent(roleId)}`, { cache: "no-store" });
  if (!res.ok) return null;
  return ((await res.json()) as { perms: Record<string, boolean> | null }).perms;
}
export async function apiSaveRolePerms(roleId: string, perms: Record<string, boolean>): Promise<boolean> {
  const res = await fetch(`/api/admin/permissions/${encodeURIComponent(roleId)}`, {
    method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ perms }),
  });
  return res.ok;
}

type CsvCell = string | number;

// 通用 CSV 导出（客户端 Blob 下载）。字段值做 CSV 转义。
export function buildCsvContent(headers: CsvCell[], rows: CsvCell[][]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\r\n");
  return "\uFEFF" + csv; // BOM 保中文 Excel 正常
}

export function exportCsv(filename: string, headers: CsvCell[], rows: CsvCell[][]): string {
  try {
    const csv = buildCsvContent(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("CSV 已生成", { description: `${filename} · ${rows.length} 条记录` });
    return csv;
  } catch (error) {
    toast.error("CSV 导出失败", { description: "请刷新后重试，或联系管理员核查浏览器下载权限。" });
    throw error;
  }
}
