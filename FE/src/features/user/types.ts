// ⚠️ 잠정 타입 — BE 미기동 상태 대비 수기 정의. BE 기동 후 `npm run typegen`
// 산출물(src/types/api.d.ts)로 교체할 것 (AI_Learn_First §9 "API 타입 수기 정의 금지").
// 실제 계약: UserController.java / UserProfileDto · UserSettingsDto (이슈 #7).

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

/** GET/PATCH /users/me — displayName 은 미설정 시 서버가 login 으로 대체해 내려준다. */
export interface UserProfile {
  githubId: number
  login: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  createdAt: string
}

/** GET/PATCH /users/me/settings */
export interface UserSettings {
  minSeverity: Severity
  excludedPaths: string[]
  notifyEmail: boolean
}

/** PATCH /users/me — 부분 수정(보낸 필드만 반영, ""은 값 해제). */
export interface UpdateProfileRequest {
  displayName?: string
  email?: string
}

/** PATCH /users/me/settings — 부분 수정. */
export interface UpdateSettingsRequest {
  minSeverity?: Severity
  excludedPaths?: string[]
  notifyEmail?: boolean
}
