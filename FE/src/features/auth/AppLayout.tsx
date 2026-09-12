import { LogOut } from 'lucide-react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser, useLogout } from './useAuth'

/** 인증된 영역의 공통 셸. 상단 프로스티드 헤더에 사용자 정보 + 로그아웃을 노출한다. */
export function AppLayout() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand">
          VibeGuard
        </Link>

        {user && (
          <div className="app-user">
            {user.avatarUrl && <img src={user.avatarUrl} alt="" className="app-avatar" />}
            <span className="app-username">{user.login}</span>
            <button type="button" className="btn-ghost" onClick={handleLogout} disabled={logout.isPending}>
              <LogOut size={14} />
              로그아웃
            </button>
          </div>
        )}
      </header>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
