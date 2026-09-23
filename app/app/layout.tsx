import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/common/Providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });
const jb = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

function resolveMetadataBase() {
  try {
    return new URL(process.env.EDUAI_PUBLIC_ORIGIN || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "EduAI Prism · 学校内部 AI 大模型平台",
  description: "安全、可信、面向教学科研的智能助手 — 西电内部 AI 平台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F8FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E1A" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${interTight.variable} ${jb.variable} h-full antialiased`} suppressHydrationWarning>
      {/* suppressHydrationWarning（属性级豁免）：浏览器扩展（如翻译插件）会在水合前往 body
          注入 data-* 属性，触发 dev overlay 的水合警告——与产品代码无关，React 官方文档点名的场景 */}
      <body className="min-h-full bg-[var(--bg)] text-[var(--text)]" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
