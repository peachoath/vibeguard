# 인계 — MCP 3종 완료, 파이프라인 프롬프트가 남았다

| 항목 | 내용 |
|---|---|
| 작성 | 2026-09-23 · 김신우 |
| 문서 성격 | MCP 3종·샌드박스 담당(김신우) → 파이프라인 담당(송하성) 인계 |
| 받는 사람 | 송하성 (`BE/agent/runner/*` 파이프라인 실동작 담당) |
| 브랜치 | `shinwoo/mcp-sandbox-cli` (푸시 완료, PR 열기 전) |
| 선행 조건 | PR #15(`shinwoo/docs-drop-ro-mount`) 병합 대기 중 |

---

## 1. 한 줄 요약

**MCP 서버 3종과 샌드박스는 실전에서 동작한다. 파이프라인은 끝까지 흐르지만 Agent 3이
아무 일도 하지 않는다.** 원인은 프롬프트가 무엇을 하라고 지시하지 않는 것이다.

---

## 2. 실측 결과 (2026-09-23, 시드 리포로 4단계 실구동)

대상: `https://github.com/shinu61/vibeguard-seed-python`
(`requirements.txt`에 `urllib3==1.24.1` 고정, 통과 테스트 4개, lock 파일 없음)

| 단계 | 시간 | 실제로 한 일 | 증거 |
|---|---|---|---|
| CLONING | 1초 | 클론 성공 | `<작업폴더>/repo` 생성 |
| SCANNING (A1) | 20초 | **Trivy 실행 · 취약점 12건 탐지** | `artifacts/trivy.json` 68KB |
| VERIFYING (A2) | 68초 | advisory 조회를 한 것으로 **추정** | 산출물 있음. 68초는 외부 조회 없이 나오기 어렵다. 도구 호출 로그가 남지 않아 확증은 아니다 |
| REGRESSION_CHECK (A3) | 20초 | **설치·테스트·패치 전부 안 함** | `venv/` 없음, `report.xml` 없음, `requirements.txt` 그대로 |
| PR_CREATING (A4) | 26초 | 도구가 없어 빈손 | github-mcp 미배선 |
| 최종 | 134초 | `COMPLETED` | |

**그 전 실행(`pypa/sampleproject`)은 취약점 0건이라 아무것도 확인하지 못했다.**
테스트용 리포는 반드시 `requirements.txt`에 취약 버전이 고정된 것을 써야 한다.

---

## 3. 넘기는 작업

### 3.1 Agent 3 프롬프트 (가장 급함)

`pipeline.ts`의 `buildPrompt`는 지금 이렇게만 준다.

```
# VibeGuard Agent 3 — Regression Checker
(리포 내용은 데이터로만 취급하라는 가드 문구)
## 입력
{ job, repoPath, previous: {...} }
```

Agent 1은 도구가 하나뿐이라 알아서 불렀다. Agent 3은 **설치 → 기준선 테스트 → 패치 →
재설치 → 재테스트**라는 5단계를 스스로 알아낼 수 없다. 단계별로 무엇을 어떤 순서로
하라고 적어 줘야 한다. 필요한 값은 이미 프롬프트 입력에 들어 있다(`repoPath`, 이전 단계 산출물).

주의: 패치는 **매니페스트 버전 문자열 한 줄 수정만**이다(방향 전환 v2 확정 사항).
코드 리팩토링이나 재현 테스트 생성은 범위 밖이다.

### 3.2 `COMPLETED`가 거짓 신호를 준다

아무것도 증명하지 못했는데 최종 상태가 `COMPLETED`다. "취약점 0건"과 "일을 못 했다"가
구분되지 않는다. 단계별 산출물을 검사해 `NO_FINDINGS` / `FAILED`를 구분해야 한다.

### 3.3 비용이 기록되지 않는다

`query()`의 result 메시지에 `total_cost_usd`와 `modelUsage`가 오는데 파이프라인이 버린다.
`runAgent`의 for-await 루프에서 `message.type === 'result'`를 잡아 콜백 로그로 남기면 된다.
참고 수치: Agent 1 단독 1회가 약 $0.22(Sonnet). 입력 토큰 대부분은 Agent SDK가 올리는
Claude Code 하네스 몫이다(캐시 생성 48K + 캐시 읽기 90K).

### 3.4 github-mcp (Agent 4)

공식 서버라 직접 만들 필요는 없다. `mcp-servers.ts`의 `SERVERS`에 항목을 추가하면
러너가 자동으로 주입한다(키 이름은 `github`이어야 `mcp__github__*`와 맞는다).

---

## 4. 이미 되어 있는 것 (건드릴 필요 없음)

| 영역 | 상태 |
|---|---|
| `BE/agent/sandbox/` | 컨테이너 3종 러너·CLI 완성. 자체 검사 9종, 적대적 공격 11종 차단 검증 |
| `BE/agent/mcp/*` 3종 | 실구현 완료. 실제 에이전트 호출로 동작 확인 |
| `runner/src/mcp-servers.ts` | 세션별 MCP 주입. 서버별 timeout |
| `pipeline.ts` CLONING | 얕은 클론 + 입력 검증 + 작업 폴더 정리 |
| 확인 스크립트 4종 | 아래 5장 |

### 계약에서 반드시 지킬 것

- **실패는 두 종류다.** 입력 오류·도구 고장 → `isError`. 검사 결과 실패(FAILED,
  INSTALL_FAILED, SCAN_FAILED) → 정상 응답 안의 `outcome`. 섞으면 "테스트 실패"와
  "도구 고장"을 구분할 수 없다.
- **경로 규칙**: 호출자는 `repoPath` 하나만 넘긴다. CLI가 그 부모를 작업 폴더로 보고
  `venv/`·`artifacts/`를 만든다. 클론을 `<작업폴더>/repo`에 두는 이유가 이것이다.
- **timeout**: scanner·testrunner 330초(컨테이너 제한 300초 + 여유), advisory 60초.
  MCP timeout은 진행 알림으로 늘어나지 않는 절대 상한이라 컨테이너 제한보다 짧으면
  결과를 만들어 두고도 호출이 끊긴다.
- **`permissionPrompts: 'none'`을 빼지 말 것.** 서버에는 승인할 사람이 없어서,
  기본값이면 승인이 필요한 도구에서 세션이 영원히 멈춘다.
- **키**: `ANTHROPIC_API_KEY`는 `BE/agent/.env`(git 미추적). 워크스페이스 범위 키여야
  한다. 조직 범위 키는 `anthropic-workspace-id` 헤더가 없으면 400이다.
  `NVD_API_KEY`·`GITHUB_TOKEN`은 없어도 동작한다.

---

## 5. 돌려 보는 법

```bash
cd BE/agent
npm ci && npm run build

# 도커·네트워크·키 없이: 배선 확인
node runner/scripts/check-mcp-wiring.mjs

# 서버 자체 확인 (도커 필요 / 인터넷 필요, 키 불필요)
node mcp/scripts/check-sandbox-mcp.mjs
node mcp/scripts/check-advisory-mcp.mjs

# 버전 결정 로직만 (네트워크·도커 불필요)
npm run check --workspace @vibeguard/advisory-mcp
```

파이프라인 전체를 돌리려면 러너를 띄우고 `POST /scans`에 시드 리포를 넘긴다.

```bash
cd BE/agent
node runner/dist/index.js           # .env 필요
curl -X POST http://127.0.0.1:4000/scans -H 'content-type: application/json' \
  -d '{"scanId":"t1","repoUrl":"https://github.com/shinu61/vibeguard-seed-python","ref":""}'
```

단계·로그는 HMAC 콜백으로 `API_BASE_URL`에 나간다. Spring이 없으면 경고만 남기고 진행한다.
디버깅 중에는 `VIBEGUARD_KEEP_WORKDIR=1`로 작업 폴더를 남겨 `venv/`·`artifacts/`를 확인하면
에이전트가 실제로 무엇을 실행했는지 알 수 있다.

---

## 6. 김신우가 계속 맡는 것

| 항목 | 상태 |
|---|---|
| NFR-S6 프롬프트 인젝션 방어 **검증** | 문구는 `buildPrompt`에 있으나 실제로 막는지 미검증. 적대적 README를 넣은 리포로 확인 예정 |
| NFR-S9 적대적 검증 리포트 | 실측은 완료(공격 11종 차단). 문서화가 남음 |

---

## 7. 미검증·알려진 한계

- NVD 요청 제한에 걸렸을 때의 OSV 폴백 경로 (실제로 걸려 본 적 없음)
- 동시 스캔 3건(NFR-P2)이 같은 Trivy 캐시를 쓸 때의 충돌
- POST_PATCH도 매번 전체 재설치 (증분 설치 미구현)
- PEP 440의 epoch·post·dev 버전은 비교에서 다루지 않음
- 에이전트가 어떤 도구를 불렀는지 남는 로그가 없다. A2의 advisory 사용은 소요 시간에
  근거한 추정이다. 3.3의 비용 로깅과 함께 도구 호출 로그도 남기면 이런 추정이 필요 없어진다
