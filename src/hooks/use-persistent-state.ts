import { useCallback, useEffect, useState } from "react";
import { readJSON, writeJSON } from "@/lib/storage";

/**
 * `useState` that rehydrates from localStorage after mount and writes on
 * every change. SSR-safe: server renders `initial`, client swaps in the
 * stored value on hydration to avoid a mismatch.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const stored = readJSON<T | typeof SENTINEL>(key, SENTINEL);
    if (stored !== SENTINEL) setValue(stored);
    // key is intentionally the only dep; initial is read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (v: T) => {
      setValue(v);
      writeJSON(key, v);
    },
    [key],
  );

  return [value, set];
}

const SENTINEL = Symbol("unset");
