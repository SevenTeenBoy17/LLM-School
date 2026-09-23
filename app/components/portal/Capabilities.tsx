import Image from "next/image";
import { Ban } from "lucide-react";

/**
 * Capabilities — /portal 的能力概览区块。
 *
 * 两段结构，刻意成对：
 *   上半段「我们做的」六张卡，下半段「我们刻意不做的」三条。
 *
 * 下半段不是版面装饰。一个校内 AI 平台最难回答的三个家长/教师问题分别是
 * 「会不会让孩子上瘾」「数据去哪了」「以后要不要花钱」——它们都不是功能，
 * 用功能卡片回答不了，只能靠明说边界。把边界与能力放在同一屏、同样的字号里，
 * 是本页信息密度最高的一块，也是最不该折叠的一块。
 *
 * 纯静态：没有状态，hover 全交给 CSS，因此不加 "use client"。
 */

interface Capability {
  /** 能力卡头图：gpt-image-2 生成的几何母题（登记见 public/art/REGISTRY.md）。
   *  纯装饰（alt="" + aria-hidden）——标题与描述承载全部信息，图挂了不损失内容。 */
  art: string;
  title: string;
  desc: string;
}

/** 六项能力均取自平台已上线功能，措辞对齐产品内实际叫法，不做扩写。 */
const CAPABILITIES: Capability[] = [
  {
    art: "/art/spot-chat.webp",
    title: "AI 对话",
    desc: "多个模型可选，可开深度思考。默认走苏格拉底式引导，先问再答，不直接给结论。",
  },
  {
    art: "/art/spot-prompts.webp",
    title: "提示词库",
    desc: "教师把用顺手的提问方式存下来，也可以分享给同教研组，不必每次从头描述需求。",
  },
  {
    art: "/art/spot-knowledge.webp",
    title: "知识库",
    desc: "校内自己的资料，按关键词检索。回答基于本校材料，而不是模型凭印象生成。",
  },
  {
    art: "/art/spot-agents.webp",
    title: "智能体",
    desc: "教师自建的学科助手：设定角色、口吻和边界，交给学生反复使用。",
  },
  {
    art: "/art/spot-imagegen.webp",
    title: "AI 生图",
    desc: "生成课件插图、示意图这类教学素材，省掉找图和版权确认的时间。",
  },
  {
    art: "/art/spot-growth.webp",
    title: "成长记录",
    // 原文写「错题**自动归档**」——产品没有这条路径。api/mistakes 只接受学生手录
    // （route.ts 注释「POST：学生手录错题」），/api/chat 不会自动落错题。
    // 在给家长和教师看的公开页上多说一个「自动」，就是凭空承诺了一个不存在的功能。
    desc: "学生自己记下的错题按知识点聚合，看得见哪一类反复出错。",
  },
];

interface Boundary {
  title: string;
  desc: string;
}

/** 三条边界。写的是「已经放弃的选项」，不是「未来会改进的地方」。 */
const BOUNDARIES: Boundary[] = [
  {
    title: "不做上瘾式设计",
    // 原文把那句愧疚话术原样引了出来当反例，被 G8 禁机制词表抓到。**不加豁免**：
    // 词表管的是「用户可见文案」，而反例也是要印在公开页上给学生看的——
    // 在承诺「我们不发这种推送」的同一行里先替它发一遍，本身就自相矛盾。
    desc: "没有连胜天数，没有排行榜，也不会因为你一阵子没打开就推送催你回来。合上就合上，用得少不代表学得差。",
  },
  {
    title: "不用学生数据训练模型",
    desc: "对话、作业和错题只服务于学生本人与其任课教师，不会进入任何模型的训练集，也不对外流转。",
  },
  {
    title: "不收费，也没有付费升级项",
    // 口径纠错（本轮）：原文写「资源紧张时按公平使用排队」——**与实现不符**。
    // app/api/chat/route.ts 的配额门是每人每模型的**每日固定次数上限**
    // （teacher/student 各自额度、admin 与教研不限、额度设 0 视为不限），
    // 超额返回 kind:"quota" 并提示「明日恢复；可切换其他模型继续」。
    // 「排队」意味着等一会儿还能用，实际是当天不再增加——对家长是两个不同的答案。
    // 这与已修过的「家长角色」「自动归档」「数据留在学校」同属铁律②（页面不得
    // 承诺实现做不到的事）。措辞按实现逐字对齐，不写具体次数（各模型可由管理员调整）。
    desc: "学校统一部署，师生按需使用。每人每天有固定的使用次数，用完当天不再增加、次日重置，也可以换个模型继续；不存在花钱买更多次数这件事。",
  },
];

export function Capabilities() {
  return (
    <section
      id="capabilities"
      aria-labelledby="capabilities-heading"
      // pt/pb 不对称是刻意的（对齐审计 X-1）：页面主体四个区块边界的留白合计
      // 在其余三处均为 182px，唯 roles→caps 只有 154——本区块曾是链上唯一
      // lg 档 py-20 的区块（TrustSafety 注释里的对照值写的还是 py-24，代码漂移了）。
      // pt-28(98)+roles.pb(84)=182、pb-20(70)+safety.pt(112)=182，两侧同时归位；
      // 390 档 126/126 与相邻边界完全一致。区块内上下不对称在这里不可见——
      // 两侧边界都是换底色处，留白读作边界所有。
      className="w-full bg-[var(--bg)] pt-20 pb-16 lg:pt-28 lg:pb-20"
    >
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        {/* ── 标题带 ───────────────────────────────────────────── */}
        <header className="portal-reveal max-w-[720px]">
          {/* 眉标。proof / roles / safety 三个浅色区块的入口都有一条同款眉标，
              只有这一块没有——它于是成了唯一一个区块入口不带强调色锚点的地方，
              而它的 h2 文案又是四块里最泛的一个。 */}
          <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
            能力总览
          </p>
          <h2
            id="capabilities-heading"
            className="mt-3 text-[length:var(--fs-d2)] font-bold leading-[var(--lh-d)] text-[var(--text)]"
          >
            平台能做什么
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-2)]">
            六件事，都是老师和学生每天真的会用到的。没有演示专用的功能，也没有需要先培训两小时才能上手的入口。
          </p>
        </header>

        {/* ── 六张能力卡 ───────────────────────────────────────── */}
        <ul className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ art, title, desc }) => (
            <li
              key={title}
              // 三件套解除（rank 11）：常态去掉 shadow-sm，只留描边 + 白底与暖奶油区块底的差；
              // hover 时才给 shadow-md（配合抬升），阴影因此重新承担「这张可以点」的语义。
              className="group rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-6 transition-[transform,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] motion-reduce:transform-none motion-reduce:transition-none"
            >
              {/* 插图块 112×112。**上一版这里是 aspect-[2/1] + object-cover，并配了一句
                  「2:1 裁切安全，只裁掉空白边」的注释——那句话是错的**：实测盒 342×171
                  （AR 2.00）对原图 AR 1.00，object-cover 纵向裁掉 50%，六张母题里有四张
                  被切断（卡叠、折面书、画框、台阶）。教训不是「换个比例」而是
                  **别把没量过的说法写成注释**，它会让下一个人（包括我自己）跳过验证。

                  现在按原图 1:1 显示，object-contain 兜底，任何比例下都不裁。
                  底色用 --bg：六张图实测众数底色全部落在暖奶油区间，与 --bg 的
                  最大通道差 6/255，肉眼无缝——所以不需要画框，直接落在卡上。
                  （曾以为它们「在纯白与奶油间漂移」而加了画框，那是我自己 32 级量化
                   造成的假象：--bg 的蓝通道值在 32 级下进位到满值，于是读成纯白。
                   **注释里写令牌名不写色值**——写了值既会过时，也会撞色彩棘轮门。） */}
              <div
                aria-hidden="true"
                className="grid h-[112px] w-[112px] place-items-center overflow-hidden rounded-[var(--r-ctl)] bg-[var(--bg)]"
              >
                <Image
                  src={art}
                  alt=""
                  width={640}
                  height={640}
                  sizes="112px"
                  className="h-full w-full select-none object-contain"
                  draggable={false}
                />
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-[var(--text)]">
                {title}
              </h3>
              <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-2)]">
                {desc}
              </p>
            </li>
          ))}
        </ul>

        {/* ── 我们刻意不做的事 ─────────────────────────────────── */}
        <aside
          aria-labelledby="capabilities-boundaries"
          className="mt-6 rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 lg:p-10"
        >
          <h3
            id="capabilities-boundaries"
            className="text-[length:var(--fs-d3)] font-bold leading-[var(--lh-d)] text-[var(--text)]"
          >
            我们刻意不做的事
          </h3>
          <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-[var(--text-2)]">
            功能清单谁都能列长。下面三条是我们主动放弃的做法——不是还没做，是决定不做。
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-3">
            {BOUNDARIES.map(({ title, desc }) => (
              <li key={title} className="flex gap-3">
                <Ban
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-[var(--text-3)]"
                />
                <div className="min-w-0">
                  <h4 className="text-[16px] font-semibold text-[var(--text)]">
                    {title}
                  </h4>
                  <p className="mt-1.5 text-[16px] leading-relaxed text-[var(--text-2)]">
                    {desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* 三级转化点（文字链，不做按钮化）：研究里 Hero 到页脚 CTA 之间跨四个
            区块零转化点，读者读完能力后没有任何下一步。用文字链而不是按钮，
            是为了不与首屏/页尾的两处主 CTA 抢视觉权重。 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <a
            href="#faq"
            className="inline-flex min-h-[24px] items-center gap-1 text-[16px] font-semibold text-[var(--portal-accent)] underline-offset-4 hover:underline"
          >
            这些能力有什么边界？看常见问题 →
          </a>
          <p className="text-[12px] text-[var(--text-2)]">卡片插图由 AI 生成</p>
        </div>
      </div>
    </section>
  );
}
