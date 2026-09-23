'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Check, KeyRound, LogOut, RefreshCw, RotateCcw, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'
import { apiFetch } from '@/lib/api'
import { toast } from '../components/providers'

type TabId = 'profile' | 'preferences' | 'notifications' | 'policy' | 'account'

interface UserProfile {
  githubId: number
  login: string
  displayName: string
  email: string | null
  avatarUrl: string
  createdAt: string
  lastLoginAt: string | null
}

interface UserSettings {
  minSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  excludedPaths: string[]
  notifyEmail: boolean
}

interface UserStats {
  repositoryCount: number
  scanCount: number
}

function ProfileSection() {
  const qc = useQueryClient()
  const { data: profile, isPending } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => apiFetch<UserProfile>('/users/me'),
  })
  const update = useMutation({
    mutationFn: (body: { displayName?: string; email?: string }) =>
      apiFetch<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(['users', 'me'], data)
      toast.success('프로필을 저장했어요')
    },
    onError: () => toast.error('저장에 실패했어요'),
  })

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  if (isPending) return <div style={{ padding: '2rem' }}>불러오는 중…</div>
  if (!profile) return <div style={{ padding: '2rem' }}>프로필을 불러오지 못했습니다.</div>

  const nameVal = displayName ?? profile.displayName ?? ''
  const emailVal = email ?? profile.email ?? ''
  const dirty = nameVal !== (profile.displayName ?? '') || emailVal !== (profile.email ?? '')

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">프로필</h2>
        <p className="section-sub">GitHub 로그인 정보와 표시용 프로필을 관리해요.</p>
      </header>

      <div className="profile-hero">
        {profile.avatarUrl ? (
          <Image src={profile.avatarUrl} alt="" className="profile-hero-avatar" width={72} height={72} style={{ borderRadius: '50%' }} />
        ) : (
          <div className="profile-hero-avatar profile-avatar-fallback">
            {profile.login.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="profile-hero-name">{profile.displayName}</div>
          <div className="profile-hero-login">@{profile.login}</div>
        </div>
      </div>

      <div className="tile-group">
        <label className="tile-field">
          <span className="tile-field-label">표시 이름</span>
          <input
            className="tile-input"
            value={nameVal}
            placeholder={profile.login}
            maxLength={255}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="tile-field">
          <span className="tile-field-label">이메일</span>
          <input
            className="tile-input"
            type="email"
            value={emailVal}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>

      <div className="section-actions">
        <button
          className="btn-primary"
          disabled={!dirty || update.isPending}
          onClick={() => update.mutate({ displayName: nameVal, email: emailVal || undefined })}
        >
          {update.isPending ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

function PreferencesSection() {
  const qc = useQueryClient()
  const { data: settings, isPending } = useQuery({
    queryKey: ['users', 'me', 'settings'],
    queryFn: () => apiFetch<UserSettings>('/users/me/settings'),
  })
  const update = useMutation({
    mutationFn: (body: Partial<UserSettings>) =>
      apiFetch<UserSettings>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(['users', 'me', 'settings'], data)
      toast.success('설정을 저장했어요')
    },
    onError: () => toast.error('저장에 실패했어요'),
  })

  if (isPending) return <div style={{ padding: '2rem' }}>불러오는 중…</div>
  if (!settings) return <div style={{ padding: '2rem' }}>설정을 불러오지 못했습니다.</div>

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">환경설정</h2>
        <p className="section-sub">스캔 동작과 보고 방식을 조정해요.</p>
      </header>

      <div className="tile-group">
        <div className="tile-field">
          <span className="tile-field-label">최소 심각도</span>
          <select
            className="tile-input"
            value={settings.minSeverity}
            onChange={(e) => update.mutate({ minSeverity: e.target.value as UserSettings['minSeverity'] })}
          >
            <option value="LOW">낮음 (LOW) 이상</option>
            <option value="MEDIUM">보통 (MEDIUM) 이상</option>
            <option value="HIGH">높음 (HIGH) 이상</option>
            <option value="CRITICAL">치명적 (CRITICAL) 만</option>
          </select>
          <span className="tile-field-hint">이 심각도 미만 취약점은 무시됩니다.</span>
        </div>
      </div>
    </div>
  )
}

function NotificationsSection() {
  const qc = useQueryClient()
  const { data: settings, isPending } = useQuery({
    queryKey: ['users', 'me', 'settings'],
    queryFn: () => apiFetch<UserSettings>('/users/me/settings'),
  })
  const update = useMutation({
    mutationFn: (body: Partial<UserSettings>) =>
      apiFetch<UserSettings>('/users/me/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: (data) => {
      qc.setQueryData(['users', 'me', 'settings'], data)
      toast.success('알림 설정을 저장했어요')
    },
    onError: () => toast.error('저장에 실패했어요'),
  })

  if (isPending) return <div style={{ padding: '2rem' }}>불러오는 중…</div>
  if (!settings) return null

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">알림</h2>
        <p className="section-sub">스캔 결과 알림 채널을 설정해요.</p>
      </header>

      <div className="tile-group">
        <label className="tile-row" style={{ cursor: 'pointer' }}>
          <div className="tile-row-text">
            <span className="tile-row-title">이메일 알림</span>
            <span className="tile-row-desc">스캔 완료·회귀 차단 시 이메일로 알려드려요.</span>
          </div>
          <input
            type="checkbox"
            checked={settings.notifyEmail}
            onChange={(e) => update.mutate({ notifyEmail: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--color-accent, #007aff)' }}
          />
        </label>
      </div>
    </div>
  )
}

function PolicySection() {
  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">스캔 정책</h2>
        <p className="section-sub">자동 스캔 트리거와 제외 경로를 설정해요.</p>
      </header>
      <div className="tile-group">
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">PR 이벤트 트리거</span>
            <span className="tile-row-desc">Pull Request 생성·업데이트 시 자동으로 스캔을 시작합니다.</span>
          </div>
          <span className="connect-badge" style={{ fontSize: 12, padding: '3px 8px' }}>
            <Check size={11} /> 활성
          </span>
        </div>
      </div>
    </div>
  )
}

function AccountSection() {
  const qc = useQueryClient()
  const router = useRouter()
  const { data: profile, isPending } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: () => apiFetch<UserProfile>('/users/me'),
  })
  const { data: stats } = useQuery({
    queryKey: ['users', 'me', 'stats'],
    queryFn: () => apiFetch<UserStats>('/users/me/stats'),
  })
  const resync = useMutation({
    mutationFn: () => apiFetch<UserProfile>('/users/me/resync', { method: 'POST' }),
    onSuccess: (data) => {
      qc.setQueryData(['users', 'me'], data)
      qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      toast.success('GitHub 프로필을 동기화했어요')
    },
    onError: () => toast.error('동기화에 실패했어요'),
  })
  const logout = useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => { qc.clear(); router.replace('/login') },
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const del = useMutation({
    mutationFn: () => apiFetch<void>('/users/me', { method: 'DELETE' }),
    onSuccess: () => { qc.clear(); router.replace('/login') },
    onError: () => toast.error('탈퇴 처리에 실패했어요'),
  })

  if (isPending) return <div style={{ padding: '2rem' }}>불러오는 중…</div>
  if (!profile) return <div style={{ padding: '2rem' }}>계정 정보를 불러오지 못했습니다.</div>

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">계정</h2>
        <p className="section-sub">연결된 GitHub 계정과 세션·위험 작업을 관리해요.</p>
      </header>

      <div className="connect-card">
        <div className="connect-main">
          <svg width="34" height="34" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <div>
            <div className="connect-title">
              GitHub 연결됨
              <span className="connect-badge"><Check size={11} /> 연결</span>
            </div>
            <div className="connect-sub">@{profile.login}</div>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={() => resync.mutate()} disabled={resync.isPending}>
          <RefreshCw size={13} />
          {resync.isPending ? '동기화 중…' : '재동기화'}
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-value">{stats?.repositoryCount ?? '—'}</div>
          <div className="stat-label">연결된 리포</div>
        </div>
        <div className="stat-cell">
          <div className="stat-value">{stats?.scanCount ?? '—'}</div>
          <div className="stat-label">전체 스캔</div>
        </div>
        <div className="stat-cell">
          <div className="stat-value" style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>{profile.githubId}</div>
          <div className="stat-label">GitHub ID</div>
        </div>
      </div>

      <div className="tile-group">
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">GitHub 다시 연결</span>
            <span className="tile-row-desc">권한(scope)을 갱신하거나 토큰을 새로 발급받아요.</span>
          </div>
          <a href="/oauth2/authorization/github" className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RotateCcw size={13} />
            다시 연결
          </a>
        </div>
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">로그아웃</span>
            <span className="tile-row-desc">이 기기에서 세션을 종료해요.</span>
          </div>
          <button type="button" className="btn-ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={13} />
            로그아웃
          </button>
        </div>
      </div>

      <div className="danger-card">
        <div className="danger-text">
          <span className="danger-title">회원 탈퇴</span>
          <span className="danger-desc">계정과 모든 데이터가 영구 삭제되며 되돌릴 수 없어요.</span>
        </div>
        <button type="button" className="btn-danger" onClick={() => setDeleteOpen(true)}>
          계정 삭제
        </button>
      </div>

      {deleteOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <h3 className="modal-title">정말 탈퇴하시겠어요?</h3>
            <p className="modal-body">확인을 위해 <b>{profile.login}</b> 을(를) 그대로 입력해주세요.</p>
            <input
              className="tile-input"
              value={confirmText}
              placeholder={profile.login}
              autoFocus
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => { setDeleteOpen(false); setConfirmText('') }} disabled={del.isPending}>취소</button>
              <button
                type="button"
                className="btn-danger"
                disabled={confirmText !== profile.login || del.isPending}
                onClick={() => del.mutate()}
              >
                {del.isPending ? '삭제 중…' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: '프로필', icon: <UserRound size={17} /> },
  { id: 'preferences', label: '환경설정', icon: <SlidersHorizontal size={17} /> },
  { id: 'notifications', label: '알림', icon: <Bell size={17} /> },
  { id: 'policy', label: '스캔 정책', icon: <ShieldCheck size={17} /> },
  { id: 'account', label: '계정', icon: <KeyRound size={17} /> },
]

const SECTIONS: Record<TabId, React.ReactNode> = {
  profile: <ProfileSection />,
  preferences: <PreferencesSection />,
  notifications: <NotificationsSection />,
  policy: <PolicySection />,
  account: <AccountSection />,
}

export default function SettingsPage() {
  const [active, setActive] = useState<TabId>('profile')

  return (
    <AuthGuard>
      <main className="repositories-page">
        <AppHeader active="repositories" />

        <ScreenContent>
          <div className="settings-page">
            <h1 className="settings-title">내 계정</h1>

            <div className="settings-layout">
              <nav className="settings-nav" aria-label="설정 섹션">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`settings-nav-item${active === t.id ? ' active' : ''}`}
                    aria-current={active === t.id}
                    onClick={() => setActive(t.id)}
                  >
                    <span className="settings-nav-icon">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </nav>

              <div className="settings-content">
                {SECTIONS[active]}
              </div>
            </div>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}
