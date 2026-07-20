import { useEffect, useRef } from "react";

const store = new Map<string, number>();

export function useRowScrollMemory<T extends HTMLElement>(key: string) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const saved = store.get(key);
    if (saved !== undefined) el.scrollLeft = saved;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => store.set(key, el.scrollLeft), 120);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, [key]);
  return ref;
}
