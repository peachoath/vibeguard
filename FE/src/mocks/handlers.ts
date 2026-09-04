import { http, HttpResponse } from 'msw'

// 백엔드 OpenAPI 확정 전, MSW 목으로 프론트 선행 개발 (PRD §R10)
export const handlers = [
  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({ id: 'demo', login: 'octocat', avatarUrl: '' }),
  ),
  http.get('/api/v1/repositories', () => HttpResponse.json([])),
]
