import { Monitor, Moon, Sun } from 'lucide-react'
import { Segmented } from '@/components/Segmented'
import { Switch } from '@/components/Switch'
import type { ThemePref } from '@/lib/theme'
import { useTheme } from '@/lib/useTheme'
import type { Density, DiffView } from '@/lib/preferences'
import { usePreferences } from '@/lib/usePreferences'

const FONT_SIZES = [12, 13, 14, 15]

/** 환경설정 — 테마·밀도·Diff 뷰·코드 폰트·모션. 전부 이 브라우저 로컬 설정. */
export function PreferencesSection() {
  const { pref, resolved, setTheme } = useTheme()
  const { prefs, update } = usePreferences()

  return (
    <div className="section">
      <header className="section-head">
        <h2 className="section-title">환경설정</h2>
        <p className="section-sub">이 브라우저에만 적용되는 개인 표시 설정이에요.</p>
      </header>

      <div className="tile-group">
        {/* 테마 */}
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

        {/* 화면 밀도 */}
        <div className="tile-row tile-row-stack">
          <div className="tile-row-text">
            <span className="tile-row-title">화면 밀도</span>
            <span className="tile-row-desc">목록·카드의 여백을 조절해요.</span>
          </div>
          <Segmented<Density>
            ariaLabel="화면 밀도"
            value={prefs.density}
            onChange={(v) => update({ density: v })}
            options={[
              { value: 'comfortable', label: '편안함' },
              { value: 'compact', label: '컴팩트' },
            ]}
          />
        </div>

        {/* Diff 뷰 기본값 */}
        <div className="tile-row tile-row-stack">
          <div className="tile-row-text">
            <span className="tile-row-title">Diff 뷰 기본값</span>
            <span className="tile-row-desc">패치 비교를 좌우 분할 / 인라인 중 무엇으로 열지.</span>
          </div>
          <Segmented<DiffView>
            ariaLabel="Diff 뷰 기본값"
            value={prefs.diffView}
            onChange={(v) => update({ diffView: v })}
            options={[
              { value: 'split', label: '좌우 분할' },
              { value: 'inline', label: '인라인' },
            ]}
          />
        </div>

        {/* 코드 폰트 크기 */}
        <div className="tile-row tile-row-stack">
          <div className="tile-row-text">
            <span className="tile-row-title">코드 폰트 크기</span>
            <span
              className="tile-row-desc"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--font-mono-size)' }}
            >
              로그·스니펫에 적용 · 미리보기 abc123
            </span>
          </div>
          <Segmented<string>
            ariaLabel="코드 폰트 크기"
            value={String(prefs.codeFontSize)}
            onChange={(v) => update({ codeFontSize: Number(v) })}
            options={FONT_SIZES.map((s) => ({ value: String(s), label: `${s}px` }))}
          />
        </div>

        {/* 모션 줄이기 */}
        <div className="tile-row">
          <div className="tile-row-text">
            <span className="tile-row-title">모션 줄이기</span>
            <span className="tile-row-desc">전환·애니메이션 효과를 최소화해요.</span>
          </div>
          <Switch
            label="모션 줄이기"
            checked={prefs.reduceMotion}
            onChange={(next) => update({ reduceMotion: next })}
          />
        </div>
      </div>
    </div>
  )
}
