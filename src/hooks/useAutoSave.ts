import { useRef, useCallback } from "react";

export function useAutoSave(saveFn: () => Promise<void>, delayMs = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      try {
        await saveFn();
      } finally {
        savingRef.current = false;
      }
    }, delayMs);
  }, [saveFn, delayMs]);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveFn();
    } finally {
      savingRef.current = false;
    }
  }, [saveFn]);

  return { trigger, flush };
}
