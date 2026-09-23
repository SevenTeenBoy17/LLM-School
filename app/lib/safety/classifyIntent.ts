export type Intent = "crisis" | "integrity" | "normal";

export interface SafetyClassification {
  intent: Intent;
  care: boolean;
  confidence: "low" | "medium" | "high";
  signals: string[];
}

interface NormalizedText {
  lower: string;
  spaced: string;
  compact: string;
  tokens: string[];
}

const CRISIS_PHRASES = [
  "\u81ea\u6740",
  "\u81ea\u6b8b",
  "\u81ea\u4f24",
  "\u60f3\u6b7b",
  "\u4e0d\u60f3\u6d3b",
  "\u6d3b\u4e0d\u4e0b\u53bb",
  "\u6d3b\u7740\u6ca1\u610f\u601d",
  "\u6ca1\u610f\u601d\u6d3b",
  "\u6d3b\u7740\u6ca1\u6709\u610f\u4e49",
  "\u4eba\u751f\u6ca1\u6709\u610f\u4e49",
  "\u7ed3\u675f\u751f\u547d",
  "\u7ed3\u675f\u81ea\u5df1",
  "\u7ed3\u675f\u8fd9\u4e00\u5207",
  "\u4f24\u5bb3\u81ea\u5df1",
  "\u60f3\u4e0d\u5f00",
  "\u60f3\u6d88\u5931",
  "\u8df3\u697c",
  "\u5272\u8155",
  "\u541e\u836f",
  "\u6491\u4e0d\u4e0b\u53bb",
  "\u6551\u6551\u6211",
  "\u6ca1\u4eba\u9700\u8981\u6211",
  "\u6211\u662f\u7d2f\u8d58",
  "\u88ab\u9738\u51cc",
  "\u88ab\u6b3a\u8d1f",
  "\u9738\u51cc",
  "\u88ab\u6253",
  "\u6027\u9a9a\u6270",
  "\u733f\u4eb5",
  "\u88ab\u6478",
  "\u88ab\u5a01\u80c1",
  "suicide",
  "kill myself",
  "want to die",
  "end it all",
  "end my life",
  "self harm",
  "hurt myself",
];

const CRISIS_PINYIN = [
  "zisha",
  "zican",
  "zishang",
  "xiangsi",
  "buxianghuo",
  "huobuxiaqu",
  "tiaolou",
  "gewang",
  "tun yao",
  "tunyu",
];

const INTEGRITY_PHRASES = [
  "\u76f4\u63a5\u7ed9\u7b54\u6848",
  "\u76f4\u63a5\u544a\u8bc9\u6211\u7b54\u6848",
  "\u76f4\u63a5\u5199\u51fa\u6765",
  "\u7ed9\u6211\u7b54\u6848",
  "\u7ed9\u5b8c\u6574\u7b54\u6848",
  "\u5b8c\u6574\u7b54\u6848",
  "\u6807\u51c6\u7b54\u6848",
  "\u5168\u90e8\u7b54\u6848",
  "\u4f5c\u4e1a\u7b54\u6848",
  "\u8003\u8bd5\u7b54\u6848",
  "\u6284\u7b54\u6848",
  "\u770b\u7b54\u6848",
  "\u770b\u5b8c\u6574\u7b54\u6848",
  "\u770b\u5b8c\u6574\u8303\u4f8b",
  "\u5e2e\u6211\u5199\u4f5c\u4e1a",
  "\u5e2e\u6211\u5199\u4f5c\u6587",
  "\u5e2e\u6211\u5199\u8bba\u6587",
  "\u5e2e\u6211\u5199\u62a5\u544a",
  "\u5e2e\u6211\u505a\u4f5c\u4e1a",
  "\u5199\u597d\u4f5c\u4e1a",
  "\u4ee3\u5199",
  "\u66ff\u6211\u5199",
  "\u4ee3\u505a",
  "\u5e2e\u6211\u5b8c\u6210",
  "directly give",
  "just the answer",
  "give me the answer",
  "do my homework",
  "write my essay",
  "write my paper",
  "write my report",
  "solve this for me",
  "complete solution",
];

const SOFT_CONCERN_PHRASES = [
  "\u4ec0\u4e48\u90fd\u4e0d\u60f3",
  "\u4e0d\u60f3\u52a8",
  "\u63d0\u4e0d\u8d77\u52b2",
  "\u6ca1\u52a8\u529b",
  "\u597d\u7d2f",
  "\u592a\u7d2f\u4e86",
  "\u538b\u529b\u5f88\u5927",
  "\u538b\u529b\u597d\u5927",
  "\u538b\u529b\u5927",
  "\u7761\u4e0d\u7740",
  "\u597d\u96be\u8fc7",
  "\u96be\u8fc7",
  "\u7126\u8651",
  "\u70e6\u6b7b\u4e86",
  "\u597d\u70e6",
  "\u6ca1\u4eba\u61c2",
  "\u6ca1\u4eba\u7406\u89e3",
  "\u597d\u5b64\u5355",
  "\u597d\u5b64\u72ec",
  "\u5598\u4e0d\u8fc7\u6c14",
  "\u5d29\u6e83\u4e86",
  "\u597d\u7edd\u671b",
  "emo",
  "\u60f3\u54ed",
  "\u6ca1\u4eba\u7231\u6211",
];

const SOFT_CONCERN_REGEX = [
  /\u538b\u529b[\s\S]{0,4}\u5927/u,
];

const CRISIS_REGEX = [
  /\u4e0d\s*\u60f3[\s\S]{0,8}\u6d3b/u,
  /\u6d3b[\s\S]{0,6}\u4e0d[\s\S]{0,6}\u4e0b/u,
  /\u60f3[\s\S]{0,6}\u6b7b/u,
  /\u6d3b[\s\S]{0,3}\u6ca1[\s\S]{0,3}\u610f(\u4e49|\u601d)/u, // huozhe-mei-yiyi/yisi variants
  /\u7ed3\u675f[\s\S]{0,8}(\u751f\u547d|\u81ea\u5df1|\u8fd9\u4e00\u5207|\u4e00\u5207|\u4eba\u751f)/u, // jieshu shengming/ziji/zheyiqie/yiqie/rensheng
  /\u4f24\u5bb3[\s\S]{0,8}\u81ea\u5df1/u,
  /kill\s*my\s*self/i,
  /want\s*to\s*die/i,
  /end\s*(it\s*all|my\s*life)/i,
  /self\s*harm/i,
];

const INTEGRITY_REGEX = [
  /\u76f4\u63a5[\s\S]{0,8}\u7b54\u6848/u,
  /\u7ed9[\s\S]{0,8}\u5b8c\u6574[\s\S]{0,8}\u7b54\u6848/u,
  /\u5e2e[\s\S]{0,8}\u5199[\s\S]{0,8}(\u4f5c\u4e1a|\u4f5c\u6587|\u8bba\u6587|\u62a5\u544a)/u,
  /(\u4ee3|\u66ff\u6211)[\s\S]{0,6}(\u5199|\u505a|\u5b8c\u6210)/u,
  /just\s*(give\s*)?(me\s*)?the\s*answer/i,
  /(do|finish|complete)\s*my\s*homework/i,
  /write\s*my\s*(essay|paper|report)/i,
  // M5/T7 补：常见作业体裁（原表只有作业/作文/论文/报告，漏掉读后感等）
  /帮[\s\S]{0,8}写[\s\S]{0,8}(读后感|观后感|周记|日记|心得|演讲稿|实验报告|小结|检讨书)/u,
  // M5/T7 补：**提交意图 + 整篇代做** 组合（实测漏网：「帮我把读后感整篇写完直接交」）。
  // 双信号才命中，精度优先：正常求助（如「读后感怎么写」）不含「直接交/交上去」故不误伤。
  /(整篇|全文|全部|通篇)[\s\S]{0,6}(写完|写好|做完|完成)[\s\S]{0,12}(直接交|交上去|交给老师|要交|交作业)/u,
  /(直接交|交上去|交给老师|明天要交|马上要交)[\s\S]{0,12}(整篇|全文|全部|通篇|帮我写|替我写|写完|写好)/u,
];

// \u26a0\ufe0f \u5df2\u77e5\u7f3a\u9677\uff08\u957f\u5468\u671f\u5185\u6d4b\u5b9e\u8bc1\uff0c\u6682\u672a\u4fee\u590d\u2014\u2014\u89c1\u4e0b\uff09\uff1a\u6b64\u5904\u4e3a\u56fa\u5b9a\u77ed\u8bed\u767d\u540d\u5355\uff0c\u4e14\u5426\u5b9a\u5224\u5b9a\u4f5c\u7528\u4e8e**\u6574\u6761\u6d88\u606f**\u800c\u975e\u5426\u5b9a\u6240\u8986\u76d6\u7684\u5206\u53e5\u3002
// \u540e\u679c1\uff08\u8bef\u6740\uff0cP1\uff09\uff1a\u5b66\u751f\u5199\u300c\u8bf7\u7ed9\u63d0\u5347\u5efa\u8bae\uff0c\u4f46\u4e0d\u8981\u66ff\u6211\u5199\u6574\u7bc7\u300d\u4f1a\u88ab\u8bef\u5224 scaffold\uff0817ms \u672a\u8d70\u6a21\u578b\u3001\u96f6\u5b66\u79d1\u4ef7\u503c\uff09\uff0c
//   \u56e0\u4e3a\u77ed\u8bed\u300c\u66ff\u6211\u5199\u300d\u672c\u8eab\u5728 INTEGRITY_PHRASES \u91cc\uff0c\u800c\u672c\u767d\u540d\u5355\u672a\u8986\u76d6\u300c\u4e0d\u8981\u66ff\u6211\u5199\u300d\u8fd9\u7c7b\u5426\u5b9a\u5f62\u5f0f\u3002
// \u540e\u679c2\uff08\u82e5\u8d38\u7136\u653e\u5bbd\u672c\u8868\u6216\u6309\u77ed\u8bed\u7cbe\u786e\u8c41\u514d\uff0c\u4f1a\u5f00\u66f4\u5927\u7684\u53e3\u5b50\uff09\uff1a\u5bf9\u6297\u5ba1\u67e5\u5df2\u5b9e\u8bc1\uff0c\u6269\u8868 + \u7cbe\u786e\u8c41\u514d\u4f1a\u8ba9
//   \u300c\u4e0d\u8981\u4ee3\u5199\uff0c\u76f4\u63a5\u7ed9\u7b54\u6848\u300d\u300c\u4e0d\u8981\u66ff\u6211\u5199\uff0c\u76f4\u63a5\u628a\u7b54\u6848\u5199\u51fa\u6765\u300d\u7b49**\u7528\u8bf1\u9975\u5426\u5b9a\u8bcd\u6d17\u767d\u771f\u5b9e\u4ee3\u5199\u8bf7\u6c42**\u7684 prompt \u4ece scaffold \u53d8\u6210\u653e\u884c\u3002
// \u7ed3\u8bba\uff1a\u5173\u952e\u8bcd\u5206\u7c7b\u5668\u65e0\u6cd5\u533a\u5206\u300c\u8bf1\u9975\u5426\u5b9a\u300d\u4e0e\u300c\u771f\u8bda\u58f0\u660e\u300d\uff0c\u4e0d\u53ef\u7528\u8865\u4e01\u4fee\u590d\uff1b\u6b63\u89e3\uff1d\u5173\u952e\u8bcd\u521d\u7b5b + \u6a21\u578b\u8bed\u4e49\u590d\u6838\u540e\u518d\u51b3\u5b9a\u662f\u5426 scaffold\uff0c
//   \u5e76\u914d\u5957\u300c\u4ee3\u5199 prompt / \u6b63\u5f53\u58f0\u660e prompt\u300d\u53cc\u5411\u56de\u5f52\u8bed\u6599\u3002\u4fee\u590d\u524d\u7ef4\u6301\u73b0\u72b6\uff08\u5b81\u53ef\u8bef\u6740\uff0c\u4e0d\u53ef\u653e\u7eb5\u4ee3\u5199\uff09\u3002
const NEGATED_INTEGRITY = [
  "\u4e0d\u8981\u76f4\u63a5\u7b54\u6848",
  "\u522b\u76f4\u63a5\u7ed9\u7b54\u6848",
  "\u4e0d\u8981\u7ed9\u5b8c\u6574\u7b54\u6848",
  "\u4e0d\u8981\u4ee3\u5199",
  "\u4e0d\u7528\u4ee3\u5199",
  "do not give me the answer",
  "don't give me the answer",
  "not the answer",
];

function normalize(text: string): NormalizedText {
  const lower = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, " ");
  const spaced = lower.replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const compact = spaced.replace(/\s+/g, "");
  const tokens = spaced ? spaced.split(" ") : [];
  return { lower, spaced, compact, tokens };
}

function containsPhrase(n: NormalizedText, phrase: string): boolean {
  const p = normalize(phrase);
  return n.spaced.includes(p.spaced) || n.compact.includes(p.compact);
}

function phraseHits(n: NormalizedText, phrases: string[], tag: string): string[] {
  return phrases
    .filter((phrase) => containsPhrase(n, phrase))
    .map((phrase) => `${tag}:${phrase}`);
}

function regexHits(text: string, patterns: RegExp[], tag: string): string[] {
  return patterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => `${tag}:${pattern.source}`);
}

function anyNear(n: NormalizedText, left: string[], right: string[], maxGap = 5): boolean {
  const tokens = n.tokens;
  for (let i = 0; i < tokens.length; i += 1) {
    if (!left.some((word) => tokens[i]?.includes(word))) continue;
    const window = tokens.slice(i + 1, i + 1 + maxGap).join("");
    if (right.some((word) => window.includes(word))) return true;
  }
  return false;
}

function hasNegatedIntegrity(n: NormalizedText): boolean {
  return NEGATED_INTEGRITY.some((phrase) => containsPhrase(n, phrase));
}

function hasEnglishDirectAnswerRequest(n: NormalizedText): boolean {
  const tokens = n.tokens;
  for (let i = 0; i < tokens.length; i += 1) {
    if (!tokens[i]?.includes("answer")) continue;
    const window = tokens.slice(Math.max(0, i - 4), i + 3).join(" ");
    if (/\b(just|direct|directly|complete|full|give|send)\b/i.test(window)) return true;
  }
  return false;
}

function crisisSignals(n: NormalizedText): string[] {
  const hits = [
    ...phraseHits(n, CRISIS_PHRASES, "crisis_phrase"),
    ...phraseHits(n, CRISIS_PINYIN, "crisis_pinyin"),
    ...regexHits(n.lower, CRISIS_REGEX, "crisis_pattern"),
  ];

  if (anyNear(n, ["\u4f24\u5bb3", "\u7ed3\u675f", "\u4e0d\u60f3", "\u6491\u4e0d\u4f4f"], ["\u81ea\u5df1", "\u6d3b", "\u547d", "\u6211"])) {
    hits.push("crisis_semantic:distress_self");
  }
  if (anyNear(n, ["\u88ab", "\u906d\u5230"], ["\u9738\u51cc", "\u6b3a\u8d1f", "\u6b27\u6253", "\u5a01\u80c1", "\u6027\u9a9a\u6270", "\u6478"])) {
    hits.push("crisis_semantic:abuse_or_bullying");
  }
  if (n.compact.includes("helpme") && (n.compact.includes("die") || n.compact.includes("hurt"))) {
    hits.push("crisis_semantic:english_help_harm");
  }
  return [...new Set(hits)];
}

function integritySignals(n: NormalizedText): string[] {
  const hits = [
    ...phraseHits(n, INTEGRITY_PHRASES, "integrity_phrase"),
    ...regexHits(n.lower, INTEGRITY_REGEX, "integrity_pattern"),
  ];

  if (
    anyNear(
      n,
      ["\u7ed9", "\u544a\u8bc9", "\u53d1", "\u5199", "\u505a", "\u5b8c\u6210", "\u6284"],
      ["\u7b54\u6848", "\u4f5c\u4e1a", "\u4f5c\u6587", "\u8bba\u6587", "\u62a5\u544a", "\u8003\u8bd5"],
    )
  ) {
    hits.push("integrity_semantic:completion_request");
  }
  if (hasEnglishDirectAnswerRequest(n)) {
    hits.push("integrity_semantic:english_direct_answer");
  }
  if (hasNegatedIntegrity(n)) {
    return hits.filter((hit) => hit.startsWith("integrity_phrase:") && !hit.includes("\u7b54\u6848"));
  }
  return [...new Set(hits)];
}

function careSignals(n: NormalizedText): string[] {
  return [
    ...phraseHits(n, SOFT_CONCERN_PHRASES, "care_phrase"),
    ...regexHits(n.lower, SOFT_CONCERN_REGEX, "care_pattern"),
  ];
}

function confidence(count: number): SafetyClassification["confidence"] {
  if (count >= 2) return "high";
  if (count === 1) return "medium";
  return "low";
}

export function classifySafety(text: string): SafetyClassification {
  if (!text) return { intent: "normal", care: false, confidence: "low", signals: [] };
  const n = normalize(text);

  const crisis = crisisSignals(n);
  if (crisis.length > 0) {
    return { intent: "crisis", care: true, confidence: confidence(crisis.length), signals: crisis };
  }

  const integrity = integritySignals(n);
  if (integrity.length > 0) {
    return { intent: "integrity", care: false, confidence: confidence(integrity.length), signals: integrity };
  }

  const care = careSignals(n);
  return { intent: "normal", care: care.length > 0, confidence: confidence(care.length), signals: care };
}

export function classifyIntent(text: string): Intent {
  return classifySafety(text).intent;
}

export function softConcern(text: string): boolean {
  const safety = classifySafety(text);
  return safety.intent !== "crisis" && safety.care;
}

// 「否定歧义」子集判定（已知 P1 误杀的正解入口）：文本含否定声明（如「不要替我写整篇」）
// 但关键词分类**仍**判 integrity（宁可误杀策略保留的那部分）。只有这个子集才值得送模型语义复核——
// ①无否定词的真代写（如「帮我写作文」）绝不复核、直接 scaffold；②有否定词但已被白名单放行的（如
// 「不要直接给答案」+无其他信号）本来就是 normal，不经过这里。复核失败/超时时调用方必须回退 scaffold（fail-closed）。
// 否定语境宽检测（仅用于「是否送复核」，绝不用于直接放行）：白名单 NEGATED_INTEGRITY 只覆盖固定短语，
// 恰恰漏掉「不要**替我写**整篇」这一实测误杀主案例。此处用否定词 + 代写/答案语素的邻近匹配放宽「送检」范围——
// 放宽送检**不放宽拦截**：真正放行仍须模型复核判 A（fail-closed），无否定词的真代写依旧直接 scaffold、永不送检。
const NEGATION_CONTEXT_REGEX =
  /(不要|别|不用|不需要|请勿|不必|无需|拒绝)[^。！？!?\n]{0,10}(替我|帮我|给我|代)?[^。！？!?\n]{0,4}(写|做|完成|抄|答案|整篇|全文|成品|代写)/u;
export function integrityNegationAmbiguous(text: string): boolean {
  if (!text) return false;
  const n = normalize(text);
  // 对抗审查 P3：宽检测须跑在**归一化后**文本上——原文里的零宽字符（复制自网页/文档常见）会打断「不要」，
  // 使宽检测与白名单双失配 → 真诚否定声明拿不到复核机会（方向安全：仅误杀恢复失效，绝不开代写口子）。
  // n.compact 已剥零宽/空白并 NFKC+lower，重聚「不要」；同时保留原文测试以防 normalize 改写标点影响 gap。
  const negated = hasNegatedIntegrity(n) || NEGATION_CONTEXT_REGEX.test(text) || NEGATION_CONTEXT_REGEX.test(n.compact);
  if (!negated) return false;
  return integritySignals(n).length > 0;
}
