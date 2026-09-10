<img src="./DOCS/assets/logo.svg" alt="VibeGuard" height="48">

# VibeGuard

> 취약한 라이브러리를 탐지하고, 하위 호환을 깨지 않는 **최소 안전 버전으로 올려도 안 깨진다는 것을 리포의 기존 테스트로 증명**한 버전 상향 패치를 GitHub PR로 제안하는 Multi-Agent 의존성 보안 시스템.

GitHub 리포지토리를 연결하면 AI 에이전트가 **취약 라이브러리를 탐지하고(SCA) → 공식 DB로 위험도를 검증해 최소 안전 버전을 정하고 → 매니페스트 버전을 올린 뒤 → 리포에 원래 있던 테스트를 패치 전후로 실행해 "올려도 안 깨진다"를 증명하고 → 증거를 담아 PR을 올립니다.**

> 우리가 테스트로 증명하는 것은 "취약함"이 아니라 **하위 호환 유지**입니다. (SAST·코드 리팩토링은 추후 확장 — [방향전환](./DOCS/VibeGuard_방향전환.md))

> 2026학년도 AI(클로드 코드) 기반 VIBECODING 실전활용 경진대회 · 상세 기획은 [`DOCS/`](./DOCS) 참고.

<p align="center">
  <img alt="Frontend" src="https://img.shields.io/badge/FE-React_19_+_Vite-61DAFB?logo=react&logoColor=black">
  <img alt="Backend" src="https://img.shields.io/badge/BE-Spring_Boot_4_/_Java_21-6DB33F?logo=springboot&logoColor=white">
  <img alt="Agent" src="https://img.shields.io/badge/Agent-Node_22_+_Claude_SDK-339933?logo=nodedotjs&logoColor=white">
  <img alt="DB" src="https://img.shields.io/badge/DB-Supabase_PostgreSQL_16-3ECF8E?logo=supabase&logoColor=white">
  <img alt="Deploy" src="https://img.shields.io/badge/FE_Deploy-Vercel-000000?logo=vercel&logoColor=white">
</p>

---

## 문서 (Docs)

> **처음이라면 [`AI Learn First`](./DOCS/VibeGuard_AI_Learn_First.md)부터 읽으세요.** 프로젝트 전체 맥락·규칙·현황을 한 문서에 압축해, 팀원이 다른 LLM에 붙여넣고 바로 작업을 시작할 수 있는 온보딩 진입점입니다.

| 문서 | 다루는 범위 | 이럴 때 |
|---|---|---|
| [방향전환](./DOCS/VibeGuard_방향전환.md) | **SAST→SCA 전환 확정 근거 (최우선 문서)** | 방향·스코프의 최종 근거를 확인할 때 |
| [AI Learn First](./DOCS/VibeGuard_AI_Learn_First.md) | 온보딩 프라이머 — 맥락·불변식·규칙·구현 현황·작업 진입점 | **작업을 처음 시작할 때 / LLM에 컨텍스트를 줄 때** |
| [PRD](./DOCS/VibeGuard_PRD.md) | 제품 요구사항 전체 (기능·API·데이터·NFR·신뢰도·마일스톤) | 요구사항·스코프를 확인할 때 |
| [Architecture](./DOCS/VibeGuard_Architecture.md) | 시스템 구조·데이터 흐름 (Mermaid 시각화 9종) | 구조·시퀀스·ERD를 눈으로 볼 때 |
| [API Spec](./DOCS/VibeGuard_API_Spec.md) | REST / SSE / HMAC 콜백 상세 명세 | 엔드포인트·DTO·에러 규격을 구현할 때 |
| [Business Model](./DOCS/VibeGuard_BusinessModel.md) | FREE / PRO 플랜, 과금 가치 | 기능을 플랜에 매핑할 때 |
| [Trust Model](./DOCS/VibeGuard_TrustModel.md) | 신뢰도 4축(검증·시스템·투명성·정직성) | 신뢰도 소구점·발표 자료를 다룰 때 |
| [프로젝트 계획서](./DOCS/VibeGuard_프로젝트_계획서.pdf) | 대회 제출용 기획서 (PDF) | 원본 기획 맥락이 필요할 때 |

**문서 관계도**

```
                ┌─────────────────────────┐
   시작 ──────▶ │   AI Learn First (진입)   │
                └────────────┬────────────┘
                             │ 종합·요약
        ┌───────────┬────────┼────────┬────────────┐
        ▼           ▼        ▼        ▼            ▼
      PRD     Architecture  API Spec  Business    Trust
    (요구사항)   (구조·흐름)   (인터페이스) Model      Model
```

> 문서와 실제 코드가 충돌하면 **코드 및 배포 후 `/v3/api-docs`(OpenAPI)** 가 최종 기준입니다.

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

- **브랜치 전략:** `main` ← `dev` ← `feature/*`, PR 리뷰 1인 이상 필수
- **DB 스키마:** 변경은 반드시 Flyway 마이그레이션 파일로만 (`V2__...`)
- **FE 상태관리:** 서버 상태 = TanStack Query, 클라이언트 상태 = Zustand (혼용 금지)
- **FE 타입:** 백엔드 OpenAPI → `npm run typegen`으로 생성. 수기 API 타입 정의 금지
- **보안:** 컨테이너 3종 역할별 네트워크 차등 — 테스트 컨테이너만 네트워크 차단, 리포 콘텐츠는 데이터로만 취급 (PRD §11.1)
- **언어:** 탐지(SCA)는 다국어(Trivy), 회귀 증명은 **Python(pytest)** 우선. Node/Java 회귀는 추후 확장 ([PRD §6.4](./DOCS/VibeGuard_PRD.md))
- **패치 범위:** 매니페스트 버전 문자열 한 줄 수정만(코드 리팩토링 없음). lock 파일 있는 리포는 탐지만

## 제품 플랜 (FREE / PRO)

| | **FREE** — Dependency Fix | **PRO** — Verified Dependency Upgrade |
|---|---|---|
| 한 줄 | 탐지 + 최소 안전 버전 상향 PR 체험 | 여기에 **하위 호환 회귀 증명**까지 |
| 탐지 (SCA / Trivy) | 지원 (다국어) | 지원 (다국어) |
| CVE 분석 · 안전 버전 결정 | 기본 | 정밀(NVD/OSV/GHSA + major 점프 회피) |
| 설치·회귀 테스트(패치 전후) · 자동 재시도 | 미지원 | 지원 (Python/pytest) |
| 회귀 증거 PR · 감사 로그 · 상세 리포트 | 미지원 | 지원 |

> 과금 가치는 "더 많이 탐지"가 아니라 **"올린 버전이 기존 기능을 안 깨뜨림을 증명받기 위해"** 입니다. 상세: [Business Model](./DOCS/VibeGuard_BusinessModel.md)

## 신뢰도 (왜 믿을 수 있나)

VibeGuard의 신뢰도는 4개 축에서 나옵니다 — 상세: [Trust Model](./DOCS/VibeGuard_TrustModel.md)

- **검증** — 세 주장을 구분: "취약"(공식 DB) / "고쳤다"(버전 대조) / **"안 깨졌다"(회귀 테스트)** (최대 차별점)
- **시스템** — 역할별 네트워크 격리 · 적대적 8종 실측 차단 · 최소 권한 · 토큰 암호화 · HMAC 콜백
- **투명성** — 감사 로그 · 판단 근거 노출 · 실시간 SSE · 회귀 증거 뷰
- **정직성** — 증명 없음(NO_TESTS)·설치 실패·회귀 깨짐·lock 미지원을 숨기지 않고 노출

## 마일스톤

2주 계획 · **W2 전반(설치 + 회귀 검증)이 핵심입니다.** 상세: [PRD §14](./DOCS/VibeGuard_PRD.md).

## 팀

김세원(기획·디자인) · 송하성(프론트엔드·보안) · 민진홍(백엔드·인프라) · 김신우(백엔드·보안)
