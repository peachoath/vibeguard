import { getPreferences } from './preferences'

/** ISO → 절대 날짜. 시간대 설정(local/utc)을 반영. */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const utc = getPreferences().timezone === 'utc'
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: utc ? 'UTC' : undefined,
  })
}

/** ISO → 절대 날짜+시각. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const utc = getPreferences().timezone === 'utc'
  return d.toLocaleString('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: utc ? 'UTC' : undefined,
  })
}

/** ISO → "방금 전 / N분 전 / N시간 전 / N일 전 / 날짜". */
export function relativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return iso
  const diff = Date.now() - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return formatDate(iso)
}

/** 가입 후 경과를 친근하게: "N일째 / N개월째 / N년째 사용 중". */
export function membershipDuration(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const days = Math.floor((Date.now() - d) / 86400000)
  if (days < 1) return '오늘 가입'
  if (days < 30) return `${days}일째 사용 중`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}개월째 사용 중`
  return `${Math.floor(months / 12)}년째 사용 중`
}
