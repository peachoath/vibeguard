import { useCallback, useEffect, useState } from 'react'
import { SaveButton } from '@/components/SaveButton'
import { SectionSkeleton } from '@/components/Skeleton'
import { toast } from '@/components/toast'
import { ApiError } from '@/lib/api'
import { membershipDuration } from '@/lib/datetime'
import { useLeaveGuard } from '../leaveGuard'
import { useProfile, useUpdateProfile } from '../useUser'

/** 프로필 — 아바타/아이디 + 표시이름·이메일 인라인 수정. */
export function ProfileSection() {
  const { data: profile, isPending, isError } = useProfile()
  const update = useUpdateProfile()
  const { setDirty } = useLeaveGuard()

  const [displayName, setDisplayName] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const nameVal = displayName ?? profile?.displayName ?? ''
  const emailVal = email ?? profile?.email ?? ''
  const dirty = !!profile && (nameVal !== profile.displayName || emailVal !== (profile.email ?? ''))

  const save = useCallback(() => {
    setSuccess(false)
    update.mutate(
      { displayName: nameVal, email: emailVal },
      {
        onSuccess: () => {
          setDisplayName(null)
          setEmail(null)
          setSuccess(true)
          setTimeout(() => setSuccess(false), 1600)
          toast.success('프로필을 저장했어요')
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError && e.status === 400
              ? '입력값을 확인해주세요 (이메일 형식 등)'
              : '저장에 실패했어요',
          ),
      },
    )
  }, [nameVal, emailVal, update])

  // 저장 안 된 변경을 상위 가드에 동기화.
  useEffect(() => {
    setDirty(dirty)
    return () => setDirty(false)
  }, [dirty, setDirty])

  // ⌘S / Ctrl+S 로 저장.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && dirty) {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, save])

  if (isPending) return <SectionSkeleton />
  if (isError || !profile) return <p className="section-error">프로필을 불러오지 못했습니다.</p>

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
          <div className="profile-hero-joined">{membershipDuration(profile.createdAt)}</div>
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
          <span className="tile-field-hint">비워두면 @{profile.login} 으로 표시돼요.</span>
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

      <div className="preview-row">
        <span className="preview-caption">미리보기</span>
        <span className="preview-chip">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="preview-chip-avatar" />
          ) : (
            <span className="preview-chip-avatar preview-chip-fallback">
              {profile.login.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="preview-chip-name">{nameVal || profile.login}</span>
        </span>
      </div>

      <div className="section-actions">
        <SaveButton onClick={save} disabled={!dirty} pending={update.isPending} success={success} />
        {dirty && <span className="dirty-hint">저장 안 된 변경 · ⌘S</span>}
      </div>
    </div>
  )
}
