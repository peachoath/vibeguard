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
 * TODO(구현): 실제 컨테이너 실행 및 결과/outcome 파싱. (프로젝트의 심장)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'testrunner-mcp', version: '0.0.0' })

// 회귀 검증 1급 지원: Python(pytest). Node/Java는 추후 확장.
const STACK = z.enum(['python-pytest', 'node-vitest', 'node-jest', 'java-gradle', 'java-maven'])

// ② 설치 컨테이너 — 의존성 설치 (네트워크 O)
server.registerTool(
  'install',
  {
    description: '② 설치 컨테이너에서 의존성을 설치한다(네트워크 O). Python은 pip install.',
    inputSchema: {
      repoPath: z.string(),
      stack: STACK,
      // 패치 전/후 구분 — 후속 설치는 바뀐 패키지만 업그레이드(빠름)
      phase: z.enum(['PRE_PATCH', 'POST_PATCH']),
    },
  },
  async (args) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          tool: 'install',
          args,
          // outcome: OK | INSTALL_FAILED
          outcome: null,
          note: 'not implemented',
        }),
      },
    ],
  }),
)

// ③ 테스트 컨테이너 — 리포의 기존 테스트 실행 (네트워크 X)
server.registerTool(
  'run_tests',
  {
    description:
      '③ 테스트 컨테이너에서 리포의 기존 테스트를 실행하고 결과를 반환한다(네트워크 차단). ' +
      'PRE_PATCH=기준선, POST_PATCH=하위 호환 확인.',
    inputSchema: {
      repoPath: z.string(),
      stack: STACK,
      phase: z.enum(['PRE_PATCH', 'POST_PATCH']),
    },
  },
  async (args) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({
          tool: 'run_tests',
          args,
          passed: null,
          exitCode: null,
          // PASSED | FAILED | NO_TESTS | OOM_KILLED | TIMED_OUT
          outcome: null,
          total: 0,
          failed: 0,
          note: 'not implemented',
        }),
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
