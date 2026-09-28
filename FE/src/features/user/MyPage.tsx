import { Bell, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { LeaveGuardContext } from './leaveGuard'
import { AccountSection } from './sections/AccountSection'
import { NotificationsSection } from './sections/NotificationsSection'
import { PolicySection } from './sections/PolicySection'
import { PreferencesSection } from './sections/PreferencesSection'
import { ProfileSection } from './sections/ProfileSection'

type TabId = 'profile' | 'preferences' | 'notifications' | 'policy' | 'account'

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

/** 마이페이지 — 좌측 탭 + 우측 콘텐츠. URL 동기화·저장 경고·방향 슬라이드·키보드 이동. */
export function MyPage() {
  const { tab } = useParams<{ tab: TabId }>()
  const navigate = useNavigate()
  const active: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : 'profile'
  const activeIndex = TABS.findIndex((t) => t.id === active)

  const [dirty, setDirty] = useState(false)
  const [pendingTab, setPendingTab] = useState<TabId | null>(null)
  // 슬라이드 방향은 탭 전환(이벤트) 시점에 결정한다.
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd')

  // 저장 안 된 변경 시 새로고침·창 닫기 경고.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function goTo(next: TabId) {
    if (next === active) return
    setDirection(TABS.findIndex((t) => t.id === next) >= activeIndex ? 'fwd' : 'back')
    if (dirty) {
      setPendingTab(next)
      return
    }
    navigate(`/settings/${next}`)
  }

  function confirmLeave() {
    if (pendingTab) {
      setDirty(false)
      navigate(`/settings/${pendingTab}`)
      setPendingTab(null)
    }
  }

  function onNavKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const delta = e.key === 'ArrowDown' ? 1 : -1
    const nextIndex = (activeIndex + delta + TABS.length) % TABS.length
    goTo(TABS[nextIndex].id)
  }

  return (
    <LeaveGuardContext.Provider value={{ setDirty }}>
      <div className="settings-page">
        <h1 className="settings-title">내 계정</h1>

        <div className="settings-layout">
          <nav className="settings-nav" aria-label="설정 섹션" onKeyDown={onNavKey}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`settings-nav-item${active === t.id ? ' active' : ''}`}
                aria-current={active === t.id}
                onClick={() => goTo(t.id)}
              >
                <span className="settings-nav-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* key로 탭 전환 시 재마운트 → 방향 슬라이드 애니메이션 */}
          <div key={active} className={`settings-content slide-${direction}`}>
            {SECTIONS[active]}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={pendingTab !== null}
        title="저장하지 않고 이동할까요?"
        body="저장하지 않은 변경사항이 있어요. 이동하면 변경사항이 사라집니다."
        confirmLabel="이동"
        cancelLabel="계속 편집"
        danger
        onConfirm={confirmLeave}
        onCancel={() => setPendingTab(null)}
      />
    </LeaveGuardContext.Provider>
  )
}
