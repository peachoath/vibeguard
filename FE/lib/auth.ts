'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './api'

export interface AuthUser {
  githubId: number
  login: string
  avatarUrl: string
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<AuthUser>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      window.location.href = '/login'
    },
  })
}
