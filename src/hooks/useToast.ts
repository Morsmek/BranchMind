import { useState, useCallback, useRef } from "react";

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let globalAddToast: ((message: string, type?: "success" | "error" | "info") => void) | null = null;

export function toast(message: string, type: "success" | "error" | "info" = "info") {
  globalAddToast?.(message, type);
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  globalAddToast = addToast;

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
