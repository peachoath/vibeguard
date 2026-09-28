/**
 * 테마 스위치 헬퍼 — 라이트 / 다크 / 시스템(OS 연동) 3-모드.
 *
 * 색상은 index.css 의 :root / [data-theme='dark'] CSS 변수로 정의돼 있고,
 * 실제 전환은 <html>의 data-theme 속성 하나만 바꾸면 전체에 즉시 반영된다.
 * '사용자 선택(pref)'은 3-모드이고, 실제 DOM에 반영되는 값(resolved)은 2-모드다.
 * 마이페이지 환경설정 UI는 useTheme() 훅으로 이 모듈을 구독한다.
 */
export type ThemePref = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'vg-theme'

/** 기본값: 라이트 — 애플/토스 톤의 밝고 깔끔한 기본. (사용자가 다크로 바꾸면 그 선택을 유지) */
export const DEFAULT_PREF: ThemePref = 'light'

/** localStorage에 저장된 사용자 선택(없으면 기본값). */
export function getStoredPref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT_PREF
}

/** 현재 OS 다크모드 여부. */
function systemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** 선택(pref) → 실제 적용 테마(resolved). */
export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === 'system' ? systemTheme() : pref
}

/** 선택(pref)을 DOM(<html data-theme>)에만 반영. 저장은 하지 않는다. */
function applyToDom(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref)
}

/**
 * 사용자의 명시적 선택을 저장하고 DOM에 반영. 저장된 선택을 반환.
 * (기본값은 저장하지 않으므로, 사용자가 실제로 고른 값만 localStorage에 남는다.)
 */
export function applyThemePref(pref: ThemePref): ThemePref {
  applyToDom(pref)
  localStorage.setItem(STORAGE_KEY, pref)
  return pref
}

/**
 * 앱 부팅 시 1회 호출 — 저장된 선택(없으면 기본값)을 적용만 하고,
 * '시스템' 모드일 때 OS 테마 변경을 실시간 반영하도록 리스너를 건다.
 * 기본값을 저장하지 않으므로 DEFAULT_PREF 변경이 기존 사용자에게도 반영된다.
 */
export function initTheme(): void {
  applyToDom(getStoredPref())
  window
    .matchMedia?.('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getStoredPref() === 'system') applyToDom('system')
    })
}
