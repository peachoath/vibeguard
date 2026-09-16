/**
 * advisory-mcp (자체 제작) — NVD API 2.0 / OSV.dev / GHSA 교차 조회 (PRD §6.3)
 *
 * NVD는 요청 제한이 엄격하다(키 없이 5분에 5회). 키가 있으면 쓰고, 조회가 실패하면
 * OSV.dev로 폴백한다. 조회 결과는 24시간 캐싱한다 (PRD §6.3 note, R5).
 * NVD_API_KEY·GITHUB_TOKEN은 없어도 동작한다. 있으면 요청 제한만 느슨해진다.
 *
 * 최소 안전 버전 결정은 versions.ts에 있다. 네트워크 없이 검사하기 위해 떼어 두었다.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { parseFixedVersions, resolveFixedVersion, type VulnFix } from './versions.js'

// Trivy DB·pip 캐시와 같은 자리에 둔다. MCP 서버는 스캔마다 새로 뜨므로
// 메모리 캐시는 사실상 캐시가 아니다.
const CACHE_DIR = join(homedir(), '.cache/vibeguard/advisory')
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 20_000

// 조회 대상 식별자는 URL에 그대로 들어간다. 모양을 먼저 확인해 엉뚱한 경로를 부르지 않는다.
const CVE_ID = /^CVE-\d{4}-\d{4,}$/i
const GHSA_ID = /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/i

const ok = (value: unknown): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
})
const fail = (message: string): CallToolResult => ({
  content: [{ type: 'text', text: message }],
  isError: true,
})

/** OSV는 PyPI, GHSA·Trivy는 pip이라고 부른다. 같은 생태계다. */
function toOsvEcosystem(ecosystem: string): string {
  const known: Record<string, string> = { pip: 'PyPI', pypi: 'PyPI', python: 'PyPI', npm: 'npm', maven: 'Maven', go: 'Go' }
  return known[ecosystem.toLowerCase()] ?? ecosystem
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'user-agent': 'vibeguard-advisory-mcp', ...init.headers },
  })
  if (!response.ok) throw new Error(`${url} 응답 ${response.status}`)
  return response.json()
}

/** 같은 질문을 24시간 안에 다시 하면 파일에서 읽는다. 실패는 캐싱하지 않는다. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const file = join(CACHE_DIR, key.replace(/[^A-Za-z0-9._-]/g, '_') + '.json')
  try {
    const saved = JSON.parse(await readFile(file, 'utf8')) as { fetchedAt: number; value: T }
    if (Date.now() - saved.fetchedAt < CACHE_TTL_MS) return saved.value
  } catch {
    // 캐시가 없거나 깨졌으면 그냥 다시 받는다.
  }
  const value = await load()
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(file, JSON.stringify({ fetchedAt: Date.now(), value }))
  return value
}

interface OsvVuln {
  id: string
  aliases?: string[]
  summary?: string
  details?: string
  severity?: { type: string; score: string }[]
  database_specific?: { severity?: string }
  affected?: { package?: { name?: string; ecosystem?: string }; ranges?: { events?: { fixed?: string }[] }[] }[]
}

/** OSV 응답에서 패치 판단에 필요한 만큼만 남긴다. details는 길어서 버린다. */
function summarizeOsv(vuln: OsvVuln): VulnFix & { cvss?: string } {
  const fixedVersions = (vuln.affected ?? []).flatMap((affected) =>
    (affected.ranges ?? []).flatMap((range) =>
      (range.events ?? []).map((event) => event.fixed).filter((fixed): fixed is string => Boolean(fixed)),
    ),
  )
  return {
    id: vuln.id,
    aliases: vuln.aliases,
    summary: vuln.summary,
    severity: vuln.database_specific?.severity,
    cvss: vuln.severity?.[0]?.score,
    fixedVersions: [...new Set(fixedVersions)],
  }
}

async function queryOsv(ecosystem: string, packageName: string, version: string) {
  const osvEcosystem = toOsvEcosystem(ecosystem)
  const data = (await cached(`osv_${osvEcosystem}_${packageName}_${version}`, () =>
    fetchJson('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ package: { name: packageName, ecosystem: osvEcosystem }, version }),
    }),
  )) as { vulns?: OsvVuln[] }
  return (data.vulns ?? []).map(summarizeOsv)
}

const server = new McpServer({ name: 'advisory-mcp', version: '0.0.0' })

server.registerTool(
  'lookup_cve',
  {
    description: 'NVD API 2.0에서 CVE 상세 조회(CVSS 벡터·점수·설명). 실패하면 OSV.dev로 폴백하며 source에 출처를 적는다.',
    inputSchema: { cveId: z.string() },
  },
  async ({ cveId }) => {
    if (!CVE_ID.test(cveId)) return fail(`CVE ID 모양이 아니다: ${cveId}`)
    try {
      return ok(
        await cached(`nvd_${cveId.toUpperCase()}`, async () => {
          const apiKey = process.env.NVD_API_KEY
          try {
            const data = (await fetchJson(
              `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
              apiKey ? { headers: { apiKey } } : {},
            )) as { vulnerabilities?: { cve: Record<string, any> }[] }
            const cve = data.vulnerabilities?.[0]?.cve
            if (!cve) throw new Error('NVD에 해당 CVE가 없다')
            // NVD는 CVSS 3.1/3.0/2.0을 버전별 배열로 준다. 높은 판부터 본다.
            const metrics = cve.metrics ?? {}
            const metric = (metrics.cvssMetricV31 ?? metrics.cvssMetricV30 ?? metrics.cvssMetricV2 ?? [])[0]
            return {
              source: 'NVD',
              id: cve.id,
              published: cve.published,
              description: cve.descriptions?.find((one: { lang: string }) => one.lang === 'en')?.value,
              cvssVector: metric?.cvssData?.vectorString,
              cvssScore: metric?.cvssData?.baseScore,
              severity: metric?.cvssData?.baseSeverity ?? metric?.baseSeverity,
            }
          } catch (nvdError) {
            // 키 없이 5분 5회 제한에 걸리는 상황이 흔하다. 조회 자체를 포기하지 않는다.
            const data = (await fetchJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(cveId.toUpperCase())}`)) as OsvVuln
            return {
              source: 'OSV',
              nvdError: String(nvdError),
              id: data.id,
              aliases: data.aliases,
              description: data.summary,
              cvssVector: data.severity?.[0]?.score,
              severity: data.database_specific?.severity,
            }
          }
        }),
      )
    } catch (error) {
      return fail(`CVE 조회 실패: ${String(error)}`)
    }
  },
)

server.registerTool(
  'query_osv',
  {
    description: 'OSV.dev에서 패키지·버전에 해당하는 취약점과 수정 버전 목록 조회(키 불필요)',
    inputSchema: { ecosystem: z.string(), packageName: z.string(), version: z.string() },
  },
  async ({ ecosystem, packageName, version }) => {
    try {
      const vulns = await queryOsv(ecosystem, packageName, version)
      return ok({ ecosystem: toOsvEcosystem(ecosystem), packageName, version, vulns })
    } catch (error) {
      return fail(`OSV 조회 실패: ${String(error)}`)
    }
  },
)

server.registerTool(
  'github_advisory',
  {
    description: 'GitHub Security Advisory(GHSA) 조회. GITHUB_TOKEN이 있으면 쓰고, 없으면 시간당 60회 제한으로 조회한다.',
    inputSchema: { ghsaId: z.string() },
  },
  async ({ ghsaId }) => {
    if (!GHSA_ID.test(ghsaId)) return fail(`GHSA ID 모양이 아니다: ${ghsaId}`)
    try {
      return ok(
        await cached(`ghsa_${ghsaId.toLowerCase()}`, async () => {
          const token = process.env.GITHUB_TOKEN
          const data = (await fetchJson(`https://api.github.com/advisories/${encodeURIComponent(ghsaId)}`, {
            headers: {
              accept: 'application/vnd.github+json',
              ...(token ? { authorization: `Bearer ${token}` } : {}),
            },
          })) as Record<string, any>
          return {
            source: 'GHSA',
            ghsaId: data.ghsa_id,
            cveId: data.cve_id,
            summary: data.summary,
            severity: data.severity,
            cvssVector: data.cvss?.vector_string,
            cvssScore: data.cvss?.score,
            published: data.published_at,
            withdrawn: data.withdrawn_at,
            // 패키지별 첫 수정 버전. 상향 판단의 근거가 된다.
            affected: (data.vulnerabilities ?? []).map((one: Record<string, any>) => ({
              ecosystem: one.package?.ecosystem,
              packageName: one.package?.name,
              vulnerableRange: one.vulnerable_version_range,
              firstPatchedVersion: one.first_patched_version,
            })),
          }
        }),
      )
    } catch (error) {
      return fail(`GHSA 조회 실패: ${String(error)}`)
    }
  },
)

server.registerTool(
  'resolve_fixed_version',
  {
    description:
      '하위 호환을 깨지 않는 최소 상향 버전 산출. OSV.dev 조회 결과로 두 가지를 계산해 돌려준다: ' +
      'withinMajor(메이저를 넘지 않는 상향, 남는 취약점 명시)와 fixesAll(전부 막는 상향, majorJump 표시). ' +
      '최종 선택은 호출한 에이전트가 한다.',
    inputSchema: {
      ecosystem: z.string(),
      packageName: z.string(),
      currentVersion: z.string(),
      // Trivy가 준 fixedVersion 문자열("2.0.6, 1.26.17")을 그대로 넘겨도 된다.
      candidates: z.string().optional(),
    },
  },
  async ({ ecosystem, packageName, currentVersion, candidates }) => {
    try {
      const vulns = await queryOsv(ecosystem, packageName, currentVersion)
      const hinted = parseFixedVersions(candidates)
      const all = hinted.length > 0 ? [...vulns, { id: 'trivy-candidates', fixedVersions: hinted }] : vulns
      return ok({ packageName, ...resolveFixedVersion(currentVersion, all) })
    } catch (error) {
      return fail(`안전 버전 계산 실패: ${String(error)}`)
    }
  },
)

await server.connect(new StdioServerTransport())
