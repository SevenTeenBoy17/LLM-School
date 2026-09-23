import { EmptyState } from "@/components/common/EmptyState";
import { emptyCopy } from "@/lib/data/emptyStates";
import { cn } from "@/lib/utils";

/**
 * HourHeatmap — 一周 × 24 小时使用热力图。
 *
 * ⚠️ 本文件在 UI 调研第二轮被实锤含有**伪造数据**，已于本轮清除。历史形态如下，
 * 记录在此是为了防止后人"补个兜底更友好"地把它加回来：
 *
 *   一个名为 intensity(day, hour) 的纯函数，按分段条件给出 0-4 级强度：
 *   上午时段随小时递增、午后取距 14:30 的距离、傍晚固定一档、周末统一减二；
 *   组件再用它铺满 7×24 生成一张兜底矩阵，在 props 未给出合法 grid 时顶上。
 *
 * 它用一条公式画出一张有作息规律的热力图，与后端数据毫无关系；更糟的是
 * 那时的 aria-label 把这套假规律当结论念出来——「工作日上午 8 至 11 时…为高峰」。
 * 明眼用户至少还能怀疑图形，读屏用户拿到的是一句斩钉截铁的假话。
 * 这是铁律②在本项目里最严重的一次落地失守。
 *
 * 现在的三条约束：
 *
 * 1. **没有数据就不画图。** grid 缺失或形状不对 → 空态，不猜、不补、不兜底。
 * 2. **aria-label 只描述「这是什么图」，不含任何结论。** 结论要从数据里读，
 *    而数据由下面的 sr-only 表格逐格提供——读屏用户自己判断高峰在哪。
 * 3. **不用 title 属性承载数据。** title 只在鼠标悬停时出现，键盘、触屏、读屏
 *    三类用户全部拿不到。168 格的信息全押在 title 上等于没给。
 */

const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** 5 档强度。相邻档难以满足 WCAG 1.4.11 的 3:1，故颜色之外另有 sr-only 表格承载真值。 */
const COLORS = [
  "var(--border-2)",
  "var(--info-bg)",
  "color-mix(in srgb, var(--info) 45%, white)",
  "var(--info)",
  "var(--info-ink)",
];

const LEVELS = ["无", "低", "偏低", "偏高", "高"];

/** grid 必须是 7×24 的合法矩阵，任何一行不合规就整体判为无数据——半张真半张假比全空更糟。 */
function isValidGrid(g: number[][] | undefined): g is number[][] {
  if (!g || g.length !== 7) return false;
  return g.every(
    (row) => Array.isArray(row) && row.length === 24 && row.every((v) => Number.isInteger(v) && v >= 0 && v <= 4),
  );
}

export function HourHeatmap({ grid }: { grid?: number[][] }) {
  if (!isValidGrid(grid)) {
    const copy = emptyCopy("admin.noHeatmap");
    return <EmptyState kind={copy.kind} title={copy.title} description={copy.description} compact />;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
        <span>使用高峰热力图 · 一周 × 24 小时</span>
        <span className="flex items-center gap-1.5">
          低（0 级）
          {COLORS.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
          ))}
          高（4 级）
        </span>
      </div>

      {/* 图形层对 AT 隐藏：它的信息由下面的 sr-only 表格逐格提供，两者重复会让读屏念两遍。
          aria-label 只说「这是什么」与「怎么读」，不含任何关于高峰位置的结论。 */}
      <div
        className="space-y-1"
        role="img"
        aria-label="按星期与时段的使用强度热力图，强度分 5 档（0 至 4 级）。完整数值见其后的数据表。"
      >
        {DAYS.map((d, di) => (
          <div key={d} className="grid grid-cols-[32px_repeat(24,minmax(0,1fr))] items-center gap-[3px]">
            <span className="text-[11px] text-[var(--text-2)]">{d}</span>
            {grid[di].map((v, hi) => (
              <div
                key={hi}
                aria-hidden
                className={cn("aspect-square rounded-[3px] transition hover:scale-110")}
                style={{ background: COLORS[v] }}
              />
            ))}
          </div>
        ))}
        <div className="mt-1 grid grid-cols-[32px_repeat(24,minmax(0,1fr))] gap-[3px] text-[9px] text-[var(--text-3)]">
          <span />
          {Array.from({ length: 24 }).map((_, h) => (
            <span key={h} className="text-center">
              {h % 4 === 0 ? h : ""}
            </span>
          ))}
        </div>
      </div>

      {/* 文字等价物：一张真表格，行列关系可被程序化确定。
          这是把 168 格数据交给键盘与读屏用户的唯一可靠方式。

          sr-only 必须挂在**外层 div** 而不是 table 上：sr-only 靠 overflow:hidden
          把 1×1 的盒子里的内容裁掉，而 overflow 对 display:table 的裁切并不可靠——
          25 列 white-space:nowrap 的表格会把可滚动溢出区域向右撑开。
          实测代价：/admin/analytics 在三个断点全部横向溢出（mobile 1365px）。
          div 是确定的块容器，overflow 在它上面行为明确。 */}
      <div className="sr-only">
      <table>
        <caption>使用强度数据表：行为星期，列为整点时段，单元格为 0 至 4 级强度</caption>
        <thead>
          <tr>
            <th scope="col">星期</th>
            {Array.from({ length: 24 }).map((_, h) => (
              <th key={h} scope="col">{`${h} 时`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d, di) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              {grid[di].map((v, hi) => (
                <td key={hi}>{`${v} 级（${LEVELS[v]}）`}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
