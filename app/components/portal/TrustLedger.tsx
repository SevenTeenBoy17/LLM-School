/**
 * TrustLedger — 信任制品目录（rank 6 的可交付部分）。
 *
 * **这张表的全部价值在于它把「没有的」和「有的」列在一起。**
 *
 * 同类平台在这个位置摆的是一排合规认证徽章。我们一枚都没有——而自制一个看起来
 * 像认证的图形是伪造。研究给的替代路径是：出一份自陈的制品目录，把已有的与
 * 尚未产出的一并列出，让信息中心与法务能一眼判断「我还缺什么材料」。
 * 一份填满勾的清单只要有一格是猜的，整份的可信度就没了；一份如实写着四项
 * 「未产出」的清单，反而是可以拿去谈的。
 *
 * ⚠️ 本组件**刻意不含法规对齐表**（研究 rank 6 的另一半）。那张表需要逐条核对
 * 公开法规原文后填写条目名称与出处，而 agent 不得凭记忆写任何条文编号或规范名称
 * ——写错一个编号，这一节就从信任资产变成信任负债。它留给人工完成，
 * 本文件末尾的说明也如实告诉读者「对齐表尚未产出」。
 *
 * 每一行的状态只能取自仓库事实：
 * · 公开可见 = 本页或站内公开页上就能读到
 * · 需登录   = 登录后在产品内可见
 * · 未产出   = 仓库里没有对应文件，不存在
 * 三种状态之外不允许出现「进行中」「即将上线」这类模糊档——那是承诺不是事实。
 */

type Availability = "公开可见" | "需登录" | "未产出";

interface Artifact {
  name: string;
  where: string;
  status: Availability;
}

const ARTIFACTS: Artifact[] = [
  {
    name: "安全与隐私说明",
    where: "本页「安全与隐私」一节，无需登录",
    status: "公开可见",
  },
  {
    name: "数据流向说明（存储在校内 / 推理经加密通道出校）",
    where: "本页安全区块与常见问题；登录后在安全求助面板内也有同一份表述",
    status: "公开可见",
  },
  {
    name: "AI 生成资产登记册",
    where: "仓库 public/art/REGISTRY.md，逐张登记授权链与 AIGC 标识",
    status: "公开可见",
  },
  {
    name: "使用额度与配额规则",
    where: "本页常见问题；具体数值由学校管理员在管理端设定",
    status: "需登录",
  },
  {
    name: "安全策略行为（危机识别、诚信引导、学段边界）",
    where: "登录后在对话中可直接触发观察；策略本身写在服务端",
    status: "需登录",
  },
  {
    name: "第三方安全审计报告",
    where: "尚未开展第三方审计",
    status: "未产出",
  },
  {
    name: "数据处理协议（DPA）模板",
    where: "尚未拟定",
    status: "未产出",
  },
  {
    name: "子处理者清单",
    where: "尚未整理（当前推理经加密通道调用校外大模型服务，尚未形成对外清单）",
    status: "未产出",
  },
  {
    name: "法规对齐自陈表",
    where: "需人工逐条核对公开法规原文后填写，尚未产出",
    status: "未产出",
  },
];

const STATUS_STYLE: Record<Availability, string> = {
  公开可见: "bg-[var(--ok-bg)] text-[var(--ok-ink)]",
  需登录: "bg-[var(--rg-control-bg)] text-[var(--text-2)]",
  未产出: "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
};

export function TrustLedger() {
  return (
    <section
      id="trust-ledger"
      aria-labelledby="trust-ledger-heading"
      className="w-full bg-[var(--bg-2)] py-[var(--sec-y-lg)]"
    >
      <div className="mx-auto w-full max-w-[var(--portal-max)] px-[var(--portal-pad)]">
        <div className="mx-auto max-w-[var(--measure-lg)]">
          <header className="portal-reveal">
            <p className="text-[14px] font-semibold tracking-[0.05em] text-[var(--portal-accent)]">
              可核对的东西
            </p>
            <h2
              id="trust-ledger-heading"
              className="mt-[var(--gap-after-eyebrow)] text-[length:var(--fs-d2)] font-bold leading-[var(--lh-d)] text-[var(--text)]"
            >
              我们有什么，以及还没有什么
            </h2>
            <p className="mt-[var(--gap-para)] text-[16px] leading-relaxed text-[var(--text-2)]">
              下面这张表是平台自陈，<strong>未经第三方审计</strong>。
              我们没有任何合规认证徽章可摆，所以把清单原样列出来——包括还没有的那四项。
              信息中心或法务需要材料时，可以直接对着这张表提要求。
            </p>
          </header>

          {/* 表格自带横向滚动容器：窄视口下不让页面本身横向滚动。 */}
          <div className="mt-8 overflow-x-auto rounded-[var(--r-card)] border border-[var(--border)] bg-[var(--card)]">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">
                平台信任制品目录：制品名称、获取方式与当前状态
              </caption>
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th scope="col" className="px-5 py-3 text-[14px] font-semibold text-[var(--text)]">
                    制品
                  </th>
                  <th scope="col" className="px-5 py-3 text-[14px] font-semibold text-[var(--text)]">
                    在哪里 / 为什么没有
                  </th>
                  <th scope="col" className="px-5 py-3 text-[14px] font-semibold text-[var(--text)]">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody>
                {ARTIFACTS.map((a) => (
                  <tr key={a.name} className="border-b border-[var(--border-2)] last:border-b-0">
                    <th
                      scope="row"
                      className="px-5 py-4 text-left text-[16px] font-semibold text-[var(--text)]"
                    >
                      {a.name}
                    </th>
                    <td className="px-5 py-4 text-[14px] leading-relaxed text-[var(--text-2)]">
                      {a.where}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLE[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-[14px] leading-relaxed text-[var(--text-3)]">
            状态只有三档：公开可见 / 需登录 / 未产出。没有「进行中」「即将上线」——
            那是承诺，不是事实。
          </p>
        </div>
      </div>
    </section>
  );
}
