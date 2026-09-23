"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--text-3)]",
      "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-edu)]/40 focus-visible:border-[var(--c-edu)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
