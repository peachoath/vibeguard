import { create } from 'zustand'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

/**
 * 클라이언트(UI) 상태만 담습니다 — 필터, 사이드바 토글, 선택 항목 등.
 * 원격 데이터는 절대 여기 두지 않습니다 (PRD §8.1).
 */
interface UIState {
  sidebarOpen: boolean
  severityFilter: Severity[]
  selectedFindingId: string | null
  toggleSidebar: () => void
  setSeverityFilter: (s: Severity[]) => void
  selectFinding: (id: string | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  severityFilter: [],
  selectedFindingId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSeverityFilter: (severityFilter) => set({ severityFilter }),
  selectFinding: (selectedFindingId) => set({ selectedFindingId }),
}))
