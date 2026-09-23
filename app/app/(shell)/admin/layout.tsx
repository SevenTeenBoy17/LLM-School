import type { ReactNode } from "react";

/**
 * Admin access is server-authoritative.
 *
 * `proxy.ts` verifies the signed session cookie before any `/admin/*` route is
 * rendered, and sensitive API routes repeat role checks. A client redirect here
 * would race against the persisted Zustand default role during hydration and
 * send real admins back to `/dashboard` on hard refresh.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
