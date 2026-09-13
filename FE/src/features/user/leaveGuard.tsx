import { createContext, useContext } from 'react'

/**
 * 마이페이지 내 "저장 안 된 변경사항" 추적. 한 번에 한 섹션만 보이므로 단일 boolean으로 충분.
 * 편집 섹션(프로필·정책)이 dirty 상태를 등록하고, MyPage가 탭 전환/이탈을 가드한다.
 */
interface LeaveGuard {
  setDirty: (dirty: boolean) => void
}

export const LeaveGuardContext = createContext<LeaveGuard>({ setDirty: () => {} })

export function useLeaveGuard(): LeaveGuard {
  return useContext(LeaveGuardContext)
}
