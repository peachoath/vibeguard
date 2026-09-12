import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { authKeys } from '@/features/auth/useAuth'
import type {
  UpdateProfileRequest,
  UpdateSettingsRequest,
  UserProfile,
  UserSettings,
} from './types'

// 서버 상태는 전부 TanStack Query로 관리 (AI_Learn_First §9). 마이페이지 = /users/me 계열.
export const userKeys = {
  profile: ['user', 'profile'] as const,
  settings: ['user', 'settings'] as const,
}

/** 프로필 조회 (GET /users/me). */
export function useProfile() {
  return useQuery({
    queryKey: userKeys.profile,
    queryFn: () => apiFetch<UserProfile>('/users/me'),
    staleTime: 60_000,
  })
}

/** 프로필 수정 (PATCH /users/me). 성공 시 프로필·인증 캐시 갱신(헤더 아바타/이름 동기화). */
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) =>
      apiFetch<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (profile) => {
      qc.setQueryData(userKeys.profile, profile)
      qc.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}

/** GitHub 프로필(login·avatar) 재동기화 (POST /users/me/resync). */
export function useResyncProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<UserProfile>('/users/me/resync', { method: 'POST' }),
    onSuccess: (profile) => {
      qc.setQueryData(userKeys.profile, profile)
      qc.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}

/** 설정 조회 (GET /users/me/settings). */
export function useSettings() {
  return useQuery({
    queryKey: userKeys.settings,
    queryFn: () => apiFetch<UserSettings>('/users/me/settings'),
    staleTime: 60_000,
  })
}

/** 설정 수정 (PATCH /users/me/settings). */
export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateSettingsRequest) =>
      apiFetch<UserSettings>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (settings) => qc.setQueryData(userKeys.settings, settings),
  })
}

/**
 * 회원 탈퇴 (DELETE /users/me). 성공 시 BE가 세션을 무효화하므로
 * 클라이언트도 모든 쿼리 캐시를 비워 미인증 상태로 되돌린다.
 */
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/users/me', { method: 'DELETE' }),
    onSuccess: () => {
      qc.setQueryData(authKeys.me, null)
      qc.clear()
    },
  })
}
