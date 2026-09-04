/**
 * advisory-mcp (자체 제작) — NVD API 2.0 / OSV.dev / GHSA 교차 조회 (PRD §6.3)
 *
 * NVD는 요청 제한이 엄격 → API 키 사용, 실패 시 OSV.dev 폴백,
 * CVE ID 기준 24시간 캐싱 (PRD §6.3 note, R5).
 *
 * TODO(W3): 실제 API 호출, CVSS 벡터 해석, 캐싱 구현.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({ name: 'advisory-mcp', version: '0.0.0' })

const stub = async (tool: string, args: unknown) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({ tool, args, note: 'not implemented (W3)' }),
    },
  ],
})

server.registerTool(
  'lookup_cve',
  { description: 'NVD API 2.0에서 CVE 상세 조회', inputSchema: { cveId: z.string() } },
  (args) => stub('lookup_cve', args),
)
server.registerTool(
  'query_osv',
  {
    description: 'OSV.dev에서 패키지·버전 취약점 조회',
    inputSchema: { ecosystem: z.string(), packageName: z.string(), version: z.string() },
  },
  (args) => stub('query_osv', args),
)
server.registerTool(
  'github_advisory',
  { description: 'GitHub Security Advisory(GHSA) 조회', inputSchema: { ghsaId: z.string() } },
  (args) => stub('github_advisory', args),
)
server.registerTool(
  'resolve_fixed_version',
  {
    description: '하위 호환을 깨지 않는 최소 상향 버전 산출 (major 점프 회피)',
    inputSchema: { ecosystem: z.string(), packageName: z.string(), currentVersion: z.string() },
  },
  (args) => stub('resolve_fixed_version', args),
)

await server.connect(new StdioServerTransport())
