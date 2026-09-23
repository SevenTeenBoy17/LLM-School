import Link from "next/link";
import { FACT_BADGES } from "@/lib/data/portalFacts";

/**
 * FactBadges — 首屏正下方的事实徽章条。
 *
 * **它不是认证徽章条，这个区别是本组件存在的全部理由。**
 *
 * 同类平台在这个位置放的是第三方认证标记（合规框架、评级、奖项）。我们一枚都没有，
 * 而自制一个看起来像认证的图形是伪造——在采购与信息中心眼里那是负分，
 * 且一旦被识破会连累整页的安全承诺。
 *
 * 于是换一种做法：这里放的每一枚都是**可以被本产品的界面或代码推翻的自陈事实**，
 * 出具方就是我们自己，不假装是第三方。每一枚都可点，落到本页安全区块里对应的
 * 那张卡——读者能当场核对我们凭什么这么说。
 *
 * 三条纪律：
 * · 措辞必须与站内实现逐字对齐（每条下方注了事实来源，实现变了这里要跟着变）；
 * · 不放任何数字（用户数、学校数、满意度一律没有——我们没有这些数据）；
 * · 落点必须真实存在且可见，不做「看起来能点」的死链。
 */

// 数据抽到 lib/data/portalFacts.ts 与登录页底部条共用（一处声明两处消费）。

export function FactBadges() {
  return (
    // 紧贴首屏之下：研究里这一条的要求是「30 秒内能拿到的信任依据」，
    // 放到页面中部就等于没有——大部分人根本滚不到那里。
    // 不做 portal-reveal：它要在首屏滚动线附近立刻可读，不该等动画。
    <section
      aria-label="平台的五条事实承诺"
      className="w-full border-b border-[var(--border-2)] bg-[var(--bg)] py-[var(--sec-y-sm)]"
    >
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        <ul className="flex flex-wrap items-center justify-center gap-3">
          {FACT_BADGES.map(({ label, href }) => (
            <li key={label}>
              {/* 胶囊高 28px 但触达补到 40px：14px 文字的胶囊本身够不到触控下限，
                  用 min-h 而不是加大视觉高度——不想让这条带子在首屏下方变得抢眼。 */}
              <Link
                href={href}
                className="inline-flex min-h-[40px] items-center rounded-full border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--portal-accent)] transition-colors duration-[var(--t-fast)] ease-[var(--ease-out)] hover:border-[var(--portal-accent)]"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-[12px] text-[var(--text-3)]">
          以上五条都是我们自己的说法，不是第三方认证——点开任意一条可以看到它对应的做法。
        </p>
      </div>
    </section>
  );
}
