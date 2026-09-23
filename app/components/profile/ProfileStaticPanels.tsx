"use client";

/**
 * BL3 组件拆分：个人中心的三块**纯静态展示**面板（零状态依赖、零行为）。
 * 从 profile/page.tsx 原样抽出，文案与「· 示例数据」「演示环境未开通」等诚实标注一字未改——
 * 拆分只降页面体量，不改变任何呈现或可用性语义。
 */
import * as Icons from "lucide-react";
import { Key, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotYetAvailable } from "@/components/common/NotYetAvailable";

/** 登录设备列表（示例数据；设备下线需服务端会话管理，诚实禁用）。 */
export function ProfileDevicesCard() {
  return (
    <Card>
      <CardHeader><CardTitle>登录设备 <span className="ml-1 text-[11px] font-normal text-[var(--text-3)]">· 示例数据</span></CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[
            { name: "Windows · Chrome 121",  ip: "校内 10.1.x.x",     time: "当前会话",  current: true },
            { name: "macOS · Safari 17",     ip: "家庭网络",          time: "今日 08:42" },
            { name: "iOS · 西电 APP",        ip: "校内 Wi-Fi",        time: "昨日 21:15" },
            { name: "Windows · Edge 121",    ip: "外网 (待确认)",     time: "3 天前", warn: true },
          ].map((d, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-[var(--rg-selected-bg)] text-[var(--c-primary)]">
                <Icons.Smartphone size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold truncate">{d.name}</div>
                  {d.current && <Badge variant="green">当前</Badge>}
                  {d.warn && <Badge variant="red">异地</Badge>}
                </div>
                <div className="text-[11px] text-[var(--text-2)]">{d.ip} · {d.time}</div>
              </div>
              <NotYetAvailable why="需设备会话管理基建 · 演示环境未开通">下线</NotYetAvailable>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-3)]">设备远程下线需服务端设备会话管理，演示环境未开通。当前会话退出请用右上角「退出登录」。</p>
      </CardContent>
    </Card>
  );
}

/** API Token 管理（示例数据；签发/存储基建未开通，全部按钮诚实禁用）。 */
export function ProfileApiTokensCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>API Token 管理 <span className="ml-1 text-[11px] font-normal text-[var(--text-3)]">· 示例数据</span></CardTitle>
        <NotYetAvailable why="需密钥签发/存储基建 · 演示环境未开通"><Key size={13} /> 创建 Token</NotYetAvailable>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[
            { name: "教研工具集成", scope: "对话 / 提示词读取",       expire: "2026-12-31", lastUse: "今日 14:18" },
            { name: "课程助手 Webhook", scope: "对话 / 知识库检索",   expire: "2026-06-30", lastUse: "昨日 09:02" },
          ].map((t, i) => (
            <div key={i} className="rounded-[12px] border border-[var(--border-2)] p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold">{t.name}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-2)]">{t.scope}</div>
                </div>
                <div className="flex gap-2">
                  <NotYetAvailable why="演示环境未开通">重置</NotYetAvailable>
                  <NotYetAvailable why="演示环境未开通">撤销</NotYetAvailable>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-[var(--text-3)]">
                <span>过期：{t.expire}</span>
                <span>最近使用：{t.lastUse}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[12px] bg-[var(--warn-bg)] p-3 text-[12px] text-[var(--warn-ink)]">
          <Bell className="inline" size={13} /> Token 创建后仅显示一次，请妥善保存。所有 API 调用均会写入审计日志。
        </div>
      </CardContent>
    </Card>
  );
}

/** 活动记录（示例数据；真实活动流需事件采集，尚未接入）。 */
export function ProfileActivityCard() {
  return (
    <Card>
      <CardHeader><CardTitle>活动记录 · 近 7 天 <span className="ml-1 text-[11px] font-normal text-[var(--text-3)]">· 示例数据</span></CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {[
            { time: "今日 14:32", action: "使用 Claude 生成《重积分》教案",   tag: "AI 对话" },
            { time: "今日 11:08", action: "上传《七年级第一单元教学设计.docx》", tag: "知识库" },
            { time: "今日 09:24", action: "登录平台",                            tag: "账户" },
            { time: "昨日 16:42", action: "创建智能体「信息科技教案助手」 v1.2", tag: "智能体" },
            { time: "昨日 14:18", action: "导出对话为 Word",                     tag: "导出" },
            { time: "2 天前",     action: "提示词「课堂导入活动头脑风暴」获 12 个收藏", tag: "提示词" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-[12px] border border-[var(--border-2)] p-2.5">
              <span className="text-num text-[11px] text-[var(--text-3)] w-20 shrink-0">{a.time}</span>
              <span className="flex-1 text-[13px]">{a.action}</span>
              <Badge variant="primary">{a.tag}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
