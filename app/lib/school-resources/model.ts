export const KINDS = { slides: "课件", lesson: "教案", worksheet: "学习单", activity: "互动活动", media: "音视频", other: "其他资料" } as const;
export type ResourceKind = keyof typeof KINDS;
export const SUBJECTS = ["语文", "数学", "英语", "科学", "信息科技", "道德与法治", "艺术", "体育与健康", "跨学科"];
export const GRADES = ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级", "七年级", "八年级", "九年级", "跨年级"];
export const SCOPES = { school: "校内教师与教研员", group: "教研组", private: "仅自己" } as const;
export const ACCEPT = ".ppt,.pptx,.doc,.docx,.pdf,.txt,.md,.png,.jpg,.jpeg,.webp,.html,.htm,.mp4,.webm,.mp3,.wav,.ogg,.m4a";
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;
export const MAX_LIBRARY_BYTES = 200 * 1024 * 1024;
export const MAX_BATCH_FILES = 5;

export function requireResourceCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || typeof globalThis.crypto.randomUUID !== "function") {
    throw new Error("文件校验需要安全浏览器环境。校园访问请使用有效 HTTPS 地址，或联系管理员；本机开发可使用 localhost。");
  }
  return globalThis.crypto;
}

export interface SchoolResource {
  id: string;
  origin: "example" | "local";
  title: string;
  kind: ResourceKind;
  subject: string;
  grade: string;
  description: string;
  author: string;
  scope: keyof typeof SCOPES;
  rights: "own" | "licensed";
  updatedAt: number;
  revision: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256?: string;
  blob?: Blob;
  body?: string;
}
export interface LocalResourceState { drafts: SchoolResource[]; favoriteIds: string[]; }
export interface ResourceEditToken { id: string; revision: number; }
export const emptyResourceState = (): LocalResourceState => ({ drafts: [], favoriteIds: [] });

export function fileExtension(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }
export function inferKind(name: string): ResourceKind {
  const ext = fileExtension(name);
  if (["html", "htm"].includes(ext)) return "activity";
  if (["mp4", "webm", "mp3", "wav", "ogg", "m4a"].includes(ext)) return "media";
  return ["ppt", "pptx"].includes(ext) ? "slides" : ["doc", "docx", "md", "txt"].includes(ext) ? "lesson" : "other";
}
export function validateResourceFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const ext = fileExtension(file.name);
  const mime = file.type.split(";")[0].trim().toLowerCase();
  if (!ACCEPT.split(",").includes(`.${ext}`)) return "不支持此格式，请选择课件、文档、图片、音视频或 HTML。";
  if (file.size <= 0) return "文件为空，请重新选择。";
  if (file.size > MAX_FILE_BYTES) return "单个文件不能超过 50 MB。";
  if (["image/svg+xml", "application/x-msdownload", "application/javascript", "text/javascript", "application/xhtml+xml"].includes(mime)) return "文件类型与允许的教学资料格式不符。";
  if (mime === "text/html" && !["html", "htm"].includes(ext)) return "HTML 文件必须使用 .html 或 .htm 扩展名。";
  if (["html", "htm"].includes(ext)) {
    if (mime && !["text/html", "application/octet-stream"].includes(mime)) return "HTML 扩展名与文件类型不一致。";
    if (file.size > MAX_HTML_BYTES) return "单个 HTML 活动不能超过 5 MB。";
  }
  return null;
}
export function readableBytes(bytes: number) {
  if (bytes < 1024) return `${Math.max(0, bytes)} B`;
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
export function filterResources(resources: SchoolResource[], options: {
  query: string; subject: string; grade: string; kind: string; tab: string; favoriteIds: string[]; sort: string;
}) {
  const needle = options.query.trim().toLocaleLowerCase();
  return resources.filter(r => (!needle || `${r.title} ${r.description} ${r.author} ${r.subject}`.toLocaleLowerCase().includes(needle))
    && (!options.subject || r.subject === options.subject) && (!options.grade || r.grade === options.grade)
    && (!options.kind || r.kind === options.kind) && (options.tab !== "drafts" || r.origin === "local")
    && (options.tab !== "favorites" || options.favoriteIds.includes(r.id)))
    .sort((a, b) => options.sort === "title" ? a.title.localeCompare(b.title, "zh-CN") : b.updatedAt - a.updatedAt);
}

const sample = (id: string, title: string, kind: ResourceKind, subject: string, grade: string, description: string, body: string): SchoolResource => ({
  id, title, kind, subject, grade, description, body, origin: "example", author: "教研团队（示例）",
  scope: "school", rights: "own", updatedAt: Date.UTC(2026, 8, 1), revision: 0, fileName: `${title}-示例提纲.md`,
  fileSize: new TextEncoder().encode(body).length, mimeType: "text/markdown",
});
export const EXAMPLE_RESOURCES: SchoolResource[] = [
  sample("example-fractions", "分数的意义：从一张纸开始", "slides", "数学", "四年级", "用折纸、图示和生活情境理解单位“1”，配有课堂提问与迁移练习。", "# 分数的意义：从一张纸开始\n\n前端示例提纲，不是学校已上传课件。\n\n## 教学目标\n学生能说明单位“1”，并用图示解释四分之三。\n\n## 课堂流程\n1. 将同样大小的纸平均分成四份，涂出三份。\n2. 比较大小不同纸张的四分之三，讨论为何数量不一定相等。\n3. 用一句话解释分母与分子分别表示什么。\n\n## 形成性评价\n请画出一个反例：三块不等大的纸片能否表示三分之二？说明依据。"),
  sample("example-water", "校园节水 · 跨学科项目教案", "lesson", "跨学科", "五年级", "以真实用水观察串联数据统计、证据表达和节水倡议。", "# 校园节水 · 项目教案\n\n前端示例，课堂实施前需由教师校对。\n\n## 驱动问题\n学校里哪些用水环节可以改进？\n\n## 证据链\n观察记录（地点、时间、测量单位）→整理统计表→标出缺失值→解释发现与局限→提出可验证的节水方案。\n\n## 学科关联\n科学：控制测量条件。数学：比较单位时间用水量。语文：用证据支持倡议。\n\n## 学生保护\n不拍摄可识别同学的影像，不把家庭用水作为公开排名。"),
  sample("example-search", "信息检索与来源辨别", "worksheet", "信息科技", "七年级", "从问题、检索词到来源核对，留下可追溯的判断依据。", "# 信息检索与来源辨别\n\n示例学习单\n\n我的问题：________\n检索关键词：________\n来源标题与链接：________\n发布者、日期：________\n事实与观点分别是：________\n另一来源能否印证：________\n我仍不确定的是：________\n\n评价关注检索策略、来源说明与不确定性，不按搜索次数打分。"),
  sample("example-reading", "阅读中的提问与回应", "lesson", "语文", "六年级", "从文本细节提出问题，以原文为依据回应同伴。", "# 阅读中的提问与回应\n\n示例教学设计\n\n1. 圈出一个让你困惑的句子。\n2. 说出问题，并指出文本位置。\n3. 与同伴交换解释，每人提供一处文本证据。\n4. 记录观点发生变化的原因。\n\n反馈语：你的解释依据是什么？有没有另一种合理读法？"),
  sample("example-light", "光与影的观察记录", "worksheet", "科学", "三年级", "记录一天中的影子变化，在观察与推断之间建立边界。", "# 光与影观察记录\n\n示例学习单\n\n观察日期：________\n地点及固定参照物：________\n\n| 时间 | 影子方向 | 长度与单位 | 天气 |\n| --- | --- | --- | --- |\n| | | | |\n\n观察到的事实：________\n我的解释：________\n还需要怎样验证：________\n\n教师提醒：不要直视太阳；观察须在安全区域进行。"),
  sample("example-dialogue", "Our school · 情境对话素材", "other", "英语", "四年级", "围绕校园场景开展轮流提问、倾听与简短表达。", "# Our school\n\n示例素材\n\nA: Where is the library?\nB: It is next to the classroom.\nA: What do you like to read?\nB: I like stories about nature.\n\n教师可替换地点；活动后请学生用自己的话复述伙伴的回答。"),
];
