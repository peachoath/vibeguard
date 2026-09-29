'use client'

import { useAuthUser, type AuthUser } from './queries'

export type { AuthUser }

/** auth-guard 등에서 쓰는 현재 사용자 훅. React Query로 백업되어 authMe 캐시를 공유한다. */
export function useCurrentUser() {
  const { data, isPending, isError } = useAuthUser()
  return { data: data ?? null, isLoading: isPending, isError }
}
