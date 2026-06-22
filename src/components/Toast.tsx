import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional secondary line shown smaller below the message. */
  detail?: string;
  /** ms before auto-dismiss. 0 = sticky. */
  ttl?: number;
}

type Listener = (items: ToastItem[]) => void;
const listeners = new Set<Listener>();
let items: ToastItem[] = [];
let nextId = 1;

function emit() {
  for (const l of listeners) l(items);
}

export const toast = {
  show(message: string, opts: { kind?: ToastKind; detail?: string; ttl?: number } = {}) {
    const item: ToastItem = {
      id: nextId++,
      kind: opts.kind ?? 'info',
      message,
      detail: opts.detail,
      ttl: opts.ttl ?? 3500,
    };
    items = [...items, item];
    emit();
    if (item.ttl && item.ttl > 0) {
      setTimeout(() => toast.dismiss(item.id), item.ttl);
    }
    return item.id;
  },
  success(message: string, detail?: string) {
    return toast.show(message, { kind: 'success', detail });
  },
  error(message: string, detail?: string) {
    return toast.show(message, { kind: 'error', detail, ttl: 6000 });
  },
  dismiss(id: number) {
    items = items.filter((i) => i.id !== id);
    emit();
  },
};

export function ToastHost() {
  const [list, setList] = useState<ToastItem[]>(items);
  useEffect(() => {
    const l: Listener = (x) => setList(x);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  if (list.length === 0) return null;
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-body">
            <div className="toast-msg">{t.message}</div>
            {t.detail && <div className="toast-detail">{t.detail}</div>}
          </div>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => toast.dismiss(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
