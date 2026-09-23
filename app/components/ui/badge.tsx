import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border border-transparent px-2.5 py-0.5 text-[11px] font-semibold",
  {
    variants: {
      variant: {
        default: "bg-[var(--rg-control-bg)] text-[var(--text-2)]",
        primary: "bg-[var(--info-bg)] text-[var(--info-ink)]",
        cyan:    "bg-[var(--info-bg)] text-[var(--info-ink)]",
        violet:  "bg-[var(--proc-bg)] text-[var(--proc-ink)]",
        green:   "bg-[var(--ok-bg)] text-[var(--ok-ink)]",
        gold:    "bg-[var(--warn-bg)] text-[var(--warn-ink)]",
        red:     "bg-[var(--err-bg)] text-[var(--err-ink)]",
        outline: "bg-transparent border-[var(--border)] text-[var(--text-2)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
