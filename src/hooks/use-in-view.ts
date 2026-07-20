import { useEffect, useRef, useState } from "react";

/** Fires once when the element first intersects the viewport, then disconnects. */
export function useInView<T extends Element>(options?: IntersectionObserverInit) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "200px", ...options },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, options]);

  return { ref, inView };
}
