import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, apiFetch, apiOrigin } from '@/lib/api'
import type { AuthUser } from './types'

// 인증은 서버 상태이므로 전부 TanStack Query로 관리 (AI_Learn_First §9, Query vs Zustand 혼용 금지).
export const authKeys = {
  me: ['auth', 'me'] as const,
}

/** 현재 로그인 사용자. 미인증(401)이면 null 을 반환한다(에러로 취급하지 않음). */
export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await apiFetch<AuthUser>('/auth/me')
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * GitHub OAuth 로그인 시작. OAuth 리다이렉트 특성상 fetch가 아니라 전체 페이지 이동이 필요하다.
 * 회원가입 개념이 따로 없고, 최초 로그인 시 BE가 users를 자동 upsert 한다(AI_Learn_First §12).
 */
export function startGitHubLogin(): void {
  window.location.href = `${apiOrigin()}/oauth2/authorization/github`
}

/** 로그아웃(POST /auth/logout, 204). 성공 시 인증 캐시를 비운다. */
export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(authKeys.me, null)
      qc.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}
