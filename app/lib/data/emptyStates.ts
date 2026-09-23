import type { EmptyKind } from "@/components/common/EmptyState";

/**
 * 空态词表 —— 全站空态文案的**唯一真相**。
 *
 * 为什么要有这个文件：实测 27 个 .tsx 各自硬编码「还没有 / 暂无 / 尚无 / 还是空的」，
 * 同一件事在不同页面有四种说法，而且每次改口径都要翻 27 个文件。
 * 现在页面只选 key，怎么说话集中在这里——「全站空态怎么说话」变成一处可审的事实。
 *
 * 写作纪律（每条都对应一个已经犯过或差点犯的错）：
 *
 * 1. **说原因，不说现象。** 「暂无数据」是描述现象；「错题本还是空的——在成长页
 *    记下第一道错题，这里就会按知识点聚起来」才是解释原因并给出下一步。
 * 2. **不承诺产品做不到的事。** 每条文案指向的入口必须真实存在（这是铁律②在
 *    文案层的落点，与门户配额口径那次是同一类错）。
 * 3. **不放数字。** 空态里出现「已有 1200 位老师在用」这类数字，既是编造也是
 *    社交压力，两头都踩线。
 * 4. **post-completion 不庆祝。** 静默陈述，不用感叹号，不用「太棒了」。
 * 5. **no-results 必须给出口。** 至少一个「清除筛选」或「换个词试试」的动作，
 *    否则它就是死胡同。
 */

export interface EmptyCopy {
  kind: EmptyKind;
  title: string;
  description?: string;
}

/** key 命名：`<页面或区域>.<情形>`，方便 grep 与门禁扫描。 */
export const EMPTY_STATES = {
  // ── 对话 ───────────────────────────────────────────────────────────
  "chat.noSessions": {
    kind: "first-use",
    title: "还没有会话",
    description: "从上方发起一次新对话；这里会按时间列出你最近问过的问题，随时点回去接着聊。",
  },
  "chat.searchNoHit": {
    kind: "no-results",
    title: "没有匹配的会话",
    description: "换一个更短的关键词试试，或者清空搜索看全部。",
  },

  // ── 提示词中心 ─────────────────────────────────────────────────────
  "prompts.noMatch": {
    kind: "no-results",
    title: "没有匹配的提示词",
    description: "试试换个分类，或清空搜索词看全部模板。",
  },
  "prompts.noFavorites": {
    kind: "first-use",
    title: "收藏夹还是空的",
    description: "在任意模板卡片上点 ☆，它就会出现在这里，方便你下次直接取用。",
  },

  // ── 教学产物 ───────────────────────────────────────────────────────
  "artifacts.firstUse": {
    kind: "first-use",
    title: "还没有归档的产物",
    description: "在 AI 对话里生成教案、题组或反馈草稿后，字数足够的回复会自动出现在这里。",
  },

  // ── 班级学情（教师端）─────────────────────────────────────────────
  "class.noMistakeCluster": {
    kind: "first-use",
    title: "错题聚类还没有数据",
    description: "学生在成长页记下错题后，这里会按「学科 × 知识点」聚合计数——不含原文与姓名。",
  },
  "class.noPending": {
    kind: "post-completion",
    title: "没有待批改的作业",
    description: "本班当前没有等待处理的提交。",
  },

  // ── 学生成长 ───────────────────────────────────────────────────────
  "growth.noMistakes": {
    kind: "first-use",
    title: "错题本还是空的",
    description: "遇到做错的题，记一条进来；过一阵子这里会告诉你哪一类反复出错，值得再练。",
  },

  // ── 知识库 ─────────────────────────────────────────────────────────
  "knowledge.noFiles": {
    kind: "first-use",
    title: "校内知识库还没有资料",
    description: "上传讲义、教案或参考材料后，AI 回答就能基于本校资料，而不是凭印象生成。",
  },
  "knowledge.noShared": {
    kind: "feature-education",
    title: "老师还没有分享资料",
    description: "任课老师把备课产物设为「本班可见」后，会出现在这里，点开即读。",
  },

  // ── 图表零数据（不是"加载中"，是已确认为空）───────────────────────
  // 这两条是清除两处伪造数据后留下的缺口：原先它们分别被一条手写公式和一个
  // 100% 兜底环填上了，看起来永远"有数据"。现在如实说没有。
  "dashboard.noModelCalls": {
    kind: "first-use",
    title: "还没有模型调用记录",
    description: "发起一次对话后，这里会按模型显示真实的调用占比。",
  },
  "admin.noHeatmap": {
    kind: "first-use",
    title: "还没有足够的使用记录",
    description: "累积一段时间的调用后，这里会显示按星期与时段的真实分布。",
  },

  // ── 管理端 ─────────────────────────────────────────────────────────
  "admin.noAudit": {
    kind: "first-use",
    title: "审计日志还没有记录",
    description: "关键操作发生后会在这里留痕，可按时间、用户与操作类型回溯。",
  },
  "admin.noAnalytics": {
    kind: "first-use",
    title: "还没有可统计的数据",
    description: "师生开始使用后，这里会显示真实的调用与活跃情况；在此之前不显示任何估算值。",
  },
} as const satisfies Record<string, EmptyCopy>;

export type EmptyStateKey = keyof typeof EMPTY_STATES;

/** 取一条空态文案。key 写错时 TS 直接报错，不会在运行时静默显示空白。 */
export function emptyCopy(key: EmptyStateKey): EmptyCopy {
  return EMPTY_STATES[key];
}
