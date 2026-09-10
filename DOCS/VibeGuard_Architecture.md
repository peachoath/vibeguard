# VibeGuard 아키텍처 문서 (Architecture)

> VibeGuard의 시스템 구조·데이터 흐름·컴포넌트 책임을 시각 자료 중심으로 정리한 문서.
> 다이어그램은 [Mermaid](https://mermaid.js.org/)로 작성되어 GitHub·VS Code(Kiro)에서 그대로 렌더링됩니다.

| 항목 | 내용 |
|---|---|
| 문서 버전 | **v2.0 (방향 전환: SAST→SCA, 회귀 증명, 컨테이너 3종)** |
| 최종 수정 | 2026-09-10 |
| 관련 문서 | [PRD](./VibeGuard_PRD.md) · [BusinessModel](./VibeGuard_BusinessModel.md) · [TrustModel](./VibeGuard_TrustModel.md) · [방향전환](./VibeGuard_방향전환.md) |

---

## 1. 개요

VibeGuard는 GitHub 리포의 **취약 라이브러리를 탐지 → 위험도 검증·최소 안전 버전 결정 → 매니페스트 버전 상향 → 설치·회귀 테스트로 하위 호환 증명 → PR**까지 자동화하는 멀티 에이전트 의존성 보안 시스템이다. 크게 **3티어**로 구성된다.

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
        SCAN["scanner-mcp<br/>Trivy (SCA)"]
        ADV["advisory-mcp<br/>NVD·OSV·GHSA"]
        GHMCP["github-mcp<br/>(공식) 브랜치·PR"]
        TEST["testrunner-mcp<br/>설치·테스트 컨테이너"]
    end

    subgraph Infra["Sandbox — 컨테이너 3종 (역할별 네트워크 차등)"]
        C1["① 스캔 Trivy<br/>네트워크 O · 코드 실행 X"]
        C2["② 설치 pip<br/>네트워크 O(필수)"]
        C3["③ 테스트 pytest<br/>네트워크 X(절대)"]
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
    SCAN --> C1
    TEST --> C2 & C3
```

> 공통 격리(비특권 사용자·`--read-only`·`--cap-drop=ALL`·메모리/PID 상한·300s)는 3종 모두 유지. **남의 테스트 코드가 도는 ③ 테스트 컨테이너에만 네트워크가 없다.** Trivy DB·pip 캐시는 호스트에서 `:ro` 마운트(속도 목적).

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
    CLONING --> SCANNING : Agent 1 (Trivy)
    SCANNING --> VERIFYING : Agent 2 (안전 버전 결정)
    SCANNING --> NO_FINDINGS
    VERIFYING --> REGRESSION_CHECK : Agent 3 (설치·회귀)
    REGRESSION_CHECK --> PR_CREATING : Agent 4
    REGRESSION_CHECK --> PATCH_FAILED : 재시도 2회 초과
    REGRESSION_CHECK --> REGRESSION_BLOCKED : 패치 후 회귀 실패
    PR_CREATING --> COMPLETED
    CLONING --> FAILED
    SCANNING --> FAILED
    NO_FINDINGS --> [*]
    PATCH_FAILED --> [*]
    REGRESSION_BLOCKED --> [*]
    COMPLETED --> [*]
    FAILED --> [*]
```

> 테스트가 없는 리포는 `REGRESSION_CHECK`에서 회귀 증명 없이 통과(`NO_TESTS`)하고 A4로 진행한다.

### 4.2 에이전트별 책임과 MCP 매핑

```mermaid
flowchart LR
    A1["Agent 1<br/>Scanner (SCA)"] --> A2["Agent 2<br/>Verifier (안전 버전)"]
    A2 --> A3["Agent 3<br/>Regression Checker (심장)"]
    A3 --> A4["Agent 4<br/>PR Author"]

    A1 -.->|scanner-mcp| M1[Trivy]
    A2 -.->|advisory-mcp| M2[NVD·OSV·GHSA]
    A3 -.->|testrunner-mcp| M3[pip 설치 · pytest 실행]
    A4 -.->|github-mcp| M4[브랜치·PR]
```

| Agent | 입력 | 산출물 | 허용 MCP 툴 (화이트리스트) |
|---|---|---|---|
| 1 Scanner | 클론 경로, 브랜치 | `findings[]` (SCA) | `scanner__run_trivy` |
| 2 Verifier | `findings[]` | `verified[]` (verdict, 최소 안전 버전, majorJump) | `advisory__lookup_cve/query_osv/github_advisory/resolve_fixed_version` |
| 3 Regression Checker | `verified[]` | `patches[]`, `test_runs[]` (설치·테스트 2회) | `testrunner__install`, `testrunner__run_tests` |
| 4 PR Author | patches, 회귀 증거 | PR URL | `github__*` |

> 단계 간 전달은 구조화된 JSON 아티팩트(`stage_output.json`)로 명시적 전달 — 컨텍스트 오염 방지, 재현성 확보 (PRD §5.3).

### 4.3 Agent 3 — 설치 → 회귀 검증 루프 (Python 우선)

**재현 테스트를 만들지 않는다.** 리포의 기존 테스트를 패치 전후로 실행해 하위 호환을 증명한다.

```mermaid
flowchart TD
    START([verified finding]) --> INST1["② 설치: pip install (패치 전 버전)"]
    INST1 -->|설치 실패| IFAIL["INSTALL_FAILED<br/>스킵·로그 노출"]
    INST1 --> PRE{"③ 테스트: pytest (패치 전)"}
    PRE -->|테스트 없음| NOTESTS["NO_TESTS<br/>증명 없이 A4 진행"]
    PRE -->|통과 = 기준선| PATCH["호스트: 매니페스트 버전 한 줄 상향"]
    PATCH --> INST2["② 설치: 바뀐 패키지 업그레이드"]
    INST2 --> POST{"③ 테스트: pytest (패치 후)"}
    POST -->|깨짐| RETRY{"재시도 < 2? (버전 후보 낮춤)"}
    RETRY -->|예| PATCH
    RETRY -->|아니오| BLOCK["REGRESSION_BLOCKED<br/>PR 차단"]
    POST -->|통과 = 안 깨짐| DONE([하위 호환 증명 완료 → Agent 4])

    classDef bad fill:#3a1f22,stroke:#e5484d,color:#fff;
    classDef good fill:#1f3a24,stroke:#3e9b4f,color:#fff;
    class IFAIL,BLOCK bad;
    class DONE,NOTESTS good;
```

> 회귀 검증은 **Python(pytest)** 을 1급 지원한다. 이유는 재현 테스트 작성이 아니라 **의존성 설치·테스트 실행이 언어마다 달라 Python(`pip install`)이 가장 단순**하기 때문이다(PRD §6.4). 취약점 1건당 설치 2회 + 테스트 2회. 테스트 컨테이너만 네트워크 차단.

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

    R->>M: Agent1 Trivy 스캔 (scanner-mcp, ① 스캔 컨테이너)
    R->>API: POST /internal/runner/events (HMAC) stage=SCANNING
    API-->>FE: event: stage / finding

    R->>M: Agent2 검증 + 최소 안전 버전 결정 (advisory-mcp)
    R->>M: Agent3 설치·테스트(전) → 버전 상향 → 설치·테스트(후) (testrunner-mcp)
    R->>API: event: log (패치 전후 pytest 통과 로그)

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
        string type "SCA (SAST는 추후)"
        string cve_id
        string package_name
        string current_version
        string recommended_version
        string verdict "PATCH|IGNORE|MANUAL"
    }
    patches {
        uuid id PK
        uuid finding_id FK
        text diff "매니페스트 한 줄"
        smallint attempt_no
    }
    test_runs {
        uuid id PK
        uuid patch_id FK
        string phase "PRE_PATCH|POST_PATCH"
        boolean passed
        int exit_code
        string outcome "PASSED|FAILED|NO_TESTS|OOM_KILLED|TIMED_OUT|INSTALL_FAILED"
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

> 스키마 원본은 `BE/api-server/src/main/resources/db/migration/V1__init.sql`. **방향 전환으로 `test_runs`에 `exit_code`·`outcome` 컬럼 추가 및 `patches.test_code` 제거가 필요하며, `V1`은 이미 배포되어 수정 금지이므로 반드시 신규 `V2__…` 마이그레이션으로 반영한다** (PRD §10).

---

## 7. 보안 경계 (Trust Boundary)

```mermaid
flowchart TB
    subgraph Trusted["신뢰 영역 (우리 인프라)"]
        API[API Server]
        R[Agent Runner]
        DB[(PostgreSQL)]
    end
    subgraph Sandbox["격리 영역 (컨테이너 3종, 역할별 네트워크 차등)"]
        SB1["① 스캔/② 설치<br/>네트워크 O · 공통 격리"]
        SB3["③ 테스트 pytest<br/>네트워크 X · 남의 코드 실행"]
    end
    subgraph Untrusted["신뢰 불가 (외부 리포 콘텐츠)"]
        REPO["클론된 리포<br/>README/주석 = 데이터로만 취급"]
    end

    API <-->|HMAC-SHA256 서명| R
    R -->|제한된 Docker socket| SB1
    R -->|제한된 Docker socket| SB3
    SB3 -->|읽기전용 마운트| REPO
    API --> DB

    note1["GitHub 토큰·API 키·Claude는<br/>컨테이너에 들어가지 않음 (AES-256-GCM 저장)"]
    API -.-> note1
```

| 경계 | 방어 | 근거 |
|---|---|---|
| 사용자 ↔ API | 세션 쿠키(HttpOnly), OAuth2 | §9, SecurityConfig |
| API ↔ Runner | HMAC-SHA256 콜백 서명 | NFR-S4 |
| Runner ↔ Sandbox | 역할별 네트워크 차등 — **③ 테스트만 네트워크 차단**, 공통 격리(읽기전용·권한 드롭) 전부 유지 | NFR-S1 |
| Sandbox 자체 | 적대적 공격 8종 실제 시도해 전부 차단 확인 (실측) | NFR-S9 |
| Sandbox ↔ 리포 | 리포 콘텐츠는 데이터로만, 프롬프트 인젝션 방어 | NFR-S6 |
| 토큰 저장 | AES-256-GCM, 노출 금지, 컨테이너 미주입 | NFR-S3 |

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
      Node 22 + TS (오케스트레이션)
      Python (샌드박스 러너)
      Claude Agent SDK
      MCP SDK + zod
      Trivy (SCA)
      pytest (회귀)
    Infra
      Docker / Compose
      컨테이너 3종 (스캔/설치/테스트)
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
| [방향전환](./VibeGuard_방향전환.md) | SAST→SCA 전환 배경·확정 사항 (최우선 근거) |
