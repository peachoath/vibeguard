import { http, HttpResponse } from 'msw'

// 백엔드 OpenAPI 확정 전, MSW 목으로 프론트 선행 개발 (PRD §R10).
// 계약: AuthController.java / ScanController.java / SseHub.java (이슈 #8, F-04).

const MOCK_SCAN_ID = '00000000-0000-0000-0000-000000000001'

// 스트림 핸들러에서 approve 핸들러로 phase2 시작을 알릴 resolve 함수 저장
const pendingApprovals = new Map<string, () => void>()

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

export const handlers = [
  // ── 인증 ────────────────────────────────────────────────────
  http.get('/api/v1/auth/me', () =>
    HttpResponse.json({
      githubId: 583231,
      login: 'octocat',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
    }),
  ),
  http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('/api/v1/repositories', () =>
    HttpResponse.json([
      {
        id: 'repo-001',
        fullName: 'peachoath/vibeguard',
        description: '보안 취약점 자동 스캔 · 패치 SaaS',
        language: 'TypeScript',
        private: false,
        defaultBranch: 'main',
      },
      {
        id: 'repo-002',
        fullName: 'peachoath/api-server',
        description: 'Spring Boot 백엔드 API 서버',
        language: 'Java',
        private: true,
        defaultBranch: 'dev',
      },
      {
        id: 'repo-003',
        fullName: 'peachoath/ml-pipeline',
        description: null,
        language: 'Python',
        private: true,
        defaultBranch: 'main',
      },
    ]),
  ),

  // 스캔 목록 (이력 페이지)
  http.get('/api/v1/scans', () =>
    HttpResponse.json([
      {
        id: '00000000-0000-0000-0000-000000000001',
        repositoryId: 'repo-001',
        repositoryFullName: 'peachoath/vibeguard',
        ref: 'main',
        commitSha: 'a1b2c3d4e5f6',
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 3_600_000).toISOString(),
        finishedAt: new Date(Date.now() - 3_480_000).toISOString(),
        durationMs: 120_000,
        errorCode: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        repositoryId: 'repo-002',
        repositoryFullName: 'peachoath/api-server',
        ref: 'feature/auth',
        commitSha: 'b2c3d4e5f6a1',
        status: 'NO_FINDINGS',
        startedAt: new Date(Date.now() - 86_400_000).toISOString(),
        finishedAt: new Date(Date.now() - 86_200_000).toISOString(),
        durationMs: 200_000,
        errorCode: null,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        repositoryId: 'repo-001',
        repositoryFullName: 'peachoath/vibeguard',
        ref: 'main',
        commitSha: 'c3d4e5f6a1b2',
        status: 'FAILED',
        startedAt: new Date(Date.now() - 172_800_000).toISOString(),
        finishedAt: new Date(Date.now() - 172_600_000).toISOString(),
        durationMs: 45_000,
        errorCode: 'RUNNER_TIMEOUT',
      },
    ]),
  ),

  // 스캔 시작 (#10)
  http.post('/api/v1/scans', async ({ request }) => {
    const body = await request.json() as { repositoryId: string; ref: string }
    return HttpResponse.json(
      {
        id: MOCK_SCAN_ID,
        repositoryId: body.repositoryId,
        ref: body.ref,
        commitSha: null,
        status: 'QUEUED',
        startedAt: new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        errorCode: null,
      },
      { status: 201 },
    )
  }),

  // #3 스캔 취소
  http.delete('/api/v1/scans/:id', () => new HttpResponse(null, { status: 204 })),

  // ── 스캔 ────────────────────────────────────────────────────
  http.get('/api/v1/scans/:id', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      repositoryId: 'repo-001',
      ref: 'main',
      commitSha: 'a1b2c3d4e5f6',
      status: 'SCANNING',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      durationMs: null,
      errorCode: null,
    }),
  ),

  // Finding 상세
  http.get('/api/v1/findings/:id', ({ params }) =>
    HttpResponse.json({
      id: params.id,
      type: 'SCA',
      cveId: 'CVE-2019-20477',
      cweId: 'CWE-502',
      severity: 'CRITICAL',
      cvssScore: 9.8,
      manifestPath: 'requirements.txt',
      packageName: 'pyyaml',
      currentVersion: '5.1',
      recommendedVersion: '6.0.1',
      verdict: 'CONFIRMED',
      rationale: 'PyYAML의 yaml.load() 함수가 임의 Python 객체를 역직렬화할 수 있어 원격 코드 실행이 가능합니다. Loader 파라미터 없이 호출하는 코드 3곳 확인.',
      status: 'OPEN',
      filePath: null,
      snippet: null,
    }),
  ),

  http.patch('/api/v1/findings/:id/ignore', () => new HttpResponse(null, { status: 200 })),

  // 스캔 Finding 목록 (#5 리포트 페이지)
  http.get('/api/v1/scans/:id/findings', () =>
    HttpResponse.json([
      { id: 'f-001', severity: 'CRITICAL', title: 'pyyaml 5.1 — CVE-2019-20477 RCE',            cveId: 'CVE-2019-20477', cvssScore: 9.8, packageName: 'pyyaml',   affectedVersion: '5.1',    patchedVersion: '6.0.1'  },
      { id: 'f-002', severity: 'HIGH',     title: 'requests 2.26.0 — CVE-2023-32681 헤더 유출', cveId: 'CVE-2023-32681', cvssScore: 6.1, packageName: 'requests', affectedVersion: '2.26.0', patchedVersion: '2.31.0' },
      { id: 'f-003', severity: 'MEDIUM',   title: 'Pillow 9.3.0 — CVE-2023-44271 서비스 거부',  cveId: 'CVE-2023-44271', cvssScore: 5.3, packageName: 'Pillow',   affectedVersion: '9.3.0',  patchedVersion: '10.0.1' },
      { id: 'f-004', severity: 'LOW',      title: 'urllib3 1.26.7 — CVE-2023-43804 헤더 주입',  cveId: 'CVE-2023-43804', cvssScore: 3.7, packageName: 'urllib3',  affectedVersion: '1.26.7', patchedVersion: '2.0.7'  },
    ]),
  ),

  // 대시보드 통계 (#8)
  http.get('/api/v1/dashboard/stats', () =>
    HttpResponse.json({
      totalScans: 47,
      successRate: 0.85,
      totalFindings: 128,
      fixedFindings: 93,
      trend: [
        { date: '2026-09-08', scans: 5, findings: 12 },
        { date: '2026-09-09', scans: 3, findings: 8  },
        { date: '2026-09-10', scans: 7, findings: 15 },
        { date: '2026-09-11', scans: 2, findings: 4  },
        { date: '2026-09-12', scans: 8, findings: 18 },
        { date: '2026-09-13', scans: 6, findings: 11 },
        { date: '2026-09-14', scans: 4, findings: 9  },
      ],
    }),
  ),

  // ── PR 생성 승인 (F-04 검토 게이트) ─────────────────────────
  http.post('/api/v1/scans/:id/approve', ({ params }) => {
    const resolve = pendingApprovals.get(params.id as string)
    if (resolve) {
      resolve()
      pendingApprovals.delete(params.id as string)
    }
    return new HttpResponse(null, { status: 204 })
  }),

  // ── SSE 스트림 (F-04) ────────────────────────────────────────
  http.get('/api/v1/scans/:id/stream', ({ params }) => {
    const scanId = (params.id as string) || MOCK_SCAN_ID
    const enc = new TextEncoder()
    const ts = () => new Date().toISOString()

    function sse(event: string, data: object): Uint8Array {
      return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    // Phase 1: CLONING → REGRESSION_CHECK 완료 + review 이벤트
    const phase1: Uint8Array[] = [
      sse('open',    { scanId }),
      sse('stage',   { scanId, kind: 'stage', stage: 'CLONING', status: 'RUNNING' }),
      sse('stage',   { scanId, kind: 'stage', stage: 'CLONING', status: 'DONE' }),
      sse('stage',   { scanId, kind: 'stage', stage: 'SCANNING', agent: 1, status: 'RUNNING', progress: 0 }),
      sse('log',     { scanId, kind: 'log', agent: 1, level: 'INFO',  message: 'SCA 스캔 시작 — 의존성 분석 중', ts: ts() }),
      sse('log',     { scanId, kind: 'log', agent: 1, level: 'INFO',  message: 'requirements.txt 파싱 완료 — 47개 패키지', ts: ts() }),
      sse('finding', { scanId, kind: 'finding', findingId: 'f-001', severity: 'CRITICAL', title: 'pyyaml 5.1 — CVE-2019-20477 RCE' }),
      sse('finding', { scanId, kind: 'finding', findingId: 'f-002', severity: 'HIGH',     title: 'requests 2.26.0 — CVE-2023-32681 헤더 유출' }),
      sse('log',     { scanId, kind: 'log', agent: 1, level: 'INFO',  message: '취약점 2개 발견, A1 완료', ts: ts() }),
      sse('stage',   { scanId, kind: 'stage', stage: 'SCANNING',         agent: 1, status: 'DONE',    progress: 1 }),
      sse('stage',   { scanId, kind: 'stage', stage: 'VERIFYING',        agent: 2, status: 'RUNNING', progress: 0 }),
      sse('log',     { scanId, kind: 'log', agent: 2, level: 'INFO',  message: 'pyyaml CVE 검증 중 — CVSS 9.8 확인', ts: ts() }),
      sse('log',     { scanId, kind: 'log', agent: 2, level: 'WARN',  message: 'requests 영향 범위 제한적 — 외부 헤더 노출 조건부', ts: ts() }),
      sse('stage',   { scanId, kind: 'stage', stage: 'VERIFYING',        agent: 2, status: 'DONE',    progress: 1 }),
      sse('stage',   { scanId, kind: 'stage', stage: 'REGRESSION_CHECK', agent: 3, status: 'RUNNING', progress: 0 }),
      sse('log',     { scanId, kind: 'log', agent: 3, level: 'INFO',  message: '패치 전 pytest 실행 — 24/24 통과', ts: ts() }),
      sse('log',     { scanId, kind: 'log', agent: 3, level: 'INFO',  message: 'pyyaml → 6.0.1 업그레이드 적용', ts: ts() }),
      sse('log',     { scanId, kind: 'log', agent: 3, level: 'INFO',  message: '패치 후 pytest 실행 — 24/24 통과', ts: ts() }),
      sse('stage',   { scanId, kind: 'stage', stage: 'REGRESSION_CHECK', agent: 3, status: 'DONE',    progress: 1 }),
      sse('review',  { scanId, kind: 'review' }), // ← 검토 게이트: FE가 승인 버튼을 표시
    ]

    // Phase 2: approve 수신 후 PR 생성
    const phase2: Uint8Array[] = [
      sse('stage', { scanId, kind: 'stage', stage: 'PR_CREATING', agent: 4, status: 'RUNNING', progress: 0 }),
      sse('log',   { scanId, kind: 'log', agent: 4, level: 'INFO', message: 'GitHub PR 생성 중 — fix/cve-pyyaml-requests', ts: ts() }),
      sse('stage', { scanId, kind: 'stage', stage: 'PR_CREATING', agent: 4, status: 'DONE',    progress: 1 }),
      sse('done',  { scanId, kind: 'done', status: 'COMPLETED', prUrl: 'https://github.com/peachoath/vibeguard/pull/99' }),
    ]

    const stream = new ReadableStream({
      async start(controller) {
        // Phase 1 전송
        for (let i = 0; i < phase1.length; i++) {
          await delay(350 + (i * 7 % 300))
          controller.enqueue(phase1[i])
        }

        // 승인 대기 — approve POST가 오면 resolve 호출
        await new Promise<void>(resolve => {
          pendingApprovals.set(scanId, resolve)
        })

        // Phase 2 전송
        for (let i = 0; i < phase2.length; i++) {
          await delay(450 + (i * 11 % 400))
          controller.enqueue(phase2[i])
        }
        controller.close()
      },
    })

    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  }),
]
