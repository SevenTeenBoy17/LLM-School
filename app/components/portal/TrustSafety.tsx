import Image from "next/image";
import { BookOpenCheck, Clock, Database, LifeBuoy, ShieldAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Pillar = {
  icon: LucideIcon;
  title: string;
  body: string;
  /** 卡片级锚点 id（不含 safety- 前缀由本文件补齐）。页脚的不同标签要落到**不同**的
   *  卡片——原先两条不同标签（未成年人保护 / 数据存放说明）都指向 #safety 整节，
   *  等于其中一条是死链的孪生兄弟：点了没错但也没到该到的地方。 */
  anchor: string;
  /** 可选的常驻徽标：只给「无论如何都成立」的承诺用，不做装饰。 */
  badge?: string;
  /** true = 危机相关，图标改用 warn 族，与底部求助条同色系。 */
  critical?: boolean;
  /**
   * 网格跨列。**不是排版偏好，是信息优先级的物化**：
   * 危机识别独占一整行当领读卡；末条补一次跨列，纯粹为了在 md 两列下
   * 不留半个空洞（1+2+1 三行排满），lg 三列下再收回单列。
   */
  span?: string;
};

/**
 * 四条安全承诺。刻意写死在组件里、刻意不做成手风琴：
 * 给未成年人用的规则，折叠一次就等于少一半人看见。
 */
const PILLARS: Pillar[] = [
  {
    icon: ShieldAlert,
    title: "危机识别先于模型",
    body:
      "涉及自伤、伤害他人等信号时，系统在把话交给模型之前就拦下，直接给出求助路径，而不是先生成一段回答再补救。",
    anchor: "crisis",
    badge: "不受任何使用量限制影响，永远可用",
    critical: true,
    span: "md:col-span-2 lg:col-span-3",
  },
  {
    icon: Database,
    anchor: "data",
    title: "数据存在校内",
    body:
      // 两处改动都因为原文比事实宽：
      // ① 补上「推理会出校」——SafetyHelp.tsx:187 站内早就如实披露了
      //    「AI 回答与生图会经加密通道调用校外大模型服务完成计算」，
      //    门户页反而只说存储、不说计算，等于对外的口径比对内的更宽。
      // ② 删掉「家长」——权限模型里没有这个角色（lib/types.ts:24）。
      "对话与作业数据存放于学校自有环境，不用于训练任何模型。生成回答时会经加密通道调用校外大模型服务完成计算，内容只用于生成结果。谁能看到什么，按教师、学生、管理员的角色划定。",
  },
  {
    icon: BookOpenCheck,
    anchor: "scope",
    title: "分学段的内容边界",
    body:
      "回答按学段收敛，不超纲。遇到作业代写、考试作弊一类的请求，i-learning 引导思路与方法，不产出可以直接交上去的成品。",
  },
  {
    icon: Clock,
    anchor: "guardian",
    title: "学校与教师设定的守护",
    body:
      "使用时段与每日上限由学校或班主任设定。学生端会明示当前处于守护状态，而不是在后台悄悄限制。",
    span: "md:col-span-2 lg:col-span-1",
  },
];

/**
 * 背景美术的软边遮罩。
 *
 * 用 `mask-image` 而不是直接压不透明度：底图自带一块近白的画布，压到 55% 之后
 * 白仍然比 `--bg-2` 的暖奶油**更亮**，于是区块里会浮出一个边缘笔直的浅色矩形——
 * 比不放图更难看，而且它不报错、只在截图上才看得出来。
 *
 * 遮罩里的 `var(--text)` 取的是**它的 alpha 通道（=1），不是它的颜色**：
 * 遮罩只认透明度。写令牌而不是写 `black`，是为了让「本文件零裸色值」这条纪律
 * 在整份文件里没有例外——下一个人不必判断「这个 black 算不算越界」。
 *
 * `closest-side` 未指定形状时退化为**内切椭圆**，四边同时收口，
 * 因此不存在任何一条直边会露出来。
 */
const ART_MASK =
  "radial-gradient(closest-side, var(--text) 0%, var(--text) 40%, color-mix(in srgb, var(--text) 45%, transparent) 62%, transparent 84%)";

/**
 * TrustSafety — 门户的安全与隐私区块（锚点 #safety）。
 *
 * 纯静态、无交互、无折叠：本项目铁律要求安全信息常驻可见，
 * 因此这里没有 tab、没有手风琴、没有「查看更多」，全部内容一屏内展开。
 * 底部求助信息条同理常驻，且不随任何状态隐藏。
 *
 * ── 这一节为什么要比其它节「重」 ─────────────────────────────────────
 *
 * 它和上面的能力区在版式上原本是同一种卡片墙，读者扫下来会当成第四组功能点。
 * 但未成年人安全是这页唯一不能被略读的部分，所以本轮把分量差做成可量的三件事，
 * 而不是靠一句「更重要」的文案：
 *   · 区块留白 py-20/lg:py-32，明显高于能力区的 pt-20 pb-16/lg:pt-28 lg:pb-20；
 *   · 标题在 lg 上升到 --fs-d1（56px），与英雄区 h1 同级——全页只有这两处；
 *   · 危机识别卡横跨整行做领读，其余三条退为支撑。
 * **一档新字号都没有新增**：56/40/28/18/16/14/12 七档是门户字阶的上限，
 * 多加一档就撞穿字阶棘轮门（tests/gate/typography.mjs）。
 *
 * ── 背景美术的两条纪律 ───────────────────────────────────────────────
 *
 * 1. **盾形只在右侧**。它是装饰，不是内容，因此绝不能进入正文的行宽。
 *    做法是把图钉在右上、用椭圆遮罩收口，同时给标题带一个显式的 max-w
 *    （md 420px / lg 520px）——两侧留出的空档是算出来的，不是看着差不多。
 * 2. **md 以下不出图**。390px 的正文是单列满宽，任何底图都会进到字的背后；
 *    与其压到看不见（那等于白加一张图的重量），不如干脆不放。
 *    「背景美术由 AI 生成」的标注跟着图一起出现/消失——图没出的档位标了就是错标。
 *
 * `mix-blend-darken` 让底图那块近白画布直接消融进 `--bg-2`（逐通道取暗，
 * 白 vs 暖奶油 = 暖奶油），只剩线网与盾形描边落下来；section 上的 `isolate`
 * 把混合限制在本区块内，不让它去和上一节的底色发生关系。
 */
export function TrustSafety() {
  return (
    <section
      id="safety"
      aria-labelledby="safety-heading"
      // overflow-hidden：背景美术右侧与上方都有出血，不裁会在窄档撑出横向滚动条。
      className="relative isolate overflow-hidden bg-[var(--bg-2)] py-20 lg:py-32"
    >
      {/* ── 背景美术（装饰，见文件头注释）───────────────────────────── */}
      <div
        aria-hidden="true"
        // top 分两档不是随手写的：遮罩椭圆的 ry = 盒高的一半，而盒高随视口变。
        // lg 下盒高 480px，上提 40px 只吃掉椭圆最外圈（alpha≈0）；
        // 同样上提 40px 放到 md（盒高仅 266px）就会切在 alpha≈0.25 处——
        // 区块上沿会露出一条笔直的横切边。md 因此贴顶不上提。
        className="pointer-events-none absolute top-0 right-[-4%] -z-10 hidden aspect-[3/2] w-[min(720px,52%)] select-none opacity-60 mix-blend-darken md:block lg:top-[-40px]"
        style={{ maskImage: ART_MASK, WebkitMaskImage: ART_MASK }}
      >
        <Image
          src="/art/portal-safety.webp"
          alt=""
          width={1400}
          height={933}
          sizes="(min-width: 1024px) 720px, 400px"
          className="h-full w-full object-cover"
          draggable={false}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        {/* ── 标题带：左侧强调竖线 ─────────────────────────────────────
            竖线用 span + bg 画，不用 border-left。globals.css 里
            `* { border-color: var(--border) }` 是无层规则，级联层的比较先于
            特异度，会静默吃掉任何 border-color 工具类（PortalHero 注释 A 已记）。 */}
        <header className="relative max-w-[420px] pl-6 lg:max-w-[520px] lg:pl-8">
          <span
            aria-hidden="true"
            className="absolute top-[6px] bottom-[6px] left-0 w-[4px] rounded-full bg-[var(--portal-accent)]"
          />
          <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
            安全与隐私
          </p>
          <h2
            id="safety-heading"
            className="mt-3 text-[length:var(--fs-d2)] leading-[var(--lh-d)] font-bold text-[var(--text)] lg:text-[length:var(--fs-d1)]"
          >
            未成年人优先
          </h2>
          <p className="mt-4 text-[18px] leading-relaxed text-[var(--text-2)]">
            这一节不折叠，也没有「查看更多」。给未成年人用的东西，规则应当一眼看完。
          </p>
        </header>

        <ul className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const lead = Boolean(pillar.critical);

            const chip = (
              <span
                className={
                  lead
                    ? "grid h-[56px] w-[56px] shrink-0 place-items-center rounded-[var(--r-ctl)] bg-[var(--warn-bg)] text-[var(--warn-ink)]"
                    : "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[var(--r-ctl)] bg-[var(--portal-tint)] text-[var(--portal-accent)]"
                }
              >
                <Icon
                  className={lead ? "h-[28px] w-[28px]" : "h-[24px] w-[24px]"}
                  aria-hidden
                  strokeWidth={2}
                />
              </span>
            );

            const copy = (
              <div className="min-w-0">
                <h3 className="text-[18px] font-bold text-[var(--text)]">{pillar.title}</h3>
                <p
                  className={
                    lead
                      ? "mt-2 max-w-[62ch] text-[16px] leading-relaxed text-[var(--text-2)]"
                      : "mt-2 text-[16px] leading-relaxed text-[var(--text-2)]"
                  }
                >
                  {pillar.body}
                </p>

                {pillar.badge ? (
                  /* 用绝对像素而非 text-xs：根字号是 14px（见 globals.css 注释），
                     rem 标度整体 ×0.875，text-xs 实际只有 10.5px。这行是危机能力的
                     核心承诺，10.5px 的中文笔画会糊成一团。 */
                  <p className="mt-4 inline-flex items-center rounded-full bg-[var(--ok-bg)] px-3 py-1 text-[12px] font-semibold text-[var(--ok-ink)]">
                    {pillar.badge}
                  </p>
                ) : null}
              </div>
            );

            return (
              <li
                key={pillar.title}
                id={`safety-${pillar.anchor}`}
                className={[
                  "rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-7 sm:p-8",
                  // 领读卡用 ring 而不是 border 加粗：ring 走 box-shadow，
                  // 不受上面那条无层 border-color 规则影响，且能与 shadow 共存。
                  lead
                    ? "shadow-[var(--shadow-md)] ring-1 ring-[var(--warn)]"
                    // 三件套解除（rank 11）：非领读卡常态去阴影，只留描边 + 白底与
                    // --bg-2 暖带的底色差。**领读卡（危机识别）的 ring + shadow-md 不动**
                    // ——那是刻意的分量差、有实测记录，且撤掉阴影后它与其余三张的
                    // 层级对比反而更明显（因为其余三张不再各自垫高一层）。
                    : "",
                  pillar.span ?? "",
                ].join(" ")}
              >
                {lead ? (
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-7">
                    {chip}
                    {copy}
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {chip}
                    <div className="mt-5">{copy}</div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* 求助信息条：常驻、不可折叠、不随任何状态隐藏。
            本轮只加分量（更大的内边距、32px 图标、18px 正文、shadow-md），
            **一个字都没有改**——这段文案是逐字核对过实现的。 */}
        <aside
          aria-label="心理援助热线"
          data-ink="warn"
          className="mt-8 flex flex-col gap-4 rounded-[var(--r-card)] bg-[var(--warn-bg)] px-6 py-6 text-[var(--warn-ink)] shadow-[var(--shadow-md)] sm:flex-row sm:items-center sm:gap-6 sm:px-9 sm:py-8"
        >
          <LifeBuoy className="h-[32px] w-[32px] shrink-0" aria-hidden strokeWidth={2} />
          <p className="text-[18px] leading-relaxed">
            如果你正处在困难中，可以随时拨打全国 24 小时心理援助热线{" "}
            <a
              href="tel:12356"
              // inline-block 是为了触达面积：行内 <a> 的边框盒只有字形高度，
              // 18px 下量到约 21px，低于 24×24 的最小触达。改成 inline-block 后
              // 盒高取行高（18×1.625≈29px），仍然随正文自然换行。
              className="inline-block font-bold underline underline-offset-4 transition-opacity duration-[var(--t-fast)] ease-[var(--ease-out)]"
            >
              12356
            </a>
            。本页不折叠、不隐藏；学生端与教师端每一页右下角也常驻求助入口。
          </p>
        </aside>

        {/* AIGC 标识。与背景美术同断点出现——图没渲染的档位标了就是错标。 */}
        <p className="mt-6 hidden text-right text-[12px] text-[var(--text-2)] md:block">
          背景美术由 AI 生成
        </p>
      </div>
    </section>
  );
}
