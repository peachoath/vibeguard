// ⚠️ 잠정 타입 — BE 미기동 상태라 수기 정의. BE 기동 후 `npm run typegen`(openapi-typescript)
// 산출물(src/types/api.d.ts)로 교체할 것. AI_Learn_First §9 "API 타입 수기 정의 금지".
// 실제 계약: GET /api/v1/auth/me → { githubId, login, avatarUrl } (AuthController.java)
export interface AuthUser {
  githubId: number
  login: string
  avatarUrl: string
}
