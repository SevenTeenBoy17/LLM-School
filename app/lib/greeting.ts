// 角色×姓名 动态问候（消除写死「下午好，王教授」——评审 P0-4）。
// 纯函数，服务端安全；hour 由调用方传入（客户端用 new Date().getHours()）。
import type { UserRole } from "@/lib/types";

export function timeOfDay(hour: number): string {
  if (hour < 6) return "凌晨好";
  if (hour < 9) return "早上好";
  if (hour < 12) return "上午好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

/** 取名（去姓）：仅 3+ 字纯中文取后两字，复姓/英文/短名回退全名，避免错称。 */
export function givenName(name: string): string {
  return /^[一-龥]{3,}$/.test(name) ? name.slice(-2) : name;
}

/** 角色×姓名 动态问候。教师/科研用敬称，学生口语化，管理类用全名。 */
export function greeting(name: string, role: UserRole, hour = 9): string {
  const t = timeOfDay(hour);
  const g = givenName(name);
  switch (role) {
    case "teacher":
    case "researcher":
      return `${t}，${g} 老师 👋`;
    case "student":
      return `${t}，${g} 👋`;
    case "admin":
    case "college-admin":
    default:
      return `${t}，${g}`;
  }
}
