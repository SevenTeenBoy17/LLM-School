import "server-only";
import { isProd } from "@/lib/server/env";

export type MutationGuardResult =
  | { ok: true }
  | { ok: false; status: 403 | 415; code: "CROSS_ORIGIN_REQUEST" | "UNSUPPORTED_MEDIA_TYPE"; message: string };

export function validateMutationOrigin(request: Request): MutationGuardResult {
  const requestUrl = new URL(request.url);
  const trustedOrigins = new Set([requestUrl.origin]);
  const configuredOrigin = process.env.EDUAI_PUBLIC_ORIGIN;
  if (configuredOrigin) {
    try {
      trustedOrigins.add(new URL(configuredOrigin).origin);
    } catch { /* an invalid deployment origin never becomes trusted */ }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  if (host) trustedOrigins.add(`${forwardedProto || requestUrl.protocol.replace(":", "")}://${host}`);

  const originHeader = request.headers.get("origin");
  let originMatched = false;
  if (originHeader) {
    try {
      const supplied = new URL(originHeader);
      originMatched = trustedOrigins.has(supplied.origin);
      if (!originMatched && !isProd()) {
        const expected = requestUrl;
        const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
        originMatched = loopback.has(supplied.hostname) && loopback.has(expected.hostname) && supplied.port === expected.port;
      }
    } catch { /* handled by the shared rejection below */ }
    if (!originMatched) {
      return { ok: false, status: 403, code: "CROSS_ORIGIN_REQUEST", message: "请求来源未获授权。" };
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none" && !(fetchSite === "same-site" && originMatched)) {
    return { ok: false, status: 403, code: "CROSS_ORIGIN_REQUEST", message: "请求来源未获授权。" };
  }
  return { ok: true };
}

export function validateJsonMutationRequest(request: Request): MutationGuardResult {
  const origin = validateMutationOrigin(request);
  if (!origin.ok) return origin;
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, status: 415, code: "UNSUPPORTED_MEDIA_TYPE", message: "写操作仅接受 application/json。" };
  }
  return { ok: true };
}
