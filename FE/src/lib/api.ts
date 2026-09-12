// REST 호출 공통 헬퍼. 인증은 세션 쿠키 방식이므로 credentials:'include' 고정 (AI_Learn_First §9).
// base는 dev에서 '/api/v1'(Vite 프록시), 배포에선 VITE_API_BASE_URL 주입값.

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/**
 * OAuth 시작 URL의 오리진. `/oauth2/authorization/github` 는 `/api/v1` 하위가 아니라
 * BE 오리진 루트에 있으므로, API_BASE가 절대 URL이면 그 오리진을, 상대경로면 same-origin('')을 쓴다.
 */
export function apiOrigin(): string {
  return /^https?:\/\//.test(API_BASE) ? new URL(API_BASE).origin : ''
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `API ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) throw new ApiError(res.status)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
