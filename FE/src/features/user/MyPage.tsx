import { Bell, KeyRound, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react'
import { useState } from 'react'
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

/** 마이페이지 — 좌측 탭 + 우측 콘텐츠(설정앱 레이아웃). 이슈 #7, F-01 확장. */
export function MyPage() {
  const [active, setActive] = useState<TabId>('profile')

  return (
    <div className="settings-page">
      <h1 className="settings-title">내 계정</h1>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="설정 섹션">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item${active === tab.id ? ' active' : ''}`}
              aria-current={active === tab.id}
              onClick={() => setActive(tab.id)}
            >
              <span className="settings-nav-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {active === 'profile' && <ProfileSection />}
          {active === 'preferences' && <PreferencesSection />}
          {active === 'notifications' && <NotificationsSection />}
          {active === 'policy' && <PolicySection />}
          {active === 'account' && <AccountSection />}
        </div>
      </div>
    </div>
  )
}
