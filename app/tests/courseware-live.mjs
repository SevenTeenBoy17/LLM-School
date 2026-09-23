// Explicit live acceptance run. Uses the running app, never reads or logs gateway credentials.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import JSZip from "jszip";

const base = process.env.COURSEWARE_BASE || "http://127.0.0.1:4921";
const topic = process.argv[3] === "water" ? "water" : "geography";
const out = resolve(`../.agent-supervisor/courseware-acceptance-20260905${topic === "water" ? "-water" : ""}`);
mkdirSync(out, { recursive: true });
const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "teacher", password: "Teacher@123" }) });
assert.equal(login.status, 200, "teacher login");
const cookie = login.headers.get("set-cookie").split(";", 1)[0];
async function request(path, body) {
  const response = await fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}
const phase = process.argv[2] || "plan";
const planFile = join(out, `${topic}-deck.json`);
if (phase === "plan") {
  const geography = {
    operationId: "live-geography-20260905-image-migration-v1", subject: "地理", grade: "七年级", topic: "亚洲的自然与人文特征", slideCount: 6,
    objectives: ["读图解释亚洲的地势与河流流向", "比较东亚、南亚与西亚的自然和人文差异"], style: "clear", uploadIds: [],
    sourceSummary: "验收用教师知识提要（不是学生数据）：亚洲地势中部高、四周低；大河多发源于中部高原山地，呈放射状流向周边海洋。亚洲东部和南部季风气候显著，夏季风来自海洋，带来暖湿气流。东亚典型稻作区夏季高温多雨，平原和沿海人口密集；并非东亚所有地区都属季风气候。南亚夏季受西南季风影响，季风不稳定易导致旱涝。西亚大部分地区降水少，水资源短缺，绿洲农业零散，波斯湾沿岸石油资源丰富。教学安排：封面兼学习目标、地形与河流、季风与降水、东亚南亚西亚三栏比较、读图练习、因果链总结。必须至少一幅大型区域地形示意图和一页三栏场景对比。不绘政治国界，不编造人口或降水量数据。知识表述保留地域限定。",
  };
  const water = { operationId: "live-water-20260905-image-migration-v1", subject: "科学", grade: "五年级", topic: "水循环：一滴水的旅行", slideCount: 4,
    objectives: ["解释蒸发、凝结、降水和径流之间的联系", "用观察证据区分水蒸气与小水滴"], style: "clear", uploadIds: [],
    sourceSummary: "教师验收材料，依据 USGS Water Cycle Diagrams（https://www.usgs.gov/water-science-school/science/water-cycle-diagrams）。水在海洋、陆地和大气之间持续转移；水面蒸发与植物蒸腾使水进入大气。水蒸气遇冷凝结为小水滴，云中也可能有冰晶；水蒸气本身通常看不见。降水回到地表，形成地表径流或下渗进入土壤和地下水。太阳能驱动蒸发，重力影响降水、径流和地下水流动。设计四页：大场景封面与目标；海洋-陆地-云-地下水完整剖面循环图（每条箭头清晰标注过程）；透明密封袋少量常温水贴窗观察、禁止热水与明火、只能解释局部过程并不等同自然全循环；读图解释与迁移。画面要像高质量科学教材插图，有清晰图例和真实教学内容，不编造实验测量结果和百分比。",
  };
  const result = await request("/api/courseware/plan", topic === "water" ? water : geography);
  writeFileSync(planFile, JSON.stringify(result.authoritativeEntity, null, 2));
  console.log(JSON.stringify({ id: result.authoritativeEntity.id, source: result.authoritativeEntity.generationSource, slides: result.authoritativeEntity.plan.slides.map(s => ({ title: s.title, layout: s.layout, bullets: s.bullets })) }, null, 2));
} else {
  assert.ok(existsSync(planFile));
  const saved = JSON.parse(readFileSync(planFile, "utf8"));
  const deck = (await request(`/api/courseware/${saved.id}`)).deck;
  if (phase === "images") {
    for (const slide of deck.plan.slides) {
      const before = Date.now();
      await request(`/api/courseware/${deck.id}/visuals/${slide.id}`, { stateVersion: deck.stateVersion });
      console.log(`page ${slide.index} ready (${Math.round((Date.now() - before) / 1000)}s)`);
    }
  }
  const status = await request(`/api/courseware/${deck.id}/visuals`);
  writeFileSync(join(out, "visual-status.json"), JSON.stringify(status, null, 2));
  for (const item of status.items.filter(item => item.state === "ready")) {
    const image = await fetch(`${base}${item.imageUrl}`, { headers: { cookie } });
    assert.equal(image.status, 200);
    writeFileSync(join(out, `${item.slideId}.png`), Buffer.from(await image.arrayBuffer()));
  }
  if (phase === "download" || phase === "images") {
    for (const mode of ["visual", "editable"]) {
      const response = await fetch(`${base}/api/courseware/${deck.id}/download?mode=${mode}`, { headers: { cookie } });
      assert.equal(response.status, 200, `${mode} download`);
      const bytes = Buffer.from(await response.arrayBuffer());
      writeFileSync(join(out, `${topic}-${mode}.pptx`), bytes);
      const zip = await JSZip.loadAsync(bytes);
      assert.equal(Object.keys(zip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).length, deck.plan.slides.length);
      if (mode === "visual") for (const slide of deck.plan.slides) {
        assert.deepEqual(await zip.file(`ppt/media/slide${slide.index}.png`).async("nodebuffer"), readFileSync(join(out, `${slide.id}.png`)), "download differs from preview");
      }
      console.log(`${mode}: ${bytes.length} bytes, ${deck.plan.slides.length} slides verified`);
    }
  }
}
