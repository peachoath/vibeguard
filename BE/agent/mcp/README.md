# BE/agent/mcp — 자체 제작 MCP 서버

에이전트가 쓰는 도구 서버다. 각 에이전트 세션에는 그 단계에 필요한 서버만 주입하고
`allowedTools`로 쓸 수 있는 도구를 제한한다(PRD §5.3).

| 서버 | 도구 | 하는 일 |
|---|---|---|
| `scanner-mcp` | `run_trivy` | ① 스캔 컨테이너에서 Trivy로 취약 라이브러리를 찾는다 |
| `testrunner-mcp` | `install`, `run_tests` | ② 설치·③ 테스트 컨테이너를 돌려 하위 호환을 증명한다 |
| `advisory-mcp` | `lookup_cve`, `query_osv`, `github_advisory`, `resolve_fixed_version` | NVD·OSV·GHSA를 조회하고 최소 안전 버전을 계산한다 |

`scanner-mcp`와 `testrunner-mcp`는 컨테이너를 직접 띄우지 않는다. 샌드박스 러너
(`BE/agent/sandbox/cli.py`)를 자식 프로세스로 부르고 결과 JSON을 그대로 돌려준다.
격리 규칙과 컨테이너 3종의 설명은 `BE/agent/sandbox/README.md`에 있다.

## 빌드

```
cd BE/agent
npm ci
npm run build
```

## 확인 스크립트

`mcp/scripts/` 아래 두 개가 있다. **둘 다 API 키가 필요 없다.**
준비물이 없으면 실패가 아니라 이유를 적고 건너뛴다(종료 코드 0).

| 스크립트 | 무엇을 확인하나 | 준비물 |
|---|---|---|
| `check-sandbox-mcp.mjs` | scanner·testrunner가 샌드박스 러너를 호출해 스캔·설치·테스트를 실제로 돌리고, 잘못된 입력을 거절하는지 | Docker 실행 중, 이미지 2종, `sandbox/.venv` |
| `check-advisory-mcp.mjs` | advisory가 세 DB를 조회하고, 중복을 CVE로 합치며, 상향 후보 두 가지를 계산하는지 | 인터넷 연결 |

```
cd BE/agent
node mcp/scripts/check-sandbox-mcp.mjs
node mcp/scripts/check-advisory-mcp.mjs
```

버전 비교·안전 버전 결정 로직만 따로 보는 검사는 네트워크도 도커도 필요 없다.

```
cd BE/agent
npm run check --workspace @vibeguard/advisory-mcp
```

## 환경변수

`BE/agent/.env.example`를 `.env`로 복사해 채운다. advisory-mcp가 쓰는 두 키는
**없어도 동작하며** 있으면 요청 제한만 느슨해진다.

| 변수 | 없을 때 |
|---|---|
| `NVD_API_KEY` | NVD 조회가 5분 5회로 제한되고, 걸리면 OSV.dev로 폴백한다 |
| `GITHUB_TOKEN` | GHSA 조회가 시간당 60회로 제한된다 |
