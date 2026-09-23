"use client";

import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PagePlaceholderProps {
  title: string;
  description?: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-[20px] text-white shadow-lg"
        style={{ backgroundImage: "linear-gradient(135deg, var(--accent-tint), var(--rg-hover-bg))" }}>
        <Hammer size={26} className="text-[var(--c-edu)]" />
      </div>
      <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-2 max-w-md text-[13px] text-[var(--text-2)]">{description}</p>}
      <Button variant="grad" className="mt-6" asChild>
        <Link href="/dashboard">返回首页</Link>
      </Button>
    </div>
  );
}
