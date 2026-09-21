/**
 * VibeGuard Agent Runner (PRD §5.2)
 *
 * Spring Boot API 서버로부터 HTTP로 스캔 작업을 위임받아,
 * Agent 1~4를 각각 독립 Claude Agent SDK 세션으로 순차 구동한다(Pipeline).
 * 진행 상황은 HMAC 서명 콜백으로 서버에 통지한다(NFR-S4).
 *
 * ⚠️ 핵심 설계 (PRD §5.3, R1): Agent 툴 기반 서브에이전트를 쓰면 MCP 툴이
 * 조용히 사라진다. 따라서 각 단계는 반드시 최상위 세션으로 구동한다(agents.ts/pipeline.ts).
 */
import express from 'express'
import { CallbackClient } from './callback.js'
import { loadConfig } from './config.js'
import { Pipeline, type ScanJob } from './pipeline.js'

const config = loadConfig()
const callback = new CallbackClient(config.apiBaseUrl, config.callbackSecret)
const pipeline = new Pipeline(config, callback)

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vibeguard-runner' })
})

// Spring Boot → Runner: 스캔 작업 위임. 즉시 202로 응답하고 파이프라인은 비동기로 구동.
app.post('/scans', (req, res) => {
  const { scanId, repoUrl, ref } = req.body ?? {}
  if (!scanId || !repoUrl) {
    return res.status(400).json({ error: 'scanId, repoUrl required' })
  }
  const job: ScanJob = { scanId, repoUrl, ref: ref ?? '' }
  console.log(`[runner] queued scan ${scanId} for ${repoUrl}@${job.ref || 'default'}`)

  // 응답을 막지 않도록 파이프라인은 백그라운드로 실행.
  void pipeline.run(job)

  return res.status(202).json({ scanId, status: 'QUEUED' })
})

app.listen(config.port, () => {
  console.log(`[runner] listening on :${config.port}`)
})
