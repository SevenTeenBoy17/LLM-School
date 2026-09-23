/**
 * ModelBadges — 登录页页脚的「已接入模型」品牌条（V14.3，替换原承诺条）。
 *
 * 诚实性约束：此处列出的模型必须与网关真实路由一致（lib/data/models.ts，
 * 其显示名又与 lib/server/llm.ts MODEL_MAP 对齐）——这是「Powered by」性质的
 * 事实陈述，不是第三方背书。模型清单变了这里必须跟着变。
 *
 * logo 来源：@lobehub/icons-static-svg（MIT 打包）之官方品牌形状，内联为
 * currentColor 单色矢量——不用 AI 生图：商标必须精确，生成近似即伪造。
 * 商标属各自权利人，此处为指示性使用（nominative use：指明实际接入的服务）。
 * GPT-5.4 与 GPT-Image-2 同属 OpenAI，共用同一枚标。
 */

import { LOGO_PATHS } from "@/lib/data/brandLogos";

/**
 * 显示名规则（V14.4 用户拍板）：只写品牌词，不写版本数字——版本会过期，页脚
 * 只陈述品牌层的事实；品牌与 lib/data/models.ts 的供应商对应关系保持一致。
 * ⚠️ DeepSeek 与 Gemini 均为用户指示展示：网关 MODEL_MAP 暂无 deepseek 路由、
 * 无 Gemini（UI 的 gemini 卡实际路由到 GLM-5.1）。接线后请在 models.ts 补卡片；
 * 若长期不接线，对应项应移除以守住「已接入」口径。
 */
const INTEGRATED_MODELS: Array<{ name: string; logo: keyof typeof LOGO_PATHS }> = [
  { name: "GPT", logo: "openai" },
  { name: "Gemini", logo: "gemini" },
  { name: "Claude", logo: "claude" },
  { name: "DeepSeek", logo: "deepseek" },
  { name: "GLM", logo: "zhipu" },
  { name: "MiniMax", logo: "minimax" },
];

export function ModelBadges() {
  return (
    // w-full 而非居中 1100px 容器：品牌条右缘随页脚 padding 靠向视口右侧（V14.5 用户拍板），
    // 与边界的呼吸距由页脚的 px 值统一把握
    <div className="flex w-full flex-col items-center gap-3 md:flex-row md:justify-between">
      {/* V15.2 拍板：标签改诚实口径——四家已真实路由（GPT/Claude/GLM/MiniMax），
          DeepSeek 与 Gemini 网关已备型号（/v1/models 实测在列）、接线排期中 */}
      <span className="lh-on-video text-[12px] text-white/70">多模型驱动 · 持续接入中</span>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {INTEGRATED_MODELS.map((m) => (
          <li key={m.name} className="lh-on-video flex items-center gap-1.5 text-white/85">
            <svg viewBox="0 0 24 24" aria-hidden className="h-[17px] w-[17px] shrink-0 fill-current drop-shadow-[0_1px_2px_rgba(5,6,10,0.5)]">
              <path d={LOGO_PATHS[m.logo]} />
            </svg>
            <span className="text-[13px] font-semibold tracking-[0.01em]">{m.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
