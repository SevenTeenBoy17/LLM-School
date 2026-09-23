// M4/B5：轻量学科标注（纯函数，零外部依赖，服务端落库时调用）。
// 设计铁律：**不确定就返回 null**——统计里如实显示「未分类」，绝不为了图表好看而猜学科。
// 只做关键词/学科专有名词匹配，不做语义推断；命中多个学科时取命中数最多者，并列则视为不确定。

export const SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治", "信息"] as const;
export type Subject = (typeof SUBJECTS)[number];

// 每个学科的判别词：优先选「跨学科歧义低」的专有名词（如「函数」既数学也信息，故两边都放，靠计数与并列判定兜底）
const RULES: Array<{ subject: Subject; re: RegExp }> = [
  { subject: "语文", re: /(语文|作文|阅读理解|文言文|古诗|修辞|议论文|记叙文|散文|课文|标点|病句|成语|作者简介|中心思想)/ },
  { subject: "数学", re: /(数学|方程|函数|几何|三角形|勾股|因式分解|不等式|概率|统计图|求导|三角函数|圆锥|抛物线|应用题|解方程|计算题)/ },
  // 英语：补语法术语（现在完成时/一般过去时/进行时…）——单测发现「时态」不含「完成时」等变体
  { subject: "英语", re: /(英语|english|时态|(现在|过去|将来|一般)(完成|进行|完成进行)?时|语法填空|完形填空|单词|音标|从句|被动语态|情态动词|不规则动词|阅读词汇|介词|冠词)/i },
  { subject: "物理", re: /(物理|力学|牛顿|浮力|摩擦力|电路|欧姆|电压|电流|光的折射|凸透镜|机械能|动能|压强|杠杆|比热)/ },
  { subject: "化学", re: /(化学|化学式|化合价|摩尔|离子|酸碱|中和反应|氧化还原|元素周期|溶解度|方程式配平|置换反应)/ },
  { subject: "生物", re: /(生物|细胞|光合作用|呼吸作用|遗传|基因|染色体|生态系统|食物链|酶|血液循环|反射弧)/ },
  { subject: "历史", re: /(历史|朝代|王朝|辛亥革命|抗日战争|工业革命|文艺复兴|条约|变法|春秋战国|唐朝|宋朝|明清)/ },
  { subject: "地理", re: /(地理|经纬|气候|季风|地形|板块|洋流|等高线|人口密度|城市化|时区|降水量)/ },
  { subject: "政治", re: /(政治|道德与法治|宪法|公民权利|义务|社会主义核心价值观|人民代表大会|法治|依法)/ },
  { subject: "信息", re: /(信息科技|编程|算法|代码|python|scratch|循环结构|数据结构|计算机|人工智能|流程图|变量赋值)/i },
];

/** 返回识别到的学科；不确定（无命中或并列第一）返回 null。 */
export function detectSubject(text: string): Subject | null {
  if (!text) return null;
  const sample = text.slice(0, 600);
  const scored = RULES
    .map(({ subject, re }) => ({ subject, hits: (sample.match(new RegExp(re.source, re.flags.includes("i") ? "gi" : "g")) ?? []).length }))
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[0].hits === scored[1].hits) return null; // 并列 → 不确定
  return scored[0].subject;
}
