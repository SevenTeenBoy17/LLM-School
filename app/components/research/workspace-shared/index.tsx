"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type Dispatch, type ReactNode, type SetStateAction } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Info, X } from "lucide-react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import styles from "./workspace.module.css";

export { ExportTasks } from "./ExportTasks";

const IdentityLock = createContext(false);
const ResearchIdentity = createContext<{ identity: string | null; locked: boolean; failed: boolean; retry: () => void }>({ identity: null, locked: true, failed: false, retry: () => {} });
export function useResearchOwner() { return useContext(ResearchIdentity).identity; }
export function ResearchIdentityBoundary({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const owner = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    let controller: AbortController | undefined;
    let attempt = 0;
    async function verify() {
      const current = ++attempt;
      controller?.abort(); controller = new AbortController();
      const request = controller;
      setLocked(true); setFailed(false);
      const timeout = setTimeout(() => request.abort(), 8000);
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store", signal: request.signal });
        if (!response.ok) throw new Error("identity-unavailable");
        const { user } = await response.json();
        if (!user || typeof user.id !== "string" || !Number.isInteger(user.sessionVersion)) throw new Error("identity-unavailable");
        if (!alive || current !== attempt) return;
        const nextIdentity = `${user.id}:${user.sessionVersion}`;
        if (owner.current && owner.current !== nextIdentity) { window.location.reload(); return; }
        owner.current = nextIdentity;
        setIdentity(nextIdentity);
        setLocked(false);
      } catch { if (alive && current === attempt) setFailed(true); }
      finally { clearTimeout(timeout); }
    }
    const hide = () => { attempt++; controller?.abort(); setLocked(true); };
    const visibility = () => { if (document.hidden) hide(); else void verify(); };
    const focus = () => { void verify(); };
    void verify();
    window.addEventListener("blur", hide); window.addEventListener("focus", focus); document.addEventListener("visibilitychange", visibility);
    return () => { alive = false; controller?.abort(); window.removeEventListener("blur", hide); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visibility); };
  }, [retry]);
  return <ResearchIdentity.Provider value={{ identity, locked, failed, retry: () => setRetry(v => v + 1) }}>{children}</ResearchIdentity.Provider>;
}
export function WorkspaceFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { locked, failed, retry } = useContext(ResearchIdentity);
  return <section className={`${styles.workspace} ${className}`} data-research-workspace>
    <IdentityLock.Provider value={locked}><div inert={locked} aria-hidden={locked || undefined}>{children}</div></IdentityLock.Provider>
    {locked && <div className={styles.identityLock} role="status"><strong>{failed ? "暂时无法确认当前账号" : "正在核对当前账号…"}</strong>{failed ? <><p>工作区已暂时锁定，本机草稿未被清除。</p><WorkButton onClick={retry}>重新核对</WorkButton><a href="/login">重新登录</a></> : <div className={styles.waiting} role="progressbar" aria-label="核对账号进度"><span /></div>}</div>}
  </section>;
}

export type ResearchArtName = "prep" | "artifacts" | "water" | "plant" | "math" | "reading" | "worksheet" | "folder";
export function ResearchArt({ name, size = 48, className = "" }: { name: ResearchArtName; size?: number; className?: string }) {
  // Discrete generated cutouts, not screenshots of controls or text.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/art/research-workspace-v1/${name}.png`} alt="" width={size} height={size} draggable={false} className={`${styles.art} ${className}`} style={{ width: size, height: size }} />;
}

export function WorkButton({ primary = false, className = "", children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <Button {...props} type={type} variant={primary ? "primary" : "outline"} className={`${styles.button} ${primary ? styles.primary : ""} ${className}`}>{children}</Button>;
}

export function DemoNotice() {
  return <p className={styles.demo}><Info size={14} aria-hidden="true" /><span>本机演示 · 示例内容与修改仅保留在当前浏览器标签页，不会同步或发布给师生。请勿输入敏感资料。</span></p>;
}

function DialogBody({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  const locked = useContext(IdentityLock);
  const root = useRef<HTMLDivElement>(null);
  const focusBeforeOpen = useRef<Element | null>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => gsap.fromTo(root.current, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.2, ease: "power3.out", clearProps: "transform,opacity" }), root);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, []);
  return <Dialog.Content ref={root} inert={locked} aria-hidden={locked || undefined} style={locked ? { visibility: "hidden" } : undefined} className={`${styles.dialog} ${className ?? ""}`} {...(!description ? { "aria-describedby": undefined } : {})}
    onOpenAutoFocus={() => { focusBeforeOpen.current = document.activeElement; }}
    onCloseAutoFocus={(event) => {
      if (focusBeforeOpen.current instanceof HTMLElement && focusBeforeOpen.current.isConnected) { event.preventDefault(); focusBeforeOpen.current.focus(); }
    }}>
    <header className={styles.dialogHeader}><div><Dialog.Title className={styles.dialogTitle}>{title}</Dialog.Title>{description && <Dialog.Description className={styles.dialogDescription}>{description}</Dialog.Description>}</div>
      <Dialog.Close asChild><button type="button" className={styles.close} aria-label="关闭窗口" title="关闭窗口"><X size={20} /></button></Dialog.Close>
    </header>
    <div className={styles.dialogBody}>{children}</div>
  </Dialog.Content>;
}

export function WorkDialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; className?: string }) {
  const { failed } = useContext(ResearchIdentity);
  // Release the focus trap on identity failure so the account retry stays reachable.
  return <Dialog.Root open={open && !failed} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className={styles.overlay} /><DialogBody title={title} description={description} className={className}>{children}</DialogBody></Dialog.Portal></Dialog.Root>;
}

// Ownership comes from the authenticated session, never a persisted display name.
// sessionStorage deliberately expires on tab close; sample edits never enter an API payload.
export function useDemoState<T>(key: string, initial: T, validate?: (value: unknown) => value is T): [T, Dispatch<SetStateAction<T>>, { ready: boolean; persistent: boolean; message?: string }] {
  const { identity } = useContext(ResearchIdentity);
  const initialRef = useRef(initial);
  const validator = useRef(validate);
  const [state, setState] = useState<T>(initial);
  const [status, setStatus] = useState<{ ready: boolean; persistent: boolean; message?: string }>({ ready: false, persistent: false });
  const storageKey = useRef<string | null>(null);
  const ready = useRef(false);
  useEffect(() => {
    let alive = true;
    ready.current = false;
    storageKey.current = null;
    if (!identity) return;
    function hydrate() {
      let next = initialRef.current;
      let persistent = false;
      let message: string | undefined;
      try {
        const ownedKey = `research-frontend:v1:${identity}:${key}`;
        const stored = sessionStorage.getItem(ownedKey);
        if (stored) {
          try {
            const decoded: unknown = JSON.parse(stored);
            if (!validator.current?.(decoded)) throw new Error("invalid-draft");
            next = decoded;
          } catch {
            message = "已有本机草稿无法恢复，原数据已保留，未被示例覆盖。当前修改仅保留在页面内存，请先导出材料。";
            throw new Error("invalid-draft");
          }
        }
        sessionStorage.setItem(ownedKey, JSON.stringify(next));
        if (alive) storageKey.current = ownedKey;
        persistent = true;
      } catch { /* Offline/private-mode drafts remain in memory for this view only. */ }
      if (!alive) return;
      ready.current = true;
      setState(next);
      setStatus({ ready: true, persistent, message });
    }
    hydrate();
    return () => { alive = false; ready.current = false; storageKey.current = null; };
  }, [key, identity]);
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    if (!ready.current) return;
    setState((previous) => typeof action === "function" ? (action as (value: T) => T)(previous) : action);
  }, []);
  useEffect(() => {
    if (!status.ready || !storageKey.current) return;
    try { sessionStorage.setItem(storageKey.current, JSON.stringify(state)); }
    catch { storageKey.current = null; queueMicrotask(() => setStatus({ ready: true, persistent: false })); }
  }, [state, status.ready]);
  return [state, update, status];
}

export function AnimatedPanel({ children, className = "", motionKey }: { children: ReactNode; className?: string; motionKey?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => gsap.from(root.current, { opacity: 0, y: 5, duration: 0.18, ease: "power3.out", clearProps: "opacity,transform" }), root);
      return () => ctx.revert();
    });
    return () => media.revert();
  }, [motionKey]);
  return <div ref={root} className={className}>{children}</div>;
}
