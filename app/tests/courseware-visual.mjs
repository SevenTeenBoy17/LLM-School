import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import JSZip from "jszip";
import {
  assessCoursewarePlan,
  buildFallbackCoursewarePlan,
} from "../lib/courseware/core.ts";
import { coursewarePlanToPptx } from "../lib/courseware/pptx.ts";

const samples = [
  {
    slug: "geography-asia-monsoon",
    brief: {
      operationId: "sample-geography-0001",
      subject: "地理",
      grade: "八年级",
      topic: "亚洲季风气候与河流分布",
      slideCount: 8,
      objectives: ["在地图上定位主要季风区", "用地形与季风证据解释河流分布", "比较东亚、南亚与西亚的区域差异"],
      style: "clear",
      sourceSummary: "使用教材地图，所有边界和数据由教师复核。",
      uploadIds: [],
    },
    references: ["亚洲东部和南部季风气候显著。", "中部高原山地影响水系与气流。", "地图边界、河流名称与数据须以教材为准。"],
    requiredLayouts: ["map-focus", "comparison", "data-story"],
  },
  {
    slug: "physics-ohms-law",
    brief: {
      operationId: "sample-physics-0002",
      subject: "物理",
      grade: "九年级",
      topic: "欧姆定律及其应用",
      slideCount: 8,
      objectives: ["识别电流、电压与电阻的关系", "设计控制变量实验", "用证据解释电路现象"],
      style: "academic",
      sourceSummary: "实验数据与单位由教师根据教材和真实测量补充。",
      uploadIds: [],
    },
    references: ["实验时应保持除研究变量外的其他条件不变。", "电流、电压、电阻的数值和单位必须依据真实记录。"],
    requiredLayouts: ["formula", "experiment", "process"],
  },
  {
    slug: "history-silk-road",
    brief: {
      operationId: "sample-history-0003",
      subject: "历史",
      grade: "七年级",
      topic: "丝绸之路上的交流与互鉴",
      slideCount: 8,
      objectives: ["在时空坐标中梳理交流路线", "区分史料信息与历史解释", "用证据说明交流的双向性"],
      style: "warm",
      sourceSummary: "人物、年代、路线与材料出处由教师依据教材复核。",
      uploadIds: [],
    },
    references: ["路线、人物、年代与史料出处须回到教材核验。", "比较不同材料时要说明来源、立场和可支持的结论。"],
    requiredLayouts: ["timeline", "comparison", "process"],
  },
];

const outputDir = process.env.COURSEWARE_SAMPLE_DIR ? resolve(process.env.COURSEWARE_SAMPLE_DIR) : null;
if (outputDir) await mkdir(outputDir, { recursive: true });

const report = [];
for (const sample of samples) {
  const plan = buildFallbackCoursewarePlan(sample.brief, sample.references);
  const quality = assessCoursewarePlan(plan);
  assert.equal(plan.schemaVersion, "courseware.v2");
  assert.equal(quality.issues.length, 0, `${sample.slug} has blocking quality issues`);
  assert.equal(quality.visualCoverage, 100, `${sample.slug} lacks visual coverage`);
  assert.ok(quality.layoutVariety >= 7, `${sample.slug} repeats too few layouts`);
  assert.ok(quality.editableObjectEstimate >= 140, `${sample.slug} has too few editable objects`);
  for (const layout of sample.requiredLayouts) {
    assert.ok(plan.slides.some((slide) => slide.layout === layout), `${sample.slug} missing ${layout}`);
  }

  const bytes = await coursewarePlanToPptx(plan);
  const zip = await JSZip.loadAsync(bytes);
  const slideNames = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  assert.equal(slideNames.length, sample.brief.slideCount);
  let editableShapeCount = 0;
  for (const name of slideNames) {
    const source = await zip.file(name).async("string");
    assert.equal(source.includes("<p:pic>"), false, `${sample.slug} contains a flattened slide image`);
    const shapeCount = (source.match(/<p:sp>/g) ?? []).length;
    editableShapeCount += shapeCount;
    assert.ok(shapeCount >= 10, `${name} has only ${shapeCount} editable shapes`);
  }
  assert.match(await zip.file("ppt/notesSlides/notesSlide2.xml").async("string"), /教师|证据|核对/);

  if (outputDir) {
    await writeFile(join(outputDir, `${sample.slug}.pptx`), bytes);
    await writeFile(join(outputDir, `${sample.slug}.json`), JSON.stringify({ plan, quality, editableShapeCount }, null, 2));
  }
  report.push({ slug: sample.slug, slides: plan.slides.length, layouts: quality.layoutVariety, score: quality.score, editableShapeCount, bytes: bytes.length });
}

console.log(JSON.stringify({ ok: true, samples: report, outputDir }, null, 2));
