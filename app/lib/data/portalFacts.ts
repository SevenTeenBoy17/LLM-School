/**
 * 五条事实承诺 —— 门户徽章条与登录页底部条的**共用数据源**。
 *
 * 从 components/portal/FactBadges.tsx 抽出，原因是登录页重构后底部需要同一批内容
 * （参考稿该位置是真实公司 logo 墙——放真实商标等于伪造背书，撞铁律②；
 * 结构上的同构替代就是这五条可核对的自陈事实）。
 * 两处消费、一处声明，措辞变更才不会漂移。
 *
 * 写作纪律（继承自 FactBadges）：
 * · 措辞必须与站内实现逐字对齐（每条下方注了事实来源，实现变了这里要跟着变）；
 * · 不放任何数字（用户数、学校数、满意度一律没有——我们没有这些数据）；
 * · href 是 /portal 内的真实锚点，登录页消费时自行加 "/portal" 前缀。
 */

export interface FactBadge {
  label: string;
  /** /portal 页内锚点（以 # 开头）；跨页消费时加 "/portal" 前缀 */
  href: string;
}

export const FACT_BADGES: FactBadge[] = [
  // 事实来源：TrustSafety 危机识别卡（危机分支在进模型之前拦截，不受配额影响）。
  { label: "危机识别先于模型", href: "#safety-crisis" },
  // 事实来源：TrustSafety 数据卡 + SafetyHelp 站内披露（存储在校内、推理经加密通道出校）。
  { label: "数据存放于校内", href: "#safety-data" },
  // 事实来源：Capabilities 边界卡第二条。
  { label: "不用于训练模型", href: "#safety-data" },
  // 事实来源：Capabilities 边界卡第三条 + api/chat 配额门（无付费档位）。
  { label: "不收取任何费用", href: "#faq" },
  // 事实来源：Capabilities 边界卡第一条（无连胜、无排行榜、无召回推送）。
  { label: "没有排行榜", href: "#safety-scope" },
];
