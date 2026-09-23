// Teacher-review acceptance fixtures, applied through the ordinary versioned save API.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const water = process.argv[2] === "water";
const file = resolve(`../.agent-supervisor/courseware-acceptance-20260905${water ? "-water/water" : "/geography"}-deck.json`);
const saved = JSON.parse(readFileSync(file, "utf8"));
const base = "http://127.0.0.1:4921";
const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "teacher", password: "Teacher@123" }) });
assert.equal(login.status, 200);
const cookie = login.headers.get("set-cookie").split(";", 1)[0];
const deckResponse = await fetch(`${base}/api/courseware/${saved.id}`, { headers: { cookie } });
assert.equal(deckResponse.status, 200, `deck fetch failed: HTTP ${deckResponse.status}`);
const { deck } = await deckResponse.json();
const plan = deck.plan;
if (!water) {
  plan.slides[0].visualHint = "封面以自然地形和三种区域生活插图为主，不画风向或河流箭头，不画数值图例，不标注细小地名。四条学习目标各出现一次。保持简洁、大字、安全边距。";
  plan.slides[1].visualHint = "中央放简化亚洲地形大图，仅标中部高原山地、北冰洋、太平洋、印度洋。图例只用相对高地与低地，不画海拔数字或比例尺。河流箭头由中央分别向北、东、南，不画向西入海箭头，不画风向箭头。所有文字清晰，不增加未提供地名。";
  plan.slides[3].bullets = ["东亚：典型稻作区夏季高温多雨；平原和沿海人口较密集。", "南亚：夏季受西南季风影响，季风不稳定易造成旱涝差异。", "西亚：大部分地区降水少，绿洲农业零散；波斯湾沿岸石油丰富。"];
  plan.slides[3].visualHint = "整页为三幅等宽大场景图对比，分别为东亚稻田与城市、南亚雨季农田、西亚绿洲与石油。每列只排对应的一条要点，文字不要在顶部重复。图占各列上部三分之二，底部各列大字说明。底部一行总结，保留地域限定。";
  plan.slides[4].title = "读图练习：用证据解释差异";
  plan.slides[4].bullets = ["读地势图：河流为什么大多从中部流向周边？", "读季风图：暖湿气流从哪里来，带来什么影响？", "选一个区域，用“自然条件—人类活动”解释生活差异。"];
  plan.slides[4].visual = { ...plan.slides[4].visual, title: "综合读图", labels: ["高地", "低地", "河流", "夏季风"], caption: "示意图，不表示数值或精确比例" };
  plan.slides[4].visualHint = "左半页上下两幅简洁大示意图：上图亚洲高地与向北东南的河流，下图海洋暖湿气流进入东部和南部。不要小插图、小照片、细碎表格、比例尺或任何数值图例。右半页三条大字问题及空白答题线。所有标签仅用已提供词语，不加细小地名。";
  plan.slides[5].title = "回顾：自然条件与区域生活";
  plan.slides[5].bullets = ["地势影响河流：亚洲中部高、四周低，许多大河由中部流向周边。", "气候影响生产：夏季风带来暖湿气流，降水条件影响农业与用水。", "比较需要边界：同一区域内部也存在差异，避免以偏概全。"];
  plan.slides[5].visual = { ...plan.slides[5].visual, title: "两条因果链", labels: ["地势", "河流", "气候", "农业与用水"], caption: "地势影响河流；气候影响农业与用水" };
  plan.slides[5].visualHint = "不要画地势→河流→季风的错误线性因果链。用上下两条互相独立的图文链：高原山地→河流向周边，海洋暖湿气流→降水→农业与用水。每条只保留大插图和短标签。底部保留第三条地域限定与一句出口问题，不放密集小地图或小字。";
} else {
  plan.title = "水循环：一滴水的旅行";
  plan.designIntent = "科学教材式自然剖面、过程箭头和课堂观察；以下为验收时人工审阅的教学分镜，不宣称为在线模型规划。";
  plan.theme = { palette: "ocean", mood: "明亮、准确、适合小学科学课堂", visualSystem: "自然水循环剖面、过程箭头与观察记录" };
  const data = [
    { title: "水循环：一滴水的旅行", kind: "cover", layout: "cover", purpose: "从雨后水洼的变化提出问题", bullets: ["水洼变小了，水去了哪里？", "云中的水，又怎样回到地面？"], takeaway: "水在海洋、陆地和大气之间不断转移。", labels: ["海洋", "陆地", "大气"], visualHint: "大幅阳光下海洋、山地、河流和云的自然插画。左侧大字标题与两条问题，右侧主体，不放复杂箭头和小字标签。" },
    { title: "海洋、陆地与大气之间", kind: "concept", layout: "process", purpose: "解释水循环的主要过程与方向", bullets: ["蒸发与植物蒸腾：水进入大气。", "凝结：水蒸气遇冷形成小水滴。", "降水、径流与下渗：水返回并流经陆地。"], takeaway: "太阳能驱动蒸发，重力影响水向低处运动。", labels: ["蒸发", "植物蒸腾", "凝结", "降水", "地表径流", "下渗"], visualHint: "占页面三分之二的海洋-森林-山地-云-土壤剖面图。蒸发和蒸腾箭头向上；降水和下渗向下；径流由山地流入海洋；凝结标在云内。地下水流向海洋。只写六个给定大字标签，不添测量数字，不把水蒸气画成可见白汽。" },
    { title: "观察：窗边的密封袋", kind: "activity", layout: "experiment", purpose: "用局部模型观察蒸发和凝结现象", bullets: ["透明密封袋装少量常温水，密封后固定在窗边。", "观察袋壁小水滴，记录位置和变化，不预填结果。", "比较：这个小模型不能展示自然界的所有过程。"], takeaway: "使用常温水，不用热水、明火或电热设备。", labels: ["常温水", "密封袋", "袋壁水滴", "观察记录"], visualHint: "清晰表现贴在窗上的透明密封袋、底部浅蓝水和上部袋壁水滴；右侧放三条步骤与空白观察记录。常温水和安全提示醒目。不画加热设备，不编造观察数据、温度或持续时间。" },
    { title: "解释身边的水循环", kind: "summary", layout: "practice", purpose: "迁移概念并用现象检验解释", bullets: ["雨后水洼变小，主要发生了什么过程？", "袋壁水滴能否说明水蒸气本身是白色的？", "画一条可能的旅行路线，并标注水的变化过程。"], takeaway: "水蒸气通常看不见；可见的小水滴不是水蒸气。", labels: ["蒸发", "凝结", "降水"], visualHint: "左侧用雨后水洼和透明袋壁水滴两幅大场景辅助提问；右侧三条大字题目及答题留白。不要印答案或虚构测量数值，底部保留核心结论。" },
  ];
  plan.slides = data.map((item, index) => ({ ...plan.slides[index], ...item, index: index + 1, eyebrow: "科学 · 五年级", subtitle: "", visual: { kind: index === 2 ? "experiment" : "process", title: item.title, labels: item.labels, values: [], caption: "课堂示意，需结合教材复核", emphasis: "" }, teacherNote: "以学生实际观察为依据，不把示意插图当成真实测量。展示前复核图示箭头和术语。", sourceRefs: ["USGS Water Cycle Diagrams", "https://www.usgs.gov/water-science-school/science/water-cycle-diagrams"] }));
  plan.reviewNotes = ["依据 USGS 水循环图解整理，分镜已由本次验收流程人工审阅。", "生图中的箭头、中文和科学术语仍须逐页复核。"];
}
const response = await fetch(`${base}/api/courseware/${deck.id}`, { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ operationId: `acceptance-review-${water ? "water" : "geography"}-20260905-v1`, stateVersion: deck.stateVersion, plan }) });
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
writeFileSync(file, JSON.stringify(result.authoritativeEntity, null, 2));
console.log({ id: deck.id, stateVersion: result.stateVersion, review: "manual acceptance review" });
