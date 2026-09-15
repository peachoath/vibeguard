import { Check, LogOut, RefreshCw, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CopyButton } from '@/components/CopyButton'
import { SectionSkeleton } from '@/components/Skeleton'
import { toast } from '@/components/toast'
import { startGitHubLogin, useLogout } from '@/features/auth/useAuth'
import { formatDate, relativeTime } from '@/lib/datetime'
import { useDeleteAccount, useProfile, useResyncProfile, useUserStats } from '../useUser'

/** 계정 — GitHub 연동 상태·통계·세션 + 위험 구역(회원 탈퇴). */
export function AccountSection() {
  const { data: profile, isPending, isError } = useProfile()
  const { data: stats } = useUserStats()
  const resync = useResyncProfile()
  const logout = useLogout()
  const navigate = useNavigate()

  if (isPending) return <SectionSkeleton />
  if (isError || !profile) return <p className="section-error">계정 정보를 불러오지 못했습니다.</p>

  function handleLogout() {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
  }

  function handleResync() {
    resync.mutate(undefined, {
      onSuccess: () => toast.success('GitHub 프로필을 동기화했어요'),
      onError: () => toast.error('동기화에 실패했어요'),
    })
  }

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">계정</h2>
        <p className="section-sub">연결된 GitHub 계정과 세션·위험 작업을 관리해요.</p>
      </header>

      {/* GitHub 연동 카드 */}
      <div className="connect-card">
        <div className="connect-main">
          <GitHubMark />
          <div>
            <div className="connect-title">
              GitHub 연결됨
              <span className="connect-badge">
                <Check size={11} /> 연결
              </span>
            </div>
            <div className="connect-sub">
              @{profile.login} · 연결일 {formatDate(profile.createdAt)}
              {profile.lastLoginAt && ` · 마지막 로그인 ${relativeTime(profile.lastLoginAt)}`}
            </div>
          </div>
        </div>
        <button type="button" className="btn-ghost" onClick={handleResync} disabled={resync.isPending}>
          <RefreshCw size={13} className={resync.isPending ? 'spin' : undefined} />
          {resync.isPending ? '동기화 중…' : '재동기화'}
        </button>
      </div>

      {/* 계정 요약 통계 */}
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
          <div className="stat-value-row">
            <span className="stat-value stat-value-mono">{profile.githubId}</span>
            <CopyButton value={String(profile.githubId)} label="GitHub ID" />
          </div>
          <div className="stat-label">GitHub ID</div>
        </div>
      </div>

      {/* 세션 */}
      <div className="tile-group">
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">GitHub 다시 연결</span>
            <span className="tile-row-desc">권한(scope)을 갱신하거나 토큰을 새로 발급받아요.</span>
          </div>
          <button type="button" className="btn-ghost" onClick={startGitHubLogin}>
            <RotateCcw size={13} />
            다시 연결
          </button>
        </div>
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">로그아웃</span>
            <span className="tile-row-desc">이 기기에서 세션을 종료해요.</span>
          </div>
          <button type="button" className="btn-ghost" onClick={handleLogout} disabled={logout.isPending}>
            <LogOut size={13} />
            로그아웃
          </button>
        </div>
      </div>

      <DangerZone login={profile.login} />
    </div>
  )
}

function DangerZone({ login }: { login: string }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const del = useDeleteAccount()
  const navigate = useNavigate()

  function closeModal() {
    setOpen(false)
    setConfirmText('')
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !del.isPending) closeModal() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, del.isPending])

  function confirmDelete() {
    del.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
      onError: () => toast.error('탈퇴 처리에 실패했어요'),
    })
  }

  return (
    <div className="danger-card">
      <div className="danger-text">
        <span className="danger-title">회원 탈퇴</span>
        <span className="danger-desc">
          계정과 모든 데이터(리포지토리·스캔·결과)가 영구 삭제되며 되돌릴 수 없어요.
        </span>
      </div>
      <button type="button" className="btn-danger" onClick={() => setOpen(true)}>
        계정 삭제
      </button>

      {open && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="회원 탈퇴 확인">
          <div className="modal">
            <h3 className="modal-title">정말 탈퇴하시겠어요?</h3>
            <p className="modal-body">
              확인을 위해 <b>{login}</b> 을(를) 그대로 입력해주세요.
            </p>
            <input
              className="tile-input"
              value={confirmText}
              placeholder={login}
              autoFocus
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={closeModal} disabled={del.isPending}>
                취소
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={confirmDelete}
                disabled={confirmText !== login || del.isPending}
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

function GitHubMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}
