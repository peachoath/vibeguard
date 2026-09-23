/**
 * 런너 설정 — 환경변수 로드 (BE/agent/.env).
 * 시크릿은 로그에 남기지 않는다 (NFR-S3).
 */
export interface RunnerConfig {
  port: number
  apiBaseUrl: string
  callbackSecret: string
  anthropicApiKey: string | undefined
  /** 에이전트 세션이 쓰는 모델. 별칭('haiku'·'sonnet'·'opus') 또는 모델 ID. */
  agentModel: string
  /** 세션 1개당 비용 상한(USD). 넘으면 SDK가 세션을 중단한다. */
  agentMaxBudgetUsd: number
}

export function loadConfig(): RunnerConfig {
  return {
    port: Number(process.env.RUNNER_PORT ?? 4000),
    // Spring Boot API 서버 주소. 콜백은 {apiBaseUrl}/api/v1/internal/runner/events 로 전송.
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:8080',
    callbackSecret: process.env.RUNNER_CALLBACK_SECRET ?? 'dev-secret-change-me',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    agentModel: process.env.AGENT_MODEL ?? 'sonnet',
    agentMaxBudgetUsd: Number(process.env.AGENT_MAX_BUDGET_USD ?? 0.5),
  }
}
