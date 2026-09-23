/**
 * HeroDome — 登录页的穹顶光弧背景。**纯 CSS/SVG 分层，零位图。**
 *
 * 参考稿该位置是一张实拍/绘画艺术图（山谷 + 发光穹顶 + 人物剪影）。三个不能照搬的理由：
 * 别人的作品；位图违背本项目 ≤150KB + 纯几何资产纪律；人物剪影撞铁律⑤。
 * 于是用可计算的几何重建同款氛围——这也让它天然响应式、天然主题化（全部走令牌）。
 *
 * 层叠（自下而上）：
 *   L0 基底近黑 + 顶部渐隐（压住导航区）
 *   L1 星点（inline SVG，**固定坐标**——visual 门要截图对比，运行时随机会让基线永不稳定）
 *   L2 弧带群：同心细环（repeating-radial-gradient，静态）+ 辐条纹理（repeating-conic-gradient，
 *      240s 超慢旋转）+ 三道主弧（1px 边框圆 + blur 阶梯）
 *   L3 地平线暖光（全画面唯一暖色——温差是参考稿氛围成立的关键一笔）
 *   L4 山体剪影（两层 SVG path，由远及近变黑）
 *
 * 整体 aria-hidden + pointer-events-none：它是氛围不是信息，读屏与命中测试都不该碰到它。
 * 外层容器负责 overflow: clip（220vw 的圆必然出血，不 clip 会打红 visual 门的 overflowX）。
 */
export function HeroDome() {
  // 星点固定坐标（构建期写死）。视觉上求「稀疏、上密下疏」，不求随机学意义上的均匀。
  const stars: Array<[number, number, number]> = [
    [8, 6, 1], [15, 12, 0.7], [22, 4, 0.8], [31, 9, 1.1], [38, 15, 0.6],
    [46, 5, 0.9], [54, 11, 0.7], [61, 7, 1], [69, 14, 0.6], [76, 4, 0.8],
    [84, 10, 1.1], [91, 6, 0.7], [12, 22, 0.6], [27, 19, 0.9], [44, 24, 0.7],
    [58, 20, 0.8], [73, 23, 0.6], [88, 18, 0.9], [19, 30, 0.7], [35, 28, 0.6],
    [65, 31, 0.8], [81, 27, 0.7], [50, 33, 0.6], [5, 16, 0.8], [96, 13, 0.6],
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-clip">
      {/* L0 基底 + 四角暗角 */}
      <div className="absolute inset-0" style={{ background: "var(--lh-bg)" }} />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />

      {/* L1 星点（只铺上半区） */}
      <svg className="absolute inset-x-0 top-0 h-[40%] w-full" viewBox="0 0 100 40" preserveAspectRatio="none">
        {stars.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.22} fill="var(--lh-text)" opacity={0.25 + (i % 3) * 0.12} />
        ))}
      </svg>

      {/* L2a 同心细环（静态纹理，被环形 mask 圈在穹顶带内） */}
      <div
        className="absolute left-1/2 w-[220vw] -translate-x-1/2 rounded-full"
        style={{
          top: "26vh",
          aspectRatio: "1",
          background:
            "repeating-radial-gradient(circle at center, transparent 0 34px, var(--lh-arc-glow) 34px 35px)",
          maskImage: "radial-gradient(closest-side, transparent 58%, black 66%, black 82%, transparent 94%)",
          WebkitMaskImage: "radial-gradient(closest-side, transparent 58%, black 66%, black 82%, transparent 94%)",
          opacity: 0.5,
        }}
      />
      {/* L2b 辐条纹理（唯一的持续动效，慢到只提供「活着」的质感） */}
      <div
        className="lh-spin absolute left-1/2 w-[220vw] -translate-x-1/2 rounded-full"
        style={{
          top: "26vh",
          aspectRatio: "1",
          background:
            "repeating-conic-gradient(from 0deg, transparent 0deg 5deg, var(--lh-arc-glow) 5deg 5.5deg)",
          maskImage: "radial-gradient(closest-side, transparent 60%, black 68%, black 80%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(closest-side, transparent 60%, black 68%, black 80%, transparent 92%)",
          opacity: 0.35,
        }}
      />
      {/* L2c 三道主弧：1px 边框圆，blur 与透明度阶梯拉出光晕层次 */}
      {[
        { inset: "0vw", blur: 0.5, opacity: 0.55 },
        { inset: "3vw", blur: 1.5, opacity: 0.3 },
        { inset: "6vw", blur: 3, opacity: 0.16 },
      ].map((ring, i) => (
        <div
          key={i}
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            top: `calc(26vh + ${ring.inset})`,
            width: `calc(220vw - ${ring.inset} * 2)`,
            aspectRatio: "1",
            border: "1px solid var(--lh-arc)",
            filter: `blur(${ring.blur}px)`,
            opacity: ring.opacity,
          }}
        />
      ))}

      {/* L3 地平线暖光（全画面唯一暖色） */}
      <div
        className="lh-pulse absolute inset-x-0"
        style={{
          top: "52vh",
          height: "22vh",
          background: "radial-gradient(52% 46% at 50% 42%, var(--lh-horizon) 0%, transparent 70%)",
          opacity: 0.5,
        }}
      />

      {/* L4 山体剪影：远山微亮、近山全黑，压住画面下缘 */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full"
        viewBox="0 0 100 38"
        preserveAspectRatio="none"
      >
        <path
          d="M0,20 L14,13 L26,18 L40,9 L55,17 L68,11 L82,16 L100,10 L100,38 L0,38 Z"
          fill="color-mix(in srgb, var(--lh-text) 4%, var(--lh-bg))"
        />
        <path
          d="M0,27 L12,22 L28,26 L45,18 L60,25 L76,20 L90,24 L100,21 L100,38 L0,38 Z"
          fill="var(--lh-bg)"
        />
      </svg>

      {/* L0' 顶部渐隐：让导航区落在干净的深色上 */}
      <div
        className="absolute inset-x-0 top-0 h-[18vh]"
        style={{ background: "linear-gradient(180deg, var(--lh-bg) 0%, transparent 100%)" }}
      />
    </div>
  );
}
