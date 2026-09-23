// BL1：错题知识点「受控词表」（纯数据 + 纯函数，服务端与客户端共用）。
//
// 动机（M2 审查 P2 落地）：knowledgePoint 原为学生自由文本，会原样进入教师端去标识聚类视图——
// 学生可借此注入题目原文/人名等 PII，使「无原文」保证被击穿。改为受控词表后：
//   ①命中词表 → 存标准词；②未命中 → 一律降级为「其他」，绝不落自由文本。
// 词表按初中主干知识点收敛（覆盖不足时降级到「其他」，不影响记录本身，只影响聚类维度）。

export const KNOWLEDGE_POINTS: Record<string, string[]> = {
  语文: ["文言文阅读", "现代文阅读", "作文表达", "古诗词鉴赏", "基础字词", "标点与病句"],
  数学: ["一元二次方程", "一次函数", "二次函数", "几何证明", "三角函数", "概率统计", "因式分解", "不等式"],
  英语: ["时态语态", "从句", "完形填空", "阅读理解", "词汇拼写", "介词冠词"],
  物理: ["力学与运动", "浮力", "压强", "电路与欧姆定律", "光学成像", "热学", "功与能"],
  化学: ["化学方程式", "酸碱盐", "氧化还原", "溶液与溶解度", "元素与化合价", "实验操作"],
  生物: ["细胞结构", "光合作用", "呼吸作用", "遗传与变异", "生态系统", "人体生理"],
  历史: ["中国古代史", "中国近代史", "世界近代史", "历史材料分析"],
  地理: ["气候与季风", "地形地貌", "人口与城市", "地图与等高线", "区域地理"],
  政治: ["法律与权利", "国家制度", "道德与价值观", "时事分析"],
  信息: ["算法与流程", "编程基础", "数据处理", "信息安全"],
};

export const OTHER_POINT = "其他";

/** 该学科的可选知识点（含「其他」兜底项）；未知学科只给「其他」。 */
export function pointsForSubject(subject: string): string[] {
  return [...(KNOWLEDGE_POINTS[subject] ?? []), OTHER_POINT];
}

/** 规范化：命中词表返回标准词，否则一律「其他」——杜绝自由文本进入聚类视图。 */
export function normalizeKnowledgePoint(subject: string, raw?: string): string {
  if (!raw) return OTHER_POINT;
  const v = raw.normalize("NFKC").replace(/\s+/g, "");
  const list = KNOWLEDGE_POINTS[subject] ?? [];
  return list.find((p) => p.normalize("NFKC").replace(/\s+/g, "") === v) ?? OTHER_POINT;
}
