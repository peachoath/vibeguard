/**
 * 라이트/다크 테마 스위치 헬퍼.
 *
 * 색상은 index.css 의 :root / [data-theme='dark'] CSS 변수로 정의돼 있고,
 * 실제 전환은 <html>의 data-theme 속성 하나만 바꾸면 전체에 즉시 반영된다.
 * 향후 헤더에 토글 스위치를 붙일 때 이 모듈만 호출하면 된다.
 *
 * 예) const [theme, setTheme] = useState(getStoredTheme() ?? 'light')
 *     <button onClick={() => setTheme(applyTheme(toggleTheme()))}>…</button>
 */
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'vg-theme'

/** 기본 테마. 현재 라이트 고정(추후 'system' 옵션 도입 시 이 값만 조정). */
export const DEFAULT_THEME: Theme = 'light'

/** localStorage에 저장된 사용자 선택 테마(없으면 null). */
export function getStoredTheme(): Theme | null {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : null
}

/** 현재 <html>에 적용된 테마. */
export function getActiveTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/** 테마를 DOM(<html data-theme>)에 적용하고 저장한다. 적용된 값을 반환. */
export function applyTheme(theme: Theme): Theme {
  document.documentElement.dataset.theme = theme
  localStorage.setItem(STORAGE_KEY, theme)
  return theme
}

/** 현재 테마의 반대 값을 계산해 반환(적용은 하지 않음). */
export function toggleTheme(): Theme {
  return getActiveTheme() === 'dark' ? 'light' : 'dark'
}

/** 앱 부팅 시 1회 호출 — 저장된 테마(없으면 기본)를 적용한다. */
export function initTheme(): void {
  applyTheme(getStoredTheme() ?? DEFAULT_THEME)
}
