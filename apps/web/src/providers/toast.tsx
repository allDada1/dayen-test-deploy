import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from "react";

type ToastType = "success" | "error" | "warning" | "info" | "favorite" | "order";

type ToastAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

type ToastItem = {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  action?: ToastAction;
  timeoutMs: number;
};

type ToastInput = {
  type?: ToastType;
  title?: string;
  message: string;
  action?: ToastAction;
  timeoutMs?: number;
};

type ToastOptions = Omit<ToastInput, "type" | "message">;

type ToastContextValue = {
  show: (toast: ToastInput) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
  favorite: (message: string, options?: ToastOptions) => void;
  order: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const DEFAULT_TOAST_TIMEOUT_MS = 5200;

const toastMeta: Record<ToastType, { icon: ToastType; title: string }> = {
  success: { icon: "success", title: "Готово" },
  error: { icon: "error", title: "Действие не выполнено" },
  warning: { icon: "warning", title: "Проверьте данные" },
  info: { icon: "info", title: "Уведомление" },
  favorite: { icon: "favorite", title: "Избранное обновлено" },
  order: { icon: "order", title: "Заказ обновлен" },
};

function ToastIcon({ icon }: { icon: ToastType }) {
  if (icon === "favorite") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.2 5.8a5.3 5.3 0 0 0-7.5 0l-.7.7-.7-.7a5.3 5.3 0 1 0-7.5 7.5L12 21l8.2-7.7a5.3 5.3 0 0 0 0-7.5Z" />
      </svg>
    );
  }

  if (icon === "info") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 12a8 8 0 0 1 8-8h.4a7.6 7.6 0 0 1 7.6 7.6A7.4 7.4 0 0 1 12.6 19H9l-4 2 1.2-3.5A8 8 0 0 1 4 12Z" />
        <path d="M9 11.5h.1M12 11.5h.1M15 11.5h.1" />
      </svg>
    );
  }

  if (icon === "warning") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4 21 20H3L12 4Z" />
        <path d="M12 9v5M12 17h.1" />
      </svg>
    );
  }

  if (icon === "error") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="m9 9 6 6M15 9l-6 6" />
      </svg>
    );
  }

  if (icon === "order") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 9V7.75C8.5 5.68 10.07 4 12 4s3.5 1.68 3.5 3.75V9" />
        <path d="M6.75 9h10.5c.9 0 1.59.8 1.46 1.69l-.68 4.89A3.3 3.3 0 0 1 14.76 19H9.24a3.3 3.3 0 0 1-3.27-2.82l-.68-4.89C5.16 9.8 5.85 9 6.75 9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.3 2.3 4.9-5" />
    </svg>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());

  const remove = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    ({ type = "info", title, message, action, timeoutMs = DEFAULT_TOAST_TIMEOUT_MS }: ToastInput) => {
      const id = Date.now() + Math.random();
      const timer = window.setTimeout(() => remove(id), timeoutMs);
      timers.current.set(id, timer);
      setToasts((current) => [...current.slice(-3), { id, type, title, message, action, timeoutMs }]);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success(message, options) {
        show({ type: "success", message, ...options });
      },
      error(message, options) {
        show({ type: "error", message, ...options });
      },
      warning(message, options) {
        show({ type: "warning", message, ...options });
      },
      info(message, options) {
        show({ type: "info", message, ...options });
      },
      favorite(message, options) {
        show({ type: "favorite", message, ...options });
      },
      order(message, options) {
        show({ type: "order", message, ...options });
      },
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toastStack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          const meta = toastMeta[toast.type];
          const style = { "--toast-timeout": `${toast.timeoutMs}ms` } as CSSProperties;

          return (
            <article key={toast.id} className={`toast toast--${toast.type}`} style={style}>
              <span className="toast__icon" aria-hidden="true">
                <ToastIcon icon={meta.icon} />
              </span>
              <span className="toast__content">
                <strong>{toast.title || meta.title}</strong>
                <span>{toast.message}</span>
                {toast.action ? (
                  toast.action.href ? (
                    <a className="toast__action" href={toast.action.href} onClick={() => remove(toast.id)}>
                      {toast.action.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="toast__action"
                      onClick={() => {
                        toast.action?.onClick?.();
                        remove(toast.id);
                      }}
                    >
                      {toast.action.label}
                    </button>
                  )
                ) : null}
              </span>
              <button type="button" className="toast__close" aria-label="Закрыть уведомление" onClick={() => remove(toast.id)}>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M5 5l10 10M15 5 5 15" />
                </svg>
              </button>
            </article>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used within ToastProvider");
  return value;
}
