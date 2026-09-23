"use client";

import { useEffect, useRef, useState } from "react";

/**
 * VideoBackdrop — 登录页的实拍视频背景层（/login-bg.mp4，15s 无缝循环）。
 *
 * 与 HeroDome 的关系是**覆盖而非替换**：穹顶仍渲染在下层，承担三个兜底位——
 * 视频加载完成前的首帧、加载失败、以及 prefers-reduced-motion（自动播放的
 * 循环视频正是该偏好要关掉的东西）。任何一种情况下页面都是完整的静态穹顶画，
 * 视频只是增强。这与 DotMatrixTitle 的「最终态永远可读」是同一条纪律。
 *
 * 遮罩四层与视频同一容器、同一淡入：单独淡视频会出现「遮罩先压黑穹顶」的
 * 脏帧。层序（自下而上）：全局压暗 → 标题区径向暗斑（文字对比度的保险）→
 * 顶部渐隐（导航）→ 底部渐隐（承诺条）。
 *
 * 整层 aria-hidden + pointer-events-none：它是氛围不是信息。
 */
export function VideoBackdrop() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mql.matches) {
        video.pause();
        setReady(false); // 整层（含遮罩）隐去，下层静态穹顶接管
      } else {
        // play() 被自动播放策略拒绝时静默保持隐藏——穹顶仍在，无损
        void video.play().catch(() => {});
      }
    };
    apply();
    mql.addEventListener("change", apply);
    return () => {
      mql.removeEventListener("change", apply);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-clip"
      style={{ opacity: ready ? 1 : 0, transition: "opacity 900ms var(--ease-out)" }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src="/login-bg.mp4"
        onCanPlay={() => {
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setReady(true);
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* V14.1 用户拍板：撤掉全局压暗（「黑纱」）——视频以原生亮度示人，
          文字对比度只靠下面两处**局部**手段，不再整幅罩灰。 */}
      {/* 标题区径向暗斑：收小减淡成文字后的一圈柔和光影，不再读作一层纱 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 42% at 50% 46%, color-mix(in srgb, var(--lh-bg) 30%, transparent) 0%, transparent 66%)",
        }}
      />
      {/* 顶部渐隐已整条移除（V14.1 二轮拍板：仍读作黑边）——
          导航是深色玻璃物件，自带落脚，视频直通顶缘 */}
      {/* 底部渐隐：承诺条的落脚，收短减淡后保留 */}
      <div
        className="absolute inset-x-0 bottom-0 h-[16vh]"
        style={{
          background:
            "linear-gradient(0deg, color-mix(in srgb, var(--lh-bg) 78%, transparent) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
