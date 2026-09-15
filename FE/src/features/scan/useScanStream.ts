import { useEffect, useRef, useState } from 'react'
import { API_BASE } from '@/lib/api'
import type { SseDoneEvent, SseFindingEvent, SseLogEvent, SseStageEvent } from './types'

export type ConnectionStatus = 'connecting' | 'open' | 'done' | 'error'

export interface StageTime {
  startedAt: number
  /** DONE 이벤트 수신 시 설정. 단위 ms. */
  duration?: number
}

export interface StreamState {
  connectionStatus: ConnectionStatus
  /** stage name → 가장 최근 stage 이벤트. RUNNING→DONE 순으로 덮어쓴다. */
  stages: Record<string, SseStageEvent>
  /** stage name → 시작/종료 타임스탬프. Pipeline 소요 시간 표시에 사용. */
  stageTimes: Record<string, StageTime>
  logs: SseLogEvent[]
  findings: SseFindingEvent[]
  done: SseDoneEvent | null
  /** REGRESSION_CHECK 완료 후 사용자 검토 대기 여부. */
  awaitingReview: boolean
  /** 현재까지 재연결 시도 횟수. 최초 연결 중에는 0. */
  retryCount: number
  /** SSE 연결 성립 시점(ms). 로그 상대 타임스탬프 기준. */
  streamStartedAt: number | null
}

const MAX_LOGS = 2000
export const MAX_RETRIES = 5

/**
 * GET /api/v1/scans/{scanId}/stream SSE 구독 훅 (F-04).
 * 연결 실패 시 지수 백오프로 최대 5회 재시도. done 이벤트 수신 또는 언마운트 시 스트림 닫음.
 * withCredentials: true — 크로스 오리진에서도 세션 쿠키 전송 (API Spec §5.3).
 */
export function useScanStream(scanId: string): StreamState {
  const [state, setState] = useState<StreamState>({
    connectionStatus: 'connecting',
    stages: {},
    stageTimes: {},
    logs: [],
    findings: [],
    done: null,
    awaitingReview: false,
    retryCount: 0,
    streamStartedAt: null,
  })

  // 최신 setState 참조를 ref로 유지 — 클로저 내 stale 방지
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    let dead = false
    let retries = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const openConnections: EventSource[] = []

    function connect() {
      if (dead) return

      const es = new EventSource(`${API_BASE}/scans/${scanId}/stream`, {
        withCredentials: true,
      })
      openConnections.push(es)

      es.onopen = () => {
        retries = 0
        setState(s => ({
          ...s,
          connectionStatus: 'open',
          retryCount: 0,
          streamStartedAt: s.streamStartedAt ?? Date.now(),
        }))
      }

      es.addEventListener('stage', (e: MessageEvent) => {
        const p: SseStageEvent = JSON.parse(e.data)
        const now = Date.now()
        setState(s => {
          const stageTimes = { ...s.stageTimes }
          if (p.status === 'RUNNING') {
            stageTimes[p.stage] = { startedAt: now }
          } else if (p.status === 'DONE' && stageTimes[p.stage]) {
            stageTimes[p.stage] = {
              ...stageTimes[p.stage],
              duration: now - stageTimes[p.stage].startedAt,
            }
          }
          return { ...s, stages: { ...s.stages, [p.stage]: p }, stageTimes }
        })
      })

      es.addEventListener('log', (e: MessageEvent) => {
        const p: SseLogEvent = JSON.parse(e.data)
        setState(s => ({
          ...s,
          logs:
            s.logs.length >= MAX_LOGS
              ? [...s.logs.slice(1), p]
              : [...s.logs, p],
        }))
      })

      es.addEventListener('finding', (e: MessageEvent) => {
        const p: SseFindingEvent = JSON.parse(e.data)
        setState(s => ({ ...s, findings: [...s.findings, p] }))
      })

      es.addEventListener('review', () => {
        setState(s => ({ ...s, awaitingReview: true }))
      })

      es.addEventListener('done', (e: MessageEvent) => {
        const p: SseDoneEvent = JSON.parse(e.data)
        dead = true
        es.close()
        setState(s => ({ ...s, done: p, connectionStatus: 'done', awaitingReview: false }))
      })

      es.onerror = () => {
        es.close()
        if (dead) return
        if (retries >= MAX_RETRIES) {
          setState(s => ({ ...s, connectionStatus: 'error' }))
          dead = true
          return
        }
        const delay = Math.min(1000 * 2 ** retries, 30_000)
        retries++
        setState(s => ({ ...s, connectionStatus: 'connecting', retryCount: retries }))
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      dead = true
      openConnections.forEach(es => es.close())
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [scanId])

  return state
}
