import { http, HttpResponse } from 'msw'

const defaultProfile = {
  githubId: 583231,
  login: 'octocat',
  displayName: 'octocat',
  email: null as string | null,
  avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
  createdAt: '2026-01-15T09:00:00Z',
  lastLoginAt: new Date().toISOString(),
}

const defaultSettings = {
  minSeverity: 'LOW' as const,
  excludedPaths: [] as string[],
  notifyEmail: false,
}

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

export function resetMockState() {
  resetSession()
}

const mockScans = [
  { id: 'scan-1', repositoryName: 'payment-api', branch: 'main', status: 'COMPLETED', startedAt: '2026-09-23T16:28:00Z', completedAt: '2026-09-23T16:32:38Z', findingCount: 6, passedTests: 24, totalTests: 24, prNumber: 42 },
  { id: 'scan-2', repositoryName: 'auth-service', branch: 'develop', status: 'REGRESSION_BLOCKED', startedAt: '2026-09-23T15:52:00Z', completedAt: '2026-09-23T15:57:12Z', findingCount: 2, passedTests: 23, totalTests: 24, prNumber: null },
  { id: 'scan-3', repositoryName: 'web-client', branch: 'main', status: 'COMPLETED', startedAt: '2026-09-23T14:10:00Z', completedAt: '2026-09-23T14:12:44Z', findingCount: 3, passedTests: null, totalTests: null, prNumber: 39 },
  { id: 'scan-4', repositoryName: 'billing-worker', branch: 'main', status: 'INSTALL_FAILED', startedAt: '2026-09-22T21:06:00Z', completedAt: '2026-09-22T21:09:02Z', findingCount: 2, passedTests: null, totalTests: null, prNumber: null },
  { id: 'scan-5', repositoryName: 'api-gateway', branch: 'main', status: 'COMPLETED', startedAt: '2026-09-22T18:31:00Z', completedAt: '2026-09-22T18:35:05Z', findingCount: 3, passedTests: 110, totalTests: 110, prNumber: 38 },
]

const mockRepositories = [
  { id: 'repo-1', name: 'payment-api', fullName: 'acme/payment-api', branch: 'main', language: 'Python', lastScannedAt: '2026-09-23T16:28:00Z', findingCount: 3, status: 'PROTECTED' },
  { id: 'repo-2', name: 'auth-service', fullName: 'acme/auth-service', branch: 'main', language: 'Java', lastScannedAt: '2026-09-23T15:52:00Z', findingCount: 1, status: 'NEEDS_ACTION' },
  { id: 'repo-3', name: 'web-client', fullName: 'acme/web-client', branch: 'develop', language: 'TypeScript', lastScannedAt: '2026-09-23T14:10:00Z', findingCount: 0, status: 'SAFE' },
  { id: 'repo-4', name: 'billing-worker', fullName: 'acme/billing-worker', branch: 'main', language: 'Go', lastScannedAt: '2026-09-22T21:06:00Z', findingCount: 2, status: 'PROTECTED' },
  { id: 'repo-5', name: 'admin-console', fullName: 'acme/admin-console', branch: 'main', language: 'TypeScript', lastScannedAt: '2026-09-21T09:00:00Z', findingCount: 5, status: 'REVIEW_REQUIRED' },
]

const mockFindings = [
  { id: 'finding-1', scanId: 'scan-1', packageName: 'pyyaml', cveId: 'CVE-2019-20477', cvssScore: 9.8, severity: 'CRITICAL', affectedVersion: '5.1', patchedVersion: '5.4', evidence: 'NVD · OSV · GHSA', verdict: 'PATCH', regressionResult: 'PASS', regressionPassed: 24, regressionTotal: 24 },
  { id: 'finding-2', scanId: 'scan-1', packageName: 'urllib3', cveId: 'CVE-2023-45803', cvssScore: 8.1, severity: 'HIGH', affectedVersion: '1.24.1', patchedVersion: '1.26.18', evidence: 'NVD · OSV', verdict: 'PATCH', regressionResult: 'PASS', regressionPassed: 24, regressionTotal: 24 },
  { id: 'finding-3', scanId: 'scan-1', packageName: 'jinja2', cveId: 'CVE-2024-22195', cvssScore: 7.5, severity: 'HIGH', affectedVersion: '3.1.2', patchedVersion: '3.1.4', evidence: 'GHSA · OSV', verdict: 'PATCH', regressionResult: 'PENDING', regressionPassed: null, regressionTotal: null },
  { id: 'finding-4', scanId: 'scan-1', packageName: 'cryptography', cveId: 'CVE-2023-49083', cvssScore: 7.8, severity: 'HIGH', affectedVersion: '41.0.2', patchedVersion: '41.0.6', evidence: 'NVD · GHSA', verdict: 'MANUAL', regressionResult: 'MANUAL', regressionPassed: null, regressionTotal: null },
  { id: 'finding-5', scanId: 'scan-1', packageName: 'idna', cveId: 'CVE-2024-3651', cvssScore: 6.5, severity: 'MEDIUM', affectedVersion: '3.4', patchedVersion: '3.7', evidence: 'OSV', verdict: 'IGNORE', regressionResult: 'NOT_AFFECTED', regressionPassed: null, regressionTotal: null },
  { id: 'finding-6', scanId: 'scan-1', packageName: 'requests', cveId: 'CVE-2023-32681', cvssScore: 6.1, severity: 'MEDIUM', affectedVersion: '2.28.0', patchedVersion: '2.31.0', evidence: 'NVD', verdict: 'PATCH', regressionResult: 'PASS', regressionPassed: 24, regressionTotal: 24 },
]

export const handlers = [
  // ── 인증 ──────────────────────────────────────
  http.get('/api/v1/auth/me', () =>
    state.authed
      ? HttpResponse.json({ githubId: state.profile.githubId, login: state.profile.login, avatarUrl: state.profile.avatarUrl })
      : new HttpResponse(null, { status: 401 }),
  ),
  http.post('/api/v1/auth/logout', () => {
    state.authed = false
    return new HttpResponse(null, { status: 204 })
  }),
  http.get('/oauth2/authorization/github', () => {
    resetSession()
    return HttpResponse.redirect('/dashboard')
  }),

  // ── 사용자 프로필 / 설정 ──────────────────────
  http.get('/api/v1/users/me', () =>
    state.authed ? HttpResponse.json(state.profile) : new HttpResponse(null, { status: 401 }),
  ),
  http.get('/api/v1/users/me/stats', () =>
    state.authed
      ? HttpResponse.json({ repositoryCount: 5, scanCount: 28 })
      : new HttpResponse(null, { status: 401 }),
  ),
  http.patch('/api/v1/users/me', async ({ request }) => {
    const body = (await request.json()) as { displayName?: string; email?: string }
    if (body.displayName !== undefined) state.profile.displayName = body.displayName.trim() || state.profile.login
    if (body.email !== undefined) state.profile.email = body.email.trim() || null
    return HttpResponse.json(state.profile)
  }),
  http.post('/api/v1/users/me/resync', () => {
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

  // ── 저장소 ────────────────────────────────────
  http.get('/api/v1/repositories', () => HttpResponse.json(mockRepositories)),

  // ── 스캔 이력 ─────────────────────────────────
  http.get('/api/v1/scans', () => HttpResponse.json(mockScans)),
  http.post('/api/v1/scans', async ({ request }) => {
    const body = (await request.json()) as { repositoryId: string; branch: string }
    const repo = mockRepositories.find((r) => r.id === body.repositoryId)
    const newScan = {
      id: `scan-${Date.now()}`,
      repositoryName: repo?.name ?? 'unknown',
      branch: body.branch,
      status: 'QUEUED',
      startedAt: new Date().toISOString(),
      completedAt: null,
      findingCount: 0,
      passedTests: null,
      totalTests: null,
      prNumber: null,
    }
    return HttpResponse.json(newScan, { status: 201 })
  }),
  http.get('/api/v1/scans/:id', ({ params }) => {
    const scan = mockScans.find((s) => s.id === params.id) ?? mockScans[0]
    return HttpResponse.json(scan)
  }),

  // ── Finding ───────────────────────────────────
  http.get('/api/v1/scans/:id/findings', ({ params }) => {
    const findings = mockFindings.filter((f) => f.scanId === params.id)
    return HttpResponse.json(findings.length > 0 ? findings : mockFindings)
  }),
  http.get('/api/v1/findings/:id', ({ params }) => {
    const finding = mockFindings.find((f) => f.id === params.id)
    return finding ? HttpResponse.json(finding) : new HttpResponse(null, { status: 404 })
  }),

  // ── 대시보드 통계 ──────────────────────────────
  http.get('/api/v1/dashboard/stats', () =>
    HttpResponse.json({
      unresolvedFindings: 18,
      criticalCount: 6,
      regressionPassed: 18,
      regressionTotal: 23,
      regressionBlocked: 3,
      prsCreated: 14,
    }),
  ),
]
