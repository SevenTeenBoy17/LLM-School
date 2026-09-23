import "server-only";
import { assertPublicOutboundUrl } from "@/lib/server/outboundGuard";
import { get } from "node:https";
import { isIP } from "node:net";

function publicV4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

async function downloadProviderImage(value: string): Promise<string> {
  const url = new URL(value);
  if (value.length > 8192 || url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("img_invalid_asset_url");
  let addresses = isIP(url.hostname) ? [url.hostname] : [];
  if (!addresses.length) {
    // Encrypted DNS avoids local proxy fake-IP answers; HTTPS download still pins a public IP.
    const dns = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(url.hostname)}&type=A`, {
      headers: { accept: "application/dns-json" }, redirect: "error", signal: AbortSignal.timeout(10_000),
    });
    if (!dns.ok || Number(dns.headers.get("content-length")) > 65536) throw new Error("img_dns_failed");
    const body = await dns.text();
    if (body.length > 65536) throw new Error("img_dns_failed");
    const answer = JSON.parse(body) as { Status?: number; Answer?: { type: number; data: string }[] };
    if (answer.Status !== 0) throw new Error("img_dns_failed");
    addresses = answer.Answer?.filter((item) => item.type === 1).map((item) => item.data) || [];
  }
  if (!addresses.length || addresses.some((address) => !publicV4(address))) throw new Error("img_private_asset_url");
  // Pin the validated address to prevent DNS rebinding; never forward gateway credentials.
  return new Promise((resolve, reject) => {
    const req = get(url, { lookup: (_host, options, cb) => {
      if (options.all) cb(null, [{ address: addresses[0], family: 4 }]);
      else cb(null, addresses[0], 4);
    } }, (response) => {
      if (response.statusCode !== 200 || !response.headers["content-type"]?.startsWith("image/")) {
        response.destroy(); reject(new Error(response.statusCode === 404 || response.statusCode === 410 ? "img_asset_expired" : "img_invalid_asset_response")); return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer) => {
        total += chunk.length;
        if (total > 12 * 1024 * 1024) { response.destroy(new Error("img_asset_too_large")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("base64")));
      response.on("error", reject);
    });
    const timer = setTimeout(() => req.destroy(new Error("img_asset_timeout")), 30_000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
  });
}

// Courseware explicitly requests base64; do not change the shared image workflow.
export async function generateCoursewareImage(prompt: string, source?: { url?: string; save: (url: string) => void }): Promise<string> {
  if (source?.url) return downloadProviderImage(source.url);
  const key = process.env.LLM_IMAGE_API_KEY || process.env.LLM_API_KEY;
  if (!key) throw new Error("img_no_key");
  const configured = process.env.LLM_IMAGE_BASE_URL || process.env.LLM_BASE_URL;
  if (!configured) throw new Error("img_no_base");
  const url = new URL(`${configured.replace(/\/$/, "")}/images/generations`);
  if (url.username || url.password || !["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("img_invalid_base");
  await assertPublicOutboundUrl(url.href);
  const response = await fetch(url, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.EDUAI_IMAGE_MODEL || "gpt-image-2", prompt, n: 1, size: "1792x1024", response_format: "b64_json" }),
    redirect: "error", signal: AbortSignal.timeout(240_000),
  });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`img_gw_${response.status}`); }
  if (!response.body) throw new Error("img_gw_empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > 20 * 1024 * 1024) { await reader.cancel(); throw new Error("img_gw_response_too_large"); }
    chunks.push(item.value);
  }
  const result = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { data?: { b64_json?: unknown; url?: unknown }[] };
  const assetUrl = result.data?.[0]?.url;
  const dataUrl = typeof assetUrl === "string" ? assetUrl.match(/^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/)?.[1] : undefined;
  let b64 = result.data?.[0]?.b64_json || dataUrl;
  if (!b64 && typeof assetUrl === "string") {
    const parsed = new URL(assetUrl);
    if (assetUrl.length > 8192 || parsed.protocol !== "https:" || parsed.username || parsed.password || (parsed.port && parsed.port !== "443")) throw new Error("img_invalid_asset_url");
    source?.save(assetUrl);
    b64 = await downloadProviderImage(assetUrl);
  }
  if (typeof b64 !== "string" || b64.length > 16 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new Error(result.data?.[0]?.url ? "img_url_only_response" : "img_gw_empty");
  }
  return b64;
}
