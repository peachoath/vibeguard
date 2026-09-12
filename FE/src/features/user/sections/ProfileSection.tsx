import { useState } from 'react'
import { ApiError } from '@/lib/api'
import { useProfile, useUpdateProfile } from '../useUser'

/** 프로필 — 아바타/아이디 + 표시이름·이메일 인라인 수정. */
export function ProfileSection() {
  const { data: profile, isPending, isError } = useProfile()
  const update = useUpdateProfile()

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (isPending) return <SectionSkeleton />
  if (isError || !profile) return <p className="section-error">프로필을 불러오지 못했습니다.</p>

  // 편집 시작 전엔 서버값, 편집 후엔 로컬값을 표시.
  const nameVal = displayName ?? profile.displayName
  const emailVal = email ?? profile.email ?? ''
  const dirty =
    nameVal !== profile.displayName || emailVal !== (profile.email ?? '')

  function save() {
    setError(null)
    setSaved(false)
    update.mutate(
      { displayName: nameVal, email: emailVal },
      {
        onSuccess: () => {
          setSaved(true)
          setDisplayName(null)
          setEmail(null)
        },
        onError: (e) =>
          setError(
            e instanceof ApiError && e.status === 400
              ? '입력값을 확인해주세요 (이메일 형식 등).'
              : '저장에 실패했습니다.',
          ),
      },
    )
  }

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">프로필</h2>
        <p className="section-sub">GitHub 로그인 정보와 표시용 프로필을 관리해요.</p>
      </header>

      <div className="profile-hero">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="profile-hero-avatar" />
        ) : (
          <div className="profile-hero-avatar profile-avatar-fallback">
            {profile.login.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <div className="profile-hero-name">{profile.displayName}</div>
          <div className="profile-hero-login">@{profile.login}</div>
          <div className="profile-hero-joined">가입일 {formatDate(profile.createdAt)}</div>
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

      {error && <p className="section-error">{error}</p>}

      <div className="section-actions">
        <button
          type="button"
          className="btn-primary-sm"
          onClick={save}
          disabled={!dirty || update.isPending}
        >
          {update.isPending ? '저장 중…' : '변경사항 저장'}
        </button>
        {saved && !dirty && <span className="save-ok">저장됨 ✓</span>}
      </div>
    </div>
  )
}

function SectionSkeleton() {
  return <div className="section section-loading">불러오는 중…</div>
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}
