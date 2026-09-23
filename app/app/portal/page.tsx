import type { Metadata } from "next";
import { PortalNav } from "@/components/portal/PortalNav";
import { PortalHero } from "@/components/portal/PortalHero";
import { FactBadges } from "@/components/portal/FactBadges";
import { ProofStrip } from "@/components/portal/ProofStrip";
import { RoleEntries } from "@/components/portal/RoleEntries";
import { Capabilities } from "@/components/portal/Capabilities";
import { ThreeSteps } from "@/components/portal/ThreeSteps";
import { TrustSafety } from "@/components/portal/TrustSafety";
import { TrustLedger } from "@/components/portal/TrustLedger";
import { PortalFaq } from "@/components/portal/PortalFaq";
import { PortalFooter } from "@/components/portal/PortalFooter";

export const metadata: Metadata = {
  title: "i-learning · 校内 AI 平台",
  description: "面向教师与学生的校内 AI 助手：数据存放于校内、不用于训练、不收取费用。",
  // og:image 用专门生成的 portal-og.webp（构图就是为分享卡设计的：左上留白供
  // 标题、右下棱镜母题）。**这张图生成并登记后曾经空挂了一轮**——资产存在不等于
  // 资产生效，与 ProofStrip 建好未挂载是同一类错，接线时一并记在这里。
  // 尺寸写实际像素（1400×933）：抓取方按此预留卡片比例，写错会被裁。
  openGraph: {
    title: "i-learning · 校内 AI 平台",
    description: "面向未成年人的校内 AI，先说清边界：数据存放于校内、不用于训练、不收取费用。",
    images: [{ url: "/art/portal-og.webp", width: 1400, height: 933, alt: "i-learning · 校内 AI 平台" }],
  },
};

/**
 * /portal — 登录前的公开门户页。
 *
 * 位置：**在 (shell) 之外**。⚠️ 本注释首版写「没有 middleware」——**错的**：
 * 本项目有 middleware，只是 Next.js 16 把它改名成了 `proxy.ts`（我按 middleware.ts
 * 找了两次都没找到，AGENTS.md 开篇警告的正是这类破坏性变更）。
 * 实际情况：proxy.ts 只管登录后的 RBAC 重定向与 /learn 并线，
 * **不拦公开路由**，所以 /portal 无需白名单即可匿名访问——结论没变，依据修正。
 *
 * `data-register="portal"` 是整页的关键：门户的暖底、展示字阶（56/40/28）与
 * 宽版心全部锁在这个作用域选择器里（见 globals.css）。**不加这个属性，
 * 页面会静默退回应用内令牌**——底色变冷灰、展示字号全部失效，而且不报错。
 * 换句话说这不是装饰性的 data 属性，是这页的样式开关。
 *
 * 为什么必须作用域化：应用页的字阶棘轮已收敛到 ≤7 档、色彩棘轮走过六批，
 * 门户的 56px 展示字号若泄漏进去会一次性撞穿它们。
 */
export default function PortalPage() {
  return (
    <div data-register="portal" data-portal-root className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* 跳过导航。登录后的 (shell) 布局每页都有，门户页此前没有：键盘用户要穿过
          5 个导航停靠点才够得到正文，而 <main> 连 id 都没有，想手写锚点也没有落点。
          `tabIndex={-1}` 是必需的——<main> 本身不可聚焦，缺了它部分浏览器只滚动
          不移焦，下一次 Tab 会回到导航开头，等于这条链接没生效。 */}
      {/* **不要给它加 data-ink="dark"。** 它聚焦时自己确实是一块深底，但
          outline-offset: 2px 让焦点环画在盒子**之外**，落在奶油色的页面底上——
          标成 dark 会拿到奶油白的环，压在奶油底上正好 1.00:1，等于没有焦点指示。
          （这条弯路走过：先按「元素自身底色」量出 2.02:1 判它失守，加了 data-ink，
          结果制造出真正的 1.00:1。参照系要取环实际落点的底色，不是元素自己的。） */}
      <a
        href="#portal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-[var(--r-ctl)] focus:bg-[var(--portal-ink)] focus:px-4 focus:py-3 focus:text-[14px] focus:font-semibold focus:text-[var(--portal-on-ink)]"
      >
        跳到主要内容
      </a>
      <PortalNav />
      <main id="portal-main" tabIndex={-1}>
        <PortalHero />
        {/* 事实徽章条紧贴首屏：读者在 30 秒内能拿到的信任依据，放到页面中部
            等于没有（大部分人滚不到那里）。五枚全部可点、落到本页对应落点。 */}
        <FactBadges />
        {/* 证据条紧跟首屏：首屏的 h1 做出「先说清边界」这个主张，
            这一节立刻用 /chat 的界面实拍把主张兑现——四张原分辨率裁剪，
            AI 那句「我不会替你写完整答案，但会陪你想明白」直接可读。
            放在 RoleEntries 之前，是因为「它怎么对待学生」比「谁能用它」更该先回答。 */}
        <ProofStrip />
        <RoleEntries />
        <Capabilities />
        {/* 三步上手放在能力总览之后：先知道「有什么」，再问「怎么开始」。
            反过来会让读者在还不知道平台能干嘛时就被灌流程。 */}
        <ThreeSteps />
        <TrustSafety />
        {/* 问答承压层放在安全区块**之后**：先常驻讲清安全承诺，再用折叠区承接
            程序性追问。反过来会让读者在还没读到承诺时就先点开一堆细节。 */}
        {/* 制品目录紧跟安全承诺：先说我们怎么做，再给出「凭什么信」的可核对清单
            （含还没有的四项）。放在 FAQ 之前——它是证据，FAQ 是追问。 */}
        <TrustLedger />
        <PortalFaq />
      </main>
      <PortalFooter />
    </div>
  );
}
