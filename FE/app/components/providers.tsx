'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useState } from 'react'

function Toaster() {
  const [toasts, setToasts] = useState<Array<{ id: number; kind: 'success' | 'error' | 'info' | 'warn'; message: string }>>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, kind, message } = (e as CustomEvent).detail
      setToasts((prev) => [...prev, { id, kind, message }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2600)
    }
    window.addEventListener('vg:toast', handler)
    return () => window.removeEventListener('vg:toast', handler)
  }, [])

  // 라이브 영역은 항상 렌더해야 동적으로 추가되는 토스트를 스크린리더가 낭독한다.
  return (
    <div className="toaster" role="region" aria-label="알림 목록" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.kind}`}
          role={t.kind === 'error' || t.kind === 'warn' ? 'alert' : 'status'}
        >
          <span className="toast-msg">{t.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="닫기"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (count, err) => {
          if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) return false
          return count < 1
        },
      },
    },
  })
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserQueryClient) browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function Providers({ children }: { children: ReactNode }) {
  const [qc] = useState(getQueryClient)

  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster />
    </QueryClientProvider>
  )
}

let toastSeq = 0
export const toast = {
  success: (message: string) => dispatch('success', message),
  error: (message: string) => dispatch('error', message),
  info: (message: string) => dispatch('info', message),
  warn: (message: string) => dispatch('warn', message),
}

function dispatch(kind: string, message: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('vg:toast', { detail: { id: ++toastSeq, kind, message } }))
}
