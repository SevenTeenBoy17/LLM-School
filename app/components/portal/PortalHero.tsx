import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LifeBuoy, School, ShieldCheck } from "lucide-react";

/**
 * PortalHero — /portal 首屏英雄区（深靛底 + 奶油字 + 背景美术 + 产品实拍）。
 *
 * 五个刻意的取舍：
 *
 * 1. **安全提示条是常驻结构，不是可关闭的提示。** 它没有关闭按钮、没有折叠、
 *    不在任何 hover/展开之后才出现，也不用 `--warn-*` 那套「出事了」的配色。
 *    理由是这条信息的价值恰恰在**没出事的时候**：一个正处在低谷的学生不会先
 *    去点「查看更多」再决定要不要求助。把它做成可关闭的横幅等于承认它是噪音；
 *    做成常驻的一行，等于承认它和「进入平台」是同一层级的信息。
 *    通用 AI 产品的首屏不需要这一行，面向未成年人的校内平台需要。
 *
 * 2. **首屏一个数字都不放。** 没有用户数、学校数、满意度、增长率。
 *    我们没有这些数据，编一个「服务 XX 所学校」的代价是：读者一旦发现一处是
 *    编的，整页的安全承诺都会跟着不可信——而安全承诺是这页真正要传达的东西。
 *    首屏的说服力全部押在「说清楚边界」上，这也是标题写「先说清边界」的原因。
 *
 * 3. **背景美术仍然是棱镜分光，仍然没有拟人形象。** 本轮把原先那一整套 CSS
 *    画的棱镜（REFRACTED_BANDS + 七八个绝对定位层）换成了生成美术
 *    `/art/portal-hero.webp`——母题、纪律、色域一个没变（同一束光、同一族蓝、
 *    刻意不用彩虹，理由是七色会把「装饰」升级成「编码」，让人误以为每条颜色
 *    各代表一种能力），换的只是保真度：位图能画出 CSS 画不出的柔光与轨道弧，
 *    27 KB 也比十几个 blur 图层便宜。
 *    项目明确不做 AI 人格化：给未成年人的工具一旦长出脸和名字，就会被当成
 *    「朋友」而不是「工具」，而全站安全策略（危机拦截、诚信脚手架、家长守护）
 *    都建立在「它是工具」这个前提上。所以这张图的 prompt 里显式禁止人物/面孔/
 *    吉祥物，成图是纯几何（登记见 public/art/REGISTRY.md）。
 *
 * 4. **两张图，两种标注纪律，不能混用。**
 *    · 背景美术 `alt="" + aria-hidden`（纯装饰、不承载任何唯一信息），
 *      但**页面上必须写明「背景美术由 AI 生成」**——来源确凿所以必须标；
 *      这与 /explore 那 8 张的处置相反，那批是**来源不明所以不能标**
 *      （贴一行未经证实的来源声明本身就是编造）。
 *    · 产品实拍 `/shots/chat.webp` 是真实界面，但截图里跑的是**种子演示数据**，
 *      因此紧挨着它必须有「界面实拍 · 内容为演示样例」——不标注等于把演示
 *      样例当成真实业绩，和编一个用户数是同一类错误。alt 写具体内容而不是
 *      `alt=""`：它承载「产品长什么样」这条信息，读屏用户不该只听到一句「图片」。
 *
 * 5. **颜色全部走 var(--令牌) + color-mix，文件内零 hex 字面量。** 半透明档位
 *    用 `color-mix(in srgb, var(--portal-on-ink) N%, transparent)` 而不是
 *    `rgba(255,255,255,.4)`：后者在暖奶油白（--portal-on-ink 并非纯白）上会
 *    偏冷，叠几层之后深底会发灰。
 *
 * ── 四个实测踩到的坑，写在这里免得下一个人再踩一遍 ──────────────────
 *
 * A. **描边按钮不能用 `border-[...]` 工具类。** globals.css 里 `* { border-color:
 *    var(--border) }` 是**无层**（unlayered）规则，而 Tailwind 工具类在
 *    `@layer utilities` 里；级联层的比较**先于**特异度，所以无层的 `*` 通吃所有
 *    border-color 工具类。首版写 `border-[color-mix(...)]` 实测渲染成暖灰
 *    `--border`——CSS 生成了、类挂上了、颜色是错的，静默失败。
 *    这里改用 `ring-*`（走 box-shadow，不受那条 `*` 影响），hover 变亮也就还能用；
 *    需要真 border 的地方（徽章/提示条/窗口标题栏）一律走 **inline style**，行内样式
 *    压得过无层规则。同理 `a { color: inherit }` 也是无层的，链接的 text-* 工具类
 *    同样无效——所以文字颜色靠 section 上的继承，而不是在 <a> 上写 text-*。
 *
 * B. **不要用 `h-12` 当按钮高度。** 本项目 body font-size 是 14px，Tailwind v4 的
 *    间距标度是 rem 制，`h-12`(3rem) 实测只有 **42px**，低于 44px 触达目标下限。
 *    按钮高度用绝对像素 `h-[48px]`。同理小字一律绝对像素：视觉门的正文字号
 *    下限是 11px，而 `text-xs` 在 14px 根字号下只有 10.5px，写档位就直接撞红。
 *
 * C. **section 的 `bg-[var(--portal-ink)]` 不能因为「反正被图盖住了」而删掉。**
 *    实心按钮对比度门量的是**计算样式里的 backgroundColor**，它沿 DOM 向上找第一个
 *    不透明祖先，看不见位图。删掉这句，主 CTA 的「控件 vs 页面底」会去跟更外层的
 *    暖奶油 `--bg` 比——奶油白按钮压奶油白页面，1.0:1，门会红，而截图上看着完全正常。
 *
 * D. **Next.js 16 的 `priority` 已废弃，改用 `preload`。** 但本区块有两张候选 LCP 图
 *    （背景美术全屏、产品实拍仅 ≥1024px 出现），官方文档明确说这种情况不要用
 *    `preload`，改用 `loading="eager"` / `fetchPriority`——否则会在 <head> 里插一条
 *    小屏根本用不上的预加载。背景美术是唯一在三档视口都出现的图，eager + high 给它。
 *
 * E. **`hidden lg:block` 不等于「小屏不下载」，但保持默认的 lazy 就等于。**
 *    我原本在这里写了一句「小屏连字节都不下载」，然后去量了一下，是错的：
 *    产品实拍写 `loading="eager"` 时，390px 下 `display:none` 照样发出了
 *    `/_next/image?url=/shots/chat.webp&w=384` 这个请求——**eager 的语义就是
 *    「别管可见性，立刻拿」**。去掉 eager 改回默认的原生 lazy 之后实测：
 *      · 390px —— chat.webp **零请求**
 *      · 1440px —— 照旧立刻请求 w=640（它本来就在首屏内，lazy 不会拖延首屏图）
 *    也就是说这里 eager 只有代价没有收益。**注释里写的性能结论必须是量出来的**，
 *    这一条差点就成了一句永远没人会去核对的漂亮话。
 */

/** 深底上的半透明奶油白。集中在一处生成，避免各处手写百分比漂移。 */
const onInk = (pct: number) => `color-mix(in srgb, var(--portal-on-ink) ${pct}%, transparent)`;
/** 深靛底色的半透明档位。压在背景美术之上做遮罩，让左侧文案区回到可读对比度。 */
const inkVeil = (pct: number) => `color-mix(in srgb, var(--portal-ink) ${pct}%, transparent)`;

/**
 * 浏览器窗口标题栏的三颗圆点。
 *
 * **刻意是同一族奶油白的三档明度，不是红黄绿。** 红黄绿是 macOS 的窗口按钮，
 * 照搬过来有两个代价：一是凭空引入三个与本页色纪律无关的色相（门户整层只有
 * 单一强调族），二是它们在真实系统里是**可点的控件**，画成静态装饰等于做了三个
 * 假按钮。三档灰只说明「这是一个窗口」，不假装它可以被操作。
 */
const WINDOW_DOTS = [40, 28, 20] as const;

export function PortalHero() {
  return (
    <section
      // overflow-hidden 是必需的：背景美术按 object-cover 铺满会溢出，
      // 右侧那块产品实拍还带 2.5° 旋转，不裁掉会在窄屏撑出横向滚动条。
      // bg-[var(--portal-ink)] 不是多余的兜底色，见文件头注释 C。
      data-ink="dark"
      className="relative isolate overflow-hidden bg-[var(--portal-ink)] text-[var(--portal-on-ink)]"
    >
      {/* ── 背景美术（装饰，见文件头注释 3/4）────────────────────────────
          原始尺寸 1400×933，object-cover 会按视口比例裁掉上下或左右：
          构图上左上是留白、光带在右下，所以横裁纵裁都不会切掉主体。 */}
      <Image
        src="/art/portal-hero.webp"
        alt=""
        aria-hidden="true"
        width={1400}
        height={933}
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full select-none object-cover object-center"
      />

      {/* 遮罩：左侧压成近乎纯深靛（文案区要 15:1 级的对比度），
          越往右越透，把光带与产品实拍完整让出来；再叠一层自下而上的收底，
          让底部那行 AI 生成标注与安全提示条不至于压在亮部上。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: [
            `linear-gradient(100deg, var(--portal-ink) 0%, ${inkVeil(92)} 34%, ${inkVeil(58)} 58%, ${inkVeil(20)} 78%, transparent 100%)`,
            `linear-gradient(to top, ${inkVeil(62)} 0%, transparent 34%)`,
          ].join(", "),
        }}
      />

      {/* ⚠️ 窄屏补一层近乎不透明的遮罩——**这不是审美调整，是修一条 AA 失守**。
          上面那道 100deg 渐变是按**桌面双栏**调的：文案锁在左半屏（遮罩 72–92% 区间），
          实测 8–15:1，没问题。但 <lg 时布局塌成单栏、正文占满整幅宽度，
          安全提示条的第一行正好落在遮罩最薄（78% 处只剩 20% 靛）而光带最亮的那块。
          逐像素复现（解码 webp + 还原 object-cover 裁切 + 两层遮罩合成）实测：
            360px → 2.43–2.51:1 ／ 390px → 2.28–2.55:1 ／ 414px → 2.34–2.61:1
            430px → 2.37–2.65:1 ／ 480px → 2.46–2.78:1 ／ 540px → 2.59–2.92:1
          全部低于 AA 的 4.5:1，**而它压住的恰恰是「遇到困难随时可以求助」那一行**——
          全页最不能看不清的一句。
          做成 `lg:hidden` 的独立层而不是去改上面那道渐变：渐变是为宽屏构图调的，
          改它会把桌面档好不容易让出来的光带又盖回去。窄屏本来就看不到右侧产品实拍，
          背景美术在这一档退成纯氛围底色没有任何损失。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 lg:hidden"
        style={{ backgroundColor: inkVeil(90) }}
      />

      <div className="mx-auto flex min-h-[640px] w-full max-w-[var(--portal-max)] flex-col justify-center px-[var(--portal-pad)] py-20 lg:min-h-[720px] lg:py-28">
        <div className="flex flex-col gap-14 lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-12">
          {/* ── 左：文案 ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-start">
            <p
              className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[14px] font-semibold"
              style={{ borderColor: onInk(24), backgroundColor: onInk(8) }}
            >
              <School aria-hidden="true" className="h-4 w-4" />
              校内 AI 平台 · i-learning
            </p>

            {/* 中文没有词间空格，浏览器可以在**任意两个汉字之间**断行——首版实测在 1440px
                下断成「面向未成年人的校 / 内 AI，先说清边界」，把「校内」这个复合词劈开了。
                `text-balance` 治不了这个：它只均分行宽，不认词边界。
                解法是把不该拆的那个词包成 nowrap 的整体单元，剩下的交给贪婪换行——
                这样 1440px 断在逗号处、390px 断在「的」之后，两档都落在语义停顿上。
                比写死 <br> 好：不用为每个断点各挑一个断行位置。 */}
            <h1 className="mt-6 text-[length:var(--fs-d1)] leading-[var(--lh-d)] font-bold">
              面向未成年人的<span className="whitespace-nowrap">校内 AI</span>，
              <span className="whitespace-nowrap">先说清边界</span>
            </h1>

            <p
              className="mt-6 max-w-[52ch] text-[18px] leading-[1.75] font-normal"
              style={{ color: onInk(82) }}
            >
              {/* 原文是「数据**留在**学校自己的服务器」。那句比事实宽：
                  产品自己的隐私说明（SafetyHelp.tsx:187）写的是「存储在学校内部服务器；
                  AI 回答与生图会经加密通道调用校外大模型服务完成计算」——
                  **对话内容确实会出校做推理，只是不落在校外**。
                  「留在」是「不出去」的意思，等于对外宣称的口径比对内披露的更宽。
                  这一页的说服力全押在安全承诺上，一处口径失守会连累整页。
                  改为只说存储（与 app/portal/page.tsx:11 和 TrustSafety 的措辞一致），
                  「推理会出校」这件事在安全区如实展开说，不塞进首屏副标题。 */}
              教师用它备课、建学科智能体、看班级学情；学生用它提问、整理错题。
              对话与作业数据存放在校内，面向全校师生开放，不收费。
            </p>

            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              {/* 主动作：深底上唯一的实心块，走 `--portal-cta-inv`（奶油白实心 + 深靛字）。
                  首版是钴蓝实心。改掉的理由是实测：钴蓝压在深靛区块上只有 **2.21:1**，
                  低于 WCAG 1.4.11 对非文字控件的 3:1——**按钮本身在背景里浮不出来**，
                  这跟「文字看不清」是两个独立的失败，前者不看文字对比度就发现不了。
                  反相后控件与文字双双 15:1 以上。
                  同一个动作在浅底（导航 / 登录页）仍是钴蓝实心：**一个色族两种明度形态，
                  不是两种颜色**。 */}
              <Link
                href="/login"
                className="group inline-flex h-[48px] items-center justify-center gap-2 rounded-[var(--r-ctl)] bg-[var(--portal-cta-inv)] px-[26px] text-[16px] font-semibold text-[var(--portal-cta-inv-ink)] shadow-[var(--shadow-md)] outline-none transition-[transform,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-lg)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                进入平台
                <ArrowRight
                  aria-hidden="true"
                  className="h-[18px] w-[18px] transition-transform duration-[var(--t-fast)] ease-[var(--ease-out)] group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>

              {/* 次动作指向 #safety。放在首屏而不是页脚：安全边界是这页的主张之一，
                  需要被「一眼看到并且能立刻跳过去」，不是读完全页才发现的补充说明。 */}
              <a
                href="#safety"
                // 描边走 ring（box-shadow）而不是 border——理由见文件头注释 A。
                className="inline-flex h-[48px] items-center justify-center gap-2 rounded-[var(--r-ctl)] px-[26px] text-[16px] font-semibold ring-1 ring-[color-mix(in_srgb,var(--portal-on-ink)_38%,transparent)] outline-none transition-[background-color,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:bg-[color-mix(in_srgb,var(--portal-on-ink)_10%,transparent)] hover:ring-[color-mix(in_srgb,var(--portal-on-ink)_72%,transparent)] motion-reduce:transition-none"
              >
                <ShieldCheck aria-hidden="true" className="h-[18px] w-[18px]" />
                先看安全边界
              </a>
            </div>

            {/* 第二路径（三级文字链，不做第三个按钮）：首屏的两个按钮服务的是
                「已经有账号」和「想先看边界」两种人，还有第三种——学校没接入、
                手上根本没有账号。研究要求收尾与首屏都给两条路径；这里用文字链
                而不是按钮，避免首屏出现三个同权重动作导致「下一步」没有唯一解。 */}
            <a
              href="#faq"
              className="mt-4 inline-flex min-h-[24px] items-center gap-1 text-[16px] font-semibold text-[var(--portal-on-ink)]/80 underline-offset-4 transition-colors duration-[var(--t-fast)] hover:text-[var(--portal-on-ink)] hover:underline"
            >
              我还没有账号，怎么办？ →
            </a>

            {/* ── 常驻安全提示条（见文件头注释 1）──────────────────────────
                无关闭按钮、无折叠、无 hover 才显形；文字用满不透明度的
                --portal-on-ink，比上面的副标题（82%）更亮，是首屏对比度最高的正文。
                背景改到位图之后这条更要紧：它坐落在遮罩最浓的一侧，
                不要为了「让美术透出来」把它挪去右边。 */}
            <div
              className="mt-8 flex w-full max-w-[52ch] items-start gap-3 rounded-[var(--r-ctl)] border px-4 py-3"
              style={{ borderColor: onInk(20), backgroundColor: onInk(7) }}
            >
              <LifeBuoy aria-hidden="true" className="mt-[3px] h-[18px] w-[18px] shrink-0" />
              <p className="text-[16px] leading-[1.6] font-normal">
                遇到困难随时可以求助 · 求助入口在学生端与教师端
                <span className="whitespace-nowrap">每一页常驻</span>
              </p>
            </div>
          </div>

          {/* ── 右：产品实拍（见文件头注释 4）──────────────────────────────
              `hidden lg:block`：390px 下塞一张 1280w 的整页截图，读者既看不清
              界面细节、又会把常驻安全提示条挤出首屏——那是拿一张缩略图换掉一条
              真正要被看见的信息。
              下面那张 Image **刻意不写 loading**（用默认的原生 lazy），实测理由见
              文件头注释 E：写 eager 会让小屏把这张用不上的图也下下来。 */}
          <figure className="hidden lg:block">
            <div
              // 2.5° 的倾斜 + 大阴影，让窗口读起来是「浮在光带上方」而不是「贴在图上」。
              // 旋转不改变布局盒，只在视觉上外扩约 7px；section 的 overflow-hidden
              // 兜住它，不会引起横向滚动。
              className="rotate-[2.5deg] overflow-hidden rounded-[var(--r-card)] shadow-[var(--shadow-lg)] ring-1 ring-[color-mix(in_srgb,var(--portal-on-ink)_22%,transparent)]"
              style={{ backgroundColor: onInk(10) }}
            >
              {/* 窗口标题栏。border 走 inline style 而不是 border-b 工具类——理由见注释 A。 */}
              <div
                className="flex h-[34px] items-center gap-[7px] px-4"
                style={{ backgroundColor: onInk(14), borderBottom: `1px solid ${onInk(16)}` }}
              >
                {WINDOW_DOTS.map((pct) => (
                  <span
                    key={pct}
                    aria-hidden="true"
                    className="block h-[10px] w-[10px] rounded-full"
                    style={{ backgroundColor: onInk(pct) }}
                  />
                ))}
              </div>

              {/* 承载信息的图 → 写具体 alt，不用 alt=""（见文件头注释 4）。 */}
              <Image
                src="/shots/chat.webp"
                alt="i-learning AI 对话页界面：左侧是导航与学科智能体列表，中间对话区里 AI 以「学术诚信引导」分三步回应学生的提问、并注明不会替学生写完整答案，右侧显示当前模型与推荐提示词，右下角常驻「安全求助」入口。"
                width={1400}
                height={875}
                sizes="(min-width: 1440px) 600px, 46vw"
                className="block h-auto w-full select-none"
              />
            </div>

            {/* 标注不跟着倾斜：斜排的小字更难读，而这一行的作用恰恰是「被读到」。
                mt-8 里有一半是留给旋转后右下角外扩出来的那约 13px。 */}
            <figcaption
              className="mt-8 text-[12px] leading-[1.6] font-normal"
              style={{ color: onInk(90) }}
            >
              界面实拍 · 内容为演示样例
            </figcaption>
          </figure>
        </div>

        {/* 生成美术的来源标注。放在版心最底、与内容同列而不是绝对定位到角落：
            绝对定位在 390px 下会压到安全提示条上，而这两条谁也不该盖住谁。 */}
        <p
          className="mt-12 text-[12px] leading-[1.6] font-normal lg:mt-14"
          style={{ color: onInk(56) }}
        >
          背景美术由 AI 生成
        </p>
      </div>
    </section>
  );
}
