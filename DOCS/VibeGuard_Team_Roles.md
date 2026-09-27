# VibeGuard 팀 역할 분담 (Team Roles)

> 4인 팀의 담당 영역·경계·협업 계약을 정의하는 문서.
> 방향 전환 v2(SAST→SCA, 회귀 증명, 컨테이너 3종)를 전제로 한다.

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 · 2026-09-10 |
| 관련 문서 | [방향전환](./VibeGuard_방향전환.md) · [PRD](./VibeGuard_PRD.md) · [Architecture](./VibeGuard_Architecture.md) · [AI Learn First](./VibeGuard_AI_Learn_First.md) |
| 전제 | 전체 기간 **2주(14일)**, 데모는 단일 VM + Docker Compose(무료), FE는 Vercel·DB는 Supabase |

---

## 0. 한눈에 보기

| 이름 | 한 줄 역할 | 주 담당 코드 경계 |
|---|---|---|
| **민진홍** | 백엔드 코어 & 인프라/배포 | `BE/api-server/*` + 배포(Docker Compose/VM) |
| **김신우** | MCP 실구현 & 샌드박스 보안 | `BE/agent/mcp/*` + `BE/agent/sandbox/` |
| **송하성** | Agent 파이프라인 실동작 & E2E + 배포/연동 보조 | `BE/agent/runner/*` + 시드 리포 + 통합 |
| **김세원** | 디자인 & 프론트엔드 전담 | `FE/*` + 디자인 + 발표/시연 자료 |

> 코딩 가능: 민진홍·김신우·송하성·김세원(FE). 방향 전환으로 SAST가 빠져 W2 난이도는 낮아졌고, **핵심은 "설치→회귀 검증"(김신우·송하성 협업 구간)** 이다.

---

## 1. 민진홍 — 백엔드 코어 & 인프라/배포

### 담당 영역
- `BE/api-server/*` 전체 (인증·리포·스캔·SSE·Finding·대시보드 API)
- 서버↔런너 HMAC 계약(수신 콜백 + 위임 클라이언트)
- **배포**: Dockerfile 2종, `docker-compose.yml` 완성, 단일 VM 배포
- DB 연동: Supabase 연결, Flyway 마이그레이션(`V2` 포함)

### 구체 작업 (방향 전환 반영)
- `test_runs`에 `exit_code`·`outcome` 컬럼 추가하는 **`V2__…` 마이그레이션** 작성, `patches.test_code` 제거
- `findings`를 SCA 중심 컬럼으로 정리(`package_name`/`manifest_path`/`current_version`/`recommended_version`)
- 상태머신에 `REGRESSION_CHECK` 반영 (기존 `PATCHING` 대체)
- api-server 실제 기동: GitHub OAuth 로그인 완주, Supabase 세션 풀러(5432)+`sslmode=require`
- 배포: api-server/agent-runner Dockerfile, Docker 소켓 마운트(DinD), VM에서 `docker compose up`

### 산출물
서버 실동작(로컬→VM), Docker Compose 통합, CI(GitHub Actions), V2 마이그레이션.

> 배포는 전담이 아니라 API 담당에 얹는 형태. 초반 집중 + 이후 간헐적. **연동·소켓 마운트는 송하성이 보조**.

---

## 2. 김신우 — MCP 실구현 & 샌드박스 보안

### 담당 영역
- `BE/agent/mcp/*` 실구현 (현재 전부 stub)
- `BE/agent/sandbox/`(신규) — 컨테이너 3종 실행 러너
- 샌드박스 격리(NFR-S1)·프롬프트 인젝션 방어(NFR-S6)·적대적 검증(NFR-S9)

### 구체 작업 (방향 전환 반영)
- **scanner-mcp**: Trivy 실제 컨테이너 실행·JSON 파싱 (Semgrep 제외, SCA만). Trivy DB 호스트 마운트(`:ro`, 속도)
- **advisory-mcp**: NVD/OSV/GHSA 실제 조회 + CVE 24h 캐싱 + **최소 안전 버전 결정 로직**(major 점프 회피)
- **testrunner-mcp**: 컨테이너 3종으로 **설치 2회 + 테스트 2회** 실행. `outcome`(PASSED/FAILED/NO_TESTS/OOM_KILLED/TIMED_OUT/INSTALL_FAILED) 판정
  - stack enum에 **`python-pytest` 추가**(현재 java/node만 — 코드 이슈)
- **컨테이너 3종 네트워크 차등**: ① 스캔·② 설치 네트워크 O, ③ 테스트 `--network=none`. 공통 격리(비특권·`--read-only`·`--cap-drop=ALL`·메모리/PID 상한·300s) 전부
- ② 설치에 `--only-binary=:all:` 적용, 러너 버전 핀(`pytest==9.1.1`)·아키텍처 고정(`--platform linux/amd64`)
- **적대적 8종**(크리덴셜 탈취·외부 유출·호스트 파일 열람·리포 변조·환경변수 탈취·권한 상승·Docker 소켓 접근·tmpfs 고갈) 차단 검증

### 산출물
MCP 3종 실동작, 컨테이너 3종 러너, 적대적 검증 리포트(NFR-S9 실측 증거).

> **W2 전반(D6~9)의 핵심**이 여기. 보안 담당이므로 격리·방어가 몫. 가장 난도 높은 구간.

---

## 3. 송하성 — Agent 파이프라인 실동작 & E2E + 배포/연동 보조

### 담당 영역
- `BE/agent/runner/*` 파이프라인 실연결 (현재 골격만)
- **시드 취약 리포** 제작
- E2E 시연 통합 + 배포/연동에서 민진홍 보조

### 구체 작업 (방향 전환 반영)
- runner의 Agent 1~4 세션에 실제 ANTHROPIC_KEY·MCP를 물려 구동, 단계별 프롬프트 튜닝
  - `agents.ts`의 allowedTools를 SCA/회귀 기준으로 조정(`mcp__scanner__run_trivy`, `mcp__testrunner__install`/`run_tests`)
  - `pipeline.ts`를 설치→회귀 흐름으로 정합(재현 테스트 생성 로직 없음)
- **`vibeguard-seed-python`** 제작: Flask 또는 FastAPI + pytest, **`requirements.txt`만(lock 없음)**, 취약 라이브러리 1개+(`pyyaml 5.1` 등), **기존 통과 테스트 20개+**
- **E2E 리허설**: 리포 연결 → 스캔 → SSE 실시간 → 회귀 증거 → PR 전 구간 완주
- HMAC 콜백 스키마(`RunnerEvent`)·SSE 이벤트가 실제로 잘 흐르는지 검증 (FE와 맞물리는 부분)
- 배포/연동 보조: Docker Compose 통합·소켓 마운트에서 민진홍과 협업

### 산출물
동작하는 파이프라인, Python 시드 리포, E2E 시연 대본·성공률 측정.

> FE 감각이 있어 "SSE로 나오는 이벤트가 화면에서 말이 되는지"까지 볼 수 있는 게 강점.

---

## 4. 김세원 — 디자인 & 프론트엔드 전담

### 담당 영역
- `FE/*` 전체 + 디자인 + 발표/시연 자료

### 구체 작업
- 화면 7종(랜딩·리포선택·스캔진행·Finding목록·상세·대시보드·이력) 구현
- 다크 시큐리티 콘솔 디자인(PRD §8.2), 심각도 색상·폰트(Pretendard/JetBrains Mono)
- 상태: 서버=TanStack Query / UI=Zustand(혼용 금지), SSE 훅 `useScanStream`(수신 시 `setQueryData`)
- API 타입은 OpenAPI 자동 생성(`npm run typegen`), 수기 정의 금지
- **회귀 증거 뷰**(F-07): 패치 전 통과 로그 / 패치 후 통과 로그 / 버전 대조 (구 "TDD 증거"에서 명칭·내용 변경됨)
- Vercel 배포: `VITE_API_BASE_URL` 주입 + `credentials:'include'`
- 발표 자료·시연 GIF("올려도 안 깨진다")

### 산출물
FE 화면 전체, 디자인 시스템, 발표·시연 자료.

> 확인 필요: 원래 PRD의 "팀장/기획" 역할(발표·문서 총괄)을 김세원이 겸하는지, 시연 리허설(송하성)과 어떻게 나눌지 팀 확정.

---

## 5. 협업 계약 (경계선 — 이것만 안 깨면 병렬 가능)

세 개의 인터페이스 계약이 담당자 사이의 경계다.

| 경계 | 계약 | 소유 |
|---|---|---|
| 김신우 ↔ 송하성 | `agents.ts`의 **MCP 툴 이름 화이트리스트** (`mcp__scanner__run_trivy` 등) | 공동 |
| 송하성 ↔ 민진홍 | **HMAC 콜백 스키마** (`RunnerEvent`: scanId/kind/stage/agent/status/payload) | 민진홍 정의 |
| 김세원 ↔ 민진홍 | **OpenAPI 스펙** (`/v3/api-docs` → FE typegen) | 민진홍 정의 |
| 배포 | 단일 VM + Docker Compose | 민진홍 주도, 송하성 보조 |

---

## 6. 작업 순서 (2주 관점)

```
민진홍  api-server 실동작 + V2 마이그레이션 + OpenAPI 확정  →  배포 뼈대(Dockerfile/compose)  →  VM 배포
김신우  testrunner-mcp(설치·회귀, 최우선)  →  scanner-mcp(Trivy)  →  advisory-mcp(안전버전)  →  적대적 검증
송하성  Python 시드 리포(먼저)  →  runner 파이프라인 실연결  →  E2E 리허설  →  배포 보조
김세원  MSW 목으로 화면 선행  →  OpenAPI 확정 후 실연결  →  회귀 증거 뷰  →  발표 자료
```

권장 착수 우선순위:
1. **민진홍**: OpenAPI 스펙 먼저 확정(D1~2) → 김세원 FE 선행 개발 가능
2. **송하성**: Python 시드 리포 먼저 제작 → 김신우 MCP의 테스트 대상 제공
3. **김신우**: `testrunner-mcp`(설치→회귀)부터 — W2 전반 핵심이라 가장 오래

---

## 7. 브랜치·협업 규칙 (CONTRIBUTING 준수)

- 브랜치: `main` ← `dev` ← `feature/*|fix/*|chore/*`. 작업 브랜치는 `dev`에서 분기 → `dev`로 PR, 리뷰 1인 이상.
- 커밋: Conventional Commits `type(scope): 제목`. scope 예: `be, agent, mcp, fe, db, infra, docs, ci`.
- `.env`는 커밋 금지(컴포넌트별), 공유는 `.env.example`. `RUNNER_CALLBACK_SECRET`은 api-server/agent 양쪽 동일.
- DB 스키마 변경은 Flyway `V2__…`로만. 기존 마이그레이션 수정 금지.
- 큰 기능 단위로 원격 push + PR 누적(진행 상황 공유).

---

## 8. 미확정 / 팀 확인 필요

| # | 사안 | 담당 |
|---|---|---|
| Q1 | 김세원의 기획·발표 총괄 역할과 송하성의 시연 리허설 경계 | 전원 |
| Q2 | LLM은 Claude(Agent SDK) 유지 — 비용은 소액 감수(무료 인프라 + 토큰 절약 전략) 확정 여부 | 전원 |
| Q3 | 샌드박스 러너 최종 위치 `BE/agent/sandbox/` 확정 | 김신우 |
| Q4 | Trivy DB·pip 캐시 호스트 경로·갱신 주체 | 김신우·민진홍 |
