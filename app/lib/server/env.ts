// 单一生产判定闸（评审 P0：三处生产判断收敛于此，避免漂移）。
// ⚠️ 必须 edge-safe：不得 import "server-only" / db / next/headers——authToken 与 proxy 在边缘运行时引用本模块。
export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}
