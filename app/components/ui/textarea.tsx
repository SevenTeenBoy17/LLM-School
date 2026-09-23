"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onInput"> {
  autoResize?: boolean;
  onInput?: React.FormEventHandler<HTMLTextAreaElement>;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoResize, onInput, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

    const handleInput: React.FormEventHandler<HTMLTextAreaElement> = (e) => {
      // React 19 narrows onInput to InputEvent; widen via cast for typed pass-through
      (onInput as React.FormEventHandler<HTMLTextAreaElement> | undefined)?.(e);
      if (autoResize && innerRef.current) {
        innerRef.current.style.height = "auto";
        innerRef.current.style.height = Math.min(innerRef.current.scrollHeight, 240) + "px";
      }
    };

    return (
      <textarea
        ref={innerRef}
        onInput={handleInput}
        className={cn(
          "flex min-h-[44px] w-full resize-none rounded-[12px] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-[14px] text-[var(--text)] placeholder:text-[var(--text-3)] outline-none transition-colors focus-visible:border-[var(--c-edu)] focus-visible:ring-2 focus-visible:ring-[var(--c-edu)]/40 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
