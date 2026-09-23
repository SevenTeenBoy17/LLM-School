"use client";

import { Printer } from "lucide-react";

/**
 * PrintButton — 页脚的二次转化动作：把这一页打印给家长或信息中心。
 *
 * 为什么是这个动作：营销站的通行做法是在页脚放订阅表单承接未转化流量，
 * 但本项目没有邮件列表、也不收费，放一个订阅框等于承诺一条不存在的路径。
 * 真实存在的需求是另一条——一个用得顺手的老师需要把这页变成可以交出去的东西
 * （交给信息中心走接入，或交给家长会说明边界）。
 * 打印是唯一诚实的二次转化：它不收集任何信息，产物完全在用户手上。
 *
 * 为什么单独抽成一个极小的 client 组件：PortalFooter 整体是静态服务端渲染，
 * 为一个 onClick 把整个页脚变成 client 组件不划算（页脚里有几十个链接与文案）。
 * 这个文件是整个门户里唯一因为「需要一次点击」而存在的客户端边界。
 *
 * 打印样式在 globals.css 的 @media print 里：隐藏导航与装饰美术、
 * 强制展开所有 details、把 reveal 动效复位到终态——否则打出来会缺一半内容。
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-ctl)] px-4 text-[14px] font-semibold text-[var(--portal-on-ink)] ring-1 ring-[color-mix(in_srgb,var(--portal-on-ink)_38%,transparent)] transition-[background-color,box-shadow] duration-[var(--t-base)] ease-[var(--ease-out)] hover:bg-[color-mix(in_srgb,var(--portal-on-ink)_10%,transparent)] hover:ring-[color-mix(in_srgb,var(--portal-on-ink)_72%,transparent)] motion-reduce:transition-none"
    >
      <Printer aria-hidden="true" className="h-[16px] w-[16px]" />
      打印这一页
    </button>
  );
}
