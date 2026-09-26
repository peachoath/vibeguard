'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

// 이전 URL 형태 (/results/pyyaml) 하위 호환을 위해 /findings/{pkg} 로 리디렉션
export default function LegacyFindingRedirect() {
  const { package: pkg } = useParams<{ package: string }>()
  const router = useRouter()

  useEffect(() => {
    router.replace(`/findings/${encodeURIComponent(pkg)}`)
  }, [pkg, router])

  return null
}
