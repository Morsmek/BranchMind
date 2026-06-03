import type { Toast as ToastType } from "../hooks/useToast";

interface ToastProps {
  toasts: ToastType[];
  onRemove: (id: number) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => onRemove(t.id)}
        >
          <span className="toast-icon">
            {t.type === "success" ? "\u2714" : t.type === "error" ? "\u2718" : "\u2139"}
          </span>
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
