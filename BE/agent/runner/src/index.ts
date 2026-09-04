/**
 * VibeGuard Agent Runner (PRD §5.2)
 *
 * Spring Boot API 서버로부터 HTTP로 스캔 작업을 위임받아,
 * Agent 1~4를 각각 독립 Claude Agent SDK 세션으로 순차 구동한다.
 *
 * ⚠️ 핵심 설계 (PRD §5.3, R1): Agent 툴 기반 서브에이전트를 쓰면 MCP 툴이
 * 조용히 사라진다. 따라서 각 단계는 반드시 최상위 세션으로 구동하고,
 * 필요한 MCP 서버만 mcpServers에 주입하며 allowedTools로 화이트리스트한다.
 *
 * TODO(W2~W5): 상태머신(QUEUED→...→COMPLETED), HMAC 콜백, SSE 로그 브릿지 구현.
 */
import express from 'express'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vibeguard-runner' })
})

// Spring Boot → Runner: 스캔 작업 위임 (뼈대)
app.post('/scans', (req, res) => {
  const { scanId, repoUrl, ref } = req.body ?? {}
  if (!scanId || !repoUrl) {
    return res.status(400).json({ error: 'scanId, repoUrl required' })
  }
  // TODO: 파이프라인 구동 (Agent 1~4 세션)
  console.log(`[runner] queued scan ${scanId} for ${repoUrl}@${ref ?? 'default'}`)
  return res.status(202).json({ scanId, status: 'QUEUED' })
})

const port = Number(process.env.RUNNER_PORT ?? 4000)
app.listen(port, () => {
  console.log(`[runner] listening on :${port}`)
})
