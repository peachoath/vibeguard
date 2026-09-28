'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from './api'

export interface AuthUser {
  id: string
  githubId: number
  login: string
  displayName: string
  avatarUrl: string | null
  email: string | null
}

export function useCurrentUser() {
  const [data, setData] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    apiFetch<AuthUser>('/api/v1/auth/me')
      .then((u) => setData(u))
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false))
  }, [])

  return { data, isLoading, isError }
}
