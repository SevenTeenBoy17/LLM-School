"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // M6 触觉反馈（S0）：:active 压下 0.97——「按得动」的物理感，K-12 亲和度低成本来源；disabled 不响应
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--rg-control-radius)] text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--c-edu)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-[var(--c-primary)] text-white shadow-md hover:bg-[var(--c-primary-2)] hover:-translate-y-px hover:shadow-lg",
        grad: "text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(37,99,235,0.35)] bg-[image:var(--grad-primary)]",
        ghost: "bg-[var(--rg-control-bg)] text-[var(--text)] hover:bg-[var(--rg-control-hover)]",
        outline: "bg-[var(--card)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--text-3)] hover:bg-[var(--rg-hover-bg)]",
        soft: "bg-[var(--rg-selected-bg)] text-[var(--c-primary)] hover:bg-[var(--info-bg)]",
        danger: "bg-[var(--err)] text-white hover:brightness-95",
        warning: "bg-[var(--warn)] text-white hover:brightness-95",
        link: "text-[var(--c-edu)] underline-offset-4 hover:underline px-0",
        // H14 · Soft 3D 四变体（仅学生域页面使用；令牌挂在 [data-persona="student"] 作用域内，
        // 教师端即便误用也只会拿到中性回退色，不会污染控制台的专业基调）。
        play: "play-3d play-gloss rounded-full bg-[var(--play-primary)] text-white [--lip:var(--play-lip-primary)]",
        playGrad: "play-3d play-gloss rounded-full text-white [--lip:#B0347A] bg-[image:var(--play-grad-pp)]",
        playSoft: "play-3d rounded-full bg-[var(--card)] text-[var(--play-primary)] border-2 border-[var(--play-primary)]/25 [--lip:var(--play-lip-neutral)]",
        playGhost: "rounded-full bg-transparent text-[var(--text-2)] transition-colors hover:bg-[var(--rg-hover-bg)] hover:text-[var(--text)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-[12px]",
        lg: "h-11 px-5 text-[14px]",
        xl: "h-12 px-6 text-[14px] rounded-[calc(var(--rg-control-radius)+2px)]",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp data-variant={variant ?? "primary"} data-size={size ?? "default"} className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
