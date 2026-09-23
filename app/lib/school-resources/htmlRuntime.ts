import { MAX_HTML_BYTES } from "./model";

export function hasRuntimePolicy(policy: string | null) {
  if (!policy || /[^\t\x20-\x7e]/.test(policy)) return false;
  const allowed = new Set(["default-src", "script-src", "style-src", "img-src", "media-src", "font-src", "sandbox", "frame-src", "connect-src", "form-action", "object-src", "worker-src", "base-uri"]);
  const directives = new Map<string, string>();
  for (const part of (policy ?? "").split(";")) {
    if (!part.trim()) continue;
    const [rawName, ...values] = part.trim().split(/[ \t]+/);
    const name = rawName.toLowerCase();
    // Browsers use the first duplicate; reject ambiguous configuration entirely.
    if (!allowed.has(name) || directives.has(name)) return false;
    directives.set(name, values.join(" "));
  }
  return directives.get("default-src") === "'none'"
    && directives.get("script-src") === "'unsafe-inline'"
    && directives.get("style-src") === "'unsafe-inline'"
    && directives.get("img-src") === "data: blob:"
    && directives.get("media-src") === "data: blob:"
    && directives.get("font-src") === "data:"
    && directives.get("sandbox") === "allow-scripts"
    && directives.get("frame-src") === "blob:"
    && directives.get("connect-src") === "'none'"
    && directives.get("form-action") === "'none'"
    && directives.get("object-src") === "'none'"
    && directives.get("worker-src") === "'none'"
    && directives.get("base-uri") === "'none'";
}

export async function readActivityHtml(blob: Blob) {
  if (blob.size <= 0 || blob.size > MAX_HTML_BYTES) throw new Error("HTML 活动须为非空文件，且不超过 5 MB。");
  const bytes = await blob.arrayBuffer();
  const html = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!html.trim() || html.includes("\0")) throw new Error("无法识别 HTML 文本，请使用 UTF-8 编码导出。");
  return html;
}
