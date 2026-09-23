import JSZip from "jszip";
import type { CoursewarePlan, CoursewareSlide } from "./core.ts";

const WIDTH = 12_192_000;
const HEIGHT = 6_858_000;
const COURSEWARE_PALETTES = {
  ocean: { ink: "13233F", accent: "176B87", secondary: "2EA7A0", warm: "E9A23B", canvas: "F4F8F7", surface: "FFFFFF", tint: "DCEFEB" },
  forest: { ink: "17352C", accent: "2C7A5A", secondary: "69A76F", warm: "D9A441", canvas: "F4F7F1", surface: "FFFFFF", tint: "DDECDD" },
  sunrise: { ink: "3C2940", accent: "C85C49", secondary: "E29462", warm: "E6B646", canvas: "FFF8F1", surface: "FFFFFF", tint: "F8DFD3" },
  ink: { ink: "15243B", accent: "345A8A", secondary: "647B98", warm: "B78945", canvas: "F4F5F7", surface: "FFFFFF", tint: "E1E7EE" },
} as const;

function xml(value: string): string {
  const validXml = Array.from(value).filter((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
  }).join("");
  return validXml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type ParagraphOptions = {
  size?: number;
  color?: string;
  bold?: boolean;
  bullet?: boolean;
  align?: "l" | "ctr" | "r";
};

type ShapeOptions = {
  fill?: string;
  line?: string;
  lineWidth?: number;
  geometry?: string;
  radius?: boolean;
  anchor?: "t" | "ctr" | "b";
  margin?: number;
  shadow?: boolean;
};

function paragraph(text: string, options: ParagraphOptions = {}): string {
  const { size = 1_600, color = "243047", bold = false, bullet = false, align = "l" } = options;
  const pPr = bullet
    ? `<a:pPr algn="${align}" marL="304800" indent="-190500"><a:spcAft><a:spcPts val="600"/></a:spcAft><a:buChar char="&#x2022;"/></a:pPr>`
    : `<a:pPr algn="${align}"><a:spcAft><a:spcPts val="300"/></a:spcAft></a:pPr>`;
  return `<a:p>${pPr}<a:r><a:rPr lang="zh-CN" sz="${size}"${bold ? ' b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="Aptos"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>${xml(text || " ")}</a:t></a:r><a:endParaRPr lang="zh-CN" sz="${size}"/></a:p>`;
}

function shape(
  id: number,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: ShapeOptions = {},
): string {
  const {
    fill = "",
    line = "",
    lineWidth = 12_700,
    geometry = options.radius ? "roundRect" : "rect",
    shadow = false,
  } = options;
  const fillXml = fill ? `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` : "<a:noFill/>";
  const lineXml = line
    ? `<a:ln w="${lineWidth}"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";
  const effectXml = shadow
    ? '<a:effectLst><a:outerShdw blurRad="76200" dist="38100" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="64748B"><a:alpha val="17000"/></a:srgbClr></a:outerShdw></a:effectLst>'
    : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${fillXml}${lineXml}${effectXml}</p:spPr></p:sp>`;
}

function textShape(
  id: number,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  paragraphs: string,
  options: ShapeOptions = {},
): string {
  const margin = options.margin ?? 137_160;
  const fillXml = options.fill ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>` : "<a:noFill/>";
  const lineXml = options.line
    ? `<a:ln w="${options.lineWidth ?? 12_700}"><a:solidFill><a:srgbClr val="${options.line}"/></a:solidFill></a:ln>`
    : "<a:ln><a:noFill/></a:ln>";
  const geometry = options.geometry ?? (options.radius ? "roundRect" : "rect");
  const effectXml = options.shadow
    ? '<a:effectLst><a:outerShdw blurRad="76200" dist="38100" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="64748B"><a:alpha val="16000"/></a:srgbClr></a:outerShdw></a:effectLst>'
    : "";
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${xml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom>${fillXml}${lineXml}${effectXml}</p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${options.anchor ?? "t"}" lIns="${margin}" rIns="${margin}" tIns="${Math.round(margin * 0.72)}" bIns="${Math.round(margin * 0.72)}"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function iconLabel(id: number, name: string, x: number, y: number, size: number, label: string, fill: string, text: string): string[] {
  return [
    shape(id, `${name}图标底`, x, y, size, size, { fill, geometry: "ellipse" }),
    textShape(id + 1, `${name}图标字`, x, y, size, size, paragraph(label, { size: 1_450, color: text, bold: true, align: "ctr" }), { anchor: "ctr", margin: 0 }),
  ];
}

function slideXml(plan: CoursewarePlan, slide: CoursewareSlide): string {
  const palette = COURSEWARE_PALETTES[plan.theme?.palette ?? "ocean"];
  const shapes: string[] = [];
  let id = 2;
  const next = () => id++;
  const addShape = (name: string, x: number, y: number, w: number, h: number, options: ShapeOptions = {}) => {
    shapes.push(shape(next(), name, x, y, w, h, options));
  };
  const addText = (name: string, x: number, y: number, w: number, h: number, paragraphs: string, options: ShapeOptions = {}) => {
    shapes.push(textShape(next(), name, x, y, w, h, paragraphs, options));
  };
  const labels = slide.visual.labels.length ? slide.visual.labels : slide.bullets.slice(0, 4);
  addShape("背景", 0, 0, WIDTH, HEIGHT, { fill: palette.canvas });

  if (slide.layout === "cover" && slide.bullets.length === 1) {
    addShape("左侧色带", 0, 0, 355_600, HEIGHT, { fill: palette.accent });
    addShape("装饰圆一", 9_480_000, -760_000, 3_200_000, 3_200_000, { fill: palette.tint, geometry: "ellipse" });
    addShape("装饰圆二", 10_250_000, 4_750_000, 2_450_000, 2_450_000, { fill: palette.secondary, geometry: "ellipse" });
    addText("学科标签", 850_000, 680_000, 3_800_000, 520_000,
      paragraph(slide.eyebrow || `${plan.subject} · ${plan.grade}`, { size: 1_150, color: palette.accent, bold: true }),
      { fill: palette.tint, radius: true, margin: 120_000 });
    addText("课件标题", 820_000, 1_430_000, 7_600_000, 1_900_000,
      paragraph(slide.title, { size: 3_350, color: palette.ink, bold: true }) +
      paragraph(slide.subtitle || `${plan.grade} · ${plan.subject}`, { size: 1_420, color: palette.secondary }));
    addText("学习挑战", 840_000, 4_130_000, 6_900_000, 1_090_000,
      paragraph("本课挑战", { size: 1_050, color: palette.accent, bold: true }) +
      paragraph(slide.bullets[0], { size: 1_520, color: palette.ink, bold: true }),
      { fill: palette.surface, radius: true, shadow: true, margin: 190_000 });
    addShape("主视觉底座", 8_480_000, 1_340_000, 2_680_000, 3_750_000, { fill: palette.surface, radius: true, shadow: true });
    addShape("主视觉轨道", 9_090_000, 2_020_000, 1_470_000, 1_470_000, { fill: palette.accent, geometry: "ellipse" });
    addText("主视觉主题", 8_710_000, 2_160_000, 2_210_000, 1_080_000,
      paragraph(slide.visual.emphasis || plan.subject, { size: 1_520, color: "FFFFFF", bold: true, align: "ctr" }), { anchor: "ctr", margin: 30_000 });
    addShape("主视觉步骤一", 8_870_000, 3_820_000, 650_000, 650_000, { fill: palette.warm, geometry: "ellipse" });
    addShape("主视觉步骤二", 9_750_000, 3_820_000, 650_000, 650_000, { fill: palette.secondary, geometry: "ellipse" });
    addText("封面页码", 10_820_000, 5_950_000, 850_000, 360_000, paragraph(`01 / ${String(plan.slides.length).padStart(2, "0")}`, { size: 900, color: palette.ink, bold: true, align: "r" }));
  } else {
    addShape("页眉色带", 0, 0, WIDTH, 95_250, { fill: palette.accent });
    addText("章节标签", 650_000, 300_000, 2_650_000, 390_000,
      paragraph(slide.eyebrow || slide.kind, { size: 950, color: palette.accent, bold: true }));
    addText("页面标题", 650_000, 660_000, 10_550_000, 650_000,
      paragraph(slide.title, { size: 2_250, color: palette.ink, bold: true }));
    addText("教学意图", 650_000, 1_250_000, 10_200_000, 430_000,
      paragraph(slide.subtitle || slide.purpose, { size: 1_050, color: "5B6B7E" }));

    const card = (index: number, x: number, y: number, w: number, h: number, title: string, body: string, fill: string) => {
      addShape(`卡片${index}底`, x, y, w, h, { fill: palette.surface, radius: true, shadow: true });
      shapes.push(...iconLabel(next(), `卡片${index}`, x + 170_000, y + 170_000, 520_000, String(index).padStart(2, "0"), fill, "FFFFFF"));
      id += 1;
      addText(`卡片${index}标题`, x + 820_000, y + 130_000, w - 980_000, 510_000,
        paragraph(title, { size: 1_280, color: palette.ink, bold: true }));
      addText(`卡片${index}正文`, x + 170_000, y + 750_000, w - 340_000, h - 910_000,
        paragraph(body, { size: 1_060, color: "465568" }));
    };

    if (slide.bullets.length > 3 || ["cover", "map-focus", "experiment", "process", "timeline", "formula"].includes(slide.layout)) {
      const rowHeight = Math.floor(3_650_000 / slide.bullets.length);
      slide.bullets.forEach((bullet, index) => {
        const y = 1_900_000 + index * rowHeight;
        addText(`要点序号${index + 1}`, 680_000, y, 500_000, rowHeight - 100_000, paragraph(String(index + 1), { size: 1_300, bold: true, color: palette.accent, align: "ctr" }), { fill: palette.tint, anchor: "ctr", margin: 30_000 });
        addText(`完整要点${index + 1}`, 1_340_000, y, 10_060_000, rowHeight - 100_000, paragraph(bullet, { size: 1_480, color: palette.ink }), { fill: palette.surface, anchor: "ctr", margin: 90_000 });
      });
      if (slide.takeaway) addText("本页结论", 680_000, 5_760_000, 10_720_000, 580_000, paragraph(slide.takeaway, { size: 1_200, color: palette.accent, bold: true }), { fill: palette.tint, margin: 80_000 });
    } else if (slide.layout === "cards") {
      const count = Math.min(3, Math.max(1, slide.bullets.length));
      const gap = 180_000;
      const w = Math.floor((10_900_000 - gap * (count - 1)) / count);
      slide.bullets.slice(0, count).forEach((bullet, index) => card(index + 1, 650_000 + index * (w + gap), 1_950_000, w, 3_520_000, labels[index] || `学习目标 ${index + 1}`, bullet, [palette.accent, palette.secondary, palette.warm][index % 3]));
    } else if (slide.layout === "comparison") {
      const count = 3;
      const w = 3_500_000;
      const fills = [palette.accent, palette.secondary, palette.warm];
      for (let index = 0; index < count; index += 1) {
        const x = 650_000 + index * 3_660_000;
        addShape(`对比卡${index + 1}`, x, 1_900_000, w, 3_950_000, { fill: palette.surface, radius: true, shadow: true });
        addShape(`对比视觉${index + 1}`, x, 1_900_000, w, 1_560_000, { fill: index === 0 ? palette.tint : index === 1 ? "E7F1E6" : "FAE8D6", radius: true });
        addShape(`对比太阳${index + 1}`, x + 2_520_000, 2_110_000, 520_000, 520_000, { fill: fills[index], geometry: "ellipse" });
        addShape(`对比地景${index + 1}`, x + 360_000, 2_600_000, 2_710_000, 470_000, { fill: fills[index], geometry: index === 1 ? "wave" : "chevron" });
        addText(`对比标题${index + 1}`, x + 230_000, 3_660_000, w - 460_000, 550_000,
          paragraph(labels[index] || `对象 ${index + 1}`, { size: 1_420, color: palette.ink, bold: true }));
        addText(`对比内容${index + 1}`, x + 230_000, 4_260_000, w - 460_000, 1_220_000,
          paragraph(slide.bullets[index] || slide.purpose, { size: 1_040, color: "465568" }));
      }
      addText("对比结论", 2_400_000, 6_010_000, 7_300_000, 470_000,
        paragraph(slide.takeaway || "比较不是罗列差异，而是用同一维度解释差异。", { size: 1_120, color: palette.surface, bold: true, align: "ctr" }),
        { fill: palette.ink, radius: true, anchor: "ctr", margin: 50_000 });
    } else if (slide.layout === "map-focus") {
      slide.bullets.slice(0, 4).forEach((bullet, index) => {
        const y = 1_850_000 + index * 930_000;
        addShape(`读图步骤${index + 1}`, 650_000, y, 4_250_000, 760_000, { fill: palette.surface, radius: true, shadow: true });
        shapes.push(...iconLabel(next(), `读图步骤${index + 1}`, 820_000, y + 120_000, 510_000, String(index + 1).padStart(2, "0"), index < 2 ? palette.accent : palette.secondary, "FFFFFF"));
        id += 1;
        addText(`读图内容${index + 1}`, 1_500_000, y + 100_000, 3_150_000, 560_000, paragraph(bullet, { size: 1_020, color: palette.ink, bold: index === 0 }), { anchor: "ctr", margin: 20_000 });
      });
      addShape("概念地图画布", 5_220_000, 1_850_000, 6_320_000, 4_020_000, { fill: "E7F4F2", radius: true, line: palette.tint, lineWidth: 19_050 });
      addShape("概念地图大陆", 6_180_000, 2_280_000, 3_940_000, 2_700_000, { fill: "C7DFB9", geometry: "cloud" });
      addShape("概念地图水域", 9_560_000, 2_160_000, 1_450_000, 3_140_000, { fill: "B9DCEA", geometry: "arc" });
      labels.slice(0, 3).forEach((label, index) => {
        const points = [[6_000_000, 2_250_000], [8_250_000, 3_050_000], [7_050_000, 4_550_000]][index];
        addShape(`地图节点${index + 1}`, points[0], points[1], 360_000, 360_000, { fill: [palette.accent, palette.warm, palette.secondary][index], geometry: "ellipse" });
        addText(`地图标签${index + 1}`, points[0] + 300_000, points[1] - 20_000, 1_800_000, 420_000, paragraph(label, { size: 1_030, color: palette.ink, bold: true }), { fill: palette.surface, radius: true, margin: 70_000 });
      });
      addText("地图说明", 5_520_000, 5_250_000, 5_720_000, 410_000, paragraph(slide.visual.caption, { size: 820, color: "5B6B7E", align: "ctr" }));
    } else if (["process", "timeline"].includes(slide.layout)) {
      const count = Math.min(4, Math.max(3, labels.length));
      addShape("流程轨道", 1_250_000, 3_250_000, 9_700_000, 120_000, { fill: palette.tint, radius: true });
      for (let index = 0; index < count; index += 1) {
        const x = 1_000_000 + index * (8_800_000 / (count - 1));
        addShape(`流程节点${index + 1}`, Math.round(x), 2_770_000, 920_000, 920_000, { fill: [palette.accent, palette.secondary, palette.warm, palette.ink][index], geometry: "ellipse", shadow: true });
        addText(`流程序号${index + 1}`, Math.round(x), 2_770_000, 920_000, 920_000, paragraph(String(index + 1), { size: 1_650, color: "FFFFFF", bold: true, align: "ctr" }), { anchor: "ctr", margin: 0 });
        addText(`流程标签${index + 1}`, Math.round(x - 330_000), 3_900_000, 1_580_000, 550_000, paragraph(labels[index] || `步骤 ${index + 1}`, { size: 1_120, color: palette.ink, bold: true, align: "ctr" }));
        addText(`流程内容${index + 1}`, Math.round(x - 430_000), 4_500_000, 1_780_000, 1_000_000, paragraph(slide.bullets[index] || slide.purpose, { size: 900, color: "526174", align: "ctr" }));
      }
    } else if (slide.layout === "experiment") {
      addShape("实验步骤面板", 650_000, 1_900_000, 5_000_000, 3_880_000, { fill: palette.surface, radius: true, shadow: true });
      slide.bullets.slice(0, 4).forEach((bullet, index) => {
        const y = 2_180_000 + index * 820_000;
        shapes.push(...iconLabel(next(), `实验步骤${index + 1}`, 900_000, y, 460_000, String(index + 1), index < 2 ? palette.accent : palette.secondary, "FFFFFF"));
        id += 1;
        addText(`实验步骤文字${index + 1}`, 1_520_000, y - 20_000, 3_700_000, 540_000, paragraph(bullet, { size: 1_020, color: palette.ink }), { anchor: "ctr", margin: 20_000 });
      });
      addShape("实验台", 6_090_000, 5_130_000, 5_150_000, 220_000, { fill: palette.ink, radius: true });
      addShape("烧杯", 6_700_000, 2_900_000, 1_720_000, 2_170_000, { fill: "D8EEF2", line: palette.accent, lineWidth: 25_400, geometry: "trapezoid" });
      addShape("烧杯液体", 6_860_000, 4_080_000, 1_400_000, 760_000, { fill: palette.secondary, geometry: "trapezoid" });
      addShape("控制变量一", 9_050_000, 2_370_000, 870_000, 870_000, { fill: palette.warm, geometry: "ellipse" });
      addShape("控制变量二", 9_760_000, 3_430_000, 1_030_000, 1_030_000, { fill: palette.accent, geometry: "ellipse" });
      addText("实验标签", 8_650_000, 4_780_000, 2_540_000, 450_000, paragraph(labels.slice(0, 2).join(" · ") || "变量 · 证据", { size: 980, color: palette.ink, bold: true, align: "ctr" }));
    } else if (slide.layout === "formula") {
      addText("核心关系", 1_080_000, 1_950_000, 10_030_000, 1_250_000,
        paragraph(slide.visual.emphasis || slide.takeaway || slide.title, { size: 2_350, color: "FFFFFF", bold: true, align: "ctr" }),
        { fill: palette.ink, radius: true, shadow: true, anchor: "ctr" });
      labels.slice(0, 3).forEach((label, index) => card(index + 1, 750_000 + index * 3_760_000, 3_630_000, 3_500_000, 2_040_000, label, slide.bullets[index] || slide.purpose, [palette.accent, palette.secondary, palette.warm][index]));
    } else if (slide.layout === "data-story") {
      addShape("证据面板", 650_000, 1_900_000, 4_760_000, 3_900_000, { fill: palette.surface, radius: true, shadow: true });
      slide.bullets.slice(0, 4).forEach((bullet, index) => addText(`证据${index + 1}`, 900_000, 2_150_000 + index * 820_000, 4_250_000, 620_000, paragraph(`${String(index + 1).padStart(2, "0")}  ${bullet}`, { size: 1_020, color: index === 0 ? palette.accent : palette.ink, bold: index === 0 }), { fill: index === 0 ? palette.tint : "F8FAFC", radius: true, margin: 100_000 }));
      addShape("数据图底", 5_720_000, 1_900_000, 5_820_000, 3_900_000, { fill: palette.surface, radius: true, shadow: true });
      const values = slide.visual.values;
      if (!values.length) addText("数据待补充", 6_100_000, 3_000_000, 5_000_000, 900_000, paragraph("未提供可核验数值，暂不绘制统计图。", { size: 1_300, color: palette.ink }));
      labels.slice(0, Math.min(4, values.length)).forEach((label, index) => {
        const y = 2_340_000 + index * 780_000;
        addText(`数据标签${index + 1}`, 6_030_000, y, 1_360_000, 420_000, paragraph(label, { size: 950, color: palette.ink, bold: true, align: "r" }));
        addShape(`数据轨道${index + 1}`, 7_620_000, y + 50_000, 3_260_000, 280_000, { fill: "E8EDF2", radius: true });
        addShape(`数据条${index + 1}`, 7_620_000, y + 50_000, Math.max(1, Math.round(3_260_000 * (values[index] / 100))), 280_000, { fill: [palette.accent, palette.secondary, palette.warm, palette.ink][index], radius: true });
      });
    } else if (slide.layout === "practice") {
      const fills = [palette.tint, "E5F2E8", "FCE9D6"];
      const accents = [palette.accent, palette.secondary, palette.warm];
      slide.bullets.slice(0, 3).forEach((bullet, index) => {
        const x = 650_000 + index * 3_660_000;
        addShape(`练习卡${index + 1}`, x, 1_950_000, 3_470_000, 3_860_000, { fill: fills[index], radius: true, shadow: true });
        shapes.push(...iconLabel(next(), `练习层级${index + 1}`, x + 220_000, 2_190_000, 620_000, String(index + 1), accents[index], "FFFFFF"));
        id += 1;
        addText(`练习标题${index + 1}`, x + 220_000, 3_060_000, 3_030_000, 580_000, paragraph(labels[index] || `层级 ${index + 1}`, { size: 1_420, color: palette.ink, bold: true }));
        addText(`练习内容${index + 1}`, x + 220_000, 3_790_000, 3_030_000, 1_450_000, paragraph(bullet, { size: 1_050, color: "465568" }));
      });
    } else if (slide.layout === "summary") {
      const summaryLabels = labels.length >= 3 ? labels : ["我学会了", "证据是什么", "下一步做什么"];
      summaryLabels.slice(0, 3).forEach((label, index) => card(index + 1, 650_000 + index * 3_660_000, 1_950_000, 3_470_000, 2_960_000, label, slide.bullets[index] || slide.purpose, [palette.accent, palette.secondary, palette.warm][index]));
      addText("行动提示", 1_180_000, 5_300_000, 9_840_000, 650_000, paragraph(slide.takeaway || "带着一条证据和一个新问题离开课堂。", { size: 1_280, color: "FFFFFF", bold: true, align: "ctr" }), { fill: palette.ink, radius: true, anchor: "ctr" });
    } else {
      addShape("左侧正文", 650_000, 1_900_000, 5_300_000, 3_900_000, { fill: palette.surface, radius: true, shadow: true });
      addText("页面要点", 930_000, 2_160_000, 4_760_000, 3_300_000, slide.bullets.map((item) => paragraph(item, { size: 1_160, color: palette.ink, bullet: true })).join(""));
      addShape("右侧视觉", 6_270_000, 1_900_000, 5_270_000, 3_900_000, { fill: palette.tint, radius: true });
      addShape("视觉中心", 7_700_000, 2_560_000, 2_400_000, 2_400_000, { fill: palette.accent, geometry: "ellipse", shadow: true });
      addText("视觉关键词", 7_830_000, 2_920_000, 2_140_000, 1_600_000, labels.slice(0, 3).map((label) => paragraph(label, { size: 1_150, color: "FFFFFF", bold: true, align: "ctr" })).join(""), { anchor: "ctr", margin: 20_000 });
    }

    addText("页脚来源", 650_000, 6_270_000, 8_900_000, 310_000,
      paragraph(slide.sourceRefs.length ? `依据：${slide.sourceRefs.join(" · ")}` : "依据：教师简报（事实内容请复核）", { size: 760, color: "718096" }));
    addText("页码", 10_150_000, 6_220_000, 1_400_000, 340_000,
      paragraph(`${String(slide.index).padStart(2, "0")} / ${String(plan.slides.length).padStart(2, "0")}`, { size: 820, color: palette.accent, bold: true, align: "r" }));
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="EduAI Prism 课件"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes.join("")}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function notesSlideXml(slide: CoursewareSlide, slideNumber: number): string {
  const note = slide.teacherNote || "本页暂无教师讲解提示。";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="幻灯片图像占位符"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="教师讲解提示"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paragraph(note, { size: 1_200, color: "243047" })}</p:txBody></p:sp><p:sp><p:nvSpPr><p:cNvPr id="4" name="页码占位符"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldNum" sz="quarter" idx="10"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{E2B2CE16-9330-4B06-A1D6-20A59B0EAA57}" type="slidenum"><a:rPr lang="zh-CN"/><a:t>${slideNumber}</a:t></a:fld><a:endParaRPr lang="zh-CN"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function notesMasterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="幻灯片图像占位符"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:solidFill><a:srgbClr val="9AA6BC"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="教师讲解提示占位符"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="zh-CN"/></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;
}

function imageSlideXml(slide: CoursewareSlide): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld name="${xml(slide.title)}"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="AI成品页图" descr="${xml(slide.title)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId3"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${WIDTH}" cy="${HEIGHT}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

export async function coursewarePlanToPptx(plan: CoursewarePlan, images?: Buffer[]): Promise<Buffer> {
  if (images && (images.length !== plan.slides.length || images.some((item) => !item.length))) throw new Error("incomplete_slide_images");
  const zip = new JSZip();
  const slides = plan.slides;
  const slideOverrides = slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const notesOverrides = slides.map((_, index) => `<Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}${notesOverrides}</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`);
  const now = new Date().toISOString();
  zip.file("docProps/core.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(plan.title)}</dc:title><dc:creator>EduAI Prism</dc:creator><cp:lastModifiedBy>EduAI Prism</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
  zip.file("docProps/app.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>EduAI Prism</Application><PresentationFormat>宽屏</PresentationFormat><Slides>${slides.length}</Slides><Company>EduAI Prism</Company><AppVersion>1.0</AppVersion></Properties>`);
  const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join("");
  const notesMasterRelationshipId = slides.length + 2;
  const presPropsRelationshipId = slides.length + 3;
  const viewPropsRelationshipId = slides.length + 4;
  const themeRelationshipId = slides.length + 5;
  const tableStylesRelationshipId = slides.length + 6;
  zip.file("ppt/presentation.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId${notesMasterRelationshipId}"/></p:notesMasterIdLst><p:sldSz cx="${WIDTH}" cy="${HEIGHT}" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>`);
  const presentationRels = slides.map((_, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
  zip.file("ppt/_rels/presentation.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${presentationRels}<Relationship Id="rId${notesMasterRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/><Relationship Id="rId${presPropsRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId${viewPropsRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/><Relationship Id="rId${themeRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${tableStylesRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/></Relationships>`);
  zip.file("ppt/presProps.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>`);
  zip.file("ppt/viewProps.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:normalViewPr horzBarState="maximized"><p:restoredLeft sz="15611"/><p:restoredTop sz="94610"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr snapToGrid="0" snapToObjects="1"><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="1" d="1"/><a:sy n="1" d="1"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
  zip.file("ppt/tableStyles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
  zip.file("ppt/slideMasters/slideMaster1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:hf sldNum="0" hdr="0" ftr="0" dt="0"/><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
  zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file("ppt/slideLayouts/slideLayout1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank"><p:cSld name="空白"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`);
  zip.file("ppt/slideLayouts/_rels/slideLayout1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
  zip.file("ppt/notesMasters/notesMaster1.xml", notesMasterXml());
  zip.file("ppt/notesMasters/_rels/notesMaster1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
  zip.file("ppt/theme/theme1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="EduAI Prism"><a:themeElements><a:clrScheme name="EduAI Prism"><a:dk1><a:srgbClr val="17233D"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="243047"/></a:dk2><a:lt2><a:srgbClr val="F7F9FC"/></a:lt2><a:accent1><a:srgbClr val="3157D5"/></a:accent1><a:accent2><a:srgbClr val="159B80"/></a:accent2><a:accent3><a:srgbClr val="E8992E"/></a:accent3><a:accent4><a:srgbClr val="D95A6F"/></a:accent4><a:accent5><a:srgbClr val="6E60D7"/></a:accent5><a:accent6><a:srgbClr val="3A99C9"/></a:accent6><a:hlink><a:srgbClr val="3157D5"/></a:hlink><a:folHlink><a:srgbClr val="6E60D7"/></a:folHlink></a:clrScheme><a:fontScheme name="EduAI Prism"><a:majorFont><a:latin typeface="Aptos Display"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="EduAI Prism"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="85000"/></a:schemeClr></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="97000"/></a:schemeClr></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:shade val="90000"/></a:schemeClr></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`);
  slides.forEach((slide, index) => {
    if (images) zip.file(`ppt/media/slide${index + 1}.png`, images[index]);
    zip.file(`ppt/slides/slide${index + 1}.xml`, images ? imageSlideXml(slide) : slideXml(plan, slide));
    zip.file(`ppt/slides/_rels/slide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${index + 1}.xml"/>${images ? `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/slide${index + 1}.png"/>` : ""}</Relationships>`);
    zip.file(`ppt/notesSlides/notesSlide${index + 1}.xml`, notesSlideXml(slide, index + 1));
    zip.file(`ppt/notesSlides/_rels/notesSlide${index + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${index + 1}.xml"/></Relationships>`);
  });
  if (images) {
    const contentTypes = await zip.file("[Content_Types].xml")!.async("string");
    zip.file("[Content_Types].xml", contentTypes.replace("</Types>", '<Default Extension="png" ContentType="image/png"/></Types>'));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
