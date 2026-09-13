import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore } from './toast'

const ICON = {
  success: <CheckCircle2 size={16} />,
  error: <AlertCircle size={16} />,
  info: <Info size={16} />,
}

/** 전역 토스트 렌더러. 앱 루트에 1회 마운트한다. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="toaster" role="region" aria-label="알림">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
          <span className="toast-icon">{ICON[t.kind]}</span>
          <span className="toast-msg">{t.message}</span>
          <button type="button" className="toast-close" aria-label="닫기" onClick={() => dismiss(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
