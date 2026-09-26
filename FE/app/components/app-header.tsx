'use client'

import { LogOut, Settings } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useCurrentUser, useLogout } from '@/lib/auth'
import DashboardNav from './dashboard-nav'

type NavTab = 'repositories' | 'scan' | 'results' | 'history' | 'dashboard'

export default function AppHeader({ active }: { active: NavTab }) {
  const { data: user } = useCurrentUser()
  const logout = useLogout()

  const initials = user?.login?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <header className="dashboard-header">
      <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈">
        <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
      </Link>

      <DashboardNav active={active} />

      <div className="account-area">
        <Link href="/settings" className="settings-button" aria-label="설정">
          <Settings size={21} />
        </Link>

        {user?.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.login}
            width={32}
            height={32}
            className="account-avatar account-avatar--img"
            style={{ borderRadius: '50%' }}
          />
        ) : (
          <span className="account-avatar">{initials}</span>
        )}

        <span className="account-copy">
          <strong>{user?.login ?? '—'}</strong>
        </span>

        <button
          type="button"
          className="logout-button"
          aria-label="로그아웃"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          title="로그아웃"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  )
}
