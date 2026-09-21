/**
 * API Server로의 HMAC 콜백 발신 (PRD NFR-S4, API Spec §8).
 *
 * 서버(RunnerCallbackController)와 동일 규약:
 *   - 서명 대상은 본문 raw bytes
 *   - 헤더 X-VibeGuard-Signature: sha256=<hex(HMAC-SHA256(body, secret))>
 *   - 헤더 X-VibeGuard-Timestamp: 유닉스 ms (서버 허용 오차 ±5분)
 */
import { createHmac } from 'node:crypto'

export type EventKind = 'stage' | 'log' | 'finding' | 'done'

export interface RunnerEvent {
  scanId: string
  kind: EventKind
  stage?: string
  agent?: number
  status?: string
  payload?: Record<string, unknown>
}

export class CallbackClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly secret: string,
  ) {}

  /** 이벤트를 서버로 전송. 실패는 로그만 남기고 파이프라인을 막지 않는다. */
  async send(event: RunnerEvent): Promise<void> {
    const body = Buffer.from(JSON.stringify(event), 'utf-8')
    const signature = 'sha256=' + createHmac('sha256', this.secret).update(body).digest('hex')
    const timestamp = String(Date.now())

    try {
      const res = await fetch(`${this.apiBaseUrl}/api/v1/internal/runner/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VibeGuard-Signature': signature,
          'X-VibeGuard-Timestamp': timestamp,
        },
        body,
      })
      if (!res.ok) {
        console.warn(`[callback] 서버 응답 ${res.status} scanId=${event.scanId} kind=${event.kind}`)
      }
    } catch (err) {
      console.warn(`[callback] 전송 실패 scanId=${event.scanId} kind=${event.kind}:`, (err as Error).message)
    }
  }

  stage(scanId: string, stage: string, agent: number, status: string, payload?: Record<string, unknown>) {
    return this.send({ scanId, kind: 'stage', stage, agent, status, payload })
  }

  log(scanId: string, agent: number, level: string, message: string) {
    return this.send({ scanId, kind: 'log', agent, payload: { level, message, ts: new Date().toISOString() } })
  }

  finding(scanId: string, payload: Record<string, unknown>) {
    return this.send({ scanId, kind: 'finding', payload })
  }

  done(scanId: string, status: string, payload?: Record<string, unknown>) {
    return this.send({ scanId, kind: 'done', status, payload })
  }
}
