import { useEffect, useState } from "react";

/** Returns `true` after the first client-side effect fires. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
