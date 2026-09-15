import { LogOut, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { applyTheme, getActiveTheme, toggleTheme } from '@/lib/theme'
import { useCurrentUser, useLogout } from './useAuth'

export function AppLayout() {
  const { data: user } = useCurrentUser()
  const logout = useLogout()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getActiveTheme)

  function handleLogout() {
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    })
  }

  function handleTheme() {
    const next = applyTheme(toggleTheme())
    setTheme(next)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand">VibeGuard</Link>

        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
            대시보드
          </NavLink>
          <NavLink to="/repositories" className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
            리포지토리
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => 'app-nav-link' + (isActive ? ' active' : '')}>
            스캔 이력
          </NavLink>
        </nav>

        <div className="app-user">
          <button type="button" className="btn-ghost app-theme-btn" onClick={handleTheme} title={theme === 'dark' ? '라이트 모드' : '다크 모드'}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {user && (
            <>
              <Link to="/settings" className="app-userlink" title="내 계정">
                {user.avatarUrl && <img src={user.avatarUrl} alt="" className="app-avatar" />}
                <span className="app-username">{user.login}</span>
              </Link>
              <button type="button" className="btn-ghost" onClick={handleLogout} disabled={logout.isPending}>
                <LogOut size={14} />
                로그아웃
              </button>
            </>
          )}
        </div>
      </header>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  )
}
