/**
 * 배선 확인 — 러너가 각 에이전트 세션에 MCP 서버를 제대로 주입하는지 본다.
 *
 * mcp/scripts/의 두 스크립트가 "서버가 제 일을 하는가"를 본다면, 이 스크립트는
 * "러너가 어느 세션에 어느 서버를 물려 주는가"를 본다. 서버의 동작은 보지 않는다.
 *
 * 실행: node runner/scripts/check-mcp-wiring.mjs   (BE/agent에서)
 *
 * 준비물: `npm run build` 로 러너와 MCP 서버의 dist/ 생성.
 * 도커·네트워크·API 키는 필요 없다. 서버를 띄워 툴 목록만 받는다.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const RUNNER_DIST = join(import.meta.dirname, '..', 'dist')

function skip(reason) {
  console.log(`건너뜀: ${reason}`)
  process.exit(0)
}

for (const file of ['agents.js', 'mcp-servers.js']) {
  if (!existsSync(join(RUNNER_DIST, file))) skip(`runner/dist/${file} 가 없다. 먼저 npm run build 를 실행한다`)
}

const { AGENTS } = await import(join(RUNNER_DIST, 'agents.js'))
const { mcpServersFor } = await import(join(RUNNER_DIST, 'mcp-servers.js'))

for (const [, config] of Object.entries(mcpServersFor({ mcpServers: ['scanner', 'testrunner', 'advisory'] }))) {
  if (!existsSync(config.args[0])) skip(`${config.args[0]} 가 없다. 먼저 npm run build 를 실행한다`)
}

/** 서버를 띄워 툴 이름을 받는다. 도구를 호출하지는 않는다. */
async function toolsOf(config) {
  const client = new Client({ name: 'check-mcp-wiring', version: '0' })
  await client.connect(new StdioClientTransport({ command: config.command, args: config.args, env: config.env }))
  const { tools } = await client.listTools()
  await client.close()
  return tools.map((one) => one.name)
}

console.log('# MCP 배선 확인')
const counts = {}

for (const agent of AGENTS) {
  const servers = mcpServersFor(agent)
  console.log(`\nAgent ${agent.agentNo} ${agent.label} — 선언 [${agent.mcpServers}] → 배선 [${Object.keys(servers)}]`)

  const exposed = []
  for (const [name, config] of Object.entries(servers)) {
    const tools = await toolsOf(config)
    counts[name] = tools.length
    exposed.push(...tools.map((tool) => `mcp__${name}__${tool}`))
    console.log(`  [${name}] 기동 OK · 툴 ${tools.length}개 · timeout ${config.timeout / 1000}초`)
  }
  console.log(`  노출된 도구: ${exposed.join(', ') || '(없음)'}`)

  // 화이트리스트와 실제 노출이 어긋나면 에이전트가 없는 도구를 부르거나,
  // 단계에 필요 없는 도구를 보게 된다. 양쪽 모두 배선 오류다.
  // github-mcp는 아직 우리 배선 대상이 아니라 대조에서 뺀다.
  const declared = agent.allowedTools.filter((one) => one.startsWith('mcp__') && !one.startsWith('mcp__github__'))
  assert.deepEqual(
    declared.filter((one) => !exposed.includes(one)),
    [],
    `Agent ${agent.agentNo}: allowedTools에 있는 도구가 실제로는 없다`,
  )
  assert.deepEqual(
    exposed.filter((one) => !agent.allowedTools.includes(one)),
    [],
    `Agent ${agent.agentNo}: 화이트리스트에 없는 도구가 노출된다`,
  )
}

// 단계 격리: 검증 단계에 테스트 실행 도구가 보이면 안 된다(PRD §5.3).
const verifier = AGENTS.find((one) => one.agentNo === 2)
const verifierTools = []
for (const [name, config] of Object.entries(mcpServersFor(verifier))) {
  verifierTools.push(...(await toolsOf(config)).map((tool) => `mcp__${name}__${tool}`))
}
assert.ok(!verifierTools.some((one) => one.includes('run_tests')), 'Agent 2에 run_tests가 보이면 안 된다')
assert.ok(!verifierTools.some((one) => one.includes('run_trivy')), 'Agent 2에 run_trivy가 보이면 안 된다')

console.log('\n서버별 툴 개수:', JSON.stringify(counts))
assert.deepEqual(counts, { scanner: 1, advisory: 4, testrunner: 2 })
console.log('통과: 러너가 단계별로 필요한 MCP 서버만 주입한다.')
