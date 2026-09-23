// 客户端导出：把一条回答下载为 Markdown / 纯文本 / 网页 / Word(.docx) / PPT(.pptx)。
// docx / pptx 走真实二进制生成（docx、OOXML+JSZip），按需动态 import，不进主包。

export type ExportFormat = "md" | "txt" | "html" | "docx" | "pptx";

function triggerDownload(filename: string, content: string, mime: string) {
  triggerDownloadBlob(filename, new Blob([content], { type: `${mime};charset=utf-8` }));
}

function triggerDownloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 释放对象 URL（下一帧，确保下载已触发）
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 轻量 Markdown → 纯文本（去掉常见标记符号，保留可读结构）。
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```/g, "").trim())
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + " ")
    .trim();
}

// 去掉行内标记（粗体/行内码），得到纯文本——docx/pptx 拆 run 与 PPT 项目符号复用。
function stripInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1");
}

// 结构化块——html / docx / pptx 三种导出共用同一解析，避免各写一套跑偏。
type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string };

function parseBlocks(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const out: Block[] = [];
  let para: string[] = [];
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;
  let inCode = false;
  let code: string[] = [];

  const flushPara = () => { if (para.length) { out.push({ kind: "p", lines: para }); para = []; } };
  const flushList = () => { if (list) { out.push(list); list = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (/^```/.test(line)) {
      if (inCode) { out.push({ kind: "code", text: code.join("\n") }); code = []; inCode = false; }
      else { flushPara(); flushList(); inCode = true; }
      continue;
    }
    if (inCode) { code.push(raw); continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { flushPara(); flushList(); out.push({ kind: "heading", level: h[1].length, text: h[2] }); continue; }

    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ul) { flushPara(); if (!list || list.kind !== "ul") { flushList(); list = { kind: "ul", items: [] }; } list.items.push(ul[1]); continue; }
    if (ol) { flushPara(); if (!list || list.kind !== "ol") { flushList(); list = { kind: "ol", items: [] }; } list.items.push(ol[1]); continue; }

    if (line.trim() === "") { flushPara(); flushList(); continue; }
    para.push(line);
  }
  if (inCode && code.length) out.push({ kind: "code", text: code.join("\n") });
  flushPara(); flushList();
  return out;
}

// 行内 → 富文本 run（粗体 / 等宽），docx 用。
function inlineRuns(text: string): { text: string; bold?: boolean; mono?: boolean }[] {
  const runs: { text: string; bold?: boolean; mono?: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(/\*\*(.+?)\*\*|`([^`]+)`/g)) {
    const idx = m.index ?? 0;
    if (idx > last) runs.push({ text: text.slice(last, idx) });
    if (m[1] !== undefined) runs.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) runs.push({ text: m[2], mono: true });
    last = idx + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

// 轻量 Markdown → HTML（headings / 列表 / 粗体 / 行内码 / 段落）。防注入：先转义。
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function mdToHtmlBody(md: string): string {
  return parseBlocks(md)
    .map((b) => {
      if (b.kind === "heading") return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
      if (b.kind === "p") return `<p>${b.lines.map(inline).join("<br>")}</p>`;
      if (b.kind === "code") return `<pre><code>${escapeHtml(b.text)}</code></pre>`;
      return `<${b.kind}>${b.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${b.kind}>`;
    })
    .join("\n");
}

function fullHtml(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body{font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.75;color:#1f2430;max-width:760px;margin:40px auto;padding:0 20px}
  h1,h2,h3,h4{line-height:1.35;margin:1.4em 0 .6em}
  code{background:#f2f3f7;border-radius:4px;padding:.1em .35em;font-size:.92em}
  pre{background:#1e2330;color:#e7ebf3;border-radius:12px;padding:14px 16px;overflow:auto}
  pre code{background:transparent;padding:0}
  footer{margin-top:3em;padding-top:1em;border-top:1px solid #e6e8ef;color:#8a90a2;font-size:12px}
</style>
</head>
<body>
<article>${body}</article>
<footer>由 EduAI Prism「i-learning」导出 · 校内使用</footer>
</body>
</html>`;
}

// 文档标题：首个标题，否则首个非空行。
function firstTitle(md: string): string {
  const h = parseBlocks(md).find((b) => b.kind === "heading");
  if (h && h.kind === "heading") return stripInline(h.text).slice(0, 60);
  const firstLine = md.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "EduAI 对话回答";
  return stripInline(firstLine.replace(/^#{1,6}\s+/, "")).slice(0, 60);
}

function splitPptLine(line: PptLine): PptLine[] {
  const maxUnits = line.mono ? 62 : 52;
  const parts: string[] = [];
  let current = "";
  let units = 0;
  for (const character of line.text || " ") {
    const width = character.charCodeAt(0) > 0xff ? 2 : 1;
    if (current && units + width > maxUnits) {
      parts.push(current);
      current = "";
      units = 0;
    }
    current += character;
    units += width;
  }
  if (current || !parts.length) parts.push(current || " ");
  return parts.map((text, index) => ({ ...line, text, bullet: line.bullet && index === 0 }));
}

function paginatePptLines(lines: PptLine[]): PptLine[][] {
  const visualLines = lines.flatMap(splitPptLine);
  const pages: PptLine[][] = [];
  const linesPerSlide = 15;
  for (let index = 0; index < visualLines.length; index += linesPerSlide) pages.push(visualLines.slice(index, index + linesPerSlide));
  return pages;
}

// 真实 Word 导出——结构化块 → docx 段落（标题/项目符号/编号/代码等宽/富文本）。
async function exportDocx(content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");
  const HMAP = [
    HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6,
  ];
  const runs = (text: string) =>
    inlineRuns(text).map((r) => new TextRun({ text: r.text, bold: r.bold, font: r.mono ? "Consolas" : undefined }));

  const children: InstanceType<typeof Paragraph>[] = [];
  for (const b of parseBlocks(content)) {
    if (b.kind === "heading") {
      children.push(new Paragraph({ heading: HMAP[Math.min(b.level, 6) - 1], children: runs(b.text) }));
    } else if (b.kind === "p") {
      children.push(new Paragraph({ children: runs(b.lines.join(" ")) }));
    } else if (b.kind === "ul") {
      for (const it of b.items) children.push(new Paragraph({ bullet: { level: 0 }, children: runs(it) }));
    } else if (b.kind === "ol") {
      b.items.forEach((it, i) => children.push(new Paragraph({ children: runs(`${i + 1}. ${it}`) })));
    } else {
      for (const cl of b.text.split("\n")) {
        children.push(new Paragraph({ children: [new TextRun({ text: cl || " ", font: "Consolas", size: 20 })] }));
      }
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ text: "由 EduAI Prism「i-learning」导出 · 校内使用", italics: true, color: "8A90A2", size: 18 })] }));

  const doc = new Document({ sections: [{ children }] });
  triggerDownloadBlob(filename, await Packer.toBlob(doc));
}

type PptLine = { text: string; bullet?: boolean; mono?: boolean };
type PptSlide = { title: string; lines: PptLine[]; cover?: boolean };

function escapeXml(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function pptShape(id: number, name: string, x: number, y: number, cx: number, cy: number, paragraphs: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="t"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function pptParagraph(line: PptLine, size = 1500, color = "1F2430", bold = false): string {
  const bullet = line.bullet ? '<a:pPr marL="342900" indent="-285750"><a:buChar char="&#x2022;"/></a:pPr>' : "<a:pPr/>";
  const font = line.mono ? '<a:latin typeface="Consolas"/><a:ea typeface="Microsoft YaHei"/>' : '<a:ea typeface="Microsoft YaHei"/>';
  return `<a:p>${bullet}<a:r><a:rPr lang="zh-CN" sz="${size}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${font}</a:rPr><a:t>${escapeXml(line.text || " ")}</a:t></a:r><a:endParaRPr lang="zh-CN" sz="${size}"/></a:p>`;
}

function pptSlideXml(slide: PptSlide): string {
  const titleSize = slide.cover ? 3000 : 2200;
  const titleY = slide.cover ? 2194560 : 365760;
  const titleH = slide.cover ? 1371600 : 731520;
  const titleColor = slide.cover ? "1F2430" : "2557E6";
  const title = pptShape(2, "标题", 548640, titleY, 11033760, titleH, pptParagraph({ text: slide.title }, titleSize, titleColor, true));
  const bodyLines = slide.cover
    ? [{ text: "由 EduAI Prism「i-learning」导出 · 校内使用" }]
    : (slide.lines.length ? slide.lines : [{ text: " " }]);
  const bodyY = slide.cover ? 3657600 : 1280160;
  const bodyH = slide.cover ? 457200 : 5029200;
  const body = pptShape(3, "正文", 640080, bodyY, 10881360, bodyH, bodyLines.map((line) => pptParagraph(line, slide.cover ? 1300 : line.mono ? 1200 : 1500, slide.cover ? "8A90A2" : "1F2430")).join(""));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="EduAI Prism"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="F7F8FB"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${title}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

// 真实 PPT 大纲导出——直接生成文本型 OOXML，避免把不需要的图片解析器带进浏览器。
async function exportPptx(content: string, filename: string) {
  const JSZip = (await import("jszip")).default;
  const docTitle = firstTitle(content);
  const slides: PptSlide[] = [{ title: docTitle, lines: [], cover: true }];
  const sections: { title: string; lines: PptLine[] }[] = [];
  let cur: { title: string; lines: PptLine[] } | null = null;
  const ensure = () => { if (!cur) { cur = { title: docTitle, lines: [] }; sections.push(cur); } return cur; };
  for (const b of parseBlocks(content)) {
    if (b.kind === "heading") { cur = { title: stripInline(b.text), lines: [] }; sections.push(cur); }
    else if (b.kind === "p") ensure().lines.push({ text: stripInline(b.lines.join(" ")) });
    else if (b.kind === "ul" || b.kind === "ol") for (const it of b.items) ensure().lines.push({ text: stripInline(it), bullet: true });
    else for (const cl of b.text.split("\n")) ensure().lines.push({ text: cl, mono: true });
  }
  if (!sections.length) sections.push({ title: docTitle, lines: [{ text: stripMarkdown(content) || " " }] });
  for (const section of sections) {
    const pages = paginatePptLines(section.lines);
    (pages.length ? pages : [[]]).forEach((lines, index) => slides.push({
      title: section.title + (pages.length > 1 ? ` (${index + 1}/${pages.length})` : ""),
      lines,
    }));
  }

  const zip = new JSZip();
  const slideOverrides = slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`);
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
  const now = new Date().toISOString();
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(docTitle)}</dc:title><dc:creator>EduAI Prism</dc:creator><cp:lastModifiedBy>EduAI Prism</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>EduAI Prism</Application><PresentationFormat>宽屏</PresentationFormat><Slides>${slides.length}</Slides><Company>EduAI Prism</Company><AppVersion>1.0</AppVersion></Properties>`);
  const slideIds = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("");
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`);
  const presentationRels = slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("");
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationRels}</Relationships>`);
  zip.file("ppt/presProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>');
  zip.file("ppt/viewProps.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" lastView="sldView"><p:normalViewPr/><p:slideViewPr/><p:notesTextViewPr/><p:gridSpacing cx="72008" cy="72008"/></p:viewPr>');
  zip.file("ppt/tableStyles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>');
  zip.file("ppt/slideMasters/slideMaster1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>');
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>');
  zip.file("ppt/slideLayouts/slideLayout1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="空白"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
  zip.file("ppt/theme/theme1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="EduAI Prism"><a:themeElements><a:clrScheme name="EduAI Prism"><a:dk1><a:srgbClr val="1F2430"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F7F8FB"/></a:lt2><a:accent1><a:srgbClr val="2557E6"/></a:accent1><a:accent2><a:srgbClr val="14B8A6"/></a:accent2><a:accent3><a:srgbClr val="F59E0B"/></a:accent3><a:accent4><a:srgbClr val="E05B66"/></a:accent4><a:accent5><a:srgbClr val="6D5CE7"/></a:accent5><a:accent6><a:srgbClr val="38BDF8"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="EduAI Prism"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="EduAI Prism"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>');
  slides.forEach((slide, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, pptSlideXml(slide));
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>');
  });
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", compression: "DEFLATE" });
  triggerDownloadBlob(filename, blob);
}

// 会话级整段导出：把整场对话拼成一份 Markdown（标题 + 每轮「## 发言者 + 正文」），
// 复用与单条消息完全相同的 5 种格式管线（md/txt/html/docx/pptx）。
export interface ExportTurn { speaker: string; content: string; }

function safeBaseName(title: string | undefined): string {
  // 去全部 C0 控制字符（含 TAB/CR/LF，用 charCode 判定避免在正则里放控制字符）+ Windows 非法文件名字符。
  const noCtrl = Array.from(title ?? "", (ch) => (ch.charCodeAt(0) < 0x20 ? " " : ch)).join("");
  const t = noCtrl.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 60);
  return t || "eduai-对话记录";
}

function buildConversationMarkdown(turns: ExportTurn[], title: string | undefined): string {
  const parts: string[] = [`# ${(title ?? "").trim() || "EduAI 对话记录"}`, ""];
  for (const t of turns) {
    parts.push(`## ${t.speaker}`, "", t.content.trim() || "（空）", "");
  }
  return parts.join("\n");
}

export async function exportConversation(turns: ExportTurn[], fmt: ExportFormat, title?: string) {
  const md = buildConversationMarkdown(turns, title);
  await exportMessage(md, fmt, safeBaseName(title));
}

// 会话级复制到剪贴板复用同一拼装（标题 + 每轮发言者 + 正文）。
export function conversationToMarkdown(turns: ExportTurn[], title?: string): string {
  return buildConversationMarkdown(turns, title);
}

export async function exportMessage(content: string, fmt: ExportFormat, baseName = "eduai-回答") {
  if (fmt === "md") {
    triggerDownload(`${baseName}.md`, content, "text/markdown");
  } else if (fmt === "txt") {
    triggerDownload(`${baseName}.txt`, stripMarkdown(content), "text/plain");
  } else if (fmt === "html") {
    const firstLine = content.replace(/^#{1,6}\s+/, "").split(/\r?\n/)[0]?.slice(0, 40) || "EduAI 回答";
    triggerDownload(`${baseName}.html`, fullHtml(firstLine, mdToHtmlBody(content)), "text/html");
  } else if (fmt === "docx") {
    await exportDocx(content, `${baseName}.docx`);
  } else {
    await exportPptx(content, `${baseName}.pptx`);
  }
}
