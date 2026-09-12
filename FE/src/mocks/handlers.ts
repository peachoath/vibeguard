import { http, HttpResponse } from 'msw'

// 백엔드 OpenAPI 확정 전, MSW 목으로 프론트 선행 개발 (PRD §R10).
// 계약은 실제 코드 기준: AuthController.java / UserController.java (이슈 #7).
//
// dev 목 모드(VITE_ENABLE_MOCKS=true)에서는 이 핸들러가 상태를 들고 있어
// 로그인 → 마이페이지 수정 → 탈퇴 → 재로그인 루프를 FE 단독으로 시연할 수 있다.
// 테스트(vitest)에서는 server.use()로 필요한 응답을 개별 오버라이드한다.

const defaultProfile = {
  githubId: 583231,
  login: 'octocat',
  displayName: 'octocat',
  email: null as string | null,
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
  createdAt: '2026-01-15T09:00:00Z',
}

const defaultSettings = {
  minSeverity: 'LOW' as const,
  excludedPaths: [] as string[],
  notifyEmail: false,
}

// 데모용 인메모리 상태.
const state = {
  authed: true,
  profile: { ...defaultProfile },
  settings: { ...defaultSettings },
}

function resetSession() {
  state.authed = true
  state.profile = { ...defaultProfile }
  state.settings = { ...defaultSettings }
}

export const handlers = [
  // ── 인증 ─────────────────────────────────────────────
  http.get('/api/v1/auth/me', () =>
    state.authed
      ? HttpResponse.json({
          githubId: state.profile.githubId,
          login: state.profile.login,
          avatarUrl: state.profile.avatarUrl,
        })
      : new HttpResponse(null, { status: 401 }),
  ),
  http.post('/api/v1/auth/logout', () => {
    state.authed = false
    return new HttpResponse(null, { status: 204 })
  }),
  // OAuth 시작(데모): 실제로는 GitHub로 리다이렉트되지만, 목 모드에선 세션 복원 후 앱으로 돌려보낸다.
  http.get('/oauth2/authorization/github', () => {
    resetSession()
    return HttpResponse.redirect('/settings')
  }),

  // ── 마이페이지 / 계정 (이슈 #7) ──────────────────────
  http.get('/api/v1/users/me', () =>
    state.authed ? HttpResponse.json(state.profile) : new HttpResponse(null, { status: 401 }),
  ),
  http.get('/api/v1/users/me/stats', () =>
    state.authed
      ? HttpResponse.json({ repositoryCount: 4, scanCount: 27 })
      : new HttpResponse(null, { status: 401 }),
  ),
  http.patch('/api/v1/users/me', async ({ request }) => {
    const body = (await request.json()) as { displayName?: string; email?: string }
    if (body.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return HttpResponse.json({ title: 'Validation Failed' }, { status: 400 })
    }
    if (body.displayName !== undefined) {
      state.profile.displayName = body.displayName.trim() || state.profile.login
    }
    if (body.email !== undefined) state.profile.email = body.email.trim() || null
    return HttpResponse.json(state.profile)
  }),
  http.post('/api/v1/users/me/resync', () => {
    // GitHub 최신 프로필을 당겨온 것처럼 avatar 캐시버스터만 갱신.
    state.profile.avatarUrl = `${defaultProfile.avatarUrl}&t=${Date.now()}`
    return HttpResponse.json(state.profile)
  }),
  http.get('/api/v1/users/me/settings', () =>
    state.authed ? HttpResponse.json(state.settings) : new HttpResponse(null, { status: 401 }),
  ),
  http.patch('/api/v1/users/me/settings', async ({ request }) => {
    const body = (await request.json()) as Partial<typeof state.settings>
    state.settings = { ...state.settings, ...body }
    return HttpResponse.json(state.settings)
  }),
  http.delete('/api/v1/users/me', () => {
    state.authed = false
    return new HttpResponse(null, { status: 204 })
  }),

  // 기타 (기존)
  http.get('/api/v1/repositories', () => HttpResponse.json([])),
]
