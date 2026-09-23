import type { ManorGradeBand } from "./v7-learning-contracts";

export type ManorMissionSubject = "语文" | "数学" | "科学";

export interface ManorMission {
  id: string;
  objectiveId: string;
  subject: ManorMissionSubject;
  title: string;
  durationMinutes: number;
  question: string;
  prompt: string;
  choices: Array<{ id: "A" | "B" | "C"; text: string }>;
  answer: "A" | "B" | "C";
  scaffold: string;
  reward: number;
  gradeBand?: ManorGradeBand;
  templateId?: string;
  assignmentId?: string;
  assignmentVersion?: number;
  resourceVersion?: string;
  datasetVersion?: string;
  projectId?: string;
  source?: { kind: "sample" | "assignment"; label: string; dataKind: "simulated"; teacherPublished: boolean };
  review?: { question: string; prompt: string; choices: ManorMission["choices"]; answer: "A" | "B" | "C"; scaffold: string };
}

export const MANOR_MISSIONS: ManorMission[] = [
  {
    id: "reading-clue-01",
    objectiveId: "cn-reading-evidence-01",
    subject: "语文",
    title: "寻找春雨的线索",
    durationMinutes: 8,
    question: "哪条证据最能说明春雨很轻？",
    prompt: "短文写道：雨丝落在嫩叶上，叶尖只是轻轻点了点头，水珠便顺着叶脉滑了下去。",
    choices: [
      { id: "A", text: "嫩叶是绿色的" },
      { id: "B", text: "叶尖只是轻轻点了点头" },
      { id: "C", text: "水珠顺着叶脉滑下去" },
    ],
    answer: "B",
    scaffold: "再读一遍，先圈出直接写“动作幅度”的关键词，再判断哪一句最能支持“轻”。",
    reward: 12,
  },
  {
    id: "math-pattern-01",
    objectiveId: "math-division-01",
    subject: "数学",
    title: "规划灌溉节奏",
    durationMinutes: 6,
    question: "每 3 分钟浇一块田，12 分钟最多完成几块？",
    prompt: "把总时间平均分成相同的小段，再数一数有几段。",
    choices: [
      { id: "A", text: "3 块" },
      { id: "B", text: "4 块" },
      { id: "C", text: "6 块" },
    ],
    answer: "B",
    scaffold: "画一条 12 分钟的时间线，每 3 分钟做一个标记。",
    reward: 10,
  },
  {
    id: "science-leaf-01",
    objectiveId: "science-transpiration-01",
    subject: "科学",
    title: "观察叶片蒸腾",
    durationMinutes: 7,
    question: "透明袋内出现小水珠，最合理的解释是什么？",
    prompt: "同样光照下，一片叶子套透明袋，另一片不套。20 分钟后袋内出现小水珠。",
    choices: [
      { id: "A", text: "叶片释放的水汽凝结" },
      { id: "B", text: "袋子自己产生了水" },
      { id: "C", text: "阳光变成了水" },
    ],
    answer: "A",
    scaffold: "比较两片叶子的唯一不同条件，再追踪水可能从哪里来。",
    reward: 12,
  },
];

const WATER_SOURCE = { kind: "sample", label: "校园花圃节水教学示例，须由教师核准后用于课堂", dataKind: "simulated", teacherPublished: false } as const;
for (const gradeBand of ["upper_primary", "middle_school"] as const) {
  const middle = gradeBand === "middle_school";
  const suffix = middle ? "middle" : "primary";
  const shared = {
    gradeBand, projectId: `water-conservation-${suffix}`, source: WATER_SOURCE, durationMinutes: 10, reward: 0,
  };
  const data = "模拟数据：相同面积和同种植物的两块花圃，一周常规浇水用水100升、覆盖土壤用水75升，两组均有9/10株叶片挺立。尚未重复实验。";
  MANOR_MISSIONS.push(
    {
      ...shared, id: `water-math-${suffix}`, objectiveId: `water-volume-${suffix}`, subject: "数学", title: middle ? "计算节水比例与比较边界" : "比较花圃用水量",
      question: middle ? "本周覆盖组比常规组少用水的比例是多少？" : "本周覆盖组比常规组少用多少升水？", prompt: data,
      choices: [{ id: "A", text: middle ? "75%" : "175升" }, { id: "B", text: middle ? "25%" : "25升" }, { id: "C", text: middle ? "约33%" : "75升" }], answer: "B",
      scaffold: middle ? "先算100-75，再以常规组100升作为比较基准；单次比例不代表长期节水率。" : "用常规组的100升减去覆盖组的75升，单位保持为升。",
      review: { question: middle ? "另一周常规组80升、覆盖组60升，少用水的比例是多少？" : "另一周常规组80升、覆盖组60升，少用了多少升？", prompt: "这是新的模拟数据，请重新计算，不沿用上一周的数量。", choices: [{ id: "A", text: middle ? "25%" : "20升" }, { id: "B", text: middle ? "20%" : "25升" }, { id: "C", text: middle ? "75%" : "140升" }], answer: "A", scaffold: "先算80-60，再按问题决定是否除以基准80。" },
    },
    {
      ...shared, id: `water-science-${suffix}`, objectiveId: `water-control-${suffix}`, subject: "科学", title: middle ? "设计对照与重复观察" : "判断植物健康与公平比较",
      question: middle ? "哪项补充最能检验覆盖土壤的效果是否稳定？" : "下一轮怎样比较才更公平？", prompt: data,
      choices: [{ id: "A", text: "只观察用水少的一组" }, { id: "B", text: "同时更换植物、土壤和光照" }, { id: "C", text: "保持植物和光照相近，重复多周记录用水与叶片状态" }], answer: "C",
      scaffold: "用水少不等于植物健康；要控制其他条件，重复记录两组的用水和健康指标。",
      review: { question: "换到阴凉花圃后，能直接使用上一轮节水结论吗？", prompt: "环境发生了变化，需要考虑证据能否迁移。", choices: [{ id: "A", text: "能，覆盖方法永远有效" }, { id: "B", text: "不能，应重新设置相近条件的对照并记录健康状况" }, { id: "C", text: "只要少浇水就成功" }], answer: "B", scaffold: "光照变化可能影响需水量，应重新观察，不能只凭旧数据。" },
    },
    {
      ...shared, id: `water-reading-${suffix}`, objectiveId: `water-argument-${suffix}`, subject: "语文", title: middle ? "用数据和限制提出节水建议" : "用证据写节水建议",
      question: "哪句话同时使用数学结果、植物观察和证据限制？", prompt: data,
      choices: [{ id: "A", text: "本周覆盖组少用25升、两组叶片挺立比例相同，建议继续对照观察，暂不推广为全年结论。" }, { id: "B", text: "覆盖土壤全年一定节水25%，不必再观察。" }, { id: "C", text: "花圃更漂亮，所以已经证明节水。" }], answer: "A",
      scaffold: "建议需要数量比较和健康观察共同支持，还应说明只观察了一周。请在表达中分别写出这三部分。",
      review: { question: "新一周节水但覆盖组叶片萎蔫更多，应怎样修订建议？", prompt: "新证据可能改变原有结论。", choices: [{ id: "A", text: "忽略萎蔫，继续推广" }, { id: "B", text: "删除不利数据" }, { id: "C", text: "保留两种观察，调整方案并继续检验植物健康" }], answer: "C", scaffold: "修订应保留不利证据，节水不能以植物健康为代价。" },
    },
  );
}

export function manorReviewQuestion(mission: ManorMission) {
  if (mission.review) return mission.review;
  const variants: Record<string, NonNullable<ManorMission["review"]>> = {
    "reading-clue-01": { question: "哪句直接支持风很轻？", prompt: "新短文：微风拂来，纸风车缓缓转了半圈，树影仍静静卧在地上。", choices: [{ id: "A", text: "树影在地上" }, { id: "B", text: "风车是纸做的" }, { id: "C", text: "风车缓缓转了半圈" }], answer: "C", scaffold: "找到描述动作速度和幅度的词语。" },
    "math-pattern-01": { question: "每4分钟浇一块田，20分钟能完成几块？", prompt: "把总时间分成相同的4分钟小段。", choices: [{ id: "A", text: "5块" }, { id: "B", text: "4块" }, { id: "C", text: "6块" }], answer: "A", scaffold: "计算20除以4，再检查单位。" },
    "science-leaf-01": { question: "要确认袋内水珠与叶片有关，应增加哪个对照？", prompt: "保持同样光照与时间，比较套叶片的袋子和一个不放叶片的干燥袋。", choices: [{ id: "A", text: "换一个颜色更鲜艳的袋子" }, { id: "B", text: "比较有无叶片的干燥袋内水珠" }, { id: "C", text: "只观察叶片颜色" }], answer: "B", scaffold: "对照应只改变是否有叶片这个关键条件。" },
  };
  return variants[mission.templateId ?? mission.id];
}

export function publicManorMission(mission: ManorMission) {
  return {
    id: mission.id,
    objectiveId: mission.objectiveId,
    subject: mission.subject,
    title: mission.title,
    durationMinutes: mission.durationMinutes,
    question: mission.question,
    prompt: mission.prompt,
    choices: mission.choices,
    reward: mission.assignmentId ? mission.reward : 0,
    gradeBand: mission.gradeBand ?? "lower_primary",
    projectId: mission.projectId ?? null,
    templateId: mission.templateId ?? mission.id,
    assignmentId: mission.assignmentId ?? null,
    assignmentVersion: mission.assignmentVersion ?? null,
    resourceVersion: mission.resourceVersion ?? "manor-template-v7.1",
    datasetVersion: mission.datasetVersion ?? (mission.projectId ? "water-simulated-v1" : null),
    source: mission.source ?? { kind: "sample", label: "内置练习示例，非教师发布活动", dataKind: "simulated", teacherPublished: false },
    evaluationScope: "single_item_practice",
  };
}
