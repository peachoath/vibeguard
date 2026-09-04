# 🛡️ VibeGuard

> AI가 생성한 코드의 보안 취약점을 탐지하고, **TDD 기반으로 "수정되었음을 증명"한** 패치를 GitHub PR로 제안하는 Multi-Agent 시스템.

GitHub 리포지토리를 연결하면 AI 에이전트가 **취약점을 탐지하고 → 취약함을 증명하는 테스트를 먼저 작성하고(FAIL) → 패치한 뒤 → 같은 테스트가 통과함을 증명하고(PASS) → 회귀 테스트까지 통과시킨 결과를 담아 PR을 올립니다.**

> 2026학년도 AI(클로드 코드) 기반 VIBECODING 실전활용 경진대회 · 상세 기획은 [`DOCS/`](./DOCS) 참고.

---

## 레포 구조

```
vibeguard/
├── FE/                      # 웹 클라이언트 — React 19 + TS + Vite
├── BE/                      # 서버 티어 (JVM + Node)
│   ├── api-server/          #   Spring Boot 4 / Java 21 — REST + SSE + OAuth + DB
│   └── agent/               #   npm workspace (Agent 티어)
│       ├── runner/          #     Claude Agent SDK 런너 (Agent 1~4 세션 구동)
│       └── mcp/             #     자체 제작 MCP 서버
│           ├── scanner-mcp/     #     Trivy / OSV / Semgrep 래핑
│           ├── advisory-mcp/    #     NVD / OSV.dev / GHSA 조회
│           └── testrunner-mcp/  #     격리 컨테이너 테스트 실행
├── DOCS/                    # PRD, 기획서
├── docker-compose.yml       # 로컬 인프라 (PostgreSQL)
└── README.md
```

> `github-mcp`은 공식 GitHub MCP Server를 사용하므로 별도 코드 없이 설정만 연결합니다.

## 아키텍처 (요약)

```
FE (React)  ──REST + SSE──▶  BE/api-server (Spring Boot)
                                   │  HTTP 위임 ↕ HMAC 웹훅 콜백
                                   ▼
                             BE/agent/runner (Node, Claude Agent SDK)
                                   │  MCP (stdio/HTTP)
                                   ▼
                             MCP 서버 4종  ──▶  격리 Docker 샌드박스
```

Agent Runner를 Spring Boot에서 분리한 이유와 서브에이전트 MCP 제약 우회는 PRD §5.2 / §5.3 참고.

---

## 기술 스택

| 티어 | 스택 |
|---|---|
| **FE** | React 19 · TypeScript 5 · Vite · TanStack Query v5 · Zustand · Tailwind v4 + shadcn/ui · Vitest + Testing Library + MSW |
| **BE/api-server** | Spring Boot 4.0.8 · Java 21 · Gradle (Kotlin DSL) · Spring Security + OAuth2 · Spring Data JPA + QueryDSL · Flyway · **Supabase PostgreSQL 16** · springdoc-openapi |
| **BE/agent** | Node 22 · TypeScript · `@anthropic-ai/claude-agent-sdk` · `@modelcontextprotocol/sdk` · zod · Express |

---

## 사전 요구사항

- Node ≥ 22, Java 21, Docker, (선택) Gradle — 각 컴포넌트는 wrapper/로컬 툴 사용

## 시작하기

### 0. 환경변수

`.env`는 **각 컴포넌트 폴더 안**에 둡니다(루트 통합 `.env` 없음 — 각 런타임이 자기 폴더만 읽습니다). 각 폴더의 `.env.example`을 `.env`로 복사해 채우세요.

| 위치 | 담는 값 | 읽는 주체 |
|---|---|---|
| `BE/api-server/.env` | DB(Supabase), GitHub OAuth, 콜백 시크릿 | Spring Boot (부팅 시 자동 로드) |
| `BE/agent/.env` | `ANTHROPIC_API_KEY`, `NVD_API_KEY`, 런너 설정 | Node 런너 |
| `FE/.env` | `VITE_*` (선택) | Vite |

```bash
cp BE/api-server/.env.example BE/api-server/.env   # DB는 Supabase Connect의 JDBC(Session pooler) 값
cp BE/agent/.env.example      BE/agent/.env
```

> DB는 **Supabase 관리형 PostgreSQL 16**. 스키마는 Spring Boot 부팅 시 Flyway가 자동 마이그레이션합니다.
> 오프라인 로컬 개발이 필요하면 `docker compose up -d postgres`로 로컬 Postgres를 띄우고
> `BE/api-server/.env`의 로컬 `DB_URL` 주석을 활성화하세요.

### 1. FE (웹)

```bash
cd FE
npm install
npm run dev          # http://localhost:5173  (/api → :8080 프록시)
npm run build        # 프로덕션 빌드
npm run test         # Vitest
```

### 2. BE/api-server (Spring Boot)

```bash
cd BE/api-server
./gradlew bootRun    # http://localhost:8080  (Swagger UI: /swagger-ui.html)
./gradlew build      # 빌드 + 테스트 (테스트는 Docker/Testcontainers 필요)
```

DB 스키마는 Flyway(`src/main/resources/db/migration/V1__init.sql`)로 자동 마이그레이션됩니다.

### 3. BE/agent (런너 + MCP)

```bash
cd BE/agent
npm install
npm run dev:runner   # http://localhost:4000/health
npm run build        # 전체 workspace 빌드
```

---

## 개발 규칙

- **브랜치 전략:** `main` ← `develop` ← `feature/*`, PR 리뷰 1인 이상 필수
- **DB 스키마:** 변경은 반드시 Flyway 마이그레이션 파일로만 (`V2__...`)
- **FE 상태관리:** 서버 상태 = TanStack Query, 클라이언트 상태 = Zustand (혼용 금지)
- **FE 타입:** 백엔드 OpenAPI → `npm run typegen`으로 생성. 수기 API 타입 정의 금지
- **보안:** 스캐너·테스트 실행은 전부 Docker 격리, 리포 콘텐츠는 데이터로만 취급 (PRD §11.1)

## 마일스톤

6주 계획 · **W4(패치 + TDD 루프)가 성패를 가릅니다.** 상세: [PRD §14](./DOCS/VibeGuard_PRD.md).

## 팀

김세원(기획·디자인) · 송하성(프론트엔드·보안) · 민진홍(백엔드·인프라) · 김신우(백엔드·보안)
