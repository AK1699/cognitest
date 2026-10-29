'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type Variant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  variant: Variant;
}

interface ToastApi {
  push: (message: string, variant?: Variant) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const VARIANT_STYLES: Record<Variant, { bar: string; text: string }> = {
  success: { bar: 'bg-pass', text: 'text-pass' },
  error: { bar: 'bg-fail', text: 'text-fail' },
  info: { bar: 'bg-accent', text: 'text-accent' },
};

const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((rows) => rows.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: Variant = 'info') => {
      const id = nextId.current++;
      setToasts((rows) => [...rows, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );


  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex overflow-hidden rounded-card border border-line bg-white shadow-lg"
          >
            <span aria-hidden className={`w-1 shrink-0 ${VARIANT_STYLES[toast.variant].bar}`} />
            <div className="flex-1 p-3">
              <p className="text-sm text-ink">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="self-start p-2 text-xs text-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
