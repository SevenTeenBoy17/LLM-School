"use client";

/**
 * /hub/image —— 教师端生图（M1/B3：补齐终审 R-7 的入口缺口）。
 * 复用 ImageStudio；服务端配额教师 30 张/日；proxy 拒学生（学生走 /student/tools/image）。
 */
import { ImageStudio } from "@/components/image/ImageStudio";

const TEMPLATES = [
  "课件插图：光合作用示意图，简洁扁平风，适合初中生物课件",
  "试卷示意图：平面直角坐标系与一次函数图像，黑白线稿",
  "班会海报：诚信考试主题，明亮励志风格，留出标题位置",
  "教研配图：小组合作学习场景插画，温暖手绘风",
];

export default function HubImagePage() {
  return (
    <ImageStudio
      subtitle="课件插图、试卷示意、活动海报——一句话生成，约 1 分钟/张。"
      templates={TEMPLATES}
      quotaLimit={30}
      footnote="校内安全审核先于生成；生成图片仅供校内教学使用，注意课件引用时的版权与事实核对。"
    />
  );
}
