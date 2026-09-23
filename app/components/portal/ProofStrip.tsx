import { ScrollShot } from "./ScrollShot";

/**
 * ProofStrip — /portal 的证据条。
 *
 * 这一节回答的是门户页最难回答的那个问题：**上面那些关于「AI 怎么对待学生」的话，
 * 凭什么信？** 常规做法是再摆一排图标卡，用另一种措辞把同样的承诺再说一遍——
 * 但承诺重复三次并不会变成证据，只会变成更长的宣传语。
 *
 * 所以这里不讲，改成给人读产品自己的界面：四张图全部从 /chat 按**原分辨率**裁出，
 * 没有重排版、没有改写、没有为了排版好看而重新截一遍。读者在这一节读到的句子，
 * 和学生在对话框里读到的是同一句。**能被界面推翻的宣称才算宣称。**
 *
 * ── 四个刻意的取舍 ──────────────────────────────────────────────────────
 *
 * 1. **不给这一节配背景美术。** 门户其余区块有生成美术打底，这一节没有。
 *    主角是四张信息密度很高的界面截图，任何底纹都在和它们抢注意力，
 *    而且会削弱「这是原样裁出来的」这个观感——衬得越漂亮，越像广告物料。
 *
 * 2. **图不缩水。** 580px 的裁图在 1440px 下就按 580px 显示，不塞进 300px 的
 *    卡片里当配图。整节的价值就是「读得清原话」，读不清等于这一节不存在。
 *    因此桌面档用 `xl:grid-cols-[580px_...]` 把左列锁死在原始像素宽。
 *
 * 3. **窄屏改横向滚动，而不是继续缩。** 390px 视口内容区只有 310px，
 *    580px 的图缩到 53% 时中文笔画会糊成一团。与其给一张看不清的图，
 *    不如让它横向滑。滚动容器带 `tabIndex`：可滚动区域必须能用键盘滚
 *    （WCAG 2.1.1），否则这一节在纯键盘下就只剩鼠标用户能读。
 *
 * 4. **alt 写全图里的字。** 这四张图**承载信息**，不是装饰——装饰图在本项目
 *    一律 `alt="" + aria-hidden`，而这里恰恰相反：读屏用户必须拿到和视力用户
 *    完全相同的那几句原话，否则「证据」对他们而言只是四个空洞的图片占位符。
 *    alt 因此偏长，这是刻意的。
 *
 * ── 三个实测约束，改动前先看 ─────────────────────────────────────────────
 *
 * A. **字号只能从 /portal 已有的七档里挑**（12/14/16/18/28/40/56）。
 *    字阶棘轮门（tests/gate/typography.mjs + type-baseline.json）对 /portal
 *    锁的是「7 档，只许降不许升」。新写一个 15px 或 20px 会直接把基线撞红，
 *    而且报出来的是「排版回归」，不会告诉你是新增区块干的。
 *
 * B. **圆角只有两档**：`--r-ctl`(12px) / `--r-card`(20px)。同一道门管。
 *
 * C. **图走 `unoptimized`。** 这不是偷懒。这四张是已经压好的 webp 裁剪，
 *    源宽 580 就是显示宽，优化器既没有可放大的余量，走一遍默认 q75 重编码
 *    反而会把 CJK 小字的笔画糊掉——**恰好糊掉这一节唯一要交付的东西**。
 *    （另：Next 16 起 `quality` 必须在 next.config 的 `images.qualities`
 *      白名单里，想用 q100 得改全局配置，代价比这里的收益大。）
 */

type Evidence = {
  src: string;
  /** 原始像素尺寸。必须与文件真实尺寸一致，否则 next/image 会算错占位高度。 */
  width: number;
  height: number;
  /** 图里文字的概括。读屏用户拿到的就是这段，写具体，不写「界面截图」。 */
  alt: string;
  title: string;
  body: string;
  /** 桌面档在 12 栏里占几栏。 */
  span: string;
  /** true = 图与说明左右分栏（宽图，说明放得下）；false = 图上说明下。 */
  split: boolean;
  /** 裁图在该边切断了界面内容，需淡出收边。**逐张实测过再填，不要凭感觉加**：
   *  按行统计非背景像素占比，第 0 行/末行仍有墨迹即为切断。
   *  实测值：socratic 末行仍有墨迹（底部切断一排灰色胶囊）、privacy 第 0 行
   *  ██ 满行（顶部把一行字拦腰切开）、guard 第 0 行 4.7%（27/580 px，y=6 才是
   *  真正的首行 94%）。**guard 这条曾被我按「≈2% 应该是容器描边」放过——
   *  肉眼分档不算测量，要看数**。help 是完整的浮标按钮，两端干净，不加。 */
  fade?: "top" | "bottom";
};

const EVIDENCE: Evidence[] = [
  {
    src: "/shots/ev-socratic.webp",
    width: 580,
    height: 240,
    alt:
      "AI 对话截图：回答顶部标着「学术诚信引导」，正文写「这是个好问题！不过答案直接给你，反而帮不到你，我们一步一步来」，" +
      "随后是三步——先拆解：这题在考哪个知识点，说说你的已知和要求；走第一步：我先给你开个头的思路，剩下的你来接；" +
      "你来试：按这个思路，下一步你打算怎么做。结尾写「把你的思路、或写到一半的过程发我，我来帮你检查、点出卡在哪" +
      "（我不会替你写完整答案，但会陪你想明白）」。",
    title: "它不给答案，给的是拆解步骤",
    body:
      "学生把作业题原样贴进来，得到的不是结果，而是「先拆解 / 走第一步 / 你来试」三步。" +
      "最后一句写在回答里，不写在条款里：不会替你写完整答案，但会陪你想明白。",
    span: "xl:col-span-12",
    split: true,
    fade: "bottom",
  },
  {
    src: "/shots/ev-privacy.webp",
    width: 580,
    height: 130,
    alt:
      "AI 对话截图：回答上方常驻两行说明——「我是 AI，我会出错——作业与考试相关内容请以老师和教材为准」，" +
      "以及「你的对话仅存储在校内平台，用于学习支持与安全保护，不对同学公开、不用于排名」。" +
      "下方还有一条「更多能力边界与隐私说明」的入口。",
    title: "「我会出错」写在对话里，不在页脚",
    body:
      "模型可能出错、对话存在哪里、会不会被同学看到——三件最该先说的事就印在回答正上方，" +
      "和回答同一个字号，不是折进页脚的小字。",
    span: "xl:col-span-12",
    split: true,
    fade: "top",
  },
  {
    src: "/shots/ev-guard.webp",
    width: 580,
    height: 56,
    alt:
      "AI 对话输入框下方的常驻披露文字：「AI 不会上网搜，只用校内资料，最新发生的事可能不知道 · " +
      "本对话框不支持上传附件 · 每条消息都会经过校内安全策略检查 · 请勿输入涉密信息」。",
    title: "每条消息都过一遍校内安全策略",
    body:
      "输入框下方常驻这一行：不上网搜、只用校内资料、不支持上传附件、每条消息都经过校内安全策略检查。" +
      "把「做不到什么」和「拦了什么」写在同一行，是因为它们本来就是同一件事的两面。",
    span: "xl:col-span-8",
    split: false,
    fade: "top",
  },
  {
    src: "/shots/ev-help.webp",
    width: 134,
    height: 62,
    alt: "页面右下角常驻的白色浮标按钮，绿色图标加「安全求助」四个字。",
    title: "求助入口常驻在右下角",
    body: "不折叠、不跟随滚动消失，学生端与教师端每一页都在。",
    span: "xl:col-span-4",
    split: false,
  },
];

/** 卡片外壳。四块共用，保证「证据」在版面上是同一等级的东西。
 *
 *  三件套解除（rank 11）：原先「1px 描边 + 白底 + shadow-sm」三种分离手法同时叠加，
 *  是研究点名的最典型 AI 生成感。本页是暖奶油底 + 纯白卡，**底色差本身已经足够**，
 *  再加常态阴影只是把每张卡都垫高一层、让阴影失去强调能力。
 *  现在：常态只留描边 + 底色差，阴影退回 hover 态——它重新变成一种可用的手段。 */
const CARD =
  "rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)] p-6 transition-shadow duration-[var(--t-base)] ease-[var(--ease-out)] hover:shadow-[var(--shadow-sm)] lg:p-7";

export function ProofStrip() {
  return (
    <section
      aria-labelledby="proof-heading"
      className="w-full bg-[var(--bg)] py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        {/* ── 标题带 ───────────────────────────────────────────────── */}
        <header className="portal-reveal max-w-[720px]">
          <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
            界面原话
          </p>
          <h2
            id="proof-heading"
            className="mt-3 text-[length:var(--fs-d2)] leading-[var(--lh-d)] font-bold text-[var(--text)]"
          >
            不是宣传语，是界面里的原话
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-[var(--text-2)]">
            四张图按原分辨率从 /chat 裁出，没有重排也没有改写。你在这里读到的句子，学生在对话里读到的是同一句。
          </p>
          {/* 只在图放不下的窄屏出现（md = 768px。⚠️ 不要按根字号 14px 去换算 48rem——CSS Media Queries L4 规定媒体查询里的相对单位按**初始值**（16px）求值，不看 html 上声明的 font-size（这正是 html{font-size:62.5%} 那套技巧对断点无效的原因）。所以断点真值是 768/1024/1280，不是 672/896/1120。rem **间距**才受根字号影响，两者不要混，
              此时内容区约 592px，刚好容得下 580px 的图；再窄就得滑）。 */}
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--text-2)] md:hidden">
            屏幕较窄时，图片可以左右滑动看清原文。
          </p>
        </header>

        {/* ── 四块证据 ─────────────────────────────────────────────── */}
        <ul className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
          {EVIDENCE.map((item) => (
            <li key={item.src} className={`${item.span} ${CARD}`}>
              {item.split ? (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[580px_minmax(0,1fr)] xl:items-center xl:gap-10">
                  <Shot item={item} />
                  <Caption item={item} />
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {/* xl 档 8/4 分栏行的两卡并排：图高 56 vs 62，不垫齐的话说明块
                      从不同 y 起排，相邻标题错开 6.00px（实测 1681 vs 1687）。
                      min-h 取两张堆叠图的较大高度，只在 xl 生效——窄档单列堆叠
                      不构成相邻行带，无需垫。 */}
                  <div className="xl:min-h-[62px]">
                    <Shot item={item} />
                  </div>
                  <Caption item={item} />
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* ── 出处（铁律：产品实拍必须就近标注）─────────────────────────
            截图里是种子演示数据，不标注等于把样例当成真实的学生对话在展示。 */}
        <p className="mt-6 text-[14px] leading-relaxed text-[var(--text-2)]">
          以上四张均为 /chat 页面界面实拍 · 内容为演示样例，不是真实学生的对话。
        </p>
      </div>
    </section>
  );
}

/**
 * 截图框薄封装。真正的实现在 ScrollShot（客户端组件）——
 * 「可不可以横向滚」只有量了才知道，见那个文件的头注释。
 *
 * 三个尺寸相关的决定沿用至今，别按「看着更简单」改回去：
 *
 * · **`max-w-none`**：Tailwind preflight 给 `img` 设了 `max-width:100%`。不解除的话，
 *   图在滚动容器里照样被压回容器宽度，滚动条**永远不出现**——看上去一切正常，
 *   实际上悄悄退回了「缩到看不清」，也就是这一节唯一要避免的失败。
 *
 * · **`w-fit max-w-full`**：首版让框铺满栅格列，结果第三、四块（580 与 134 的图
 *   放进 742 / 335 的列里）在图右侧留出一大片空底色，读起来像图没加载完。
 *   `w-fit` 让框裹住图，`max-w-full` 再把它压回容器宽——窄屏于是回到滚动，
 *   两者缺一：只写 `w-fit` 时 min-content 等于图宽，390px 下会把文档撑出横向滚动条。
 *
 * · **描边用 `ring` 不用 `border`**：全局 `* { box-sizing: border-box }`，
 *   1px 边框会从内容宽里扣掉 2px，于是 580px 的图在 580px 的栅格列里**永远差 2px**，
 *   桌面档凭空长出一条横向滚动条。ring 走 box-shadow，不参与盒模型计算。
 */
function Shot({ item }: { item: Evidence }) {
  return (
    <ScrollShot
      src={item.src}
      width={item.width}
      height={item.height}
      alt={item.alt}
      title={item.title}
      fade={item.fade}
    />
  );
}

function Caption({ item }: { item: Evidence }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[18px] font-bold text-[var(--text)]">{item.title}</h3>
      <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-2)]">
        {item.body}
      </p>
    </div>
  );
}
