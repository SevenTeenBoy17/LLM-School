"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "@/components/common/BrandLogo";

/**
 * PortalNav — /portal 公开门户页的吸顶导航。
 *
 * 三个刻意的取舍：
 *
 * 1. **移动端不做汉堡菜单。** 本页锚点只有 3 个，抽屉会让「点一下就到」变成
 *    「点开→找→点→关」。<768px 直接隐藏锚点，只留品牌 + 「进入平台」——
 *    移动端上门的人九成是来登录的，把唯一的目标动作放大比藏起一个菜单更有用。
 *
 * 2. **底部细线用绝对定位的 1px 层做淡入，不用 border-b 切换。** 切 border 会
 *    在滚过 24px 的瞬间让整条导航长高 1px，下面所有内容跟着抖一下；一个纯装饰
 *    的分隔线不值得引起布局位移。
 *
 * 3. **背景用 color-mix + backdrop-filter 而不是纯色。** 门户底色是暖奶油
 *    (--bg)，纯色导航压在同色页面上滚动时看不出「浮起来了」；半透明 + 模糊
 *    才让内容从导航下方穿过时有层次。滚动后换到 --bg-2（更暖一档）并加
 *    --shadow-sm，就是「轻微加深」。
 *
 * ── 锚点被吸顶导航遮挡的处理建议 ─────────────────────────────────
 * 本组件高 68px，不要在这里改全局。正确做法是**目标区块自己声明避让量**：
 * 给 #capabilities / #roles / #safety 三个 section 各加
 *   className="scroll-mt-[84px]"        // 68px 导航 + 16px 呼吸
 * 或在 portal 页面根节点统一写 `[&_section[id]]:scroll-mt-[84px]`。
 * 用 scroll-margin-top 而不是负 margin / 透明占位锚点：它只影响滚动落点，
 * 不改变元素在文档流里的位置，也不会破坏 section 之间的间距。
 * 平滑滚动交给 CSS `scroll-behavior: smooth`（已可用），无需 JS 劫持点击——
 * JS 劫持会一并吃掉「新标签页打开」和键盘用户的 Home/End 行为。
 * ────────────────────────────────────────────────────────────────
 */

const NAV_LINKS = [
  { href: "#capabilities", label: "能力" },
  { href: "#roles", label: "三个入口" },
  { href: "#safety", label: "安全与隐私" },
] as const;

/** 滚动多远算「离开顶部」。24px ≈ 一次滚轮刻度，够短到即时响应，又不会因抖动误触。 */
const SCROLL_THRESHOLD = 24;

export function PortalNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    // 首帧先同步一次：浏览器恢复滚动位置（刷新 / 返回）时，页面可能一进来就不在顶部。
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      // `sticky` 本身就是非 static 定位，已经能给下面那条绝对定位的细线当包含块——
      // 不要再补一个 `relative`：两者同属 position 属性，谁赢由 Tailwind 生成表里的
      // 顺序决定而非 className 的书写顺序，补上去反而可能把吸顶整个关掉。
      className="sticky top-0 z-50 w-full transition-[background-color,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)]"
      style={{
        backgroundColor: scrolled
          ? "color-mix(in srgb, var(--bg-2) 88%, transparent)"
          : "color-mix(in srgb, var(--bg) 92%, transparent)",
        backdropFilter: "saturate(160%) blur(12px)",
        WebkitBackdropFilter: "saturate(160%) blur(12px)",
        boxShadow: scrolled ? "var(--shadow-sm)" : "none",
      }}
    >
      <nav
        aria-label="门户主导航"
        className="mx-auto flex h-[68px] w-full max-w-[var(--portal-max)] items-center justify-between gap-4 px-[var(--portal-pad)]"
      >
        {/* 左：品牌。浅色暖底 → textTone="dark"；38px 是 BrandLogo 的 compact 分支，
            字号会等比收到 22px，正好嵌进 68px 的行高里而不撑破。 */}
        <Link
          href="/portal"
          aria-label="i-learning · 返回门户首页"
          className="shrink-0 rounded-[var(--r-ctl)] outline-none transition-opacity duration-[var(--t-fast)] ease-[var(--ease-out)] hover:opacity-80"
        >
          <BrandLogo size={38} textTone="dark" />
        </Link>

        {/* 中：锚点。<768px 整组隐藏（见文件头注释 2）。 */}
        <ul className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="group relative inline-flex items-center rounded-[var(--r-ctl)] px-3 py-2 text-[14px] font-normal text-[var(--text-2)] outline-none transition-colors duration-[var(--t-fast)] ease-[var(--ease-out)] hover:text-[var(--text)]"
              >
                {item.label}
                {/* 下划线从左侧展开。放在 a 内部而非 border-b，避免影响行盒高度。 */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-[var(--portal-accent)] transition-transform duration-[var(--t-base)] ease-[var(--ease-out)] group-hover:scale-x-100 motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>

        {/* 右：唯一主动作。移动端不隐藏——这是小屏上最该留下的那一个。 */}
        <Link
          href="/login"
          /* h-[44px] 而非 h-10：根字号 14px 让 h-10 只有 35px（见 globals.css 注释）。
             小屏上锚点整组隐藏，这是导航里唯一的可点元素，不能低于 44px 触达下限。 */
          className="inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-[var(--r-ctl)] bg-[var(--portal-cta)] px-4 text-[14px] font-semibold whitespace-nowrap text-[var(--portal-cta-ink)] shadow-[var(--shadow-sm)] outline-none transition-[background-color,box-shadow,transform] duration-[var(--t-base)] ease-[var(--ease-out)] hover:bg-[var(--portal-accent)] hover:shadow-[var(--shadow-md)] active:translate-y-px motion-reduce:transition-none"
        >
          进入平台
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </nav>

      {/* 底部细线：滚动后淡入。
          · 绝对定位 → 不占高度 → 不引起布局位移（见文件头注释 2）。
          · 挂在 header（视口全宽）而不是 nav（版心 1280）——分隔线要贯通整条导航，
            收在版心里会在 >1280px 的屏幕上断成一截，看着像画了一半。 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[var(--border)] transition-opacity duration-[var(--t-base)] ease-[var(--ease-out)] motion-reduce:transition-none ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      />
    </header>
  );
}
