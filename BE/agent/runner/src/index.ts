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
import { createHmac, timingSafeEqual } from 'node:crypto'
import express from 'express'
import { CallbackClient } from './callback.js'
import { loadConfig } from './config.js'
import { Pipeline, type ScanJob } from './pipeline.js'

const config = loadConfig()
const callback = new CallbackClient(config.apiBaseUrl, config.callbackSecret)
const pipeline = new Pipeline(config, callback)

/** GitHub repository URL 형식 검증 — 임의 외부 주소 실행 방지 (NFR-S6). */
const GITHUB_REPO_URL_RE = /^https:\/\/github\.com\/[\w.\-]+\/[\w.\-]+(\.git)?$/

/** 재전송 방지 허용 오차: ±5분 (RunnerCallbackController와 동일). */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000

function verifyHmac(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature || !signature.startsWith('sha256=')) return false
  const expected = 'sha256=' + createHmac('sha256', config.callbackSecret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf-8'), Buffer.from(signature, 'utf-8'))
  } catch {
    return false
  }
}

function isFreshTimestamp(ts: string | undefined): boolean {
  if (!ts) return false
  const parsed = Number(ts)
  if (!Number.isFinite(parsed)) return false
  return Math.abs(Date.now() - parsed) <= TIMESTAMP_TOLERANCE_MS
}

const app = express()

// /health는 서명 불필요
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vibeguard-runner' })
})

// POST /scans: raw body로 수신해 HMAC 검증 후 JSON 파싱
app.post(
  '/scans',
  express.raw({ type: 'application/json', limit: '64kb' }),
  (req, res) => {
    const rawBody = req.body as Buffer
    const signature = req.headers['x-vibeguard-signature'] as string | undefined
    const timestamp = req.headers['x-vibeguard-timestamp'] as string | undefined

    if (!isFreshTimestamp(timestamp)) {
      console.warn('[runner] 타임스탬프 누락 또는 만료')
      return res.status(401).json({ error: 'Timestamp missing or expired' })
    }
    if (!verifyHmac(rawBody, signature)) {
      console.warn('[runner] HMAC 서명 검증 실패')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    let body: { scanId?: string; repoUrl?: string; ref?: string; githubToken?: string }
    try {
      body = JSON.parse(rawBody.toString('utf-8'))
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }

    const { scanId, repoUrl, ref, githubToken } = body
    if (!scanId || !repoUrl) {
      return res.status(400).json({ error: 'scanId, repoUrl required' })
    }

    // repoUrl이 GitHub repository URL 형식인지 검증 — 임의 외부 주소 실행 방지
    if (!GITHUB_REPO_URL_RE.test(repoUrl)) {
      console.warn(`[runner] 허용되지 않는 repoUrl 형식: ${repoUrl}`)
      return res.status(400).json({ error: 'repoUrl must be a GitHub repository URL' })
    }

    const job: ScanJob = { scanId, repoUrl, ref: ref ?? '', githubToken }
    console.log(`[runner] queued scan ${scanId} for ${repoUrl}@${job.ref || 'default'}`)

    void pipeline.run(job)
    return res.status(202).json({ scanId, status: 'QUEUED' })
  },
)

app.listen(config.port, () => {
  console.log(`[runner] listening on :${config.port}`)
})
