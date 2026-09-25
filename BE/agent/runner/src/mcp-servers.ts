/**
 * MCP 서버 배선 — agents.ts가 이름으로만 선언한 서버를 Agent SDK가 요구하는
 * 실행 설정(Record<string, McpServerConfig>)으로 바꾼다.
 *
 * agents.ts는 "어느 단계가 어느 서버를 쓰는가"만 선언하고, "그 서버를 어떻게
 * 실행하는가"는 여기 둔다. 실행 방법이 바뀌어도 에이전트 정의는 손대지 않는다.
 *
 * 서버 이름(키)은 allowedTools의 `mcp__<서버>__<도구>`와 반드시 같아야 한다.
 * 키가 'scanner'이므로 도구는 mcp__scanner__run_trivy로 노출된다.
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk'
import type { AgentSpec } from './agents.js'

// 기본값은 이 파일 기준 상대 경로라 src/에서 돌리든 dist/에서 돌리든 BE/agent/mcp를
// 가리킨다. 배포 위치가 다르면 VIBEGUARD_MCP_DIR로 덮어쓴다(하드코딩하지 않는다).
const MCP_DIR = process.env.VIBEGUARD_MCP_DIR ?? fileURLToPath(new URL('../../mcp', import.meta.url))

/** 빌드 결과물의 위치. 서버는 `npm run build` 이후에만 뜬다. */
const entry = (packageName: string) => join(MCP_DIR, packageName, 'dist', 'index.js')

// 샌드박스 컨테이너의 자체 제한이 300초다(BE/agent/sandbox/runner.py의 DEFAULT_TIMEOUT).
// MCP의 timeout은 진행 알림으로 늘어나지 않는 절대 상한이라, 컨테이너 제한보다 짧으면
// 러너가 결과를 만들어 두고도 호출이 먼저 끊긴다. 컨테이너 제한 + 여유 30초로 잡는다.
// 여유분은 컨테이너 기동과 junit·Trivy 보고서 파싱 몫이다.
// scanner가 이 값을 그대로 쓰는 이유는 첫 Trivy DB 내려받기 때문이다. 캐시가 차 있으면
// 1초지만, 처음이거나 느린 회선에서는 DB(압축 113MB)를 받느라 컨테이너 제한에 근접한다.
const CONTAINER_TIMEOUT_MS = 300_000
const SANDBOX_TIMEOUT_MS = CONTAINER_TIMEOUT_MS + 30_000

// advisory는 컨테이너를 쓰지 않는다. 내부 HTTP 요청 제한이 20초이고 도구 하나가
// 여러 번 조회할 수 있어 60초면 충분하다.
const ADVISORY_TIMEOUT_MS = 60_000

/**
 * 자식 프로세스에 넘길 환경변수.
 *
 * PATH는 샌드박스 러너가 `docker`를 찾는 데 필요하고, HOME은 Trivy·pip·advisory
 * 캐시 위치(~/.cache/vibeguard)를 정하는 데 필요하다. 상속에 기대지 않고 명시한다.
 */
function childEnv(extraKeys: string[] = []): Record<string, string> {
  const env: Record<string, string> = {}
  for (const key of ['PATH', 'HOME', 'LANG', 'TZ', ...extraKeys]) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  return env
}

/** 우리가 직접 만든 MCP 서버 3종. github-mcp는 공식 서버라 여기 없다. */
const SERVERS: Record<string, McpServerConfig> = {
  scanner: {
    type: 'stdio',
    command: process.execPath,
    args: [entry('scanner-mcp')],
    env: childEnv(),
    timeout: SANDBOX_TIMEOUT_MS,
  },
  testrunner: {
    type: 'stdio',
    command: process.execPath,
    args: [entry('testrunner-mcp')],
    env: childEnv(),
    timeout: SANDBOX_TIMEOUT_MS,
  },
  advisory: {
    type: 'stdio',
    command: process.execPath,
    args: [entry('advisory-mcp')],
    // 두 키는 없어도 동작한다. 있으면 외부 조회 요청 제한만 느슨해진다.
    env: childEnv(['NVD_API_KEY', 'GITHUB_TOKEN']),
    timeout: ADVISORY_TIMEOUT_MS,
  },
}

/**
 * 해당 단계에 필요한 서버만 골라 준다. 세션마다 최소한만 주입하는 것이
 * allowedTools 화이트리스트와 같은 목적이다(PRD §5.3).
 */
export function mcpServersFor(agent: AgentSpec): Record<string, McpServerConfig> {
  const chosen: Record<string, McpServerConfig> = {}
  for (const name of agent.mcpServers) {
    const config = SERVERS[name]
    // 아직 배선하지 않은 서버(github)는 조용히 건너뛴다. 없는 것을 넘기면 세션이 죽는다.
    if (!config) continue
    chosen[name] = config
  }
  return chosen
}
