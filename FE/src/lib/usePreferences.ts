import { useSyncExternalStore } from 'react'
import {
  DEFAULT_PREFERENCES,
  getPreferences,
  type Preferences,
  setPreferences,
} from './preferences'

/** 개인 표시 설정을 React에 노출하는 훅. localStorage(vg-prefs)를 단일 소스로 구독. */
const listeners = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

// useSyncExternalStore는 getSnapshot이 매번 안정적 참조를 반환해야 하므로 캐시한다.
let cache = getPreferences()
let cacheKey = ''
function snapshot(): Preferences {
  const key = JSON.stringify(getPreferences())
  if (key !== cacheKey) {
    cache = JSON.parse(key)
    cacheKey = key
  }
  return cache
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_PREFERENCES)

  function update(patch: Partial<Preferences>) {
    setPreferences(patch)
    listeners.forEach((l) => l())
  }

  return { prefs, update }
}
