import type JSZip from "jszip";
import type { SchoolResource } from "./model";

export const PREVIEW_LIMITS = {
  fileBytes: 50 * 1024 * 1024,
  documentBytes: 10 * 1024 * 1024,
  plainTextBytes: 20_000,
  archiveEntries: 512,
  archiveEntryBytes: 8 * 1024 * 1024,
  archiveTotalBytes: 32 * 1024 * 1024,
  xmlBytes: 2 * 1024 * 1024,
  xmlElements: 50_000,
  xmlDepth: 100,
  pages: 30,
  textCharacters: 200_000,
  timeoutMs: 15_000,
} as const;

type PreviewSource = Pick<SchoolResource, "origin" | "fileName" | "mimeType" | "blob" | "body">;
export type PreviewFormat = "image" | "audio" | "video" | "text" | "pdf" | "docx" | "pptx" | "legacy" | "unsupported";
export type DocumentPreview =
  | { kind: "image" | "audio" | "video"; blob: Blob }
  | { kind: "text"; text: string; truncated: boolean }
  | { kind: "document"; format: "pdf" | "docx" | "pptx"; pages: { number: number; text: string }[]; totalPages: number; truncated: boolean }
  | { kind: "unsupported"; message: string };

export class DocumentPreviewError extends Error {
  readonly code: "missing" | "size" | "type" | "archive" | "xml" | "timeout" | "protected" | "parse";
  constructor(code: DocumentPreviewError["code"]) {
    super({
      missing: "本机原文件不可用，请重新添加。",
      size: "文件或解压内容超过本机预览上限，请下载原文件查看。",
      type: "文件内容与格式不符，无法安全预览。",
      archive: "Office 压缩包损坏、加密或包含不安全路径，无法预览。",
      xml: "文档结构损坏或超出安全预览限制，无法预览。",
      timeout: "本机预览超时，请下载原文件查看。",
      protected: "此 PDF 需要密码，本机文字预览不支持解密，请下载后打开。",
      parse: "无法读取文档内容，请核对文件格式；原文件仍可下载。",
    }[code]);
    this.name = "DocumentPreviewError";
    this.code = code;
  }
}

const FORMATS: Record<string, [PreviewFormat, string]> = {
  png: ["image", "image/png"], jpg: ["image", "image/jpeg"], jpeg: ["image", "image/jpeg"],
  webp: ["image", "image/webp"], gif: ["image", "image/gif"],
  mp3: ["audio", "audio/mpeg"], wav: ["audio", "audio/wav"], ogg: ["audio", "audio/ogg"], m4a: ["audio", "audio/mp4"],
  mp4: ["video", "video/mp4"], webm: ["video", "video/webm"],
  txt: ["text", "text/plain"], md: ["text", "text/markdown"], pdf: ["pdf", "application/pdf"],
  docx: ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  doc: ["legacy", "application/msword"], ppt: ["legacy", "application/vnd.ms-powerpoint"],
};

export function documentPreviewFormat(resource: Pick<PreviewSource, "fileName">): PreviewFormat {
  return FORMATS[extension(resource.fileName)]?.[0] ?? "unsupported";
}
function extension(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }

export function documentPreviewBlob(resource: PreviewSource): Blob | null {
  if (resource.blob) return resource.blob;
  if (resource.origin === "example" && typeof resource.body === "string") {
    return new Blob([resource.body], { type: resource.mimeType || "text/plain" });
  }
  return null;
}

function checkMime(value: string, expected: string, ext: string) {
  const mime = value.split(";")[0].trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    md: ["text/plain", "text/x-markdown"], wav: ["audio/x-wav", "audio/wave"],
    m4a: ["audio/x-m4a"], mp3: ["audio/mp3"], ogg: ["application/ogg"],
  };
  if (mime && mime !== "application/octet-stream" && mime !== expected && !aliases[ext]?.includes(mime)) {
    throw new DocumentPreviewError("type");
  }
}

async function validateSignature(blob: Blob, ext: string) {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const valid: Record<string, boolean> = {
    png: starts(137, 80, 78, 71, 13, 10, 26, 10), jpg: starts(255, 216, 255), jpeg: starts(255, 216, 255),
    gif: ["GIF87a", "GIF89a"].includes(ascii(0, 6)), webp: ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP",
    wav: ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE", ogg: ascii(0, 4) === "OggS",
    mp3: ascii(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224),
    mp4: ascii(4, 4) === "ftyp", m4a: ascii(4, 4) === "ftyp", webm: starts(26, 69, 223, 163),
    pdf: ascii(0, 5) === "%PDF-", docx: starts(80, 75, 3, 4), pptx: starts(80, 75, 3, 4),
  };
  if (valid[ext] === false) throw new DocumentPreviewError("type");
}

// JSZip 3.10 exposes this streaming API, but omits it from JSZipObject's declarations.
type StreamingZipEntry = JSZip.JSZipObject & { internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array> };
function readZipEntry(entry: JSZip.JSZipObject, budget: { bytes: number }, signal: AbortSignal) {
  return new Promise<Uint8Array>((resolve, reject) => {
    signal.throwIfAborted();
    const stream = (entry as StreamingZipEntry).internalStream("uint8array");
    const chunks: Uint8Array[] = [];
    let size = 0;
    let done = false;
    const fail = (error: unknown) => {
      if (done) return;
      done = true; stream.pause(); chunks.length = 0;
      signal.removeEventListener("abort", abort); reject(error);
    };
    const abort = () => fail(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    stream.on("data", (chunk) => {
      if (done) return;
      size += chunk.length; budget.bytes += chunk.length;
      const limit = /\.(xml|rels)$/i.test(entry.name) ? PREVIEW_LIMITS.xmlBytes : PREVIEW_LIMITS.archiveEntryBytes;
      if (size > limit || budget.bytes > PREVIEW_LIMITS.archiveTotalBytes) return fail(new DocumentPreviewError("size"));
      chunks.push(chunk);
    });
    stream.on("error", () => fail(new DocumentPreviewError("archive")));
    stream.on("end", () => {
      if (done) return;
      done = true; signal.removeEventListener("abort", abort);
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      resolve(bytes);
    });
    stream.resume();
  });
}

function parseXml(text: string): XMLDocument {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new DocumentPreviewError("xml");
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (!document.documentElement || document.getElementsByTagNameNS("*", "parsererror").length) throw new DocumentPreviewError("xml");
  const elements = document.getElementsByTagName("*");
  if (elements.length > PREVIEW_LIMITS.xmlElements) throw new DocumentPreviewError("xml");
  for (const element of Array.from(elements)) {
    let depth = 0;
    for (let parent = element.parentNode; parent; parent = parent.parentNode) {
      if (++depth > PREVIEW_LIMITS.xmlDepth) throw new DocumentPreviewError("xml");
    }
  }
  return document;
}

async function openOffice(blob: Blob, signal: AbortSignal) {
  const { default: Zip } = await import("jszip");
  signal.throwIfAborted();
  const buffer = await blob.arrayBuffer();
  signal.throwIfAborted();
  const zip = await Zip.loadAsync(buffer).catch(() => { throw new DocumentPreviewError("archive"); });
  const entries = Object.values(zip.files);
  if (entries.length > PREVIEW_LIMITS.archiveEntries) throw new DocumentPreviewError("size");
  const xml = new Map<string, string>();
  const budget = { bytes: 0 };
  for (const entry of entries) {
    signal.throwIfAborted();
    const name = entry.unsafeOriginalName ?? entry.name;
    if (name !== entry.name || name.startsWith("/") || /[\\:\x00-\x1f]/.test(name) || name.split("/").includes("..")) throw new DocumentPreviewError("archive");
    if (entry.dir) continue;
    const bytes = await readZipEntry(entry, budget, signal);
    if (/\.(xml|rels)$/i.test(name)) {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      parseXml(text);
      xml.set(name, text);
    }
  }
  return { xml, Zip };
}

function requiredXml(xml: Map<string, string>, path: string) {
  const text = xml.get(path);
  if (!text) throw new DocumentPreviewError("xml");
  return parseXml(text);
}

async function readOffice(blob: Blob, format: "docx" | "pptx", signal: AbortSignal): Promise<DocumentPreview> {
  const { xml, Zip } = await openOffice(blob, signal);
  signal.throwIfAborted();
  if (format === "docx") {
    requiredXml(xml, "word/document.xml");
    // Only preflighted XML reaches Mammoth. Images, macros and embedded objects are not converted.
    const safeZip = new Zip();
    for (const [name, value] of xml) safeZip.file(name, value);
    const arrayBuffer = await safeZip.generateAsync({ type: "arraybuffer", compression: "STORE" });
    signal.throwIfAborted();
    const mammoth = await import("mammoth");
    signal.throwIfAborted();
    const input = { arrayBuffer, buffer: new Uint8Array(arrayBuffer) };
    const result = await mammoth.extractRawText(input);
    signal.throwIfAborted();
    return { kind: "document", format, pages: [{ number: 1, text: result.value.slice(0, PREVIEW_LIMITS.textCharacters) }], totalPages: 1, truncated: result.value.length > PREVIEW_LIMITS.textCharacters };
  }
  const presentation = requiredXml(xml, "ppt/presentation.xml");
  const relationships = requiredXml(xml, "ppt/_rels/presentation.xml.rels");
  const targets = new Map(Array.from(relationships.getElementsByTagNameNS("*", "Relationship"))
    .filter((element) => element.getAttribute("TargetMode") !== "External" && /\/slide$/.test(element.getAttribute("Type") ?? ""))
    .map((element) => [element.getAttribute("Id"), element.getAttribute("Target")]));
  const slideIds = Array.from(presentation.getElementsByTagNameNS("*", "sldId"));
  if (!slideIds.length) throw new DocumentPreviewError("xml");
  const pages = [];
  let remaining = PREVIEW_LIMITS.textCharacters as number;
  let truncated = slideIds.length > PREVIEW_LIMITS.pages;
  for (const [index, slide] of slideIds.slice(0, PREVIEW_LIMITS.pages).entries()) {
    signal.throwIfAborted();
    const id = Array.from(slide.attributes).find((attribute) => attribute.localName === "id" && attribute.namespaceURI)?.value;
    const target = targets.get(id ?? null);
    if (!target || /[:\\?#]/.test(target) || target.startsWith("/") || decodeURIComponent(target).split("/").includes("..")) throw new DocumentPreviewError("xml");
    const url = new URL(target, "https://local.invalid/ppt/presentation.xml");
    const name = decodeURIComponent(url.pathname.slice(1));
    if (url.origin !== "https://local.invalid" || !/^ppt\/slides\/[^/]+\.xml$/.test(name)) throw new DocumentPreviewError("xml");
    const document = requiredXml(xml, name);
    const text = Array.from(document.getElementsByTagNameNS("*", "p"))
      .filter((element) => element.namespaceURI?.includes("drawingml"))
      .map((paragraph) => Array.from(paragraph.getElementsByTagNameNS("*", "t")).map((run) => run.textContent ?? "").join(""))
      .join("\n");
    pages.push({ number: index + 1, text: text.slice(0, remaining) });
    if (text.length > remaining) truncated = true;
    remaining -= Math.min(text.length, remaining);
    if (!remaining) { truncated ||= pages.length < slideIds.length; break; }
  }
  return { kind: "document", format, pages, totalPages: slideIds.length, truncated };
}

async function readPdf(blob: Blob, signal: AbortSignal): Promise<DocumentPreview> {
  const { getResolvedPDFJS } = await import("unpdf");
  const pdfjs = await getResolvedPDFJS();
  signal.throwIfAborted();
  const data = new Uint8Array(await blob.arrayBuffer());
  signal.throwIfAborted();
  const loading = pdfjs.getDocument({
    data, enableXfa: false,
    useWorkerFetch: false, useWasm: false, useSystemFonts: false, disableFontFace: true,
    disableAutoFetch: true, disableRange: true, disableStream: true, stopAtErrors: true,
  });
  let disposed = false;
  let protectedFile = false;
  const dispose = () => { if (!disposed) { disposed = true; void loading.destroy().catch(() => {}); } };
  loading.onPassword = () => { protectedFile = true; dispose(); };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    const document = await loading.promise;
    const pages = [];
    let remaining = PREVIEW_LIMITS.textCharacters as number;
    let truncated = document.numPages > PREVIEW_LIMITS.pages;
    for (let number = 1; number <= Math.min(document.numPages, PREVIEW_LIMITS.pages); number++) {
      signal.throwIfAborted();
      const page = await document.getPage(number);
      const reader = page.streamTextContent().getReader();
      let text = "";
      try {
        while (remaining > 0) {
          signal.throwIfAborted();
          const chunk = await reader.read();
          if (chunk.done) break;
          for (const item of chunk.value.items) {
            if (!("str" in item)) continue;
            const value = `${item.str}${item.hasEOL ? "\n" : " "}`;
            text += value.slice(0, remaining);
            remaining -= Math.min(value.length, remaining);
            if (!remaining) { truncated = true; break; }
          }
        }
      } finally { await reader.cancel().catch(() => {}); page.cleanup(); }
      pages.push({ number, text });
      if (!remaining) break;
    }
    return { kind: "document", format: "pdf", pages, totalPages: document.numPages, truncated };
  } catch (error) {
    if (protectedFile) throw new DocumentPreviewError("protected");
    throw error;
  } finally { signal.removeEventListener("abort", dispose); dispose(); }
}

export async function loadDocumentPreview(resource: PreviewSource, options: { signal?: AbortSignal } = {}): Promise<DocumentPreview> {
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  const timer = setTimeout(() => controller.abort(new DocumentPreviewError("timeout")), PREVIEW_LIMITS.timeoutMs);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const { signal } = controller;
  let rejectAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectAbort, { once: true });
    if (signal.aborted) rejectAbort();
  });
  const operation = async (): Promise<DocumentPreview> => {
    signal.throwIfAborted();
    const blob = documentPreviewBlob(resource);
    if (!blob) throw new DocumentPreviewError("missing");
    if (blob.size > PREVIEW_LIMITS.fileBytes) throw new DocumentPreviewError("size");
    const ext = extension(resource.fileName);
    const [format, mime] = FORMATS[ext] ?? ["unsupported", ""];
    if (format === "unsupported" || format === "legacy") return { kind: "unsupported", message: "此格式不提供本机预览，请下载原文件查看。" };
    checkMime(resource.mimeType, mime, ext); checkMime(blob.type, mime, ext);
    if (format === "text") {
      const truncated = blob.size > PREVIEW_LIMITS.plainTextBytes;
      const buffer = await blob.slice(0, PREVIEW_LIMITS.plainTextBytes).arrayBuffer();
      return { kind: "text", text: new TextDecoder("utf-8").decode(buffer, { stream: truncated }), truncated };
    }
    if (!["image", "audio", "video"].includes(format) && blob.size > PREVIEW_LIMITS.documentBytes) throw new DocumentPreviewError("size");
    await validateSignature(blob, ext); signal.throwIfAborted();
    if (format === "image" || format === "audio" || format === "video") return { kind: format, blob: blob.slice(0, blob.size, mime) };
    return format === "pdf" ? readPdf(blob, signal) : readOffice(blob, format, signal);
  };
  try { return await Promise.race([operation(), cancelled]); }
  catch (error) {
    if (signal.aborted) throw signal.reason;
    if (error instanceof DocumentPreviewError) throw error;
    throw new DocumentPreviewError("parse");
  } finally {
    clearTimeout(timer); options.signal?.removeEventListener("abort", abort);
    if (rejectAbort) signal.removeEventListener("abort", rejectAbort);
  }
}
