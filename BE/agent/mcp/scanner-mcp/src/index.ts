/**
 * scanner-mcp (자체 제작) — Trivy / OSV-Scanner / Semgrep 래핑 (PRD §6.2)
 *
 * 모든 스캐너는 격리 Docker 컨테이너에서 실행되어야 한다 (NFR-S1):
 *   --network=none --read-only --cap-drop=ALL --memory=2g --pids-limit=256, 300s 타임아웃.
 *
 * TODO(W2): 실제 컨테이너 실행 및 결과 파싱/병합 구현.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'scanner-mcp', version: '0.0.0' })

const stub = async (tool: string, args: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({ tool, args, findings: [], note: 'not implemented (W2)' }),
    },
  ],
})

server.registerTool(
  'run_trivy',
  { description: 'Trivy로 SCA 스캔 실행', inputSchema: { repoPath: z.string() } },
  (args) => stub('run_trivy', args),
)
server.registerTool(
  'run_osv',
  { description: 'OSV-Scanner로 SCA 스캔 실행', inputSchema: { repoPath: z.string() } },
  (args) => stub('run_osv', args),
)
server.registerTool(
  'run_semgrep',
  {
    description: 'Semgrep(p/owasp-top-ten, p/security-audit)로 SAST 스캔 실행',
    inputSchema: { repoPath: z.string() },
  },
  (args) => stub('run_semgrep', args),
)

await server.connect(new StdioServerTransport())
