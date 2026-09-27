/**
 * DRY_RUN 파이프라인 트리거 스크립트.
 * HMAC 서명을 자동 생성해 POST /scans 를 호출한다.
 *
 *   node runner/scripts/trigger-dry-run.mjs
 *   node runner/scripts/trigger-dry-run.mjs <scanId> <repoUrl>
 */
import { createHmac, randomUUID } from 'node:crypto'

const RUNNER_URL = process.env.RUNNER_URL ?? 'http://localhost:4000'
const SECRET = process.env.RUNNER_CALLBACK_SECRET ?? 'dev-secret-change-me'

const scanId = process.argv[2] ?? randomUUID()
const repoUrl = process.argv[3] ?? 'https://github.com/shinu61/vibeguard-seed-python'
const ref = process.argv[4] ?? ''

const bodyStr = JSON.stringify({ scanId, repoUrl, ref })
const rawBody = Buffer.from(bodyStr, 'utf-8')
const signature = 'sha256=' + createHmac('sha256', SECRET).update(rawBody).digest('hex')
const timestamp = String(Date.now())

console.log(`\n🚀 triggering dry-run scan`)
console.log(`   scanId  : ${scanId}`)
console.log(`   repoUrl : ${repoUrl}`)
console.log(`   runner  : ${RUNNER_URL}\n`)

const res = await fetch(`${RUNNER_URL}/scans`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-VibeGuard-Signature': signature,
    'X-VibeGuard-Timestamp': timestamp,
  },
  body: bodyStr,
})

const data = await res.json()
console.log(`status : ${res.status}`)
console.log(`body   :`, data)

if (res.status === 202) {
  console.log(`\n✅ pipeline started — watch runner logs for stage transitions`)
  console.log(`   Spring Boot SSE: GET /api/v1/scans/${scanId}/stream`)
}
