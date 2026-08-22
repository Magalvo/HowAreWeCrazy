import { useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 2500;

export function useToast() {
  const [toast, setToast] = useState("");
  const timerRef = useRef<number | null>(null);

  const notice = useCallback((message: string) => {
    setToast(message);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setToast(""), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  return { toast, notice };
}
