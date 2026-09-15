import { create } from 'zustand'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastState {
  toasts: Toast[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let seq = 0

/** 전역 토스트 스토어. UI 상태이므로 Zustand (AI_Learn_First §9). */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2600)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** 어디서나 호출 가능한 간편 API. */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
}
