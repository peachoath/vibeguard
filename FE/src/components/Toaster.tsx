import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscribe, type ToastItem, type ToastType } from './toast'

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
  warn:    AlertTriangle,
}

function ToastEl({ item }: { item: ToastItem }) {
  const Icon = ICONS[item.type]
  return (
    <div className={`toast toast--${item.type}`} role="alert">
      <Icon size={14} className="toast-icon" />
      <span className="toast-msg">{item.message}</span>
    </div>
  )
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => subscribe(setToasts), [])
  if (toasts.length === 0) return null
  return (
    <div className="toaster" aria-live="polite" aria-label="알림">
      {toasts.map(t => <ToastEl key={t.id} item={t} />)}
    </div>
  )
}
