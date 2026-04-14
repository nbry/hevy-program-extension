import { useRef, useCallback, useEffect } from "react";

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  // Always call the latest saveFn, not a stale closure
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        await saveFnRef.current();
      } finally {
        savingRef.current = false;
      }
    }, delayMs);
  }, [delayMs]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveFnRef.current();
    } finally {
      savingRef.current = false;
    }
  }, []);

  return { trigger, flush };
}
