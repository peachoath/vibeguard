'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect } from 'react'
import { useCurrentUser } from '@/lib/auth'

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError } = useCurrentUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (isError || !user)) {
      router.replace('/login')
    }
  }, [isLoading, isError, user, router])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="skeleton" style={{ width: 120, height: 24 }} />
      </div>
    )
  }

  if (!user) return null
  return <>{children}</>
}
