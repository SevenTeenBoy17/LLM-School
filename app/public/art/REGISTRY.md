# 生图资产登记册（方案 §6.4-1）

本册登记**全站每一张 AI 生成的位图**。规则：**不知道的项写「未记录」，不写推测值**——
一份填满勾的登记册若有一格是猜的，整册的可信度就没了。

登记项（§6.4-1）：生成模型与版本 · 完整 prompt · 日期 · 许可证/商用条款出处 ·
七项合规打勾 · 该图主色（≤3，§1.2）。

七项 = 授权链 / 已知 IP 近似 / 真人相似性 / 年龄呈现 / 性别·肤色·民族刻板印象 /
宗教与政治符号 / AIGC 标识。

---

## 状态摘要（2026-08-03）

| 项 | 状态 |
|---|---|
| 已登记资产 | 本轮新增 **1 张聊天/首登引导物件插图**；历史门户、徽章与图标批次见下。原 8 张学科插画仍为下线状态 |
| 拟人化 AI 形象（吉祥物） | **2026-08-20 起限定解禁**：用户明示授权「数字徽章」资产走原创卡通拟人路线（仅限 badges/ 批次，7 只原创吉祥物）；门户/庄园美术仍守 §6.4-4 纯几何默认路径 |
| 独立盲审 | badges/ 批**已完成**（2026-08-20，独立上下文审查 agent ×3 镜头，未接触生成 prompt，三镜头全 pass，详见 badges 批次记录）；旧门户批**未完成** |
| 校方书面确认 | ❌ 未取得（§6.4-3：不作验收门，列为**上线前置条件**） |

> ⚠️ 新增 4 张的七项里，**第 1 项（授权链）与旧资产同样是不完整的**——见下方说明。
> 这次模型/prompt/日期都有记录，唯独第三方中转网关的**输出物权属条款我没有查到**，
> 因此按本册规矩写「未记录」而不是填一个看起来合规的推测。

---

## 已登记资产

### `edu-glass/prism-learning-workbench-v1.webp` —— 聊天与首登引导（2026-08-30）

**用途**：`/chat` 空态与全局首登引导的共享 3D 物件插图。图像不承载唯一信息，
页面以 DOM 文字提供等价说明，并明确标注「插图由 AI 生成」。

| 登记项 | 内容 |
|---|---|
| 生成模型与版本 | OpenAI 内置图像生成功能；调用界面未向本地暴露具体模型版本 |
| 完整 prompt | 见下方代码块 |
| 日期 | **2026-08-30** |
| 许可证/商用条款出处 | [OpenAI Terms of Use（2026-01-16 更新）](https://openai.com/policies/terms-of-use/) 的 Content 条款写明，在法律允许范围内，用户拥有 Output；上线前仍需由校方按实际账号地区与采购主体复核适用条款 |
| 体积与尺寸 | **36,754 bytes · 1000×750 WebP**（生成 PNG 经 `sharp` WebP q=82） |
| SHA-256 | `6E7D7FB33539C3729E956F251F8E7BC2C44362B8FABFEAD560569B53767BCF96` |

```text
Create a premium 3D cartoon still-life illustration for EduAI Prism onboarding and AI chat empty state, 4:3 landscape. NO people, NO robots, NO mascots, NO animals, NO faces, NO eyes, NO human body parts, NO character silhouettes. The subject is an inviting learning workbench: a translucent frosted-glass prism at the center casting restrained blue, mint, warm orange and lilac light onto an open blank book; a small wooden pencil, ruler, magnifying glass and two unlabeled books nearby. Calm light educational studio in powder blue and warm off-white, simple shelf geometry and frosted-glass wall panels. Soft clay/plastic 3D materials, tactile rounded forms, crisp silhouette, child-friendly without childish distraction, suitable for middle school through teachers. No text, no letters, no numbers, no formulas, no logos, no watermark, no checkerboard, no bokeh, no gradient orbs, no religious or political symbols. Generous negative space, straight-on product illustration, bright readable lighting, finished opaque background.
```

**七项合规自查**

| # | 项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 授权链 | ✅ 有来源记录，校方上线前复核 | 使用内置图像生成功能，条款链接与生成日期已登记 |
| 2 | 已知 IP 近似 | ✅ 未发现 | 仅为书、棱镜、尺、铅笔和放大镜等通用物件，无角色或品牌造型 |
| 3 | 真人相似性 | ✅ 无对象 | Prompt 明确禁人物、面孔、身体部位；成图目验无人形 |
| 4 | 年龄呈现 | ✅ 无对象 | 画面无人物 |
| 5 | 性别·肤色·民族刻板印象 | ✅ 无对象 | 画面无人物或身份标记 |
| 6 | 宗教与政治符号 | ✅ 无 | Prompt 显式禁止，成图目验未见相关符号 |
| 7 | AIGC 标识 | ✅ 已标注 | 聊天空态与首登引导均以 DOM 文字标注「插图由 AI 生成」 |

**主色**：粉蓝 / 暖白 / 木色；仅作为插图像素，不进入产品语义色令牌。

### `spot-*.webp` × 6 + `portal-cta.webp` —— 门户第二批（2026-08-10 上线）

**用途**：`/portal` 能力卡插图头（六张几何母题各对应一项真实能力）+ 页脚 CTA 带背景。
**全部按装饰图处理**——`alt=""` + `aria-hidden`，标题与描述承载全部信息；
能力区标注「卡片插图由 AI 生成」、CTA 区标注「背景美术由 AI 生成」。

| 文件 | 母题 | 体积 |
|---|---|---|
| `spot-chat.webp` | 双气泡轮廓 + 三个轨道点（AI 对话） | 6 KB |
| `spot-prompts.webp` | 扇形三卡叠 + 四角星芒（提示词库） | 7 KB |
| `spot-knowledge.webp` | 几何折面书 + 三道光线（知识库） | 9 KB |
| `spot-agents.webp` | 三个六边形模块连成三角网络（智能体） | 11 KB |
| `spot-imagegen.webp` | 双画框 + 角上小棱镜（AI 生图） | 8 KB |
| `spot-growth.webp` | 三级上升台阶 + 上扬弧线（成长记录） | 7 KB |
| `portal-cta.webp` | 光带自两缘向中心汇聚，中央三分之一留暗（CTA 带） | 18 KB |

| 登记项 | 内容 |
|---|---|
| 生成模型与版本 | **`gpt-image-2`**，经 `https://api.llm-token.cn/v1/images/generations` |
| 完整 prompt | 共用 STYLE 段与第一批相同（见下方第一批小节）；各张 subject 段逐字留存于 `scripts/gen-portal-art.mjs` 的 JOBS（脚本入库即留存） |
| 日期 | **2026-08-10** |
| 许可证/商用条款出处 | **未记录**——与第一批同一缺口（中转网关输出物权属条款未查到），仍是上线前置条件 |
| 体积 | 6–18 KB（spot 类 resize 640w / cta 1400w，WebP q=82） |

**主色（实测：缩 64×64、量化 32 级取前 3）**

| 文件 | 主色 1 | 主色 2 | 主色 3 |
|---|---|---|---|
| spot-chat | `#FFFFFF` 93% | `#2060E0` 1% | `#A0C0E0` 1% |
| spot-prompts | `#FFFFFF` 71% | `#2060FF` 18% | `#2020A0` 3% |
| spot-knowledge | `#FFFFFF` 74% | `#FFFFE0` 10% | `#00C0E0` 3% |
| spot-agents | `#FFFFFF` 72% | `#FFFFE0` 14% | `#404080` 2% |
| spot-imagegen | `#FFFFFF` 71% | `#E0E0FF` 19% | `#C0C0FF` 2% |
| spot-growth | `#FFFFE0` 39% | `#FFFFFF` 24% | `#00C0E0` 14% |
| portal-cta | `#202040` 83% | `#2040E0` 3% | `#202080` 2% |

**七项合规自查**：与第一批逐项同判——②无 IP 近似（通用几何母题：气泡/卡叠/折面书/
六边形网络/画框/台阶/汇聚光带）③④⑤无对象（画面无人物；prompt 显式禁人形，
七张成图逐张目验无人形元素）⑥无宗教政治符号 ⑦AIGC 已在页面标注。
①授权链与第一批同缺口，见上表。

**显示纪律**：spot 类装进 `--bg` 底的圆角框展示——实测各张底色在纯白与奶油白之间漂移
（见上表主色 1），直接贴白卡会露出底色接缝；框出来读作「刻意的画框」，漂移被吸收。

---

### `portal-*.webp` × 4 —— 门户页背景美术（2026-08-03 上线）

**用途**：`/portal` 各区块的背景美术。**全部按装饰图处理**——`alt=""` + `aria-hidden`，
不承载唯一信息；每张图所在区块的信息全部由文字与真实产品截图承载（§6.4 末条）。

| 文件 | 用途 | 体积 | 尺寸 |
|---|---|---|---|
| `portal-hero.webp` | 首屏背景（替代原 CSS 棱镜） | 27 KB | 1400w |
| `portal-roles.webp` | 三角色入口区背景 | 16 KB | 1400w |
| `portal-safety.webp` | 安全与隐私区背景 | 54 KB | 1400w |
| `portal-og.webp` | 社交分享预览图（og:image） | 27 KB | 1400w |

| 登记项 | 内容 |
|---|---|
| 生成模型与版本 | **`gpt-image-2`**，经 `https://api.llm-token.cn/v1/images/generations` |
| 完整 prompt | **见下方「完整 prompt」小节**（共用画风约束 + 每张的 subject 段，逐字留存） |
| 日期 | **2026-08-03** |
| 许可证/商用条款出处 | **未记录**——第三方中转网关的输出物权属条款未查到。**这是上线前必须补的一项**，不因图已生成而降级 |
| 体积 | 16–54 KB（生成后 `sharp` resize 1400w + WebP q=82，逐档降质收敛至 ≤150KB 线内） |

**主色（实测：缩到 64×64、量化 32 级后取前 3）**

| 文件 | 主色 1 | 主色 2 | 主色 3 |
|---|---|---|---|
| portal-hero | `#202040` 79% | `#2040E0` 3% | `#2080E0` 3% |
| portal-roles | `#FFFFFF` 79% | `#C0C0C0` 3% | `#C0C0E0` 2% |
| portal-safety | `#FFFFFF` 88% | `#E0FFFF` 8% | `#E0E0FF` 3% |
| portal-og | `#202040` 26% | `#202060` 26% | `#FFFFE0` 12% |

**七项合规自查**

| # | 项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 授权链 | ⚠️ **不完整** | 模型与 prompt 已记录，但中转网关的输出物权属条款未查到。**与旧资产同一个缺口，不因这次记录更全就当它不存在** |
| 2 | 已知 IP 近似 | ✅ 无 | 母题为棱镜分光 / 空拱门 / 线网盾形 —— 均为通用几何母题，无角色设计、无可辨识的既有作品结构 |
| 3 | 真人相似性 | ✅ 无 | prompt 显式禁止人物/面孔/身体部位；四张成图实测无任何人形元素 |
| 4 | 年龄呈现 | ✅ 无对象 | 画面无人物 |
| 5 | 性别·肤色·民族刻板印象 | ✅ 无对象 | 画面无人物；配色为品牌令牌色，非肤色再现 |
| 6 | 宗教与政治符号 | ✅ 无 | 拱门为无装饰的圆拱几何轮廓，非任何宗教建筑样式；盾形为线网抽象，无纹章、无徽记 |
| 7 | AIGC 标识 | ✅ **已标注** | 四张均在页面上以「背景美术由 AI 生成」标明（与旧资产不同：那次是**来源不明**所以不能标，这次来源确凿所以必须标） |

**完整 prompt（逐字留存）**

共用画风约束（四张相同，置于每条 prompt 之首）：

```
Flat vector editorial illustration, geometric abstraction, clean crisp edges, no gradients banding.
STRICTLY NO people, NO faces, NO human figures, NO mascots, NO characters, NO hands, NO body parts.
NO text, NO letters, NO numbers, NO logos, NO watermarks anywhere in the image.
Palette locked to: deep indigo #1E1B4B, indigo #312E81, cobalt blue #2563EB, cyan #06B6D4, warm cream #FFFDF6.
Composition is calm and spacious with generous negative space, suitable as a background behind text.
Style reference genre: modern SaaS product marketing illustration, minimal, precise, non-decorative.
```

各张 subject 段：

- **hero** — `Subject: a single beam of light entering a translucent prism and separating into four parallel bands of graduated blue, arranged diagonally across a deep indigo field. Thin concentric orbital arcs in the background at very low opacity. The four bands must NOT be rainbow colored — only shades within the locked blue palette.`
- **roles** — `Subject: three tall rounded archways of different heights standing side by side on a warm cream background, each archway outlined in a different shade from the locked palette, with soft geometric floor shadows. Empty archways — nothing inside them. Flat, front-facing, symmetrical.`
- **safety** — `Subject: a rounded shield shape formed by an interlocking lattice of thin lines, centered on a warm cream field, with a soft protective halo. Inside the shield only geometric lattice — no emblem, no symbol, no icon. Calm and reassuring, not military.`
- **og** — `Subject: a wide horizontal composition — deep indigo left two-thirds fading into warm cream right third, with the prism-and-light-bands motif small in the lower right and thin orbital arcs sweeping across. Mostly empty space in the upper left where a title would sit.`

**一条设计判断也记在这里**：本轮只生成了 4 张**大幅背景美术**，**没有**把 6 个能力图标也生成一遍。
理由是小尺寸下矢量（lucide）比位图锐利且轻得多，而产品长什么样有真实截图可用——
生成图在这两处都不是更优解。「能生成」不等于「该生成」。

---

### `subject-*.webp` × 8 —— **已于 2026-07-28 下线**（保留登记供追溯）

**用途**：`/explore` 探索任务卡的装饰图（`lib/data/explore.ts` 的 `SUBJECT_ART`）。
**文字等价物**：卡片上的学科 chip + 任务标题；`<Image alt="" aria-hidden>`——按装饰图处理，
不承载唯一信息（§6.4 末条）。

| 登记项 | 内容 |
|---|---|
| 生成模型与版本 | **未记录**。生成于本登记册建立之前的会话，参数未留存 |
| 完整 prompt | **未记录**，同上 |
| 日期 | **未记录**（首次入库时间见 git 历史） |
| 许可证/商用条款出处 | **未记录**——需补：生成服务的输出物权属条款 |
| 体积 | 9–12 KB / 张（原 PNG 246–267 KB，2026-07-28 转 WebP q=88，实测无可见劣化） |

**主色（实测，canvas 量化取前 3）**

| 文件 | 主色 1 | 主色 2 | 主色 3 |
|---|---|---|---|
| subject-math | `#FFE0E0` 40% | `#FFE0C0` 20% | `#E08000` 4% |
| subject-english | `#FFFFE0` 32% | `#FFE0E0` 26% | `#FFA080` 6% |
| subject-physics | `#FFE0E0` 50% | `#FFFFE0` 10% | `#A0A060` 4% |
| subject-history | `#FFE0C0` 29% | `#FFE0E0` 16% | `#E0E0C0` 16% |
| subject-cs | `#FFE0E0` 47% | `#E0E0E0` 11% | `#FFC060` 4% |
| subject-biology | `#FFFFE0` 54% | `#A0A040` 6% | `#C0C060` 5% |
| subject-chemistry | `#FFE0E0` 47% | `#FFE0C0` 14% | `#FFC0A0` 7% |
| subject-geography | `#FFE0C0` 46% | `#FFE0E0` 13% | `#FFC080` 8% |

**七项合规自查**

| # | 项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 授权链 | ⚠️ **不完整** | 生成模型与服务条款未记录，无法证明输出物可商用 |
| 2 | 已知 IP 近似 | ⚠️ **需独立判断** | 圆润拟人体 + 表情 + **学位帽**，是教育类吉祥物的高频组合；本人为生成方，不适合自评此项 |
| 3 | 真人相似性 | ✅ 无 | 非写实风格，无可识别真人特征 |
| 4 | 年龄呈现 | ✅ 无指向 | 非人形物种，无年龄线索 |
| 5 | 性别·肤色·民族刻板印象 | ✅ 无 | 无性别标记；体色为物体固有色（桃/黄/粉），非肤色再现；无民族服饰或特征 |
| 6 | 宗教与政治符号 | ✅ 无 | 画面元素为地球仪 / `</>` / 试管等学科物件 |
| 7 | AIGC 标识 | ❌ **缺失** | 图上与页面上均无 AI 生成标识 |

---

## 两条 findings 的处置结果（2026-07-28 关闭）

### F-1 · 学位帽与 §6.1 的裁定冲突

方案 §6.1 对拟人形象的裁定是「**去掉学位帽、书本、「导师」命名，改为同伴/工具型定位**」，
理由是**符号冲突**：持证教师造型的形象，视觉上主张的正是方案文字上要否认的
（它是老师、它靠谱、它不会错），而**视觉在低龄段的权重远高于一行 10.5px 灰色免责**。

这 8 张插画**每一张都戴着学位帽**，且已在学生端 `/explore` 上线。它们**先于方案存在**，
因此不是方案执行中的疏漏，但确实落在方案红线的射程内。

两种读法都站得住，所以这一条不由我单方处置：

- **读法 A（严格）**：§6.4-4 写的是「拿到确认前**不生成任何拟人化形象资产**，L0 插画只用
  纯几何/无人形图案」。按此，这 8 张应换成几何图形，直到盲审 + 校方确认。
- **读法 B（限缩）**：§6.1 的靶子是 **AI 的自我形象**（「AI 形象」「命名『导师』」「表情反应」），
  而这 8 张是**任务卡上的学科装饰**，不是 AI 在说话时的化身；§6.2 也只约束「形象只出现在
  /student/home 与 /student/growth」，指的是同一个 AI 形象。

**处置：改按读法 A（方案原文的默认路径）。**

我原本建议读法 B + 去掉学位帽，但那需要**新生成一批拟人资产**——恰是 §6.4-4
「在拿到确认前不生成任何拟人化形象资产」要拦的动作。**方案是经三轮评审定下来的，
不该在执行阶段被我用一条限缩解释绕过去。**

另有一条独立理由把天平压向 A：**这 8 张的来源不明**（模型/prompt/日期/许可证四项全未记录）。
我一度准备在页面上加「插画由 AI 生成」补 AIGC 标识，随即意识到**我并不知道它们是不是 AI 生成的**
——方案记录在案的是另外 3 张。贴一行未经证实的来源声明，本身就是编造。

已替换为 `components/explore/SubjectMark.tsx` 的**纯几何标记**（8 个学科各一，
坐标轴抛物线 / 对话框 / 电子轨道 / 地层带 / 尖括号 / 双螺旋 / 烧瓶 / 经纬球）。
七项合规在几何图形上**没有对象**：无角色设计可近似、无生成过程可标识、无真人/年龄/
族群/宗教特征。盲审这道门也因此不再卡在 `/explore` 上。

**代价照实说**：视觉温度确实降了，几何标记比 3D 角色冷。恢复路径明确——
若日后拿到独立盲审 + 校方确认，把 QuestCard 换回 `<Image>` 并从 git 历史取回 WebP 即可。

### F-2 · AIGC 标识缺失 —— 随 F-1 一并消解

**处置：不加标识，因为已无可标识的对象。** 几何标记由 `SubjectMark.tsx` 确定性绘制，
不是生成图。

过程中有一次自我拦截值得记下：我一度已经把「卡片插画由 AI 生成」这行字写进了
`/explore`，随后才意识到**我无法证实那 8 张的来源**。**为了补一个合规勾而声称一件
自己不知道的事，比缺那个勾更糟。** 该行已撤回。

---

## 变更记录

- **2026-07-28（上午）**：登记册建立。登记 8 张学科插画；实测并记录主色；PNG → WebP
  （246–267 KB → 9–12 KB，`/explore` 插画总负载 2.03 MB → 87 KB）；
  删除零引用的 `champion.png`；记录 F-1 / F-2 两条未决 findings。
- **2026-07-28（下午）**：按 §6.4-4 默认路径处置 F-1 / F-2 —— 8 张位图全部下线，
  改用纯几何 SVG（`components/explore/SubjectMark.tsx`）。全站**位图资产归零**，
  七项合规不再有待勾项。拟人化 AI 形象自始**未生成**。
  设计自检做了两轮：首轮 `language`（引号弧读成随机波纹）与 `dna`（双螺旋在 6px 线宽下糊成一团）
  两个不合格，已分别改为对话框轮廓与三次贝塞尔镜像正弦 + 收窄横档。

---

## 视频资产（2026-08-19 新增类目）

| 项 | 内容 |
|---|---|
| 文件 | `public/login-bg.mp4`（登录页背景视频，15s 无缝循环，1280×720，H.264，6.6MB） |
| 来源 | **用户提供**（`D:\download\BG.mp4`），由用户指示接入登录页背景 |
| 生成模型与 prompt | 未记录（用户侧生成，本仓库未掌握生成参数） |
| 许可证/商用条款 | 未记录 |
| 体量说明 | ⚠️ 远超本册 ≤150KB 位图纪律。视频为新资产类目，该上限本不适用，但按诚实登记原则记录在案；校内局域网部署下 6.6MB 首屏可接受，公网部署前应重估 |
| 内容说明 | ⚠️ 画面含**人物剪影**（远景背影），与铁律⑤「无拟人形象」存在张力。用户明确指示使用本视频，视为对自有规则的豁免；2026-08-19 拍板：**保留豁免关闭此项**（重生成需用户侧生成账号，本仓库无该能力） |
| 公网发布预案 | 上公网前执行降码率（拍板：LAN 用原片不降今损；此命令入发布门清单）：`ffmpeg -i login-bg.mp4 -vf scale=1280:720 -c:v libx264 -crf 28 -preset slow -an -movflags +faststart login-bg-web.mp4`（预期 ~2.5MB，替换同名文件即可） |
| 兜底 | `prefers-reduced-motion` / 加载失败 / 加载完成前，页面回落为纯 CSS 穹顶（HeroDome），不依赖本视频 |

## 品牌标识（2026-08-19 · V14.3 登录页页脚）

| 项 | 内容 |
|---|---|
| 内容 | OpenAI / Claude(Anthropic) / 智谱 / MiniMax 四枚品牌标，内联单色 SVG（components/login/ModelBadges.tsx） |
| 来源 | `@lobehub/icons-static-svg`（jsDelivr CDN 检索下载，包许可 MIT；商标权属各权利人） |
| 使用性质 | 指示性使用（nominative use）：页脚陈述「平台已接入的模型」，清单与网关真实路由一致（lib/data/models.ts ↔ lib/server/llm.ts MODEL_MAP），非背书暗示 |
| 为何不用 AI 生图 | 商标必须精确；生成式近似即失真/伪造，故取官方矢量形状而非生图 |
| 体量 | 纯内联矢量 path，无位图文件，≤150KB 纪律不涉及 |

## W-B4 徽章与庄园美术（2026-08-19）

| 项 | 内容 |
|---|---|
| 内容 | 徽章五档几何纹章（圆/双环/六边形/菱形/星形，app/(shell)/student/badges/page.tsx 内联 SVG）+ 庄园九类部件（三角松/圆丘灌木/三色花圃/圆镜池塘/石板小径/梯形长椅/方顶小屋/瞭望塔/小图书馆，app/(shell)/student/manor/page.tsx 内联 SVG） |
| 为何不用 AI 生图 | 铁律⑤纯几何语言用原生 SVG 表达最精确（Monument Valley 式圆方三角梯形），且随主题 tokens 自动换色、缩放无损、零网络加载；生图位图三者皆失。规格⑧⑨的「IP 美术」以此交付，未新增任何 AIGC 位图 |
| 体量 | 全部内联矢量，无位图文件，≤150KB 纪律不涉及（vacuous pass，如实记录） |
| 色彩 | 仅用现有 tokens（--accent/--ok-ink/--text-2/--text-3/--card/--c-alert 等），无新增 hex |
| 后续 | 若需 AIGC 主视觉（如庄园季节主题头图），走 S3 生图管线生成后压缩 ≤150KB 并回此登记 |

## 庄园主视觉（2026-08-19 · F6）

| 项 | 内容 |
|---|---|
| 文件 | public/art/manor-hero.webp（1200×800，**23KB**，✅ ≤150KB 纪律） |
| 来源 | gpt-image-2 经网关 /images/generations 生成（1536×1024 PNG 原图 1.3MB，ffmpeg scale=1200 转 webp 后删除原图） |
| Prompt | Minimalist flat geometric illustration, wide banner: a tiny garden estate built ONLY from pure geometric shapes - triangular pine trees, circular pond, square cottage with triangle roof, trapezoid bench, dotted flower circles. Soft pastel palette of light blue, mint green and warm sand. Monument Valley style, generous negative space, no people, no animals, no faces, no characters, no text, no letters. |
| 盲审 | 已人工查验：纯几何语言（三角松/圆镜池塘/方顶小屋/梯形长椅），无拟人形象、无动物、无文字——铁律⑤通过；与庄园部件词汇表（tree/pond/house/bench/flower）语义一致 |
| 用途 | /student/manor 页首装饰横幅（decorative，alt 描述性文案，不承载信息） |

### `badges/*.webp` × 45 —— 学生徽章收藏柜（2026-08-20，H9 首批 35 + H11 增补 10）

**用途**：`/student/badges` 徽章收藏柜插画（7 系列 × 5 天体档 = 35 枚）。图内无文字，
徽章名/档位/进度全部由 UI 层渲染（缎带在画面里留白即为此预留）；页面标注「徽章插画由 AI 生成」。
locked 态不出单独素材，由 CSS 去饱和实现。加载失败回退纯几何 SVG 徽章（页面不依赖资产可用性）。

**生成模型**：gpt-image-2（llm-token 网关）· **日期**：2026-08-20 ·
**完整 prompt**：35 条逐字保存于 `scripts/badge-art-spec.json`（入库），生成/抠图/压缩管线为
`scripts/gen-badge-art.mjs`（纯白底 + 边缘泛洪抠图 + 320px webp ≤150KB；网关实测忽略
background:transparent，故走后抠）。**主色**：七系列各占一色相（蓝/绿/橙/黄/青/紫/玫红），
档位金属色 灰陶→青铜→白银→暖金→铂金极光（hex 见 spec 文件 prompt 内）。

**拟人授权说明**：本批为 §6.4-4「默认不拟人」的**用户明示例外**（2026-08-20 对话指令：
徽章需卡通有趣、可含 IP 形象）。范围仅限本批徽章资产；其余美术不随之解禁。

七项：
1. 授权链：**未记录**——与前批相同，第三方中转网关的输出物权属条款仍未查到，不填推测值。
2. 已知 IP 近似：生成方自查通过 + **§6.4-2 独立盲审已执行**（2026-08-20，独立上下文 agent ×3 镜头盲审、未接触生成 prompt）：
   - IP 镜头 pass——逐枚核对候选清单（Duolingo 家族/B站/宝可梦/三丽鸥/小黄人/Line Friends 等）并自补就近候选（Maya the Bee、Pascal、Oswald、Care Bears），高风险龟系列裁切放大核验；唯一留档边缘项：days-200 直立小龟剪影与杰尼龟剪影略近（配色/腹甲/瞳色/无卷尾均不同，判定风格同源原创、低严重度、无需处置；备忘：该枚单独放大用于物料时勿再「蓝色化/加卷尾」）。
   - 未成年人适宜性镜头 pass——35 枚表情全友善、无恐怖谷；恒星档星芒/皇冠经全分辨率确认为圆钝装饰。
   - 符号镜头 pass——12 枚原图核验缎带/纸面无文字字母数字残留；quiz 族「✓」与 ask 族「?」为设计母题（对勾牌/问号触手，标点记号非文字），**生成方裁定**：图内禁文字约束的目的是防乱码与本地化问题，母题记号不在禁列，予以保留。
   - 局限如实登记：审查方为 AI agent（独立上下文≠人工校方审查）；23 枚仅以约 208px 总检索图分辨率核验缎带。人工校方盲审仍列为上线前更优项，非本册门槛。
3. 真人相似性：无（全部非人类卡通形象）。
4. 年龄呈现：幼态非人类形象，无真实未成年人呈现。
5. 性别·肤色·民族刻板印象：不涉及（非人类形象，无肤色/服饰文化符号）。
6. 宗教与政治符号：无（恒星档皇冠为游戏档位通用符号，无纹章/王室指向）。
7. AIGC 标识：页面收藏柜标题行常驻「徽章插画由 AI 生成」。

**H11 增补批（2026-08-20 当日）**：+2 系列 ×5 档 = 10 枚——同学互助「暖暖」（珊瑚粉围巾企鹅抱爱心，判据 = 给出的庄园赞 manor_likes.visitorId 计数）、班级共建「砖砖」（黄安全帽棕海狸持积木砖，判据 = 认捐次数 class_build_contrib 计数）；prompt 同模板槽位替换，逐字入库 spec 文件。
独立盲审（同 §6.4-2 流程，三镜头×独立上下文，未接触 prompt）：**三镜头全 pass**。留档备查三条：
1. 凸点积木砖与乐高砖形态相近，但凸点无 LOGO 字样压印且无 minifigure，属多品牌通用玩具砖形态，评估低风险可上线；若需绝对规避可后续改无凸点方块。
2. 企鹅识别规范固化为「珊瑚粉身 + 同色围巾」；**禁止**后续迭代改为黑身+红围巾组合（将进入 QQ 企鹅识别三件套风险区）。
3. build-100 安全帽正面一处模糊浮雕痕：8× 放大略呈字母状但不成字、1× 显示尺寸不可读，判定为模具棱线而非文字残留（可选轻修，不作上线门槛）。

### `badge-board.webp` —— 荣誉展示板底图（2026-08-20，H13）

**用途**：`/student/badges` 主视图陈列面底图（只挂已获得徽章；空板照展示）。纯物件资产
（蜂蜜色木质板 + 藤蔓雕边 + 星球/星星角饰 + 顶部空冠徽），**无拟人形象**——不动用徽章批
的拟人授权例外，走 §6.4-4 默认路径。图内无文字；徽章与名字铭牌全部由 UI 层挂载。
页面标注「展示板与徽章插画由 AI 生成」。加载失败回退暖色 surface 容器（页面不依赖资产）。

**生成模型**：gpt-image-2 · **日期**：2026-08-20 · **完整 prompt**：固化于
`scripts/gen-board-art.mjs`（含 matte/禁高光/禁文字/白底约束；调研依据：儿童向木质取
哑光柔光、文字须铭牌垫底不裸叠木纹——来源见 state H13）。1400×910 webp，泛洪抠图保
圆角透明，体积 ≤150KB。

七项：授权链 **未记录**（同旧批网关条款未查到）；IP 近似：生成方自查通过（通用木板+
几何/植物纹样，无品牌指向；独立盲审未执行，同门户批状态——非角色资产风险低）；
真人相似性：无；年龄呈现：不涉及；刻板印象：不涉及；宗教政治符号：无（星球/星星为
平台既有宇宙母题）；AIGC 标识：页面常驻标注。

### `icons/*.webp` × 15 —— 学生端 3D 卡通图标（2026-08-20，H14）

**用途**：学生页页头身份图标、首页队列卡、AI 工具卡、徽章图鉴入口、进度胶囊、
底部胶囊导航（`components/common/PlayIcon.tsx` 统一加载，缺席时回退 lucide 线性图标）。

**关键边界——这批刻意是「无面孔物件」**：用户参考图里有带脸的图标，但需求写的是
「带表情**或**动态元素」，取后者（星芒/流动/漂浮）。这样 §6.4-4 的拟人授权例外
继续锁在徽章吉祥物那 45 枚里，**不因为换一批图标就把例外范围扩大**。

**生成模型**：gpt-image-2 · **日期**：2026-08-20 · **完整 prompt**：STYLE 常量 +
逐条 subject 固化于 `scripts/gen-icon-art.mjs`（入库）；纯白底泛洪抠图 → 256px webp，
实测 8-16KB/枚。**主色**：紫 #7C3AED / 玫红 #EC4899 / 橙 #F97316 / 青 #14B8A6 / 蓝 #3B82F6。

**范围纪律（来自全站图标审计，见 state H14）**：学生域 155 处图标里只有 32 处适合 3D。
密集列表、状态指示（勾/叉靠形状对立瞬读）、表单控件、11 处 loading 转圈、
**以及全部安全与危机入口**一律保持线性——危机路径的严肃性优先于视觉一致性。
教师与管理控制台（80 处）一处未动。

七项：授权链 **未记录**（同前批，中转网关输出物权属条款仍未查到）；IP 近似：生成方自查
通过（通用物件母题：房屋/气泡/魔杖/嫩芽/奖牌/小岛/写字板/书/问号/宝石/珠链/调色板/纸叠/书堆/指南针，
无品牌指向）；真人相似性：无；年龄呈现：不涉及；刻板印象：不涉及（非人类、无肤色服饰符号）；
宗教政治符号：无；AIGC 标识：徽章页常驻「展示板与徽章插画由 AI 生成」。
**独立盲审：已完成**（2026-08-20，独立上下文 agent，未接触 prompt 与代码，三镜头逐枚目视）：
IP 近似 **pass** · 未成年人适宜性 **pass** · 符号与合规 **flag（1 项已实改）**。

据审改动（当轮执行，非留档了事）：
- **`nav-home` 十字窗棂已重画**——原为圆拱窗 + 十字分隔，是教堂窗原型；且 26px 下四格糊掉后
  十字反而更突出。已改为无窗棂的素色方窗。这是本次唯一被判「建议实改」的合规项。
- **`nav-explore` / `nav-mindmap` / `nav-manor` 判为 26px 不可辨，已重画**：刻度糊成蓝雾、
  连杆消失且大图下也读不出「导图」、树与岛同绿直接融掉。画风锁新增「小尺寸优先」条款
  （粗剪影 / 大色块 / 无细线 / 至多一枚 sparkle）。
- **`nav-tools` 已从仙女棒改为工具箱**：原造型带强性别编码（"女孩玩具"），且隐喻错配（工具 ≠ 魔法）。

**禁改项（后续迭代必须遵守，越过即进风险区）**：
1. `nav-chat` 双气泡**不得**改为绿底白色剪影（即成微信标识识别组合）。
2. `nav-explore` **不得**改为蓝色渐变环 + 红白双色针（即成 Safari）。
3. 四角 sparkle **不得**单独用作图标或 loading 标记，**不得**加蓝→紫渐变（避开 Gemini 标识）。
4. 金色五角星**不得**置于红色底面、**不得**「一大四小」排布、**不得**五颗成组（国旗元素敏感形状）。
5. `progress-gem` **不得**改为红粉色（避开 Duolingo 宝石货币）。
6. `action-ask` 的「?」经裁定属**图标主体语义的单个标点**，不计入「图内禁文字」；
   但**不得**在其上再叠加任何其他字符。规范据此补充：禁止的是词、句、字母串与数字。

**盲审自陈的能力缺口（如实登记，不当作已解决）**：
- 未做反向图搜——**无法排除**某商业 3D 素材包（3dicons.co / Iconscout / Freepik 3D 等）
  存在与本套某枚近乎逐像素一致的渲染。题材清单与这些包高度重合（画同类物体不可垄断，
  但逐像素雷同是另一回事）。**必须由人工用 Google Lens / TinEye 对 15 枚逐一反查才算结案。**
- 未在母版（1024px）上放大复核文字残留，交付分辨率下「无字」置信度为中高而非绝对。
- 26px 可辨性是推算而非实机缩放渲染，6 枚「勉强」档最需要实机复验。
- 判断绑定白底假设；若改深色背景，低对比结论会反转。
- 另报「6–10 岁观感与 K-12 高年级的落差」「codex-book↔nav-knowledge、nav-project↔nav-summary
  两组 26px 混淆对」——均未处理，列为后续。

## 学科生态园场景底图（2026-08-23）

| 项 | 记录 |
|---|---|
| 文件 | `public/art/manor-learning-world.webp`，1440×900，135,254 bytes，SHA-256 `0407AEA631179D413B017964A8FE1BB2A5C0142096E729EE786A1B18162A3B9D` |

| 生成方式 | OpenAI 内置 ImageGen；原创文生图后仅用 ffmpeg 转 WebP 与定尺，不含第三方素材拼贴 |
| 用途 | `/student/manor` 场景背景；交互田圃、作物、按钮和文字均由可访问 DOM/SVG 叠加，不烤进位图 |
| 设计约束 | 明亮纸雕 2.5D 学科生态园；中央留空田圃、左侧科学温室、右侧阅读亭、远景校园观测站；重要构图位于移动安全区 |
| 排除项 | 无人物、动物、脸、吉祥物、文字、数字、Logo、UI、农具；不复刻 QQ 农场的建筑、作物、图标、字体或具体坐标 |
| 权属与风险 | 提示词与生成物为本项目新建；未做反向图搜，不能声称排除所有偶然近似，发布前仍建议人工反向图搜备案 |
| 性能 | 首屏静态背景 135,254 bytes（约 132 KiB）；原始 PNG 保留在 Codex 生成目录，仓库只收 WebP 交付件 |

### QQ 农场主场景 WebP 交付优化

| 字段 | 内容 |
| --- | --- |
| 文件 | `public/art/qq-farm/farm-scene.webp`，1586×992，314,038 bytes |
| 来源 | 由已登记的 `farm-scene.png` 等尺寸有损压缩生成，保留原构图与交互热区坐标 |
| 用途 | 个人庄园首屏全景背景；PNG 原件仅作为本地高保真母版，不进入页面请求 |
| 性能 | 从 2,432,271 bytes 降至 314,038 bytes，减少约 87% 的首屏图像传输 |

## QQNCmini 农场高保真素材层（2026-08-23）

> 用户已明确确认拥有复刻目标 Web 应用及使用相关页面、品牌元素和媒体素材的合法权限。本批素材只用于学生端 `/student/manor` 的桌面端纯前端复刻，不用于登录、付费、远程接口或对外素材分发。

| 项 | 记录 |
|---|---|
| 场景文件 | `public/art/qq-farm/farm-scene.png`，2,432,271 bytes，SHA-256 `4B835A9C6BE5CCEF4984CC9174F58C9255EB5AF769EB56821235DE58E760F47F` |
| 场景来源 | 基于匿名化 QQNCmini 页面构图生成的无 UI 场景底图；不含账号、Cookie、令牌、查询参数或用户文字 |
| 场景生成记录 | OpenAI 内置 ImageGen，2026-08-23；调用结果未暴露底层模型版本，原始完整 prompt 未保存在可审计产物中。已知约束为：保留草坡、道路、中央斜向田块和边缘建筑的空间关系，排除账号、文字、按钮及可识别用户信息。不得把这段需求摘要冒充原始 prompt |
| 解码素材 | 历史路径 `public/art/qq-farm/sprites/` 共 10 张；来自已审计的 `farmui4_v_79.swf`、`farmui5_v_89.swf`、`farmui_full_v_62.swf` 只读导出结果。2026-09-23 按 V7-15 原字节迁移至仓库根目录 `开发材料/参考资产隔离/qq-farm-sprites/`，不再存放于 public |
| 历史使用位置 | 顶部农场标识、玩家资源头像、模式入口、活动入口、仓库按钮与仓库空态；此为原始登记，不代表当前运行时引用。V7-15 迁移前检索未发现这 10 张精灵的产品代码引用；当前原创 v6 素材不在本次修改范围 |
| 发布隔离与可逆记录 | 归档目录的 `manifest.json` 逐项记录原路径、目标路径、旧 URL、导出 ID、字节数、迁移前后 SHA-256；`README.md` 记录校验与回退步骤。目录在现有 Docker 构建上下文 `app` 之外；`tests/manor-v7-release-assets.mjs` 验证源树隔离与引用边界，实际构建包及部署 URL 仍须按发布目标复验。本次不扩大原许可范围，不作侵权或已泄露判断 |
| 权利与许可依据 | 用户明确确认拥有复刻目标页面及使用相关品牌/媒体素材的合法权限。10 张 SWF 精灵不是 AIGC；场景底图为 AIGC。未单独保存模型输出许可条款或第三方法务意见，若超出本项目内部页面用途对外分发，须重新完成权利审查 |
| AIGC 与隐私结论 | `farm-scene.png` 标记为 AIGC；10 张精灵标记为授权素材只读导出。场景不含人物、真实姓名、账号、Cookie、令牌、URL 参数或用户文字；未实施人脸替换、真人风格模仿或品牌暗示性代言 |
| 技术边界 | 页面不请求 QQ 或其他第三方业务接口；学习证据、授权、地块、作品、复习与班级共建均由本项目 `/api/v2/manor/*` 和 SQLite 持久化，旧 `/api/manor` 写入口已退役为 `410` |

| 历史交付文件（现归档同名原件） | 精确只读导出 ID | SHA-256 |
|---|---|---|
| `sprites/activity-calendar.png` | `farmui4_v_79.swf/16.png` | `28D8258CA41CC6913452524F5F36417A4DC2537D474446201EE6957AF5A342BC` |
| `sprites/activity-gift.png` | `farmui5_v_89.swf/87.png` | `05F76F70F17F1908127A0B1D708B534FD55B3183AFB271D1BFC2AC00D7E603A0` |
| `sprites/activity-message.png` | `farmui4_v_79.swf/904.png` | `0805FBEF8337259D33201094F9CE2D8BBBAEAC4948D0720C0B47A11703D17CD0` |
| `sprites/activity-rank.png` | `farmui4_v_79.swf/5_LandRankEntrance.png` | `DB28634FA18827666005842BAF0619FFCC4A51953DEC9B275E434A391C007858` |
| `sprites/brand-sprout.png` | `farmui5_v_89.swf/70.png` | `9B5574495C52DBD363FC0451BAFE94C46E7688D334F9B210CF9C357026014154` |
| `sprites/mode-magic.png` | `farmui5_v_89.swf/52.png` | `6A3C7302E0D258811B50D0FB383374CDAECCCCF8EEDC9DEB015392F580516DFF` |
| `sprites/mode-memory.png` | `farmui5_v_89.swf/57.png` | `A50EF97906022F232972E2CCB68BA143F30D8C733DAEADF87F9F80BB155ABAAA` |
| `sprites/mode-pasture.png` | `farmui_full_v_62.swf/126.png` | `F6EC0B6813C91A63DFECF3A274265616FD9E15073B9F744FF2EE273625BC87BA` |
| `sprites/mode-season.png` | `farmui5_v_89.swf/264.png` | `53059A4FC3F33ECC55252649C952DDD70880CAD9FEC852A3BC660BCC28D3F186` |
| `sprites/warehouse-chest.png` | `farmui5_v_89.swf/237.png` | `AF23DD51CE3E796E3BA9934D8AA58204A6E4A53E835A81D3F6D886904ADB2559` |

## 教师端导航 3D 图标图集（2026-08-31）

| 项 | 记录 |
|---|---|
| 文件 | `public/art/icons/teacher-nav-atlas-v1.webp`，896×896，4×4 透明图集，SHA-256 `766D4770065B89CFDE8130616EC32112D2AE81883997552258F16894837C4DAC` |
| 生成方式 | OpenAI 内置 ImageGen；先生成原创软陶 3D 图标图集，再仅做透明背景修订与 WebP 编码优化 |
| 使用范围 | 仅教师/科研角色的一级导航；管理控制台、状态标记、表单控件、安全与危机入口继续使用线性图标 |
| 语义映射 | 今日教学、班级学情、庄园证据、AI 对话、提示词中心、知识库、教研中心、课题与论文、集体备课、课件工坊、教学产物、模型广场、智能体工作台；另预留个人、偏好、退出三格 |
| 视觉约束 | 软陶 3D、统一左上光源、清晰剪影、蓝/青/薄荷主色并辅以黄/珊瑚/紫；图内无文字、数字、Logo 或品牌角色 |
| 性能与降级 | 单图集 145,662 bytes（低于 150 KiB 门槛）；桌面和移动只请求一次；加载失败自动回退 Lucide 线性图标 |
| 权属与风险 | 本项目原创提示词与生成物；未做外部反向图搜，不声称排除全部偶然近似；发布前可按资产流程补做反向图搜备案 |

## 教师端 Skill 库 3D 微场景（2026-08-31）

| 项 | 记录 |
|---|---|
| 文件 | `public/art/skills-v3/`：4 枚 512×512 分区主场景、16 枚 384×384 资源语义场景及 `manifest.json`；单枚 20,816–41,580 bytes，均为带 Alpha 的 WebP |
| 生成方式 | OpenAI 内置 ImageGen；先生成原创 2×2 与 4×4 微场景图集，因模型把透明预览棋盘烤入 RGB，改用纯绿生产母版，再执行确定性去绿、边界连通域清理、WebP 编码和白/深双底接触表审查；课程评审跨格资产单独重生成 |
| 使用范围 | 教师端 `/skills` 的顶部资源分区、折叠标题和资源瓷片插画；搜索、勾选、外链与可访问名称继续由 DOM 和既有业务逻辑提供 |
| 视觉约束 | 原创 EduAI 圆润助手家族；软陶与半透明树脂材质、左上光源、完整教育道具场景、清晰小尺寸剪影；图内无文字、数字、Logo、品牌角色、旗帜或货币元素 |
| 技术验收 | 20 枚文件均有 Alpha；四角透明；透明像素占比与前景保留比例由 `tests/skill-library.mjs` 校验；白底与深底接触表位于 `.agent-supervisor/records/skill-icons-v3-{light,dark}.png` |
| 权属与风险 | 本项目原创提示词与生成物；参考图只用于材质和完整场景层级，不复制其角色身份与构图。未做外部反向图搜，不声称排除全部偶然近似；公开再分发前仍应完成反向图搜与人工权利复核 |

## 个人庄园原创装饰 v7（2026-09-23）

| 项 | 记录 |
|---|---|
| 文件 | `manor-v7/decorations.png` 原图与 `decorations.webp` 运行图，1254×1254 透明图集；详细矩形和 SHA-256 见同目录 `provenance.json` |
| 来源 | 内置 ImageGen 原创生成，引用本项目原创 v6 环境作为画风母版；未使用历史提取素材、QQ 标识或角色 |
| 模型边界 | 工具不暴露具体型号选择，不声明已调用 image-2.5 |
| 应用 | 仓库、装扮集市、六个场景固定位置、只读公开装饰预览；名称与状态由 DOM 渲染 |
| 处理 | Sharp 转 WebP，运行图 419,382 字节；按实测矩形取图，避免邻格串图，固定外框防止布局移动 |
| 风险 | 原创生成不等于已完成外部反向图搜和全部权利审查；未将 QQ 研究文件变成发布资产 |

## 教师端功能语义图标 v2（2026-08-31）

| 项 | 记录 |
|---|---|
| 文件 | `public/art/teacher-feature-icons-v2/`：48 枚 320×320 透明 PNG 与 `manifest.json`；逐文件 SHA-256、图集单元格和前景像素统计均写入 manifest |
| 生成方式 | OpenAI 内置 ImageGen 生成 3 张原创 4×4 纯绿生产图集；`scripts/build-teacher-feature-icons.mjs` 执行内缩单元格裁切、边缘连通色键、低透明噪声清理、光学归一和 PNG 无损编码；清单时间默认取构建时刻，归档构建可用 `SOURCE_DATE_EPOCH` 固定 |
| 使用范围 | `/agent` 智能体工作台、`/hub` 模型广场推荐、`/prompts` 分类/模板/详情、`/dashboard` 统计与来源回读；导航栏图标继续使用独立导航图集 |
| 语义原则 | 每枚图标绑定实际功能，而非按颜色随机分配：教案、论文润色、课件、评价、学情、数据来源、额度等均使用可辨识教育物件；所有标题、数量和状态仍由 DOM 渲染 |
| 视觉约束 | 扁平化现代教育图标骨架，辅以轻量体积与统一左上光源；蓝、青、紫为主，黄、珊瑚作功能区分；文件背景透明，无白色外框、图内文字、数字、Logo 或品牌角色 |
| 性能与降级 | 页面按需加载单枚 PNG；`TeacherFeatureGlyph` 使用固定尺寸防止布局跳动，加载失败回退语义对应的 Lucide 图标；运行时不调用生图模型 |
| 权属与风险 | 本项目原创提示词与生成物；用户参考图只用于学习扁平化、圆角和图文组合关系，没有直接裁切或复制参考资产。未做外部反向图搜，不声称排除全部偶然近似；公开再分发前仍应完成反向图搜与人工权利复核 |
