/**
 * testrunner-mcp (자체 제작) — 설치·테스트 컨테이너 실행 (PRD §6.4, 방향 전환 v2)
 *
 * 재현 테스트를 만들지 않는다. 리포의 기존 테스트를 패치 전후로 실행해
 * 하위 호환(안 깨짐)을 증명한다. 취약점 1건당 설치 2회 + 테스트 2회.
 *
 * 컨테이너 3종 중 ②·③을 담당 (NFR-S1 역할별 네트워크 차등):
 *   - install:   ② 설치 컨테이너. 네트워크 O(필수), --only-binary=:all: 로 임의 코드 차단
 *   - run_tests: ③ 테스트 컨테이너. --network=none (절대), 남의 코드 실행
 * 공통 격리(비특권·--read-only·--cap-drop=ALL·메모리/PID 상한·300s)는 둘 다 유지.
 *
 * 컨테이너 실행과 outcome 판정은 샌드박스 러너(BE/agent/sandbox/cli.py)가 한다.
 * 이 서버는 cli.py를 자식 프로세스로 부르고 JSON을 그대로 돌려준다.
 */
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// ponytail: 아래 callSandbox는 scanner-mcp에 같은 코드가 있다. 부르는 곳이 셋이 되면 공용 패키지로 뺀다.

// src/와 dist/가 같은 깊이라 어느 쪽에서 실행해도 BE/agent/sandbox/를 가리킨다.
const SANDBOX_DIR = fileURLToPath(new URL('../../../sandbox/', import.meta.url))
const PYTHON = SANDBOX_DIR + '.venv/bin/python'
const CLI = SANDBOX_DIR + 'cli.py'

// 에이전트에게 넘길 로그 길이 상한. pytest 요약과 오류는 끝부분에 있으므로 뒤쪽을 남긴다.
const LOG_TAIL = 4000
const tail = (text: string) =>
  text.length > LOG_TAIL ? '…(앞부분 생략)\n' + text.slice(-LOG_TAIL) : text

const fail = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})

/**
 * cli.py에 요청 JSON을 표준입력으로 넘기고 표준출력의 JSON 한 줄을 받는다.
 * 셸을 거치지 않고 인자 배열로 실행한다(명령어 주입 차단).
 *
 * 종료 코드 1 + {"error"}는 잘못된 입력이다 → isError.
 * 검사 자체의 실패(INSTALL_FAILED, FAILED 등)는 종료 코드 0에 outcome으로 온다 → 정상 결과.
 */
function callSandbox(request: Record<string, unknown>): Promise<CallToolResult> {
  return new Promise((resolve) => {
    const child = execFile(
      PYTHON,
      [CLI],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        let answer: Record<string, unknown>
        try {
          answer = JSON.parse(stdout)
        } catch {
          // 파이썬이 없거나 cli.py가 죽어서 약속한 JSON이 오지 않았다.
          resolve(fail(`샌드박스 CLI 실행 실패: ${error?.message ?? '출력이 JSON이 아니다'}\n${tail(stderr)}`))
          return
        }
        if (error || 'error' in answer) {
          resolve(fail(String(answer.error ?? error?.message)))
          return
        }
        for (const key of ['stdout', 'stderr']) {
          if (typeof answer[key] === 'string') answer[key] = tail(answer[key])
        }
        resolve({ content: [{ type: 'text', text: JSON.stringify(answer) }] })
      },
    )
    // 파이썬 실행에 실패하면 stdin 쓰기가 EPIPE를 낸다. 원인은 위 콜백이 보고한다.
    child.stdin?.on('error', () => {})
    child.stdin?.end(JSON.stringify(request))
  })
}

const server = new McpServer({ name: 'testrunner-mcp', version: '0.0.0' })

// 회귀 검증 1급 지원: Python(pytest). Node/Java는 추후 확장.
// 지금은 cli.py가 python-pytest 외의 stack을 isError로 거절한다.
const STACK = z.enum(['python-pytest', 'node-vitest', 'node-jest', 'java-gradle', 'java-maven'])

// ② 설치 컨테이너 — 의존성 설치 (네트워크 O)
server.registerTool(
  'install',
  {
    description:
      '② 설치 컨테이너에서 의존성을 설치한다(네트워크 O). Python은 pip install. ' +
      'outcome: OK | INSTALL_FAILED',
    inputSchema: {
      repoPath: z.string(),
      stack: STACK,
      // 패치 전/후 구분. 지금은 두 단계 모두 전체 재설치한다.
      phase: z.enum(['PRE_PATCH', 'POST_PATCH']),
    },
  },
  async ({ repoPath, stack, phase }) => callSandbox({ tool: 'install', repoPath, stack, phase }),
)

// ③ 테스트 컨테이너 — 리포의 기존 테스트 실행 (네트워크 X)
server.registerTool(
  'run_tests',
  {
    description:
      '③ 테스트 컨테이너에서 리포의 기존 테스트를 실행하고 결과를 반환한다(네트워크 차단). ' +
      'PRE_PATCH=기준선, POST_PATCH=하위 호환 확인. ' +
      'outcome: PASSED | FAILED | NO_TESTS | OOM_KILLED | TIMED_OUT',
    inputSchema: {
      repoPath: z.string(),
      stack: STACK,
      phase: z.enum(['PRE_PATCH', 'POST_PATCH']),
    },
  },
  async ({ repoPath, stack, phase }) => callSandbox({ tool: 'run_tests', repoPath, stack, phase }),
)

await server.connect(new StdioServerTransport())
