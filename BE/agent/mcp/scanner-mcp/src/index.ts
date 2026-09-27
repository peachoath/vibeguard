/**
 * scanner-mcp stdio MCP 서버 — Trivy SCA 스캔 래핑 (PRD §6.2, 방향 전환 v2)
 *
 * Claude Agent SDK가 stdio 서브프로세스로 구동한다. advisory-mcp, testrunner-mcp와 동일한
 * StdioServerTransport를 사용한다.
 *
 * Trivy 컨테이너 격리 원칙 (PRD §11.1, NFR-S1):
 *   - 비특권 컨테이너 (--security-opt=no-new-privileges)
 *   - 리포는 :ro 읽기 전용 마운트
 *   - 메모리 512MiB / PID 256 상한
 *   - 네트워크 허용 (Trivy DB 업데이트) — 실행 환경에서 외부망 필요
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const execFileAsync = promisify(execFile)

// ──────────────────────────────────────────────
// Trivy JSON 출력 타입 (schema version 2)
// ──────────────────────────────────────────────
interface TrivyVulnerability {
  VulnerabilityID: string
  PkgName: string
  InstalledVersion: string
  FixedVersion?: string
  Severity: string
  CVSS?: { nvd?: { V3Score?: number }; ghsa?: { V3Score?: number } }
  CweIDs?: string[]
  Description?: string
}

interface TrivyResult {
  Target: string
  Type?: string
  Vulnerabilities?: TrivyVulnerability[]
}

interface TrivyOutput {
  Results?: TrivyResult[]
}

// ──────────────────────────────────────────────
// Finding 표준화
// ──────────────────────────────────────────────
interface NormalizedFinding {
  cveId: string
  packageName: string
  currentVersion: string
  recommendedVersion: string | null
  severity: string
  cvssScore: number | null
  cweId: string | null
  manifestPath: string
  filePath: string
  ruleId: string
}

function normalizeSeverity(s: string): string {
  const upper = s.toUpperCase()
  if (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(upper)) return upper
  return 'UNKNOWN'
}

function extractCvssScore(cvss: TrivyVulnerability['CVSS']): number | null {
  if (!cvss) return null
  return cvss.nvd?.V3Score ?? cvss.ghsa?.V3Score ?? null
}

function extractCweId(cweIds: string[] | undefined): string | null {
  if (!cweIds || cweIds.length === 0) return null
  return cweIds[0].substring(0, 32)
}

function parseTrivy(raw: string): NormalizedFinding[] {
  let output: TrivyOutput
  try {
    output = JSON.parse(raw)
  } catch {
    return []
  }

  const findings: NormalizedFinding[] = []
  for (const result of output.Results ?? []) {
    for (const vuln of result.Vulnerabilities ?? []) {
      if (!vuln.VulnerabilityID || !vuln.PkgName || !vuln.InstalledVersion) continue
      findings.push({
        cveId: vuln.VulnerabilityID,
        packageName: vuln.PkgName,
        currentVersion: vuln.InstalledVersion,
        recommendedVersion: vuln.FixedVersion ?? null,
        severity: normalizeSeverity(vuln.Severity ?? 'UNKNOWN'),
        cvssScore: extractCvssScore(vuln.CVSS),
        cweId: extractCweId(vuln.CweIDs),
        manifestPath: result.Target,
        filePath: result.Target,
        ruleId: vuln.VulnerabilityID,
      })
    }
  }
  return findings
}

// ──────────────────────────────────────────────
// Trivy 실행
// ──────────────────────────────────────────────
async function runTrivy(repoPath: string): Promise<{ findings: NormalizedFinding[]; raw: string }> {
  const { stdout } = await execFileAsync('docker', [
    'run', '--rm',
    '-v', `${repoPath}:/repo:ro`,
    '--memory=512m',
    '--pids-limit=256',
    '--security-opt=no-new-privileges',
    'aquasec/trivy:latest',
    'fs',
    '--format', 'json',
    '--quiet',
    '--no-progress',
    '/repo',
  ], { maxBuffer: 10 * 1024 * 1024, timeout: 300_000 })

  const findings = parseTrivy(stdout)
  return { findings, raw: stdout }
}

// ──────────────────────────────────────────────
// MCP 서버 (stdio transport)
// ──────────────────────────────────────────────
const server = new McpServer({ name: 'scanner-mcp', version: '0.1.0' })

server.registerTool(
  'run_trivy',
  {
    description:
      'Trivy로 리포지토리를 SCA 스캔한다. ' +
      '반환값은 { findings: Finding[], trivyVersion } JSON. ' +
      '각 Finding은 { cveId, packageName, currentVersion, recommendedVersion, severity, cvssScore, manifestPath, filePath, ruleId, cweId } 형태.',
    inputSchema: {
      repoPath: z.string().describe('스캔할 리포 로컬 절대 경로'),
    },
  },
  async ({ repoPath }) => {
    try {
      const { findings, raw: _raw } = await runTrivy(repoPath)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ findings }),
          },
        ],
      }
    } catch (err) {
      const message = (err as Error).message
      console.error('[scanner-mcp] Trivy 실행 실패:', message)
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: message, findings: [] }),
          },
        ],
        isError: true,
      }
    }
  },
)

await server.connect(new StdioServerTransport())
