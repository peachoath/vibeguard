import { useSyncExternalStore } from 'react'
import { applyThemePref, getStoredPref, resolveTheme, type ThemePref } from './theme'

/**
 * 테마 선택을 React에 노출하는 훅. localStorage(vg-theme)를 단일 소스로,
 * 여러 컴포넌트가 같은 값을 구독하도록 useSyncExternalStore + storage 이벤트로 동기화한다.
 */
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  window.addEventListener('storage', cb) // 다른 탭에서 바뀐 경우도 반영
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getStoredPref, () => 'light' as ThemePref)

  function setTheme(next: ThemePref) {
    applyThemePref(next)
    listeners.forEach((l) => l()) // 같은 탭 내 구독자 즉시 갱신
  }

  return { pref, resolved: resolveTheme(pref), setTheme }
}
