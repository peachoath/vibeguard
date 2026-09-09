# VibeGuard 사업모델 — FREE / PRO 2단계

> AI가 생성한 코드의 보안 취약점을 탐지·패치·검증하는 VibeGuard의 요금제(플랜) 정의 문서.
> [PRD](./VibeGuard_PRD.md)의 **SCA/SAST → 취약점 분석 → 패치 → TDD 검증 → GitHub PR** 흐름을 유지하되,
> FREE는 탐지·패치·PR "경험"에 집중하고, PRO는 검증과 자동화를 강화한다.

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 |
| 최종 수정 | 2026-09-09 |
| 상태 | 확정 (플랜 2단계 Freeze) |
| 관련 문서 | [VibeGuard_PRD.md](./VibeGuard_PRD.md) |

---

## 0. 한 줄 정의

- **FREE = AI Security Fix** — 탐지 + AI 패치 + Auto PR을 경험해보는 기본형.
- **PRO = Verified AI Security Automation** — 여기에 TDD 검증까지 포함한 신뢰 가능한 보안 자동화형.

> 핵심: **FREE도 AI 패치와 Auto PR을 제공한다.** 그래야 사용자가 VibeGuard의 핵심 기능을 직접 경험하고,
> PRO는 "기능을 잠근 유료 버전"이 아니라 **패치의 신뢰성과 자동화 수준을 높여주는 플랜**이 된다.

### 발표용 한 문장

> VibeGuard는 무료 플랜에서 AI 생성 코드의 취약점을 탐지하고 패치와 PR까지 제공하고,
> PRO 플랜에서는 여기에 TDD 기반 검증과 자동 재패치까지 더해
> AI가 수정한 코드가 실제로 안전한지 스스로 검증하는 자동화 서비스를 제공합니다.

---

## 1. 기능 비교표

| 기능 | FREE | PRO |
|---|---|---|
| GitHub Repository 연결 | 지원 | 지원 |
| 기본 보안 검사 | 지원 | 지원 |
| SAST / Semgrep | 기본 | **정밀** |
| SCA / Dependency 검사 | 기본 | **정밀** |
| CVE 분석 | 기본 정보 | **상세 분석** |
| 취약점 우선순위 | 기본 | **AI 분석** |
| AI 패치 | 지원 | 지원 |
| Auto PR 생성 | 지원 | 지원 |
| **TDD 보안 검증** | 미지원 | **지원** |
| **Regression Test** | 미지원 | **지원** |
| **패치 자동 재시도** | 미지원 | **지원** |
| **자동 취약점 → 패치 Pipeline** | 미지원 | **지원** |
| 지속적인 자동 검사 | 미지원 | **지원** |
| 보안 리포트 | 기본 | **상세** |
| 취약점 이력 | 제한 | **전체** |
| Audit Log | 미지원 | **지원** |
| CI/CD | 미지원 | 미지원 |
| Team 기능 | 미지원 | 미지원 |

> CI/CD·Team 기능은 두 플랜 모두 현재 범위 밖(Non-Goal). PRD §2.2 및 §7의 W(Won't) 우선순위와 일관.

---

## 2. 🆓 FREE — AI 보안 패치 체험형

### 핵심 타겟
- 대학생 / 취준생 / 개인 개발자
- Vibe Coding 사용자 / 개인 프로젝트 개발자

### 핵심 가치
> "AI가 만든 코드에서 위험한 부분을 찾아주고, 수정까지 해준다."

FREE에서는 **보안 검사를 너무 무겁게 하지 않는 것**이 중요하다. 기본 SAST/SCA로 가볍게 탐지한다.

### FREE Flow

```
GitHub Repository 연결
        ↓
Repository 분석
        ↓
기본 SAST / SCA 검사
        ↓
취약점 발견
        ↓
간단한 CVE 분석
        ↓
AI Patch 제안
        ↓
사용자 확인
        ↓
코드 수정
        ↓
GitHub Commit
        ↓
Auto PR 생성
```

즉 **탐지 → 패치 → PR**까지 경험시킨다.

### FREE에서 TDD를 하지 않는 이유

```
취약점 발견 -> AI Patch -> GitHub PR
```

"AI가 패치를 만들어준다" 수준의 경험까지만 제공한다.
**"이 패치가 정말 취약점을 해결했는가?"**를 검증하지는 않는다 — 이 검증을 PRO의 핵심 가치로 가져간다.

---

## 3. PRO — AI 보안 자동화 & 검증형

### 핵심 타겟
- 프리랜서 / 1인 개발 사업자 / SaaS 개발자
- 실제 서비스를 운영하는 개발자
- 보안이 중요한 개인·소규모 개발 환경

### 핵심 가치
> "AI가 고친 코드를 믿는 것이 아니라, 테스트를 통해 안전하다는 것을 검증한다."

### PRO Flow — VibeGuard의 핵심 기술이 모두 들어간다

```
GitHub Repository 연결
        ↓
Repository 분석
        ↓
정밀 SAST / SCA
        ↓
취약점 발견
        ↓
Agent 2: CVE / NVD / Security Advisory 분석
        ↓
Severity 판단
        ↓
권장 패치 버전 분석
        ↓
AI Patch
        ↓
Security Test 생성
        ↓
┌───────────────────┐
│ 패치 전 테스트  FAIL │
└─────────┬─────────┘
          ↓
      AI Patch
          ↓
┌───────────────────┐
│ 패치 후 테스트  PASS │
└─────────┬─────────┘
          ↓
   Regression Test → PASS
          ↓
   Auto PR (검증 결과 포함)
          ↓
   GitHub PR
```

기존 PRD의 **FAIL → PATCH → PASS → GitHub PR** 컨셉을 그대로 살리는 부분이다.

---

## 4. PRO에서 가장 중요한 5가지 기능

### ① TDD 기반 Security Validation
FREE와 PRO를 나누는 가장 강력한 기준.

| | 메시지 |
|---|---|
| FREE | "이 코드에 취약점이 있습니다." |
| PRO | "취약점을 발견했고 → 재현 테스트에서 FAIL이 발생했고 → 패치했고 → 다시 테스트해서 PASS를 확인했습니다." |

```
FREE:  취약점 → 패치 → PR
PRO :  취약점 → 재현 → FAIL → 패치 → PASS → Regression PASS → PR
```

### ② 자동화 (사람 개입 여부)

| | 동작 |
|---|---|
| FREE | 사용자가 각 단계에 개입: [보안 검사 시작] → [패치 적용] → [PR 생성] |
| PRO | 등록 후 검사·분석·테스트 생성·패치·TDD 검증·재패치·Auto PR까지 **사람이 중간에 개입하지 않아도 됨** |

### ③ AI Patch Retry (자동 재시도)
Security Test가 FAIL이면 FREE는 "패치 검증 실패"로 끝. PRO는 실패 원인 분석 → 패치 수정 → 재검증을 자동 반복.

```
Maximum Retry = 3
```

3회 모두 실패 시:
```
Automatic Patch Failed — Human Review Required
```

> PRD §6.4 Unhappy Path의 `PATCH_FAILED`(최대 2회 재시도)와 정합 필요 — 재시도 상한 값은 구현 시 최종 확정.

### ④ Regression Test
보안 패치가 성공해도 기존 기능을 망가뜨리면 안 된다.
```
Security Test PASS → Regression Test PASS → "안전한 패치"
```
Regression이 깨지면 PR 생성 차단(PRD §6.4 `REGRESSION_BLOCKED`).

### ⑤ 검증 결과가 포함된 Auto PR
단순 PR이 아니라 "패치가 왜 안전한지"를 증명하는 PR 본문:

```
VibeGuard Security Patch
====================
Vulnerability   : SQL Injection
Severity        : Critical
--------------------
Security Test
   Before Patch : FAIL
   After Patch  : PASS
--------------------
Regression Test : PASS
--------------------
AI Patch        : Parameterized Query 적용
====================
Result
   [x] Security Issue Resolved
   [x] Existing Functionality Preserved
```

PRD §6.5 PR 본문 템플릿(재현 테스트/FAIL 로그/PASS 로그/회귀 결과)과 직접 연결된다.

---

## 5. 수익 모델 — 과금 가치

가격보다 **과금 가치**를 먼저 정의한다.

### FREE — AI Security Fix
```
기본 검사 + AI Patch + Auto PR
```
사용자가 VibeGuard의 핵심 기능을 무료로 경험.

### PRO — Verified AI Security Automation
```
정밀 검사 + AI Patch + Security Test + TDD Validation
+ Regression Test + AI Retry + 완전 자동화 + 상세 Report
```

> 돈을 내는 이유가 "취약점을 더 많이 찾기 위해서"가 아니라
> **"AI가 고친 결과를 자동으로 검증하고 신뢰할 수 있게 만들기 위해서"**가 된다.

---

## 6. 포지셔닝 맵

```
                  VibeGuard
                      │
             ┌────────┴────────┐
             ↓                 ↓
           FREE               PRO
            │                  │
       AI Security Fix    Verified Security Automation
            │                  │
       기본 탐지            정밀 탐지
            ↓                 ↓
       AI Patch             AI Patch
            ↓                 ↓
       Auto PR            Security Test
                              ↓
                         TDD Validation
                              ↓
                         Regression Test
                              ↓
                         AI Auto Retry
                              ↓
                           Auto PR
```

---

## 7. PRD와의 정합 / 후속 확인 사항

- 플랜 개념은 PRD의 파이프라인·기능을 재배치한 것이며, 기존 상태머신(QUEUED→…→COMPLETED)과 Agent 1~4 구조는 그대로 유지된다.
- FREE는 파이프라인 중 **A1(탐지, 기본 룰셋) → A3 일부(패치 생성, TDD 미수행) → A4(PR)**, PRO는 **A1(정밀)→A2(검증)→A3(TDD 전체 루프+재시도)→A4(증거 포함 PR)** 전 구간으로 매핑된다.
- 재시도 상한(FREE 문서상 3회 vs PRD §6.4 2회)은 구현 착수 전 팀이 하나로 확정해야 한다.
- 플랜 구분을 위해 향후 필요한 데이터 모델 변경(예: `users.plan`, 스캔별 플랜 스냅샷 등)은 Flyway 마이그레이션(`V2__…`)으로만 반영한다.
