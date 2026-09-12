import { Monitor, Moon, Sun } from 'lucide-react'
import { Segmented } from '@/components/Segmented'
import { useTheme } from '@/lib/useTheme'
import type { ThemePref } from '@/lib/theme'

/** 환경설정 — 테마(라이트/다크/시스템). 클라이언트 로컬 설정(localStorage). */
export function PreferencesSection() {
  const { pref, resolved, setTheme } = useTheme()

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">환경설정</h2>
        <p className="section-sub">이 브라우저에만 적용되는 개인 표시 설정이에요.</p>
      </header>

      <div className="tile-group">
        <div className="tile-row tile-row-stack">
          <div className="tile-row-text">
            <span className="tile-row-title">테마</span>
            <span className="tile-row-desc">
              현재 {resolved === 'dark' ? '다크' : '라이트'} 모드로 표시 중
              {pref === 'system' && ' (시스템 설정 따름)'}
            </span>
          </div>
          <Segmented<ThemePref>
            ariaLabel="테마 선택"
            value={pref}
            onChange={setTheme}
            options={[
              { value: 'light', label: '라이트', icon: <Sun size={15} /> },
              { value: 'dark', label: '다크', icon: <Moon size={15} /> },
              { value: 'system', label: '시스템', icon: <Monitor size={15} /> },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
