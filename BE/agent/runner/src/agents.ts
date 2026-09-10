/**
 * Agent 1~4 세션 정의 (PRD §5.3, §6).
 *
 * 핵심 설계: 서브에이전트가 아니라 각 단계를 독립 최상위 세션으로 구동한다.
 * 각 세션에는 그 단계에 필요한 MCP 서버만 주입하고 allowedTools로 화이트리스트를 건다.
 * (서브에이전트로 구현하면 MCP 툴이 조용히 사라지고 환각이 발생 — R1)
 */

/** 파이프라인 진행 단계와 매핑되는 스캔 상태(ScanStatus 문자열과 일치). */
export type StageStatus = 'SCANNING' | 'VERIFYING' | 'REGRESSION_CHECK' | 'PR_CREATING'

export interface AgentSpec {
  /** Agent 번호 1~4. */
  agentNo: number
  /** 진행 상태(서버 상태머신과 매핑). */
  stage: StageStatus
  /** 사람이 읽는 단계명. */
  label: string
  /** 이 세션에 주입할 MCP 서버 이름 목록 (#8에서 실제 config 연결). */
  mcpServers: string[]
  /** 허용 툴 화이트리스트 (mcp__<server>__<tool> 형식 + 필요한 내장 툴). */
  allowedTools: string[]
  /** 세션 최대 턴 수. */
  maxTurns: number
}

/**
 * MVP 파이프라인의 4개 에이전트 정의.
 * allowedTools의 MCP 툴 이름은 자체 MCP 서버(#8) 구현과 일치해야 한다.
 */
export const AGENTS: AgentSpec[] = [
  {
    agentNo: 1,
    stage: 'SCANNING',
    label: 'Scanner (SCA)',
    mcpServers: ['scanner'],
    // 방향 전환 v2: SCA만. Trivy 단독(OSV-Scanner 이중 실행·Semgrep(SAST) 제거).
    allowedTools: [
      'mcp__scanner__run_trivy',
      'Read',
      'Grep',
      'Glob',
    ],
    maxTurns: 12,
  },
  {
    agentNo: 2,
    stage: 'VERIFYING',
    label: 'Verifier',
    mcpServers: ['advisory'],
    allowedTools: [
      'mcp__advisory__lookup_cve',
      'mcp__advisory__query_osv',
      'mcp__advisory__github_advisory',
      'mcp__advisory__resolve_fixed_version',
      'Read',
      'Grep',
    ],
    maxTurns: 12,
  },
  {
    agentNo: 3,
    stage: 'REGRESSION_CHECK',
    label: 'Regression Checker',
    mcpServers: ['testrunner'],
    // 방향 전환 v2: 재현 테스트 생성 없음. 설치(②)→테스트(③) 패치 전후.
    // 패치는 매니페스트 버전 한 줄 수정만(Edit), 코드 리팩토링 없음.
    allowedTools: [
      'mcp__testrunner__install',
      'mcp__testrunner__run_tests',
      'Read',
      'Edit',
      'Grep',
      'Glob',
    ],
    maxTurns: 20,
  },
  {
    agentNo: 4,
    stage: 'PR_CREATING',
    label: 'PR Author',
    mcpServers: ['github'],
    allowedTools: [
      'mcp__github__create_branch',
      'mcp__github__create_or_update_file',
      'mcp__github__create_pull_request',
      'Read',
    ],
    maxTurns: 12,
  },
]
