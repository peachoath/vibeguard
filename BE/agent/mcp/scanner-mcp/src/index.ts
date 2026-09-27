/**
 * scanner-mcp (자체 제작) — Trivy 래핑 (SCA) (PRD §6.2, 방향 전환 v2)
 *
 * 방향 전환: SCA에 집중한다. Trivy 단독으로 매니페스트를 읽어 취약 라이브러리를 탐지한다.
 * (OSV-Scanner 이중 실행·Semgrep(SAST)은 이번 MVP에서 제외 — 추후 확장)
 *
 * 스캔은 컨테이너 ①에서 실행한다(NFR-S1): 네트워크는 열되 남의 코드는 실행하지 않는다.
 * Trivy DB는 호스트에서 :ro 마운트(속도 목적). 공통 격리(비특권·--read-only·
 * --cap-drop=ALL·메모리/PID 상한·300s)는 유지.
 *
 * TODO(구현): 실제 컨테이너 실행 및 결과 파싱/병합.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'scanner-mcp', version: '0.0.0' })

server.registerTool(
  'run_trivy',
  {
    description: 'Trivy로 SCA 스캔 실행(매니페스트 기반 취약 라이브러리 탐지, 다국어)',
    inputSchema: { repoPath: z.string() },
  },
  async (args) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ tool: 'run_trivy', args, findings: [], note: 'not implemented' }),
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
