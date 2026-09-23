"use client";

/**
 * /student/tools/image —— 学生生图（M1/B3 起为 ImageStudio 共享组件的薄包装）。
 * 安全与配额（8 张/日）全在服务端；教师端同能力入口在 /hub/image（30 张/日）。
 */
import { ImageStudio } from "@/components/image/ImageStudio";
import { Palette } from "lucide-react";
import { PageIcon } from "@/components/common/PlayIcon";

const TEMPLATES = [
  "手抄报插图：绿色环保主题，卡通风格，明亮色彩",
  "科学实验示意图：光合作用过程，简洁图解风格",
  "黑板报素材：运动会加油边框装饰，活力橙色",
  "课文场景插画：《背影》月台送别，温暖水彩风",
];

export default function StudentImagePage() {
  return (
    <ImageStudio
      headerIcon={<PageIcon name="image" fallback={Palette} />}
      subtitle="描述越具体，画得越好——生成约需 1 分钟，可以先去做别的。"
      templates={TEMPLATES}
      quotaLimit={8}
      footnote="校内安全审核先于生成：血腥、成人、真人肖像等内容会被拦截。生成的图片仅供校内学习使用。"
    />
  );
}
