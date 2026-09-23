import type { FocusEvent } from "react";

export function revealDialogFocus(event: FocusEvent<HTMLDivElement>) {
  const dialog = event.currentTarget;
  const target = event.target;
  const layout = getComputedStyle(dialog);
  if (!(target instanceof HTMLElement) || layout.display !== "block" || layout.overflowY !== "auto") return;
  const bounds = dialog.getBoundingClientRect();
  const control = target.getBoundingClientRect();
  // Radix loops focus without scrolling; short-screen dialogs scroll as a whole.
  if (control.top < bounds.top || control.bottom > bounds.bottom) {
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }
}
