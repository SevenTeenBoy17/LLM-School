import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Phone } from "lucide-react";
import { PrintButton } from "@/components/portal/PrintButton";

/** 版心：门户全站统一的 1280 + 40（≤900px 时 --portal-pad 自动收到 20）。 */
const SHELL = "mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]";

/** 深底上的次级文字：奶油白降到 70%，比另起一个灰色令牌更稳——
 *  深底上的灰会发脏，同色降透明度始终跟着 --portal-on-ink 走。 */
const MUTED = "text-[var(--portal-on-ink)]/70";

/** 深底链接：静止 70%，悬停/聚焦回到 100%，只动透明度不动色相。
 *
 *  `inline-flex min-h-[24px] items-center` 替换原来的 `inline-block`：
 *  14px 文字 × 1.5 行高只有 **21px**，六个页脚链接（含心理援助热线 12356）
 *  全部低于 24px 触达下限——而且**视觉门看不见它们**：该门的 visible() 排除
 *  视口外元素，页脚永远在首屏折叠线以下。是 portal.mjs 新加的全页触达断言
 *  抓出来的。min-height 用绝对像素不用 rem 档位（根字号 14px，h-6 只有 21px）。 */
const LINK =
  "inline-flex min-h-[24px] items-center text-[var(--portal-on-ink)]/70 transition-colors duration-[var(--t-fast)] ease-[var(--ease-out)] hover:text-[var(--portal-on-ink)] focus-visible:text-[var(--portal-on-ink)]";

interface FooterLink {
  label: string;
  href: string;
}

const PLATFORM_LINKS: FooterLink[] = [
  { label: "能力总览", href: "#capabilities" },
  { label: "三个入口", href: "#roles" },
  { label: "常见问题", href: "#faq" },
  { label: "进入平台", href: "/login" },
];

/** 按角色开的一列。研究结论：页脚是全站每屏都能滚到的位置，至少一列应以角色命名，
 *  让带着身份来的人在任何滚动深度都能归位。三条都落到 #roles 区块——
 *  tab 状态未同步 URL 前不做假深链（写 ?role=teacher 却不生效比不写更糟）。 */
const ROLE_LINKS: FooterLink[] = [
  { label: "我是教师", href: "#roles" },
  { label: "我是学生", href: "#roles" },
  { label: "我是管理员", href: "#roles" },
];

const SAFETY_LINKS: FooterLink[] = [
  // 落点纠错（本轮）：原先两条不同标签都指向 #safety 整节——标签承诺了两种信息，
  // 落点却是同一个，等于其中一条没有兑现。现在各指向 TrustSafety 里对应的支柱卡
  // （id 在 TrustSafety.tsx 的 PILLARS.anchor 定义），点「数据存放说明」就落在
  // 数据那张卡上。scroll-margin-top 由 globals.css 的 [id^="safety-"] 规则供给。
  { label: "未成年人保护", href: "#safety-crisis" },
  { label: "数据存放说明", href: "#safety-data" },
  { label: "内容边界与学段", href: "#safety-scope" },
  { label: "守护与使用时段", href: "#safety-guardian" },
];

/**
 * PortalFooter — 门户页收尾：结尾 CTA（--portal-ink-2）+ 页脚（--portal-ink）。
 *
 * 三条刻意的取舍：
 *
 * 1. **CTA 不说「注册 / 试用 / 免费」**。账号由学校下发，这里唯一诚实的动作是
 *    「进入」，所以按钮下的小字直接给出没有账号时的真实路径（班主任 / 信息中心），
 *    而不是给一个点了会失败的注册入口。
 *
 * 2. **心理援助热线常驻在页脚正文里**，不折叠、不藏在「更多」后面。页脚是全站
 *    每一屏都能滚到的位置，把求助信息放这里意味着任何时刻都能拿到。
 *
 * 3. **没有社交媒体图标**。我们没有这些账号，摆一排空链接就是编造。
 *
 * 纯静态组件：无状态、无事件、无请求，交互全部交给 CSS 伪类。
 */
export function PortalFooter() {
  return (
    <>
      {/* ── 上半：结尾 CTA ────────────────────────────────────────────── */}
      {/* aria-labelledby 不只是装饰：这一整块（含全页最后一个主行动按钮）位于
          </main> 之后、<footer> 之前，既不属于 main 也不属于 contentinfo。
          <section> 只有拿到可访问名称才会成为 region 地标——没有名称时，
          按地标导航的读屏用户会把整块直接跳过。 */}
      <section
        aria-labelledby="portal-cta-heading"
        data-ink="dark"
        className="relative isolate overflow-hidden bg-[var(--portal-ink-2)] text-[var(--portal-on-ink)]"
      >
        {/* CTA 带背景：光带从两缘向中心汇聚，**生成时就要求中央三分之一保持深色空置**——
            按钮正好落在那块暗区上，不需要再叠遮罩。装饰图，alt="" + aria-hidden。 */}
        <Image
          src="/art/portal-cta.webp"
          alt=""
          aria-hidden="true"
          width={1400}
          height={933}
          sizes="100vw"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full select-none object-cover object-center"
        />
        <div className={`${SHELL} py-14 text-center sm:py-16 lg:py-20`}>
          {/* 字号从 d3 升到 d2。d3 在本页只有两个使用者，另一个是 Capabilities 的
              h3「我们刻意不做的事」——于是全页最后一个转化点的 h2 与一个 h3 同号
              （像素墨迹盒都是 27px 高），标题字号不再表达层级。≤900px 更糟：
              d3 在那里是 22px，与正文 16px 只差 1.375 倍。 */}
          <h2
            id="portal-cta-heading"
            className="text-[length:var(--fs-d2)] leading-[var(--lh-d)] font-bold"
          >
            用你的校内账号进入
          </h2>

          <p className={`mx-auto mt-4 max-w-[42rem] text-[16px] leading-relaxed ${MUTED}`}>
            登录后按角色进入：教师端有备课助手、提示词库与班级学情，学生端有对话、
            成长记录与错题本。
          </p>

          {/* 双路径收尾：滚到底的人里既有拿着账号来登录的师生，也有还没接入的
              学校与家长。研究明确要求收尾 CTA 与首屏一样给两条路径——只给一条
              等于把另一半人在最后一步丢掉。措辞与首屏保持一致（同为「进入平台」
              和「我还没有账号」），漏斗才不会在末端断裂。 */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-[48px] items-center justify-center gap-2 rounded-[var(--r-ctl)] bg-[var(--portal-cta-inv)] px-8 text-[16px] font-semibold text-[var(--portal-cta-inv-ink)] shadow-[var(--shadow-lg)] transition-colors duration-[var(--t-base)] ease-[var(--ease-out)] hover:bg-[var(--card)]"
            >
              进入平台
              <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
            <Link
              href="#faq"
              className="inline-flex h-[48px] items-center justify-center gap-2 rounded-[var(--r-ctl)] px-8 text-[16px] font-semibold text-[var(--portal-on-ink)] ring-1 ring-[color-mix(in_srgb,var(--portal-on-ink)_38%,transparent)] transition-[background-color,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:bg-[color-mix(in_srgb,var(--portal-on-ink)_10%,transparent)] hover:ring-[color-mix(in_srgb,var(--portal-on-ink)_72%,transparent)]"
            >
              我还没有账号
            </Link>
          </div>

          <p className={`mt-5 text-[14px] leading-relaxed ${MUTED}`}>
            使用学校下发的账号登录 · 没有账号请联系班主任或信息中心
          </p>
          <p className={`mt-4 text-[12px] ${MUTED}`}>背景美术由 AI 生成</p>
        </div>
      </section>

      {/* ── 下半：页脚 ────────────────────────────────────────────────── */}
      <footer data-ink="dark" className="bg-[var(--portal-ink)] text-[var(--portal-on-ink)]">
        <div className={`${SHELL} py-12 sm:py-14`}>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* 第一列：品牌 */}
            <div>
              <div className="text-[18px] font-bold">i-learning</div>
              <p className={`mt-3 max-w-[22rem] text-[14px] leading-relaxed ${MUTED}`}>
                校内 AI 平台，服务于教师备课与学生学习。
              </p>
              {/* 原本这里有个「v2.6.0」版本徽标。已删：仓库里唯一的版本真相是
                  package.json 的 0.1.0，没有任何生成或校验链路指向 2.6.0。
                  在登录前的公开页上放一个无出处的版本号，等于暗示了一段并不存在的
                  发布史——这属于编造数据，哪怕它看起来只是个不起眼的小徽标。
                  要么接真实版本，要么不放；此处选择不放。 */}
            </div>

            {/* 第二列：平台 */}
            <nav aria-label="平台">
              <h3 className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-on-ink)]">
                平台
              </h3>
              <ul className="mt-4 space-y-3 text-[14px]">
                {PLATFORM_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className={LINK}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* 第三列：按角色。研究要求页脚至少一列以角色命名——带着身份来的人
                在任何滚动深度都能归位，而不是只能靠页面中部那一处 tab。 */}
            <nav aria-label="按角色">
              <h3 className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-on-ink)]">
                按角色
              </h3>
              <ul className="mt-4 space-y-3 text-[14px]">
                {ROLE_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className={LINK}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* 第四列：安全与隐私（常驻可见，不折叠） */}
            <nav aria-label="安全与隐私">
              <h3 className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-on-ink)]">
                安全与隐私
              </h3>
              <ul className="mt-4 space-y-3 text-[14px]">
                {SAFETY_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className={LINK}>
                      {item.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a href="tel:12356" className={`${LINK} inline-flex items-center gap-2`}>
                    <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                    心理援助热线 12356
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* 二次转化带：承接滚到底却还没登录的人。不做订阅表单（无邮件列表、
            非付费，放一个等于承诺不存在的路径），改为把这一页交出去。 */}
        <div className="border-t border-[var(--portal-on-ink)]/15">
          <div className={`${SHELL} flex flex-wrap items-center justify-between gap-4 py-6`}>
            <p className={`max-w-[var(--measure-md)] text-[14px] leading-relaxed ${MUTED}`}>
              需要把边界与数据流向交给信息中心或家长会？这一页可以直接打印，内容与你现在看到的一致。
            </p>
            <PrintButton />
          </div>
        </div>

        {/* 最底一行 */}
        <div className="border-t border-[var(--portal-on-ink)]/15">
          <div className={`${SHELL} py-6`}>
            <p className={`text-center text-[12px] leading-relaxed ${MUTED}`}>
              © 十七岁少年想当歌手 · 数据存储于校内 · 本平台不收取任何费用
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
