/**
 * 개인 표시 설정 — 전부 클라이언트 로컬(localStorage), BE 불필요.
 * theme(테마)는 별도 모듈(theme.ts)에서 관리하고, 여기선 밀도·모션·코드폰트·Diff뷰를 다룬다.
 *
 * 적용 방식: <html>의 data-* 속성과 CSS 변수로 반영 → index.css 가 이를 구독한다.
 *   - data-density="compact|comfortable"
 *   - data-reduce-motion="true"        (설정 시에만)
 *   - style --font-mono-size: <px>
 * diffView 는 Diff 뷰어(F-08) 기본값으로, 아직 소비처가 없어 저장만 한다.
 */
export type DiffView = 'split' | 'inline'
export type Density = 'comfortable' | 'compact'

export interface Preferences {
  diffView: DiffView
  density: Density
  codeFontSize: number
  reduceMotion: boolean
}

const STORAGE_KEY = 'vg-prefs'

export const DEFAULT_PREFERENCES: Preferences = {
  diffView: 'split',
  density: 'comfortable',
  codeFontSize: 13,
  reduceMotion: false,
}

export function getPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES
  } catch {
    return DEFAULT_PREFERENCES
  }
}

/** 설정을 <html> data-* / CSS 변수에 반영 (저장은 하지 않음). */
function applyToDom(prefs: Preferences): void {
  const el = document.documentElement
  el.dataset.density = prefs.density
  if (prefs.reduceMotion) el.dataset.reduceMotion = 'true'
  else delete el.dataset.reduceMotion
  el.style.setProperty('--font-mono-size', `${prefs.codeFontSize}px`)
}

/** 부분 수정 → 저장 + DOM 반영. 갱신된 전체 설정을 반환. */
export function setPreferences(patch: Partial<Preferences>): Preferences {
  const next = { ...getPreferences(), ...patch }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  applyToDom(next)
  return next
}

/** 앱 부팅 시 1회 — 저장된 설정(없으면 기본값)을 DOM에 반영. */
export function initPreferences(): void {
  applyToDom(getPreferences())
}
