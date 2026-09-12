import { http, HttpResponse } from 'msw'

// 백엔드 OpenAPI 확정 전, MSW 목으로 프론트 선행 개발 (PRD §R10).
// 계약은 실제 코드 기준: GET /api/v1/auth/me → { githubId, login, avatarUrl } (AuthController.java).
export const handlers = [
  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      githubId: 583231,
      login: 'octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    }),
  ),
  http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/v1/repositories', () => HttpResponse.json([])),
]
