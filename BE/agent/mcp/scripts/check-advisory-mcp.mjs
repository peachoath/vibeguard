/**
 * advisory-mcp 확인 — 도구 4종이 NVD·OSV·GHSA를 실제로 조회하고
 * 최소 안전 버전을 계약대로 계산하는지 본다.
 *
 * 실행: node mcp/scripts/check-advisory-mcp.mjs   (BE/agent에서)
 *
 * 준비물: `npm run build` 로 dist/ 생성, 인터넷 연결.
 * API 키는 필요 없다. NVD·GHSA는 키 없이도 조회되며, 요청 제한에 걸리면
 * 그 항목만 건너뛴다(NVD는 코드가 OSV로 폴백한다).
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const SERVER = join(import.meta.dirname, '..', 'advisory-mcp', 'dist', 'index.js')

function skip(reason) {
  console.log(`건너뜀: ${reason}`)
  process.exit(0)
}

if (!existsSync(SERVER)) skip(`${SERVER} 가 없다. 먼저 npm run build 를 실행한다`)

// 네트워크가 없으면 확인할 수 없다. 실패가 아니라 건너뛴다.
try {
  const probe = await fetch('https://api.osv.dev/v1/query', {
    method: 'POST',
    body: JSON.stringify({ package: { name: 'six', ecosystem: 'PyPI' }, version: '1.16.0' }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!probe.ok) skip(`OSV.dev 응답 ${probe.status}`)
} catch (error) {
  skip(`OSV.dev에 연결할 수 없다: ${error}`)
}

const client = new Client({ name: 'check-advisory-mcp', version: '0' })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [SERVER] }))

async function call(tool, args) {
  const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 120_000 })
  const text = result.content[0].text
  console.log(`  ${tool} ${JSON.stringify(args)} → isError=${!!result.isError}`)
  return { isError: !!result.isError, body: result.isError ? text : JSON.parse(text) }
}

console.log('# advisory-mcp 확인')

// ① OSV 조회 — 같은 취약점의 GHSA·PYSEC 중복이 CVE 기준으로 합쳐져야 한다.
const osv = await call('query_osv', { ecosystem: 'pip', packageName: 'urllib3', version: '1.24.1' })
assert.equal(osv.isError, false)
assert.ok(osv.body.vulns.length > 0, '취약점이 조회돼야 한다')
assert.ok(osv.body.vulns.every((one) => Array.isArray(one.sources) && one.sources.length > 0), '출처가 남아야 한다')
assert.ok(
  osv.body.vulns.every((one) => !one.fixedVersions.some((fix) => /^[0-9a-f]{20,}$/.test(fix))),
  'fixedVersions에 git 커밋 해시가 섞이면 안 된다',
)
const ids = osv.body.vulns.map((one) => one.id)
assert.equal(new Set(ids).size, ids.length, '같은 취약점이 두 번 실리면 안 된다')

// ② 최소 안전 버전 — 메이저를 넘지 않는 후보와 전부 막는 후보를 함께 준다.
const resolved = await call('resolve_fixed_version', {
  ecosystem: 'pip',
  packageName: 'urllib3',
  currentVersion: '1.24.1',
  candidates: '2.0.6, 1.26.17', // Trivy가 주는 쉼표 문자열도 받는다
})
assert.equal(resolved.isError, false)
assert.equal(resolved.body.withinMajor.version.split('.')[0], '1', '메이저를 넘지 않아야 한다')
assert.equal(resolved.body.majorJump, false)
assert.ok(resolved.body.fixesAll.majorJump, '전부 막으려면 2.x가 필요하다')

// ③ CVE 상세 — NVD 요청 제한에 걸리면 OSV로 폴백한다. 둘 다 정상이다.
const cve = await call('lookup_cve', { cveId: 'CVE-2019-11324' })
assert.equal(cve.isError, false)
assert.ok(['NVD', 'OSV'].includes(cve.body.source))

// ④ GHSA — 토큰 없이 시간당 60회. 제한에 걸리면 그 항목만 건너뛴다.
const ghsa = await call('github_advisory', { ghsaId: 'GHSA-mh33-7rrq-662w' })
if (ghsa.isError && /403|rate limit/i.test(ghsa.body)) {
  console.log('  (GHSA 요청 제한 — 이 항목만 건너뜀. GITHUB_TOKEN이 있으면 넉넉해진다)')
} else {
  assert.equal(ghsa.isError, false)
  assert.equal(ghsa.body.cveId, 'CVE-2019-11324')
  assert.equal(ghsa.body.affected[0].firstPatchedVersion, '1.24.2')
}

// ⑤ 잘못된 식별자는 조회하지 않고 거절한다(URL에 그대로 들어가는 값이다).
assert.equal((await call('lookup_cve', { cveId: '../../etc/passwd' })).isError, true)
assert.equal((await call('github_advisory', { ghsaId: 'GHSA-zzz' })).isError, true)

await client.close()
console.log('통과: advisory-mcp가 계약대로 동작한다.')
