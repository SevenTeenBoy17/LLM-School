"use client";

import Image from "next/image";

interface BrandLogoProps {
  /** Pixel size of the square logo image. Default 72. */
  size?: number;
  /** Show the "i-learning" wordmark next to the icon. Default true. */
  withText?: boolean;
  /** Text color treatment.
   *   "light" — premium icy-blue→deep-blue gradient (for dark backgrounds)
   *   "dark"  — solid var(--text) (for light backgrounds)
   */
  textTone?: "dark" | "light";
  /** Optional opacity for the icon image (0–1). Default 0.96. */
  opacity?: number;
}

/**
 * BrandLogo — "i-learning" wordmark used at the top of the login page and as
 * the mobile fallback above the login card.
 *
 * Premium-tier styling (this revision):
 *  - Larger icon (72×72 by default) with a deeper brand-blue drop shadow.
 *  - Wordmark text rendered with a gradient (icy-blue → cyan → deep blue) that
 *    matches the EduAI Prism palette, plus a soft blue drop-shadow for a
 *    "glowing tech logotype" effect on the dark hero panel.
 *  - Horizontal flex layout preserved (icon left, wordmark right).
 *  - When the consumer asks for `textTone="dark"` we fall back to a flat color
 *    so the wordmark stays legible on the light neumorphic side of the screen.
 */
export function BrandLogo({
  size = 88,
  withText = true,
  textTone = "light",
  opacity = 0.96,
}: BrandLogoProps) {
  const compact = size <= 44;

  /**
   * 字标字号：先按 size 等比推导，再**吸附到字阶档位**。
   *
   * 原实现是 `Math.round(size * 0.58)`，直接把算出来的值写进 inline style。
   * 后果在字阶门里现形：默认 size=88 推出 **51px**——一个不属于任何档位的孤值，
   * 它自己占掉 /login 七档字号里的一档，把该页顶到 §3.1 R3 的 ≤7 天花板上毫无余量。
   * 等比缩放的初衷（同一组件在 88 与 38 两种用法下都协调）是对的，
   * 错的是**让连续函数的输出直接落地**——那等于每出现一种新 size 就凭空多一档字号。
   *
   * 现在保留等比推导，但把结果吸附到「不超过它的最大档位」：
   *   88 → 51 → **40**（该页已有的档位，不新增）
   *   38 → 22 → **22**
   * 用「向下吸附」而不是「就近吸附」：51 就近会落到 56，而 56 比同页 h1 的 40 还大，
   * 会把字标抬到比页面主标题更重的位置——档位是对齐用的，不该顺手改变层级。
   */
  const STEPS = [12, 14, 16, 18, 22, 28, 40, 56] as const;
  const raw = size * 0.58;
  const textSize = STEPS.filter((s) => s <= raw).pop() ?? STEPS[0];
  const gap = Math.max(8, Math.round(size * 0.16));
  const tracking = (size * 0.028).toFixed(1);

  return (
    <div className="flex items-center" style={{ gap }}>
      {/* Logo PNG already has its own rounded blue frame — no extra container needed */}
      <div
        className={
          compact
            ? "relative shrink-0 rounded-[12px] shadow-[0_8px_18px_rgba(37,99,235,0.18)] ring-1 ring-[var(--border-2)]"
            : "relative shrink-0 rounded-[20px] shadow-[0_22px_56px_rgba(37,99,235,0.6)] ring-1 ring-white/15"
        }
        style={{ width: size, height: size }}
      >
        <Image
          src="/float/logo.png"
          alt="i-learning Logo"
          width={size * 2}
          height={size * 2}
          className={compact ? "block h-full w-full rounded-[12px] object-contain" : "block h-full w-full rounded-[20px] object-contain"}
          style={{ opacity }}
          draggable={false}
        />
        {/* Subtle inner sheen — gives the icon a glassy, premium finish */}
        <div className={compact ? "pointer-events-none absolute inset-0 rounded-[12px] bg-gradient-to-b from-white/15 via-transparent to-black/10" : "pointer-events-none absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/15 via-transparent to-black/10"} />
      </div>

      {withText && (
        <div
          className="leading-none"
          // The blue glow is on the WRAPPER (not the gradient text) — text with
          // `color: transparent` ignores `text-shadow`, but a parent
          // `drop-shadow` filter renders the shadow correctly against the
          // composited glyph outlines.
          style={
            textTone === "light"
              ? { filter: "drop-shadow(0 8px 32px rgba(59,130,246,0.6))" }
              : undefined
          }
        >
          <div
            className="whitespace-nowrap font-bold"
            style={{
              fontSize: textSize,
              letterSpacing: `${tracking}px`,
              ...(textTone === "light"
                ? {
                    // 5-stop icy-blue → cyan → deep brand-blue gradient.
                    // 135° matches the page's primary gradient direction so
                    // the wordmark reads as part of the brand system.
                    //
                    // 色彩治理豁免（scopedException，同登录页）：这是产品**字标本身**。
                    // 前面几批把学科色/角色色/模型厂牌色收敛，理由都是「身份已由文字承载，
                    // 颜色是第二遍编码」——这条理由在字标上**不成立**：字标的颜色就是它的身份，
                    // 而它本身就是文字，没有另一条通道可以退守。压成单一强调色等于把品牌抹掉。
                    // 因此保留六色标，并在 color-baseline.json 的 scopedException 里登记。
                    backgroundImage:
                      "linear-gradient(135deg, #E0F2FE 0%, #93C5FD 22%, #67E8F9 44%, #38BDF8 66%, #2563EB 88%, #1D4ED8 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                  }
                : { color: "var(--text)" }),
            }}
          >
            i-learning
          </div>
        </div>
      )}
    </div>
  );
}
