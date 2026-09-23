import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import sharp from "sharp";
import { startIsolatedManorDevServer, launchManorBrowser, RESULTS_DIR, assertMinimumHitTargets, assertNoHorizontalOverflow } from "./manor-v5-helpers.mjs";

const directory = mkdtempSync(join(tmpdir(), "eduai-manor-v6-ui-"));
const shots = join(RESULTS_DIR, "manor-v6");
mkdirSync(shots, { recursive: true });
let server, browser, database, page;
const checks = [], failures = [], external = [], pageErrors = [], consoleErrors = [], manorResponses = [], failedRequests = [];
const isManorRequest = (url) => {const path = new URL(url).pathname;return path.startsWith("/api/v2/manor") || path === "/api/manor";};
const op = () => `ui-${crypto.randomUUID()}`;
// v6 baseline: reviewed layered original art, not the retired QQ-derived baked scene.
const VISUAL_BASELINE = "E548403C2942B8EC58723C9278395ED416E9876D3668871BAC283FD3C46503F281C4D37B9991880F648FC367D19F90C92339FC32A63A730B3CCF99CB30E3C61E0CD1F02F075B381B31F5B53168D41563";
async function visualDistance(path) {
  const {data}=await sharp(path).resize(33,20,{fit:"fill"}).greyscale().raw().toBuffer({resolveWithObject:true});
  let bits="";
  for(let y=0;y<20;y++)for(let x=0;x<32;x++)bits+=data[y*33+x]>data[y*33+x+1]?"1":"0";
  let distance=0;
  for(let i=0;i<bits.length;i+=4)distance+=(Number.parseInt(bits.slice(i,i+4),2)^Number.parseInt(VISUAL_BASELINE[i/4],16)).toString(2).replaceAll("0","").length;
  return distance;
}
try {
  server = await startIsolatedManorDevServer({ label: "manor-v6-ui", tempDbDir: directory });
  browser = await launchManorBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if(message.type()==="error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if(isManorRequest(response.url())) manorResponses.push({url:response.url(),status:response.status()}); });
  page.on("requestfailed", (request) => {if(isManorRequest(request.url()))failedRequests.push({url:request.url(),error:request.failure()?.errorText});});
  page.on("request", (request) => { const url = new URL(request.url()); if (!['127.0.0.1', 'localhost'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) external.push(url.href); });
  const login = await context.request.post(`${server.base}/api/auth/login`, { data: { username: "student", password: "Student@123" } });
  assert.equal(login.status(), 200);
  database = new DatabaseSync(join(directory, "eduai.sqlite")); database.exec("PRAGMA busy_timeout=5000");
  // An explicitly isolated public-layout fixture makes the visit assertion mandatory.
  database.prepare("INSERT INTO manor_items (id,userId,partId,x,y,acquiredAt) VALUES (?,?,?,?,?,?)").run("v6-public-fixture", "u-student-p", "tree", 1, 1, Date.now());
  const bootstrap = async () => { const response = await context.request.get(`${server.base}/api/v2/manor/bootstrap`); assert.equal(response.status(), 200); return response.json(); };
  const ready = () => page.locator('[data-testid="manor-stage"][data-scenario="normal"]').waitFor({ state: "visible" });
  const shot = async (name) => { await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: join(shots, `${name}.png`), animations: "disabled" }); };
  const close = () => page.getByRole("dialog").getByRole("button", { name: "关闭", exact: true }).click();
  const closeLearning = () => page.getByRole("button", { name: "关闭学习面板" }).click();
  const saveClick = async (button, route) => { const response = page.waitForResponse((item) => item.url().includes(route) && item.request().method() === "POST"); await button.click(); assert.equal((await response).ok(), true, `Save failed: ${route}`); await page.getByRole("dialog").locator('[aria-busy="true"]').waitFor({ state: "hidden" }).catch(() => undefined); };
  await page.goto(`${server.base}/student/manor`, { waitUntil: "networkidle" }); await ready();
  await shot("desktop-initial");
  assert.ok(statSync(join(shots,"desktop-initial.png")).size>600_000,"visual screenshot is unexpectedly small");
  const distance=await visualDistance(join(shots,"desktop-initial.png"));
  assert.ok(distance<=48,`visual composition drifted by ${distance}/640 bits`);
  assert.equal(await page.locator('[data-testid="plot-grid"] button').count(), 24);
  const initial = await bootstrap();
  assert.equal(initial.plots.length, 24);
  for (const plot of initial.plots) {
    assert.equal(await page.locator(`[data-plot="${plot.id}"]`).getAttribute("data-crop"), plot.cropId ?? "empty");
    assert.equal(await page.locator(`[data-plot="${plot.id}"]`).getAttribute("data-stage"), String(plot.stage));
  }
  await assertNoHorizontalOverflow(page, "desktop");
  await assertMinimumHitTargets(page.locator('header[data-testid="farm-chrome"] button,header[data-testid="farm-chrome"] a'), "desktop chrome");
  await assertMinimumHitTargets(page.locator('[aria-label="学习空间"] button,[aria-label="庄园拓展"] button,[aria-label="农具"] button'), "farm controls");
  const stats = await sharp(join(shots, "desktop-initial.png")).stats();
  assert.ok(stats.channels.some((channel) => channel.stdev > 20), "scene must not be blank");
  const bounds = await page.locator('[data-testid="plot-grid"] button').evaluateAll((buttons) => buttons.map((button) => { const r = button.getBoundingClientRect(); const top = document.querySelector('[data-testid="farm-chrome"]').getBoundingClientRect().bottom; return { id:button.dataset.plot, visible:r.left >= 0 && r.right <= innerWidth && r.top > top && r.bottom < innerHeight - 90 }; }));
  assert.ok(bounds.every((item) => item.visible), JSON.stringify(bounds));
  checks.push("24 server-driven plots, nonblank generated scene, bounds, targets and no overflow");
  for(const plot of initial.plots){
    const hit=page.locator(`[data-plot="${plot.id}"]`), box=await hit.boundingBox();
    for(const [x,y] of [[.35,.35],[.65,.35],[.35,.65],[.65,.65]]){
      await hit.click({position:{x:box.width*x,y:box.height*y}});
      await page.getByRole("heading",{name:`第 ${plot.id+1} 块田`,exact:true}).waitFor();await close();
    }
  }
  checks.push("96 real clicks across every diamond interior select the exact plot, without forced clicks");

  const help = page.getByRole("button", { name: "庄园规则" }); await help.click();
  assert.equal(await page.getByTestId("manor-background").getAttribute("inert"), "");
  await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => Boolean(document.activeElement.closest('[role="dialog"]'))), true);
  await page.keyboard.press("Escape"); await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "庄园规则");
  await page.locator('[data-plot="12"]').click(); await page.getByRole("heading", { name: "这块土地暂未开放" }).waitFor();
  assert.doesNotMatch(await page.getByRole("dialog").innerText(), /320|第 42 级/); await close();
  await page.locator('[data-plot="3"]').click();
  await saveClick(page.getByRole("button", { name: /时间麦穗.*可播种/ }), "/plots/3/actions");
  await page.getByRole("heading", { name: "时间麦穗" }).waitFor(); await shot("plot-detail"); await close();
  await page.reload({ waitUntil:"networkidle" }); await ready();
  assert.equal(await page.locator('[data-plot="3"]').getAttribute("data-crop"), "wheat");
  checks.push("focus trap/restore, honest reserved plots, real planting and reload persistence");

  await page.getByRole("button", { name:"今日任务", exact:true }).click();
  await shot("mission-open");
  await page.getByLabel("学习任务", { exact:true }).selectOption("reading-clue-01");
  await page.getByTestId("answer-b").check();
  await saveClick(page.getByTestId("evidence-submit"), "/evidence");
  await page.getByRole("button", { name:"写下反思", exact:true }).waitFor();
  assert.equal((await bootstrap()).daily.completed, false);
  await page.getByRole("button", { name:"写下反思", exact:true }).click();
  const reflection = "我先找原句中的动作词，再用具体的词语解释。下次用另一段文字验证。";
  await page.getByRole("textbox", { name:"哪种方法帮助了你？下次准备怎样验证？" }).fill(reflection);
  await saveClick(page.getByRole("button", { name:"保存反思", exact:true }), "/task-runs");
  await closeLearning(); await page.reload({ waitUntil:"networkidle" }); await ready();
  await page.getByRole("button", { name:"今日任务", exact:true }).click();
  assert.equal(await page.getByRole("textbox", { name:"哪种方法帮助了你？下次准备怎样验证？" }).inputValue(), reflection);
  await page.getByRole("button", { name:"安排复习并结束本次任务", exact:true }).click();
  await page.getByTestId("learning-summary").waitFor(); await shot("learning-summary");
  let current = await bootstrap(); assert.equal(current.daily.completed, true); assert.equal(current.taskRuns[0].reflection, reflection); assert.ok(current.taskRuns[0].artifactId);
  checks.push("answer is not completion; reflection save/reload; review plus reflection artifact completes task");

  await closeLearning(); await page.getByRole("button", { name:"记忆温室", exact:true }).click();
  await page.getByRole("button", { name:/已安排/ }).click(); await page.getByRole("button", { name:"查看记录", exact:true }).first().click();
  await page.getByTestId("review-editor").waitFor();
  assert.equal(await page.getByRole("button", { name:"提交复习", exact:true }).count(), 0);
  await saveClick(page.getByRole("button", { name:"延期", exact:true }).first(), "/actions");
  current = await bootstrap(); const review = current.reviews[0];
  database.prepare("UPDATE review_schedules SET dueAt=? WHERE id=?").run(Date.now()-1000, review.id);
  await page.getByRole("button", { name:"刷新学习记录" }).click();
  await page.getByRole("button", { name:/待复习/ }).click(); await page.getByRole("button", { name:"开始复习", exact:true }).click();
  await page.getByTestId("review-editor").getByRole("radio").nth(2).check();
  await saveClick(page.getByRole("button", { name:"提交复习", exact:true }), "/actions");
  assert.equal((await bootstrap()).reviews[0].status, "completed");
  checks.push("scheduled read-only, defer, isolated due-time fixture and real review result");

  await closeLearning();
  await page.getByRole("button", {name:"照料 · 8 点",exact:true}).click();
  await saveClick(page.locator('[data-plot="3"]'), "/plots/3/actions");
  assert.equal((await bootstrap()).plots.find((item)=>item.id===3).stage, 1);
  await page.getByRole("link",{name:"查看学习记录",exact:true}).click();
  await page.getByTestId("historical-evidence").waitFor();
  assert.ok((await page.getByTestId("historical-evidence").innerText()).includes(reflection));
  assert.equal(await page.getByTestId("historical-evidence").getByRole("radio").count(),0);
  await page.goto(`${server.base}/student/manor`,{waitUntil:"networkidle"});await ready();
  // Earn a second legitimate grant through the API; the two plot actions remain browser clicks.
  assert.equal((await context.request.post(`${server.base}/api/v2/manor/evidence`,{data:{operationId:op(),missionId:"math-pattern-01",answer:"B"}})).status(),200);
  await page.reload({waitUntil:"networkidle"});await ready();
  await page.getByRole("button", {name:"照料 · 8 点",exact:true}).click();
  await saveClick(page.locator('[data-plot="3"]'), "/plots/3/actions");
  assert.equal((await bootstrap()).plots.find((item)=>item.id===3).stage,2);await close();
  assert.equal((await context.request.post(`${server.base}/api/v2/manor/evidence`,{data:{operationId:op(),missionId:"science-leaf-01",answer:"A"}})).status(),200);
  await page.reload({waitUntil:"networkidle"});await ready();
  await page.getByRole("button", {name:"照料 · 8 点",exact:true}).click();
  await saveClick(page.locator('[data-plot="3"]'), "/plots/3/actions");
  assert.equal((await bootstrap()).plots.find((item)=>item.id===3).stage,3);await close();
  await page.getByRole("button", {name:"收获",exact:true}).click();
  await saveClick(page.locator('[data-plot="3"]'), "/plots/3/actions");
  assert.equal((await bootstrap()).resources.harvestedTotal,1);await close();
  await page.getByRole("button",{name:"查看 / 播种",exact:true}).click();
  await page.locator('[data-plot="3"]').click();
  await saveClick(page.getByRole("button",{name:/时间麦穗.*可播种/}),"/plots/3/actions");await close();
  checks.push("three real nurture actions, immutable evidence deep-link, split grants, harvest receipt and replant");

  await page.getByRole("button", { name:"创作工坊", exact:true }).click();
  await page.getByLabel("学习任务", { exact:true }).selectOption("water-math-middle");
  const original = "以常规用水为基准，我认为少用了25升。还应说明这是模拟数据。";
  await page.getByRole("textbox", { name:"作品内容" }).fill(original);
  await page.getByLabel("作品标题", { exact:true }).fill("节水观察记录");
  const energy = (await bootstrap()).resources.growthEnergy;
  await saveClick(page.getByRole("button", { name:"保存作品", exact:true }), "/artifacts");
  assert.equal((await bootstrap()).resources.growthEnergy, energy);
  await saveClick(page.getByRole("button", { name:"提交老师", exact:true }), "/evidence");
  current = await bootstrap(); const expression = current.evidence.find((item) => item.missionId === "water-math-middle" && item.evidenceType === "expression"); assert.ok(expression);
  const teacher = await browser.newContext(); assert.equal((await teacher.request.post(`${server.base}/api/auth/login`, { data:{username:"teacher", password:"Teacher@123"} })).status(), 200);
  const decision = (status, revision, reason) => teacher.request.post(`${server.base}/api/v2/teacher/manor/evidence/${expression.id}/decisions`, {data:{operationId:op(),status,expectedRevision:revision,reason}});
  assert.equal((await decision("revise",1,"请明确计算基准，并说明模拟数据的限制。" )).status(),200);
  await page.getByRole("button", {name:"刷新学习记录"}).click(); await page.getByText("请明确计算基准，并说明模拟数据的限制。",{exact:true}).waitFor();
  const revised="以常规100升为基准，少用25升即25%；这是模拟数据，需要多次真实观察才能下结论。";
  await page.getByRole("textbox",{name:"作品内容"}).fill(revised); await saveClick(page.getByRole("button",{name:"提交修订",exact:true}),"/evidence");
  assert.equal((await decision("accepted_mastery",3,"计算基准明确，保留了模拟数据限制。" )).status(),200);
  await page.getByRole("button", {name:"刷新学习记录"}).click(); await page.getByRole("button",{name:"老师已接受",exact:true}).waitFor(); await shot("teacher-feedback");
  current=await bootstrap(); const archive=current.artifacts.find((item)=>item.evidenceId===expression.id && item.status==="archived"); assert.equal(archive.content,revised);
  const report=await (await context.request.get(`${server.base}/api/portfolio/summary?mode=full`)).json(); assert.equal(report.manorArtifacts.find((item)=>item.id===archive.id).content,revised);
  await teacher.close(); checks.push("free draft, teacher revision, exact resubmission, approved archive and portfolio round trip");

  await page.goto(`${server.base}/student/growth`,{waitUntil:"networkidle"});
  await page.getByRole("tab",{name:"档案袋",exact:true}).click();
  const archiveEntry=page.getByRole("region",{name:"成长记录",exact:true}).getByRole("listitem").filter({hasText:revised});
  await archiveEntry.waitFor();await shot("growth-portfolio");
  await assertMinimumHitTargets(archiveEntry.getByRole("link",{name:/查看庄园成果/}),"portfolio source link");
  await archiveEntry.getByRole("link",{name:/查看庄园成果/}).click();
  await page.waitForURL(`**/student/manor?artifactId=${encodeURIComponent(archive.id)}`);await ready();
  await page.locator(`[id="manor-artifact-${archive.id}"]`).waitFor();
  assert.ok((await page.locator(`[id="manor-artifact-${archive.id}"]`).innerText()).includes(revised));
  await closeLearning(); await page.getByTestId("warehouse-button").click(); await page.getByRole("textbox",{name:"搜索仓库"}).fill("时间麦穗");
  assert.equal(await page.getByRole("dialog").getByText("时间麦穗",{exact:true}).count(),1); await close();
  await page.getByTestId("friend-dock").click();
  assert.ok(current.neighbors.length > 0,"Public same-class fixture must be visitable");
  await page.getByRole("dialog").getByRole("button",{name:new RegExp(current.neighbors[0].name)}).click();await page.getByText("只读参观，不展示积分、答题和学习评价。",{exact:true}).waitFor(); assert.equal(await page.getByRole("dialog").getByRole("button",{name:/照料|播种|清理/}).count(),0); await close();
  checks.push("warehouse filter, actual classmates and read-only public visit");
  await page.goto(`${server.base}/student/manor`,{waitUntil:"networkidle"});await ready();
  for(const size of [{width:390,height:844},{width:667,height:375},{width:768,height:1024},{width:1024,height:768},{width:1920,height:1080}]){
    await page.setViewportSize(size);await page.reload({waitUntil:"networkidle"});await ready();await assertNoHorizontalOverflow(page,`${size.width}`);await shot(`viewport-${size.width}`);
    if(size.width===390){assert.equal(await page.getByRole("region",{name:"农田清单"}).getByRole("button").count(),24);await page.getByRole("button",{name:/第 4 块田/}).click();await page.getByRole("heading",{name:"时间麦穗",exact:true}).waitFor();await shot("mobile-plot");await close();}
    if(size.width===667){const box=await page.getByRole("region",{name:"农田清单"}).boundingBox();assert.ok(box.height>=100,"Landscape farm list collapsed");}
  }
  checks.push("390/667/768/1024/1440/1920 responsive layouts, stable 24 IDs and mobile inspection");
  await page.getByRole("button",{name:"结束今日学习",exact:true}).click();await saveClick(page.getByRole("button",{name:"确认结束今日学习",exact:true}),"/session/end");assert.ok((await bootstrap()).profile.quietUntil>Date.now());await closeLearning();
  await page.locator('[data-plot="3"]').click();await page.getByText("舒缓模式中，仅查看，不扣减资源。",{exact:true}).waitFor();await close();
  checks.push("real session end, quiet state returned, plots still inspectable");
  await page.getByRole("link",{name:"关闭农场",exact:true}).click();await page.waitForURL("**/student/home");
  assert.deepEqual(external,[]);assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);assert.ok(manorResponses.some((response)=>new URL(response.url).pathname==="/api/manor"),"Public visit must return a legacy API response");assert.ok(manorResponses.every((response)=>response.status<400),JSON.stringify(manorResponses));
  checks.push("real exit route, no page exceptions and no external resource requests");
  console.log(JSON.stringify({ok:true,checks,screenshots:shots},null,2));
} catch(error){failures.push(String(error.stack??error));console.error(error);if(page){await page.screenshot({path:join(shots,"failure.png")}).catch(()=>{});console.error((await page.locator("body").innerText()).slice(-6000));}process.exitCode=1;}
finally{
  writeFileSync(join(shots,"report.json"),JSON.stringify({ok:failures.length===0,checks,failures,external,pageErrors,consoleErrors,manorResponses,failedRequests},null,2));
  database?.close();await browser?.close();await server?.cleanup();
  const target=resolve(directory);if(!target.startsWith(resolve(tmpdir())+sep)||!basename(target).startsWith("eduai-manor-v6-ui-"))throw new Error("Unsafe cleanup target");
  rmSync(target,{recursive:true,force:true,maxRetries:10,retryDelay:200});
}
