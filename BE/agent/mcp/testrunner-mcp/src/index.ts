/**
 * testrunner-mcp (자체 제작) — 격리 컨테이너 테스트 실행 (PRD §6.4)
 *
 * Agent 3의 TDD 증명 루프에 사용:
 *   PRE_PATCH(반드시 FAIL) → POST_PATCH(PASS) → REGRESSION(100% 통과) 단계별 실행.
 * 실행은 전부 Docker 격리 (NFR-S1), 300초 타임아웃 (NFR-S2).
 *
 *   Java/Spring → JUnit 5 + Gradle/Maven
 *   JS/TS       → Vitest 또는 Jest
 *
 * TODO(W4): 컨테이너 실행, phase별 결과/로그 파싱 구현. (프로젝트의 심장)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'testrunner-mcp', version: '0.0.0' })

server.registerTool(
  'run_tests',
  {
    description: '격리 컨테이너에서 테스트 스위트를 실행하고 phase별 결과를 반환',
    inputSchema: {
      repoPath: z.string(),
      stack: z.enum(['java-gradle', 'java-maven', 'node-vitest', 'node-jest']),
      phase: z.enum(['PRE_PATCH', 'POST_PATCH', 'REGRESSION']),
      testFilter: z.string().optional(),
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
          total: 0,
          failed: 0,
          note: 'not implemented (W4)',
        }),
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
