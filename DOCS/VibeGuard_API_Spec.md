# VibeGuard API 명세서 (API Specification)

> Spring Boot API Server가 제공하는 REST + SSE 인터페이스 상세 명세.
> [PRD §9](./VibeGuard_PRD.md)·§10(데이터 모델)과 실제 구현(`BE/api-server`)을 토대로 작성.

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 최종 수정 | 2026-09-09 |
| Base URL | `/api/v1` |
| 인증 | 세션 쿠키 (HttpOnly, SameSite=Lax) |
| 직렬화 | JSON (UTF-8) |
| 에러 규격 | RFC 9457 Problem Details |
| 스펙 소스 | springdoc-openapi → `/v3/api-docs` (FE `npm run typegen` 원본) |
| 관련 문서 | [PRD](./VibeGuard_PRD.md) · [Architecture](./VibeGuard_Architecture.md) |

---

## 1. 공통 규약

### 1.1 배포 / 오리진 (CORS)

| 티어 | 배포 | 오리진(예) |
|---|---|---|
| **FE** | **Vercel** | `https://vibeguard.vercel.app` (+ 프리뷰 `*.vercel.app`) |
| **API Server** | 단일 VM (Docker Compose) | `https://api.vibeguard.dev` |
| **DB** | **Supabase 관리형 PostgreSQL 16** | Supavisor 세션 풀러(5432) + `sslmode=require` |

- 개발 환경에선 Vite가 `/api` → `http://localhost:8080`로 프록시하므로 CORS가 필요 없다.
- 배포 환경에선 FE(Vercel)와 API(별도 도메인)가 **크로스 오리진**이 된다. 따라서 API Server는 다음을 설정해야 한다.
  - `Access-Control-Allow-Origin`: Vercel 프로덕션 + 프리뷰 도메인 화이트리스트
  - `Access-Control-Allow-Credentials: true` (세션 쿠키 전송)
  - 세션 쿠키: 크로스 사이트 전송을 위해 **`SameSite=None; Secure`** 필요(운영). Lax는 동일 사이트 배포일 때만.
- 프리플라이트(`OPTIONS`) 허용 메서드: `GET, POST, PATCH, DELETE, OPTIONS`.

> 주의: 크로스 오리진 쿠키 인증은 `SameSite=None; Secure`가 강제되므로 HTTPS 필수. Vercel↔API 도메인 구성 확정 시 CORS 화이트리스트를 환경변수로 관리한다.

### 1.2 인증 흐름

```
FE → GET /oauth2/authorization/github → GitHub 로그인 → 콜백
  → CustomOAuth2UserService (users upsert, 토큰 AES-256-GCM 암호화 저장)
  → 세션 쿠키(JSESSIONID) 발급 → defaultSuccessUrl("/")
```

- 미인증 상태로 보호 자원 접근 시 **302 리다이렉트가 아니라 `401`** 을 반환한다(`HttpStatusEntryPoint`). FE는 401을 받으면 로그인 화면으로 유도.
- 공개 경로(인증 불필요): `/`, `/oauth2/**`, `/login/**`, `/api/v1/auth/me`, `/actuator/health`, `/swagger-ui/**`, `/v3/api-docs/**`.

### 1.3 공통 응답 헤더 / 상태 코드

| 코드 | 의미 |
|---|---|
| 200 | 성공 (본문 있음) |
| 202 | 수락됨 (비동기 작업 시작 — 스캔 트리거) |
| 204 | 성공 (본문 없음 — 로그아웃/취소/무시) |
| 400 | 잘못된 요청 (검증 실패) |
| 401 | 미인증 |
| 403 | 권한 없음 (타 사용자 리소스) |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 스캔/PR 멱등성) |
| 5xx | 서버/파이프라인 오류 |

### 1.4 에러 응답 (RFC 9457 Problem Details)

`Content-Type: application/problem+json`

```json
{
  "type": "https://vibeguard.dev/errors/scan-timeout",
  "title": "Scan Timeout",
  "status": 504,
  "detail": "Semgrep 실행이 300초를 초과했습니다.",
  "instance": "/api/v1/scans/019.."
}
```

| type (suffix) | status | 상황 |
|---|---|---|
| `/errors/validation` | 400 | 필드 검증 실패 (`errors[]` 확장 필드 포함) |
| `/errors/unauthorized` | 401 | 세션 없음/만료 |
| `/errors/forbidden` | 403 | 타 사용자 리소스 접근 |
| `/errors/not-found` | 404 | 대상 없음 |
| `/errors/scan-conflict` | 409 | 동일 repo+ref 스캔 이미 진행 중 |
| `/errors/scan-timeout` | 504 | 스캐너/컨테이너 타임아웃 |

---

## 2. 엔드포인트 요약

| # | Method | Endpoint | 인증 | 설명 |
|---|---|---|---|---|
| 1 | GET | `/oauth2/authorization/github` | — | GitHub OAuth 리다이렉트 |
| 2 | GET | `/api/v1/auth/me` | 공개* | 현재 사용자 |
| 3 | POST | `/api/v1/auth/logout` | 필요 | 로그아웃 |
| 4 | GET | `/api/v1/repositories` | 필요 | 접근 가능 리포 목록 |
| 5 | POST | `/api/v1/repositories` | 필요 | 리포 연결 |
| 6 | POST | `/api/v1/scans` | 필요 | 스캔 시작 |
| 7 | GET | `/api/v1/scans/{id}` | 필요 | 스캔 상태 |
| 8 | GET | `/api/v1/scans/{id}/stream` | 필요 | **SSE 진행 스트림** |
| 9 | DELETE | `/api/v1/scans/{id}` | 필요 | 스캔 취소 |
| 10 | GET | `/api/v1/scans/{id}/findings` | 필요 | Finding 목록(필터/페이징) |
| 11 | GET | `/api/v1/findings/{id}` | 필요 | Finding 상세 + 근거 |
| 12 | PATCH | `/api/v1/findings/{id}/ignore` | 필요 | 오탐 처리 |
| 13 | GET | `/api/v1/findings/{id}/evidence` | 필요 | TDD 증거 |
| 14 | GET | `/api/v1/findings/{id}/diff` | 필요 | 패치 diff |
| 15 | GET | `/api/v1/dashboard/summary` | 필요 | 통계 요약 |
| 16 | POST | `/api/v1/internal/runner/events` | HMAC | **런너 → 서버 콜백** |

*`/auth/me`는 SecurityConfig에서 공개 경로이나, 미로그인 시 `null`/401 처리.

---

## 3. 인증 / 사용자

### 3.1 GET `/oauth2/authorization/github`
GitHub OAuth 로그인 시작. 302 리다이렉트. 스코프: `read:user, user:email` (리포 스캔 붙을 때 `repo` 추가 예정).

### 3.2 GET `/api/v1/auth/me`
현재 로그인 사용자. 미로그인 시 `401`.

**200 응답** (구현 기준)
```json
{
  "githubId": 583231,
  "login": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/583231?v=4"
}
```

### 3.3 POST `/api/v1/auth/logout`
세션 무효화 + `JSESSIONID` 쿠키 삭제. **204 No Content**.

---

## 4. 리포지토리

### 4.1 GET `/api/v1/repositories`
연결 가능/연결된 리포 목록. `200` → `RepositoryDto[]`.

```json
[
  {
    "id": "3f7c...",
    "githubRepoId": 1296269,
    "fullName": "octocat/Hello-World",
    "defaultBranch": "main",
    "language": "Python",
    "connectedAt": "2026-09-09T04:12:00Z"
  }
]
```

### 4.2 POST `/api/v1/repositories`
리포 연결.

**요청**
```json
{ "githubRepoId": 1296269, "fullName": "octocat/Hello-World", "defaultBranch": "main" }
```
**201/200** → `RepositoryDto`. 이미 연결됐으면 `409`.

---

## 5. 스캔

### 5.1 POST `/api/v1/scans`
파이프라인 시작 (비동기). Agent Runner로 HTTP 위임되고 즉시 반환.

**요청**
```json
{ "repositoryId": "3f7c...", "ref": "main" }
```
**202 Accepted** → `ScanDto`
```json
{
  "id": "019a...",
  "repositoryId": "3f7c...",
  "ref": "main",
  "commitSha": null,
  "status": "QUEUED",
  "startedAt": null,
  "finishedAt": null,
  "durationMs": null,
  "errorCode": null
}
```
- 동일 `repositoryId + ref` 스캔이 진행 중이면 `409` (`/errors/scan-conflict`).
- `status` enum: `QUEUED, CLONING, SCANNING, VERIFYING, PATCHING, PR_CREATING, COMPLETED, NO_FINDINGS, PATCH_FAILED, REGRESSION_BLOCKED, FAILED` (PRD §6.1).

### 5.2 GET `/api/v1/scans/{id}`
현재 스캔 상태 폴링용. `200` → `ScanDto`. 없으면 `404`.

### 5.3 GET `/api/v1/scans/{id}/stream` — SSE
`Content-Type: text/event-stream`. 연결 30분 유지, 끊기면 클라이언트 지수 백오프 재연결(PRD §11.2 NFR-P3).

**이벤트 타입**

```
event: stage
data: {"scanId":"019a...","stage":"PATCHING","agent":3,"status":"RUNNING","progress":0.45}

event: log
data: {"scanId":"019a...","agent":3,"level":"INFO","message":"재현 테스트 작성 완료 — 실행 중","ts":"2026-09-09T04:13:10Z"}

event: finding
data: {"scanId":"019a...","findingId":"...","severity":"CRITICAL","title":"SQL Injection"}

event: done
data: {"scanId":"019a...","status":"COMPLETED","prUrl":"https://github.com/.../pull/42"}
```

| event | 필드 | 비고 |
|---|---|---|
| `stage` | scanId, stage, agent(1-4), status(RUNNING/DONE/FAILED), progress(0~1) | 상태머신 전이 시 |
| `log` | scanId, agent, level(INFO/WARN/ERROR), message, ts | FAIL/PASS 로그 스트리밍 |
| `finding` | scanId, findingId, severity, title | 신규 Finding 발견 시 |
| `done` | scanId, status, prUrl? | 종료(성공/차단/실패 공통) |

> 주의: 토큰·시크릿은 어떤 이벤트에도 실리지 않는다 (NFR-S3). Vercel↔API 크로스 오리진에서 `EventSource`는 쿠키 전송을 위해 `withCredentials: true` 필요.

### 5.4 DELETE `/api/v1/scans/{id}`
진행 중 파이프라인 취소. `204`. 이미 종료면 `409`.

---

## 6. Finding

### 6.1 GET `/api/v1/scans/{id}/findings`
목록 (필터·페이징). `200` → `Page<FindingDto>`.

**쿼리 파라미터**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `severity` | enum[] | `CRITICAL,HIGH,MEDIUM,LOW` 다중 |
| `type` | enum | `SCA` \| `SAST` |
| `status` | enum | `OPEN,IGNORED,PATCHED,MANUAL` |
| `page` | int | 0-base |
| `size` | int | 기본 20 |
| `sort` | string | 예 `severity,desc` |

```json
{
  "content": [
    {
      "id": "f1...",
      "type": "SAST",
      "ruleId": "python.lang.security.audit.sqli",
      "cveId": null,
      "cweId": "CWE-89",
      "severity": "CRITICAL",
      "cvssScore": 9.8,
      "filePath": "app/db.py",
      "lineStart": 47,
      "lineEnd": 49,
      "packageName": null,
      "currentVersion": null,
      "recommendedVersion": null,
      "verdict": "PATCH",
      "status": "OPEN"
    }
  ],
  "page": { "number": 0, "size": 20, "totalElements": 6, "totalPages": 1 }
}
```

### 6.2 GET `/api/v1/findings/{id}`
상세 + 근거. `200` → `FindingDetailDto` (위 필드 + `snippet`, `rationale`, `advisory` 확장).

```json
{
  "id": "f1...", "type": "SAST", "severity": "CRITICAL", "cvssScore": 9.8,
  "cweId": "CWE-89", "filePath": "app/db.py", "lineStart": 47, "lineEnd": 49,
  "snippet": "cursor.execute(\"SELECT * FROM users WHERE id = '\" + uid + \"'\")",
  "verdict": "PATCH",
  "rationale": "사용자 입력이 문자열 연결로 쿼리에 직접 삽입됨. NVD/GHSA 교차 검증 결과 재현 가능.",
  "advisory": { "cvssVector": "CVSS:3.1/AV:N/AC:L/...", "source": "NVD" }
}
```

### 6.3 PATCH `/api/v1/findings/{id}/ignore`
오탐 처리. **요청** `{ "reason": "테스트 전용 코드, 운영 미노출" }` → `200 FindingDto` (status=`IGNORED`). 재스캔 시 유지.

### 6.4 GET `/api/v1/findings/{id}/evidence` — TDD 증거
`200` → `EvidenceDto`. FREE 플랜 Finding은 TDD 미수행이라 `phases`가 비거나 `null`일 수 있음(BusinessModel 참고).

```json
{
  "findingId": "f1...",
  "testCode": "def test_sqli_rejected(): ...",
  "phases": [
    { "phase": "PRE_PATCH",  "passed": false, "total": 1,   "failed": 1,  "log": "AssertionError: 인증 우회 성공" },
    { "phase": "POST_PATCH", "passed": true,  "total": 1,   "failed": 0,  "log": "1 passed" },
    { "phase": "REGRESSION", "passed": true,  "total": 128, "failed": 0,  "log": "128 passed" }
  ],
  "attempts": 1
}
```

### 6.5 GET `/api/v1/findings/{id}/diff`
패치 diff. `200` → `DiffDto`.

```json
{
  "findingId": "f1...",
  "format": "unified",
  "filePath": "app/db.py",
  "patch": "@@ -47,3 +47,3 @@\n- cursor.execute(\"... '\" + uid + \"'\")\n+ cursor.execute(\"... = %s\", (uid,))"
}
```

---

## 7. 대시보드

### 7.1 GET `/api/v1/dashboard/summary`
`200` → `SummaryDto`.

```json
{
  "severityDistribution": { "CRITICAL": 2, "HIGH": 3, "MEDIUM": 1, "LOW": 0 },
  "patchSuccessRate": 0.66,
  "avgDurationMs": 512000,
  "totalScans": 12,
  "totalPrs": 8
}
```

---

## 8. 내부 콜백 (Runner → API)

### 8.1 POST `/api/v1/internal/runner/events`
Agent Runner가 파이프라인 이벤트를 서버로 전달. **HMAC-SHA256 서명 검증** (NFR-S4). 서버는 이를 SSE로 브로드캐스트하고 DB에 반영.

**헤더**

| 헤더 | 설명 |
|---|---|
| `X-VibeGuard-Signature` | `sha256=<hex>` — 본문 raw bytes를 `RUNNER_CALLBACK_SECRET`로 HMAC-SHA256 |
| `X-VibeGuard-Timestamp` | 유닉스 ms. 재전송 공격 방지 (허용 오차 예: ±5분) |
| `Content-Type` | `application/json` |

**요청 본문(예)**
```json
{
  "scanId": "019a...",
  "kind": "stage",
  "stage": "PATCHING",
  "agent": 3,
  "status": "RUNNING",
  "payload": { "progress": 0.45 }
}
```

**응답**: 서명 유효 → `204`. 서명 불일치/타임스탬프 만료 → `401`.

> 시크릿은 `BE/api-server/.env`와 `BE/agent/.env`의 `RUNNER_CALLBACK_SECRET`이 동일해야 한다. 이 엔드포인트는 세션 인증이 아니라 HMAC으로만 보호되며, 외부 노출 없이 내부망/동일 VM에서만 호출되게 한다.

---

## 9. 데이터 전송 객체(DTO) 요약

| DTO | 대응 테이블 | 주요 필드 |
|---|---|---|
| `UserDto` | users | githubId, login, avatarUrl |
| `RepositoryDto` | repositories | id, githubRepoId, fullName, defaultBranch, language |
| `ScanDto` | scans | id, repositoryId, ref, commitSha, status, durationMs, errorCode |
| `FindingDto` | findings | id, type, ruleId, cveId, cweId, severity, cvssScore, filePath, verdict, status |
| `FindingDetailDto` | findings(+advisory) | FindingDto + snippet, rationale, advisory |
| `EvidenceDto` | patches + test_runs | testCode, phases[], attempts |
| `DiffDto` | patches | format, filePath, patch |
| `SummaryDto` | 집계 | severityDistribution, patchSuccessRate, avgDurationMs |

> DTO에는 `access_token` 등 민감 컬럼을 **절대 포함하지 않는다** (NFR-S3).

---

## 10. 환경변수 (배포 관점)

| 위치 | 키 | 용도 |
|---|---|---|
| `BE/api-server/.env` | `DB_URL`,`DB_USER`,`DB_PASSWORD` | **Supabase** 세션 풀러(5432)+`sslmode=require` |
| | `GITHUB_CLIENT_ID/SECRET` | GitHub OAuth |
| | `TOKEN_ENC_KEY` | 토큰 AES-256-GCM 키(base64 32B) |
| | `RUNNER_BASE_URL`,`RUNNER_CALLBACK_SECRET` | 런너 위임/콜백 HMAC |
| `BE/agent/.env` | `ANTHROPIC_API_KEY`,`NVD_API_KEY`,`RUNNER_CALLBACK_SECRET` | 런너/MCP |
| `FE/.env` (**Vercel**) | `VITE_API_BASE_URL` | 배포 API 오리진 (프록시 대신 절대경로) |

> **FE 배포(Vercel):** 개발의 `/api` 프록시는 Vercel에 없으므로, 배포 빌드는 `VITE_API_BASE_URL`로 API 절대 URL을 주입하고 요청에 `credentials: 'include'`를 붙여 세션 쿠키를 전송한다. `openapi-typescript` 타입 생성은 API의 `/v3/api-docs`를 소스로 유지.

---

## 11. 구현 현황 (2026-09-09 기준)

| 엔드포인트 | 상태 |
|---|---|
| OAuth 로그인 / `/auth/me` / `/auth/logout` | 구현됨 (`AuthController`, `SecurityConfig`, `CustomOAuth2UserService`) |
| repositories / scans / findings / dashboard | 미구현 (PRD §14 마일스톤 W1 중반~W2 후반) |
| SSE `/scans/{id}/stream` | 미구현 (W2 중반, D10~11) |
| `/internal/runner/events` (HMAC) | 미구현 (W1 중반~, D3 이후) |

> 스키마·enum은 [PRD §6·§9·§10](./VibeGuard_PRD.md), 흐름은 [Architecture §4·§5](./VibeGuard_Architecture.md) 참조. 확정 스펙 원천은 배포 후 `/v3/api-docs`(OpenAPI)이며, 본 문서와 불일치 시 OpenAPI를 우선한다.
