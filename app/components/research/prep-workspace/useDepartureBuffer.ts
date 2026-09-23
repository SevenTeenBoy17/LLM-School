"use client";
import { useLayoutEffect, useRef } from "react";

export function useDepartureBuffer<T>(value: T, stash: (value: T) => void, drop: () => void) {
  const latest = useRef({ value, stash, drop });
  const skipDeparture = useRef(false);
  useLayoutEffect(() => { latest.current = { value, stash, drop }; skipDeparture.current = false; });
  useLayoutEffect(() => () => { if (!skipDeparture.current) latest.current.stash(latest.current.value); }, []);
  // A save/discard can unmount before React commits the cleared input state.
  return () => { skipDeparture.current = true; latest.current.drop(); };
}
