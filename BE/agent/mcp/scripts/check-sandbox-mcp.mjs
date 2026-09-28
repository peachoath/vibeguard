/**
 * scanner-mcp·testrunner-mcp 확인 — 두 서버가 샌드박스 러너(cli.py)를 실제로
 * 호출해 컨테이너 3종(스캔·설치·테스트)을 돌리고 결과를 계약대로 돌려주는지 본다.
 *
 * 실행: node mcp/scripts/check-sandbox-mcp.mjs   (BE/agent에서)
 *
 * 준비물: `npm run build` 로 dist/ 생성, Docker 실행 중,
 *         이미지 vibeguard-sandbox:0.1 · vibeguard-scan:0.1, sandbox/.venv.
 * 준비물이 없으면 실패가 아니라 이유를 적고 건너뛴다. API 키는 필요 없다.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const MCP_DIR = join(import.meta.dirname, '..')
const SANDBOX_DIR = join(MCP_DIR, '..', 'sandbox')

function skip(reason) {
  console.log(`건너뜀: ${reason}`)
  process.exit(0)
}

for (const name of ['scanner-mcp', 'testrunner-mcp']) {
  if (!existsSync(join(MCP_DIR, name, 'dist', 'index.js'))) skip(`${name}/dist 가 없다. 먼저 npm run build 를 실행한다`)
}
if (!existsSync(join(SANDBOX_DIR, '.venv', 'bin', 'python'))) {
  skip('sandbox/.venv 가 없다. sandbox에서 python3 -m venv .venv 를 실행한다')
}
try {
  execFileSync('docker', ['info'], { stdio: 'ignore' })
} catch {
  skip('Docker가 실행 중이 아니다')
}
for (const image of ['vibeguard-sandbox:0.1', 'vibeguard-scan:0.1']) {
  const found = execFileSync('docker', ['images', '-q', image], { encoding: 'utf8' }).trim()
  if (!found) skip(`이미지 ${image} 가 없다. sandbox/README.md 의 빌드 명령을 먼저 실행한다`)
}

// 검사용 임시 리포. cli.py는 repoPath의 부모를 작업 폴더로 보고 venv/·artifacts/를 만든다.
const work = mkdtempSync(join(tmpdir(), 'vibeguard-check-'))
const repo = join(work, 'repo')
mkdirSync(join(repo, 'tests'), { recursive: true })
writeFileSync(join(repo, 'requirements.txt'), 'six==1.16.0\nurllib3==1.24.1\n')
writeFileSync(
  join(repo, 'tests', 'test_deps.py'),
  'import six, urllib3\n\ndef test_six():\n    assert six.PY3\n\ndef test_urllib3():\n    assert urllib3.__version__ == "1.24.1"\n',
)

async function connect(name) {
  const client = new Client({ name: 'check-sandbox-mcp', version: '0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [join(MCP_DIR, name, 'dist', 'index.js')] }))
  return client
}

const scanner = await connect('scanner-mcp')
const testrunner = await connect('testrunner-mcp')

async function call(client, tool, args) {
  // 첫 Trivy DB 내려받기는 기본 제한(60초)보다 오래 걸릴 수 있다.
  const result = await client.callTool({ name: tool, arguments: args }, undefined, { timeout: 600_000 })
  const text = result.content[0].text
  console.log(`  ${tool} phase=${args.phase ?? '-'} → isError=${!!result.isError}`)
  return { isError: !!result.isError, body: result.isError ? text : JSON.parse(text) }
}

try {
  console.log('# scanner-mcp · testrunner-mcp 확인')

  // ① 스캔 — 실패한 스캔과 "취약점 없음"이 구분돼야 한다.
  const scan = await call(scanner, 'run_trivy', { repoPath: repo })
  assert.equal(scan.isError, false)
  assert.equal(scan.body.outcome, 'OK')
  assert.ok(scan.body.findings.some((one) => one.pkgName === 'urllib3'), '취약한 urllib3를 찾아야 한다')

  // ② 설치 전 테스트 — 의존성이 없으니 실패해야 한다. 통과로 새면 증명이 무의미해진다.
  const before = await call(testrunner, 'run_tests', { repoPath: repo, stack: 'python-pytest', phase: 'PRE_PATCH' })
  assert.equal(before.body.outcome, 'FAILED')

  // ③ 설치 → ④ 테스트
  const install = await call(testrunner, 'install', { repoPath: repo, stack: 'python-pytest', phase: 'PRE_PATCH' })
  assert.equal(install.body.outcome, 'OK')

  const after = await call(testrunner, 'run_tests', { repoPath: repo, stack: 'python-pytest', phase: 'PRE_PATCH' })
  assert.equal(after.body.outcome, 'PASSED')
  assert.equal(after.body.total, 2)
  assert.equal(after.body.failed, 0)

  // ⑤ 잘못된 입력은 검사 결과가 아니라 호출 오류(isError)로 거절한다.
  assert.equal((await call(testrunner, 'install', { repoPath: repo, stack: 'node-jest', phase: 'PRE_PATCH' })).isError, true)
  assert.equal((await call(scanner, 'run_trivy', { repoPath: join(work, 'none') })).isError, true)

  console.log('통과: scanner-mcp·testrunner-mcp가 계약대로 동작한다.')
} finally {
  await scanner.close()
  await testrunner.close()
  rmSync(work, { recursive: true, force: true })
}
