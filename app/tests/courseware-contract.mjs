import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import {
  CoursewareBriefSchema,
  assessCoursewarePlan,
  buildFallbackCoursewarePlan,
  parsePlannerReply,
} from "../lib/courseware/core.ts";
import { coursewarePlanToPptx } from "../lib/courseware/pptx.ts";

const BRIEF = {
  operationId: "op-courseware-001",
  subject: "信息科技",
  grade: "八年级",
  topic: "校园节水数据分析",
  slideCount: 8,
  objectives: ["读懂一周用水量变化", "用证据提出节水建议"],
  style: "clear",
  sourceSummary: "学生已经完成七天水表读数记录。",
  uploadIds: [],
};

test("courseware brief enforces the bounded teacher contract", () => {
  assert.equal(CoursewareBriefSchema.parse(BRIEF).slideCount, 8);
  assert.equal(CoursewareBriefSchema.safeParse({ ...BRIEF, slideCount: 30 }).success, false);
  assert.equal(CoursewareBriefSchema.safeParse({ ...BRIEF, topic: "x" }).success, false);
});

test("fallback plan is deterministic, complete, and honest", () => {
  const first = buildFallbackCoursewarePlan(BRIEF, ["七天水表读数记录"]);
  const second = buildFallbackCoursewarePlan(BRIEF, ["七天水表读数记录"]);
  assert.deepEqual(first, second);
  assert.equal(first.slides.length, 8);
  assert.equal(new Set(first.slides.map((slide) => slide.id)).size, 8);
  assert.equal(first.schemaVersion, "courseware.v2");
  assert.ok(new Set(first.slides.map((slide) => slide.layout)).size >= 5);
  assert.equal(first.slides.every((slide) => slide.visual && slide.subtitle !== undefined), true);
  assert.ok(first.reviewNotes.some((note) => note.includes("教师复核")));
  const quality = assessCoursewarePlan(first);
  assert.deepEqual(quality.issues, []);
  assert.equal(quality.visualCoverage, 100);
  assert.ok(quality.editableObjectEstimate >= first.slides.length * 12);
});

test("planner JSON is normalized without accepting duplicate or short plans", () => {
  const seed = buildFallbackCoursewarePlan(BRIEF, []);
  const remote = {
    ...seed,
    title: "校园节水课堂课件",
    slides: seed.slides.map((slide, index) => ({ ...slide, title: `${index + 1}. ${slide.title}` })),
  };
  const parsed = parsePlannerReply(`\`\`\`json\n${JSON.stringify(remote)}\n\`\`\``, BRIEF);
  assert.ok(parsed);
  assert.equal(parsed.slides.length, 8);
  assert.equal(assessCoursewarePlan(parsed).issues.length, 0);
  const repairable = {
    ...remote,
    designIntent: `${"课堂项目学习；".repeat(80)}由教师复核。`,
    reviewNotes: ["核对数据。".repeat(80)],
    slides: remote.slides.map((slide) => ({
      ...slide,
      id: "model-id",
      index: 99,
      teacherNote: "讲解提示。".repeat(100),
    })),
  };
  const repaired = parsePlannerReply(JSON.stringify(repairable), BRIEF);
  assert.ok(repaired);
  assert.equal(repaired.designIntent.length <= 500, true);
  assert.equal(repaired.slides[0].index, 1);
  assert.equal(repaired.slides[0].teacherNote.length <= 400, true);
  const duplicate = { ...remote, slides: remote.slides.map((slide) => ({ ...slide, title: "同一页" })) };
  assert.equal(parsePlannerReply(JSON.stringify(duplicate), BRIEF), null);
  assert.equal(parsePlannerReply(JSON.stringify({ ...remote, slides: remote.slides.slice(0, 4) }), BRIEF), null);
});

test("server PPTX is a valid editable OOXML package and escapes user text", async () => {
  const plan = buildFallbackCoursewarePlan({ ...BRIEF, topic: "校园节水 <script>alert(1)</script>" }, []);
  plan.slides[0].title = "校园节水 <script>alert(1)</script> 😀 \u0000 \u000b";
  plan.slides[0].teacherNote = "教师提示：先核对 <原始记录> 再讲解。";
  const bytes = await coursewarePlanToPptx(plan);
  assert.equal(bytes.subarray(0, 2).toString("ascii"), "PK");
  const zip = await JSZip.loadAsync(bytes);
  for (const required of [
    "ppt/presentation.xml",
    "ppt/slideMasters/slideMaster1.xml",
    "ppt/slideLayouts/slideLayout1.xml",
    "ppt/notesMasters/notesMaster1.xml",
    "ppt/theme/theme1.xml",
    "ppt/slides/slide1.xml",
    "ppt/notesSlides/notesSlide1.xml",
  ]) assert.ok(zip.file(required), `missing ${required}`);
  const xml = await zip.file("ppt/slides/slide1.xml").async("string");
  const notes = await zip.file("ppt/notesSlides/notesSlide1.xml").async("string");
  const slideRels = await zip.file("ppt/slides/_rels/slide1.xml.rels").async("string");
  const viewProps = await zip.file("ppt/viewProps.xml").async("string");
  const slideMaster = await zip.file("ppt/slideMasters/slideMaster1.xml").async("string");
  const theme = await zip.file("ppt/theme/theme1.xml").async("string");
  assert.equal(xml.includes("<script>"), false);
  assert.ok(xml.includes("&lt;script&gt;"));
  assert.ok(notes.includes("教师提示"));
  assert.ok(notes.includes("&lt;原始记录&gt;"));
  assert.ok(xml.includes("😀"));
  assert.equal(xml.includes("\u0000"), false);
  assert.equal(xml.includes("\u000b"), false);
  assert.match(slideRels, /relationships\/notesSlide/);
  assert.match(viewProps, /<p:restoredLeft/);
  assert.match(viewProps, /<p:cSldViewPr/);
  assert.match(slideMaster, /<p:sldLayoutId id="2147483649"/);
  assert.equal((theme.match(/<a:effectStyle>/g) ?? []).length, 3);
});

test("editable structure preserves every bullet for all supported layouts", async () => {
  const layouts = ["cover", "split", "cards", "timeline", "practice", "summary", "map-focus", "comparison", "process", "experiment", "data-story", "formula"];
  for (const count of [1, 2, 3, 5]) {
    const plan = buildFallbackCoursewarePlan({ ...BRIEF, slideCount: 12 }, []);
    assert.equal(plan.slides.length, layouts.length, "layout coverage requires one slide per layout");
    plan.slides.forEach((slide, index) => { slide.layout = layouts[index]; slide.bullets = Array.from({ length: count }, (_, b) => `unique_bullet_${index}_${b}`); slide.visual.labels = ["one visual label"]; });
    const zip = await JSZip.loadAsync(await coursewarePlanToPptx(plan));
    for (const slide of plan.slides) {
      const xml = await zip.file(`ppt/slides/slide${slide.index}.xml`).async("string");
      for (const bullet of slide.bullets) assert.ok(xml.includes(bullet), `${slide.layout} lost ${bullet}`);
    }
  }
});
