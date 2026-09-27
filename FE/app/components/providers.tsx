'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useRef, useState } from 'react'

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

  if (!toasts.length) return null
  return (
    <div className="toaster" role="region" aria-label="알림">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} role="status">
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
  const qc = useRef(getQueryClient())

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCKS !== 'true') return
    import('@/mocks/browser').then(({ worker }) => {
      worker.start({ onUnhandledRequest: 'bypass' })
    })
  }, [])

  return (
    <QueryClientProvider client={qc.current}>
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
