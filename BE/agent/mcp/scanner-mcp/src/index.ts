/**
 * scanner-mcp (자체 제작) — Trivy 래핑 (SCA) (PRD §6.2, 방향 전환 v2)
 *
 * 방향 전환: SCA에 집중한다. Trivy 단독으로 매니페스트를 읽어 취약 라이브러리를 탐지한다.
 * (OSV-Scanner 이중 실행·Semgrep(SAST)은 이번 MVP에서 제외 — 추후 확장)
 *
 * 스캔은 컨테이너 ①에서 실행한다(NFR-S1): 네트워크는 열되 남의 코드는 실행하지 않는다.
 * Trivy DB는 호스트 캐시를 :ro 없이 마운트한다(속도 목적, 스캔 컨테이너가 DB를 스스로 갱신).
 * 공통 격리(비특권·--read-only·--cap-drop=ALL·메모리/PID 상한·300s)는 유지.
 *
 * 컨테이너 실행과 결과 파싱은 샌드박스 러너(BE/agent/sandbox/cli.py)가 한다.
 * 이 서버는 cli.py를 자식 프로세스로 부르고 JSON을 그대로 돌려준다.
 */
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// ponytail: 아래 callSandbox는 testrunner-mcp에 같은 코드가 있다. 부르는 곳이 셋이 되면 공용 패키지로 뺀다.

// src/와 dist/가 같은 깊이라 어느 쪽에서 실행해도 BE/agent/sandbox/를 가리킨다.
const SANDBOX_DIR = fileURLToPath(new URL('../../../sandbox/', import.meta.url))
const PYTHON = SANDBOX_DIR + '.venv/bin/python'
const CLI = SANDBOX_DIR + 'cli.py'

// 에이전트에게 넘길 로그 길이 상한. Trivy stderr에는 DB 다운로드 진행 표시줄이 들어가
// 매우 길다. pytest 요약과 오류는 끝부분에 있으므로 뒤쪽을 남긴다.
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
 * 검사 자체의 실패(SCAN_FAILED, FAILED 등)는 종료 코드 0에 outcome으로 온다 → 정상 결과.
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

const server = new McpServer({ name: 'scanner-mcp', version: '0.0.0' })

server.registerTool(
  'run_trivy',
  {
    description:
      'Trivy로 SCA 스캔 실행(매니페스트 기반 취약 라이브러리 탐지, 다국어). ' +
      'outcome: OK | SCAN_FAILED | TIMED_OUT. SCAN_FAILED는 "취약점 없음"이 아니다.',
    inputSchema: { repoPath: z.string() },
  },
  async ({ repoPath }) => callSandbox({ tool: 'run_trivy', repoPath }),
)

await server.connect(new StdioServerTransport())
