export type ToastType = 'success' | 'error' | 'info' | 'warn'
export interface ToastItem { id: string; message: string; type: ToastType }

type Listener = (toasts: ToastItem[]) => void
const listeners = new Set<Listener>()
let items: ToastItem[] = []

function emit() { listeners.forEach(l => l([...items])) }

function show(message: string, type: ToastType, duration = 3500) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  items = [...items, { id, message, type }]
  emit()
  setTimeout(() => {
    items = items.filter(t => t.id !== id)
    emit()
  }, duration)
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const toast = {
  success: (message: string) => show(message, 'success'),
  error:   (message: string) => show(message, 'error'),
  info:    (message: string) => show(message, 'info'),
  warn:    (message: string) => show(message, 'warn'),
}
