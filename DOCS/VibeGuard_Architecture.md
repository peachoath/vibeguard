# VibeGuard 아키텍처 문서 (Architecture)

> VibeGuard의 시스템 구조·데이터 흐름·컴포넌트 책임을 시각 자료 중심으로 정리한 문서.
> 다이어그램은 [Mermaid](https://mermaid.js.org/)로 작성되어 GitHub·VS Code(Kiro)에서 그대로 렌더링됩니다.

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 최종 수정 | 2026-09-09 |
| 관련 문서 | [PRD](./VibeGuard_PRD.md) · [BusinessModel](./VibeGuard_BusinessModel.md) · [TrustModel](./VibeGuard_TrustModel.md) |

---

## 1. 개요

VibeGuard는 GitHub 리포의 보안 취약점을 **탐지 → 검증 → TDD 증명 패치 → PR**까지 자동화하는 멀티 에이전트 시스템이다. 크게 **3티어**로 구성된다.

| 티어 | 런타임 | 역할 |
|---|---|---|
| **Web (FE)** | React 19 + TS + Vite | 대시보드, 실시간 진행 시각화, 증거·Diff 열람 |
| **API Server (BE)** | Spring Boot 4 / Java 21 | REST + SSE, OAuth, 스캔 오케스트레이션(상태머신), DB |
| **Agent (BE)** | Node 22 + TS | Claude Agent SDK 런너 + 자체 MCP 서버 3종 |

설계의 두 핵심 결정:
1. **Agent Runner를 Spring Boot에서 분리** — Claude Agent SDK가 TS/Python만 지원하므로 별도 Node 런너 + HTTP 위임 + HMAC 웹훅 콜백 구조 (PRD §5.2).
2. **Agent 1~4를 서브에이전트가 아닌 독립 세션으로 구동** — 서브에이전트는 MCP 툴에 접근 불가하여 툴이 조용히 사라지므로, 각 단계를 최상위 세션으로 띄우고 필요한 MCP만 주입 (PRD §5.3, R1).

---

## 2. 시스템 컨텍스트 (C4 Level 1)

```mermaid
graph TB
    User([개발자 / 사용자])
    subgraph VibeGuard
        FE[Web Client<br/>React]
        API[API Server<br/>Spring Boot]
        AGENT[Agent Runner<br/>Node + Claude SDK]
    end
    GH[(GitHub<br/>OAuth · Repo · PR)]
    NVD[(NVD / OSV.dev / GHSA<br/>취약점 DB)]
    CLAUDE[(Anthropic<br/>Claude API)]

    User -->|브라우저| FE
    FE -->|REST + SSE| API
    API -->|OAuth2 · PR| GH
    API -->|HTTP 위임 / HMAC 콜백| AGENT
    AGENT -->|Claude Agent SDK| CLAUDE
    AGENT -->|MCP| NVD
    AGENT -->|MCP| GH

    classDef ext fill:#2d2d2d,stroke:#888,color:#fff;
    class GH,NVD,CLAUDE ext;
```

---

## 3. 컨테이너 구성 (C4 Level 2)

```mermaid
graph TB
    subgraph Client["Web Client (React 19 / Vite)"]
        FE["TanStack Query · Zustand<br/>SSE 훅 · Diff/Shiki · Recharts"]
    end

    subgraph ApiTier["API Server (Spring Boot 4 / Java 21)"]
        SEC["Spring Security<br/>OAuth2 Client (GitHub)"]
        ORCH["Scan Orchestrator<br/>상태머신"]
        SSE["SSE Emitter Hub"]
        JPA["Spring Data JPA + QueryDSL<br/>Flyway"]
    end

    subgraph AgentTier["Agent Runner (Node 22 / TS)"]
        RUNNER["Orchestrator<br/>Agent 1~4 독립 세션"]
    end

    subgraph MCP["MCP Layer"]
        SCAN["scanner-mcp<br/>Trivy·OSV·Semgrep"]
        ADV["advisory-mcp<br/>NVD·OSV·GHSA"]
        GHMCP["github-mcp<br/>(공식) 브랜치·PR"]
        TEST["testrunner-mcp<br/>격리 테스트 실행"]
    end

    subgraph Infra["Sandbox Pool (Docker)"]
        BOX["--network=none · --read-only<br/>--cap-drop=ALL · 300s"]
    end

    DB[("Supabase<br/>PostgreSQL 16")]

    FE -->|"REST /api/v1"| SEC
    FE -->|"SSE /scans/:id/stream"| SSE
    SEC --> ORCH
    ORCH --> JPA
    JPA --> DB
    ORCH -->|"POST /scans (HTTP 위임)"| RUNNER
    RUNNER -->|"POST /internal/runner/events (HMAC)"| SSE
    RUNNER --> SCAN & ADV & GHMCP & TEST
    SCAN --> BOX
    TEST --> BOX
```

**포트 (개발 기준)**

| 컴포넌트 | 포트 | 비고 |
|---|---|---|
| FE (Vite) | 5173 | `/api` → :8080 프록시 |
| API Server | 8080 | Swagger UI `/swagger-ui.html` |
| Agent Runner | 4000 | `/health`, `/scans` |
| PostgreSQL | 5432 | Supabase 세션 풀러 / 로컬 폴백 |

---

## 4. 멀티 에이전트 파이프라인

### 4.1 스캔 상태머신

```mermaid
stateDiagram-v2
    [*] --> QUEUED
    QUEUED --> CLONING
    CLONING --> SCANNING : Agent 1
    SCANNING --> VERIFYING : Agent 2
    SCANNING --> NO_FINDINGS
    VERIFYING --> PATCHING : Agent 3
    PATCHING --> PR_CREATING : Agent 4
    PATCHING --> PATCH_FAILED : 재시도 초과
    PATCHING --> REGRESSION_BLOCKED : 회귀 실패
    PR_CREATING --> COMPLETED
    CLONING --> FAILED
    SCANNING --> FAILED
    NO_FINDINGS --> [*]
    PATCH_FAILED --> [*]
    REGRESSION_BLOCKED --> [*]
    COMPLETED --> [*]
    FAILED --> [*]
```

### 4.2 에이전트별 책임과 MCP 매핑

```mermaid
flowchart LR
    A1["Agent 1<br/>Scanner"] --> A2["Agent 2<br/>Verifier"]
    A2 --> A3["Agent 3<br/>Patcher (심장)"]
    A3 --> A4["Agent 4<br/>PR Author"]

    A1 -.->|scanner-mcp| M1[Trivy·OSV·Semgrep]
    A2 -.->|advisory-mcp| M2[NVD·OSV·GHSA]
    A3 -.->|testrunner-mcp| M3[pytest 격리 실행]
    A4 -.->|github-mcp| M4[브랜치·PR]
```

| Agent | 입력 | 산출물 | 허용 MCP 툴 (화이트리스트) |
|---|---|---|---|
| 1 Scanner | 클론 경로, 브랜치 | `findings[]` | `scanner__run_trivy/osv/semgrep` |
| 2 Verifier | `findings[]` | `verified[]` (verdict, 권장버전) | `advisory__lookup_cve/query_osv/github_advisory/resolve_fixed_version` |
| 3 Patcher | `verified[]` | `patches[]`, `test_runs[]` | `testrunner__run_tests` |
| 4 PR Author | patches, 증거 | PR URL | `github__*` |

> 단계 간 전달은 구조화된 JSON 아티팩트(`stage_output.json`)로 명시적 전달 — 컨텍스트 오염 방지, 재현성 확보 (PRD §5.3).

### 4.3 Agent 3 — TDD 증명 루프 (Python 메인)

```mermaid
flowchart TD
    START([verified finding]) --> GEN[pytest 재현 테스트 작성]
    GEN --> PRE{패치 전 실행}
    PRE -->|PASS| FALSE["증명 불가<br/>(오탐 의심) → 정보성 Finding"]
    PRE -->|FAIL 확인| PATCH[AI 패치 적용]
    PATCH --> POST{패치 후 실행}
    POST -->|FAIL| RETRY{재시도 < N?}
    RETRY -->|예| PATCH
    RETRY -->|아니오| PFAIL[PATCH_FAILED<br/>시도 이력 노출]
    POST -->|PASS 확인| REG{회귀 테스트}
    REG -->|1개라도 실패| BLOCK[REGRESSION_BLOCKED<br/>PR 차단]
    REG -->|100% 통과| DONE([증명 완료 → Agent 4])

    classDef bad fill:#3a1f22,stroke:#e5484d,color:#fff;
    classDef good fill:#1f3a24,stroke:#3e9b4f,color:#fff;
    class FALSE,PFAIL,BLOCK bad;
    class DONE good;
```

> TDD 검증 계층은 **Python(pytest)** 을 1급 지원 언어로 고정하고 고도화한다. Java/Spring(JUnit)·JS/TS(Vitest/Jest)는 추후 개발 예정 (PRD §6.4).

---

## 5. 핵심 시퀀스 — 스캔부터 PR까지

```mermaid
sequenceDiagram
    autonumber
    actor U as 사용자
    participant FE as Web
    participant API as API Server
    participant DB as PostgreSQL
    participant R as Agent Runner
    participant M as MCP / Sandbox
    participant GH as GitHub

    U->>FE: [스캔 시작]
    FE->>API: POST /api/v1/scans {repositoryId, ref}
    API->>DB: scans INSERT (QUEUED)
    API->>R: POST /scans {scanId, repoUrl, ref} (HTTP 위임)
    API-->>FE: 202 ScanDto
    FE->>API: GET /scans/:id/stream (SSE 구독)

    R->>M: Agent1 스캔 (scanner-mcp, 격리)
    R->>API: POST /internal/runner/events (HMAC) stage=SCANNING
    API-->>FE: event: stage / finding

    R->>M: Agent2 검증 (advisory-mcp)
    R->>M: Agent3 pytest FAIL→패치→PASS→회귀 (testrunner-mcp)
    R->>API: event: log (FAIL/PASS 로그)

    alt 회귀 통과
        R->>GH: Agent4 브랜치·PR 생성 (github-mcp)
        R->>API: event: done {prUrl}
        API->>DB: pull_requests INSERT
        API-->>FE: event: done → PR 링크
    else 회귀 실패
        R->>API: event: done {status: REGRESSION_BLOCKED}
        API-->>FE: PR 미생성 안내
    end
```

---

## 6. 데이터 모델 (ERD)

```mermaid
erDiagram
    users ||--o{ repositories : owns
    repositories ||--o{ scans : has
    scans ||--o{ findings : produces
    scans ||--o{ agent_runs : runs
    scans ||--o{ audit_logs : logs
    scans ||--o{ pull_requests : creates
    findings ||--o{ patches : patched_by
    patches ||--o{ test_runs : verified_by

    users {
        uuid id PK
        bigint github_id UK
        string login
        text access_token "AES-256-GCM 암호화"
    }
    repositories {
        uuid id PK
        uuid user_id FK
        bigint github_repo_id
        string full_name
        string default_branch
    }
    scans {
        uuid id PK
        uuid repository_id FK
        string ref
        string status
        bigint duration_ms
    }
    findings {
        uuid id PK
        uuid scan_id FK
        string type "SCA|SAST"
        string cve_id
        string severity
        string verdict "PATCH|IGNORE|MANUAL"
    }
    patches {
        uuid id PK
        uuid finding_id FK
        text diff
        text test_code
        smallint attempt_no
    }
    test_runs {
        uuid id PK
        uuid patch_id FK
        string phase "PRE_PATCH|POST_PATCH|REGRESSION"
        boolean passed
    }
    pull_requests {
        uuid id PK
        uuid scan_id FK
        int github_pr_number
        text url
    }
    agent_runs {
        uuid id PK
        uuid scan_id FK
        smallint agent_no "1-4"
        jsonb input_json
        jsonb output_json
    }
    audit_logs {
        uuid id PK
        uuid scan_id FK
        string tool_name
        jsonb params_json
    }
```

> 스키마 원본은 `BE/api-server/src/main/resources/db/migration/V1__init.sql`. 변경은 Flyway 마이그레이션(`V2__…`)으로만 (PRD §10).

---

## 7. 보안 경계 (Trust Boundary)

```mermaid
flowchart TB
    subgraph Trusted["신뢰 영역 (우리 인프라)"]
        API[API Server]
        R[Agent Runner]
        DB[(PostgreSQL)]
    end
    subgraph Sandbox["격리 영역 (Docker Sandbox)"]
        SB["스캐너·테스트 실행<br/>--network=none · --read-only<br/>--cap-drop=ALL · 300s"]
    end
    subgraph Untrusted["신뢰 불가 (외부 리포 콘텐츠)"]
        REPO["클론된 리포<br/>README/주석 = 데이터로만 취급"]
    end

    API <-->|HMAC-SHA256 서명| R
    R -->|제한된 Docker socket| SB
    SB -->|읽기전용 마운트| REPO
    API --> DB

    note1["GitHub 토큰: AES-256-GCM 저장<br/>로그·SSE·에러에 노출 금지"]
    API -.-> note1
```

| 경계 | 방어 | 근거 |
|---|---|---|
| 사용자 ↔ API | 세션 쿠키(HttpOnly), OAuth2 | §9, SecurityConfig |
| API ↔ Runner | HMAC-SHA256 콜백 서명 | NFR-S4 |
| Runner ↔ Sandbox | 네트워크 차단·읽기전용·권한 드롭 | NFR-S1 |
| Sandbox ↔ 리포 | 리포 콘텐츠는 데이터로만, 프롬프트 인젝션 방어 | NFR-S6 |
| 토큰 저장 | AES-256-GCM, 노출 금지 | NFR-S3 |

> 신뢰도 4축(검증·시스템·투명성·정직성) 상세는 [TrustModel](./VibeGuard_TrustModel.md) 및 PRD §11.4 참고.

---

## 8. 기술 스택 요약

```mermaid
mindmap
  root((VibeGuard))
    FE
      React 19 + TS
      Vite
      TanStack Query v5
      Zustand
      Tailwind + shadcn/ui
      Vitest + MSW
    API Server
      Spring Boot 4 / Java 21
      Spring Security + OAuth2
      JPA + QueryDSL
      Flyway
      Supabase PostgreSQL 16
    Agent
      Node 22 + TS
      Claude Agent SDK
      MCP SDK + zod
      Express
    Infra
      Docker / Compose
      Sandbox Pool
      GitHub Actions
```

---

## 9. 배포 토폴로지 (데모)

```mermaid
flowchart LR
    subgraph VM["단일 VM (Docker Compose)"]
        APIc[api-server 컨테이너]
        AGENTc[agent-runner 컨테이너]
        PGc[(postgres<br/>로컬 폴백)]
    end
    VERCEL[[Vercel<br/>FE 분리 배포 가능]]
    SUPA[(Supabase<br/>PostgreSQL 16)]

    VERCEL -->|REST + SSE| APIc
    APIc --> AGENTc
    APIc --> SUPA
    APIc -.->|오프라인 개발 시| PGc
```

> 데모는 단일 VM + Docker Compose (PRD §12). 운영 DB는 Supabase 관리형, 완전 오프라인 개발 시에만 로컬 Postgres로 폴백.

---

## 10. 문서 맵

| 문서 | 다루는 범위 |
|---|---|
| [PRD](./VibeGuard_PRD.md) | 제품 요구사항 전체 (기능·API·데이터·NFR·신뢰도·마일스톤) |
| [Architecture](./VibeGuard_Architecture.md) | 이 문서 — 시스템 구조·흐름·시각화 |
| [BusinessModel](./VibeGuard_BusinessModel.md) | FREE / PRO 플랜, 과금 가치 |
| [TrustModel](./VibeGuard_TrustModel.md) | 신뢰도 4축 상세, 플랜별 매핑 |
