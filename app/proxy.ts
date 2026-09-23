import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/server/authToken";
import { homeFor, canAccessConsole, canAccessClass, canAccessResearch, canAccessStudent } from "@/lib/nav";
import { BEACON_HEADER, beaconSecret } from "@/lib/server/beacon";

function mutationGuard(request: NextRequest): NextResponse | null {
  const requestOrigin = request.nextUrl.origin;
  const trustedOrigins = new Set([requestOrigin]);
  const configuredOrigin = process.env.EDUAI_PUBLIC_ORIGIN;
  if (configuredOrigin) {
    try { trustedOrigins.add(new URL(configuredOrigin).origin); } catch { /* invalid deployment origins are never trusted */ }
  }
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  if (host) trustedOrigins.add(`${forwardedProto || request.nextUrl.protocol.replace(":", "")}://${host}`);

  const suppliedOrigin = request.headers.get("origin");
  let originMatched = false;
  if (suppliedOrigin) {
    try {
      const parsed = new URL(suppliedOrigin);
      originMatched = trustedOrigins.has(parsed.origin);
      if (!originMatched && process.env.NODE_ENV !== "production") {
        const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
        originMatched = loopback.has(parsed.hostname) && loopback.has(request.nextUrl.hostname) && parsed.port === request.nextUrl.port;
      }
    } catch { /* rejected below */ }
    if (!originMatched) {
      return NextResponse.json({ error: { code: "CROSS_ORIGIN_REQUEST", message: "请求来源未获授权。" } }, { status: 403 });
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none" && !(fetchSite === "same-site" && originMatched)) {
    return NextResponse.json({ error: { code: "CROSS_ORIGIN_REQUEST", message: "请求来源未获授权。" } }, { status: 403 });
  }

  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (request.nextUrl.pathname === "/api/upload") {
    if (mediaType !== "multipart/form-data") {
      return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "文件上传仅接受 multipart/form-data。" } }, { status: 415 });
    }
    return null;
  }

  const mayHaveNoBody = request.method === "DELETE" || request.nextUrl.pathname === "/api/auth/logout" || request.nextUrl.pathname === "/api/manor";
  if ((!mayHaveNoBody || mediaType) && mediaType !== "application/json") {
    return NextResponse.json({ error: { code: "UNSUPPORTED_MEDIA_TYPE", message: "写操作仅接受 application/json。" } }, { status: 415 });
  }
  return null;
}

// proxy（Next 16 中 middleware 的新名）：服务端权威越权守卫 + 越权审计 beacon。
// 保持精简（不 import db/server-only）。注意：这是纵深防御，路由/页面内仍各自校验（见 docs 提醒）。
// 学籍/角色取自已签名的会话 cookie（HMAC 验签），客户端无法篡改。
// 准入/落地判定复用 nav.ts 单一真相源（评审 P1：消除 proxy 与 nav 双写漂移）。

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);

  if (pathname.startsWith("/api/")) {
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    const ephemeralProduction = process.env.NODE_ENV === "production" && process.env.VERCEL === "1";
    if (mutation && ephemeralProduction && pathname !== "/api/auth/login" && pathname !== "/api/auth/logout") {
      return NextResponse.json({ error: { code: "PERSISTENCE_UNAVAILABLE", message: "当前无状态部署不接受持久写入，请使用学校服务器或单实例互联网部署。" } }, { status: 503 });
    }
    if (mutation && user?.demo && pathname !== "/api/auth/logout") {
      return NextResponse.json({ error: { code: "DEMO_READONLY", message: "演示身份仅用于浏览，不会写入持久数据。" } }, { status: 403 });
    }
    if (mutation) {
      const rejected = mutationGuard(request);
      if (rejected) return rejected;
    }
    return NextResponse.next();
  }

  // 未登录 → 回登录页（带 from 以便登录后回跳）
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const denied =
    (pathname.startsWith("/admin") && !canAccessConsole(user.role)) ||
    (pathname.startsWith("/class") && !canAccessClass(user.role)) ||
    (pathname.startsWith("/research") && !canAccessResearch(user.role)) ||
    (pathname.startsWith("/student") && !canAccessStudent(user.role)) ||
    // M5/T7：教师侧工作面对学生 default-deny——侧栏隐藏不等于准入控制（直接输 URL 曾可达）。
    // /hub 前缀同时覆盖 M1/B3 的教师生图工作台 /hub/image。
    ((pathname.startsWith("/dashboard") || pathname.startsWith("/hub") || pathname.startsWith("/agent") || pathname.startsWith("/skills") || pathname.startsWith("/prompts") || pathname.startsWith("/knowledge"))
      && !canAccessResearch(user.role));

  // S2 并线：学生端首页由 /learn 迁至 /student/home（旧地址平滑跳转，页面文件保留）
  if (pathname.startsWith("/learn") && user.role === "student") {
    const url = request.nextUrl.clone();
    url.pathname = "/student/home";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (denied) {
    // 越权审计 beacon（后台落库，不阻塞重定向）。生产未配置密钥时 fail-closed 停用（宁少记不可伪造）。
    try {
      const secret = beaconSecret();
      if (secret) {
        const auditUrl = new URL("/api/audit", request.nextUrl.origin);
        event.waitUntil(
          fetch(auditUrl, {
            method: "POST",
            headers: { "content-type": "application/json", [BEACON_HEADER]: secret },
            body: JSON.stringify({ token, path: pathname, action: "unauthorized_access" }),
          }).catch(() => {})
        );
      }
    } catch { /* ignore */ }
    const url = request.nextUrl.clone();
    url.pathname = homeFor(user.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/learn/:path*",
    "/explore/:path*",
    "/chat/:path*",
    "/hub/:path*",
    "/prompts/:path*",
    "/knowledge/:path*",
    "/agent/:path*",
    "/skills/:path*",
    "/profile/:path*",
    "/class/:path*",
    "/research/:path*",
    "/student/:path*",
    "/admin/:path*",
  ],
};
