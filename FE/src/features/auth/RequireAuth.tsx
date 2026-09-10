import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from './useAuth'

/** 인증 필요 라우트 가드. 확인 중이면 로딩, 미인증이면 /login 으로 이동(원래 위치 기억). */
export function RequireAuth() {
  const { data: user, isPending } = useCurrentUser()
  const location = useLocation()

  if (isPending) {
    return <div style={{ padding: 32, color: 'var(--color-muted)' }}>인증 확인 중…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }
  return <Outlet />
}
