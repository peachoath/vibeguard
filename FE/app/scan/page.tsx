'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'

type ScanStatus =
  | 'QUEUED'
  | 'CLONING'
  | 'SCANNING'
  | 'VERIFYING'
  | 'REGRESSION_CHECK'
  | 'AWAITING_REVIEW'
  | 'PR_CREATING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REGRESSION_BLOCKED'

interface SseEvent {
  scanId: string
  status: ScanStatus
  progress: number
  message: string
  logLine?: string
}

const STATUS_PROGRESS: Record<string, number> = {
  QUEUED: 0,
  CLONING: 5,
  SCANNING: 22,
  VERIFYING: 44,
  REGRESSION_CHECK: 64,
  AWAITING_REVIEW: 82,
  PR_CREATING: 90,
  COMPLETED: 100,
  FAILED: 100,
  REGRESSION_BLOCKED: 100,
}

const pipeline = [
  { code: 'A1', title: '탐지기', detail: 'Trivy', description: 'Trivy SCA 취약점 탐지', threshold: 0 },
  { code: 'A2', title: '검증기', detail: 'DB 대조', description: 'NVD · OSV · GHSA 교차 검증', threshold: 22 },
  { code: 'A3', title: '회귀 검증', detail: '전후 비교', description: '설치→테스트→상향 · 패치 전후 회귀 검증', threshold: 44 },
  { code: 'A4', title: 'PR 작성', detail: 'PR 생성', description: '회귀 통과 후 PR 생성', threshold: 82 },
] as const

function ScanPageInner() {
  const searchParams = useSearchParams()
  const scanId = searchParams.get('id')

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<ScanStatus>('QUEUED')
  const [logs, setLogs] = useState<Array<{ time: string; agent: string; message: string; tone: string }>>([])
  const [repoName, setRepoName] = useState('—')
  const esRef = useRef<EventSource | null>(null)

  // SSE 연결 (실제 scanId가 있을 때)
  useEffect(() => {
    if (!scanId) {
      // 데모: 로컬 애니메이션
      const duration = 8000
      const startedAt = performance.now()
      let frame = 0
      const update = (now: number) => {
        const next = Math.min(100, Math.floor(((now - startedAt) / duration) * 100))
        setProgress(next)
        if (next < 100) frame = requestAnimationFrame(update)
        else setStatus('COMPLETED')
      }
      frame = requestAnimationFrame(update)
      return () => cancelAnimationFrame(frame)
    }

    const es = new EventSource(`/api/v1/scans/${scanId}/stream`, { withCredentials: true })
    esRef.current = es

    es.addEventListener('scan-update', (e) => {
      const data: SseEvent = JSON.parse(e.data)
      setProgress(STATUS_PROGRESS[data.status] ?? 0)
      setStatus(data.status)
      if (data.logLine) {
        const d = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        setLogs((prev) => [
          ...prev.slice(-20),
          { time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`, agent: 'A', message: data.logLine!, tone: '' },
        ])
      }
    })

    es.addEventListener('scan-complete', (e) => {
      const data: SseEvent = JSON.parse(e.data)
      setProgress(100)
      setStatus(data.status)
      es.close()
    })

    es.onerror = () => es.close()

    return () => es.close()
  }, [scanId])

  const isComplete = progress === 100
  const remaining = Math.max(0, Math.ceil((100 - progress) * 0.08))
  const stage = progress < 22 ? 'A1 탐지 단계' : progress < 44 ? 'A2 검증 단계' : progress < 82 ? 'A3 회귀 검증 단계' : progress < 100 ? 'A4 PR 작성 단계' : status === 'REGRESSION_BLOCKED' ? '회귀 차단됨' : '검사가 완료되었습니다'

  // 데모 로그 (scanId 없을 때)
  const demoActivity = [
    { time: '16:31:02', agent: 'A1', message: 'Trivy 스캔 완료 · 취약 라이브러리 14건', tone: '' },
    { time: '16:31:18', agent: 'A2', message: 'NVD · OSV · GHSA 교차 검증 완료', tone: '' },
    { time: '16:31:36', agent: 'A2', message: 'pyyaml 최소 안전 버전 5.4 확인', tone: 'info' },
    { time: '16:31:52', agent: 'A3', message: '패치 전 기준 테스트 24/24 PASS', tone: 'success' },
    { time: '16:32:03', agent: 'A3', message: 'pyyaml 5.1 → 5.4 매니페스트 한 줄 변경', tone: 'info' },
    { time: '16:32:29', agent: 'A3', message: '패치 후 기준 테스트 24/24 PASS', tone: 'success' },
    { time: '16:32:47', agent: 'A4', message: '변경 사항과 검증 근거 정리 완료', tone: 'info' },
    { time: '16:32:56', agent: 'A4', message: '보안 패치 PR 생성 완료', tone: 'success' },
  ]

  const displayLogs = scanId ? logs : demoActivity.slice(0, Math.ceil((progress / 100) * demoActivity.length))

  return (
    <AuthGuard>
      <main className="scan-page">
        <AppHeader active="scan" />

        <ScreenContent>
          <section className="scan-page-heading">
            <div>
              <h1>실시간 검사</h1>
              <p>{repoName !== '—' ? `${repoName} / main` : '검사가 실시간으로 진행 중입니다.'}</p>
            </div>
            <div className="heading-buttons">
              <button>검사 정책</button>
              <Link href="/repositories">전체 저장소</Link>
            </div>
          </section>

          <div className="live-scan-layout">
            <div className="live-scan-main">
              <section className="progress-card" aria-live="polite">
                <Image className="detection-gif" src="/detect.gif" alt="보안 검사 중" width={188} height={140} unoptimized priority />
                <div className="progress-number">
                  <span>진행도</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress-detail">
                  <p>{stage} {!isComplete && '· 진행 중…'}</p>
                  <div className="progress-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <b>{isComplete ? '검사 완료' : `예상 남은 시간 ${remaining}초`}</b>
                </div>
              </section>

              <section className="pipeline-card">
                <div className="section-title">
                  <h2>멀티 에이전트 파이프라인</h2>
                  <p>독립 세션 + 단계별 MCP 화이트리스트</p>
                </div>
                <div className="pipeline-grid">
                  {pipeline.map((item, index) => {
                    const nextThreshold = pipeline[index + 1]?.threshold ?? 101
                    const isActive = progress >= item.threshold && progress < nextThreshold
                    const isDone = progress >= nextThreshold || isComplete
                    return (
                      <article
                        className={`pipeline-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        key={item.code}
                      >
                        <b>{item.code}</b>
                        <strong>{item.title}</strong>
                        <em>{isDone ? '완료' : isActive ? '진행 중' : '대기'}</em>
                      </article>
                    )
                  })}
                </div>
              </section>

              <section className="activity-card">
                <div className="activity-heading">
                  <h2>실시간 활동</h2>
                  <span>{isComplete ? 'DONE' : 'LIVE'}</span>
                </div>
                <div className="activity-list">
                  {displayLogs.map((item, i) => (
                    <div className={`activity-row ${item.tone}`} key={`${item.time}-${i}`}>
                      <time>{item.time}</time>
                      <b>{item.agent}</b>
                      <span>{item.message}</span>
                    </div>
                  ))}
                </div>
                <p className="activity-footer">테스트 컨테이너 · network=none · read-only · cap-drop=ALL · 300s timeout</p>
              </section>
            </div>

            <aside className="verification-status">
              <div>
                <h2>{isComplete ? '검증 완료' : '검증 중…'}</h2>
                <h3>보안 패치 검증</h3>
                <p>공식 DB 교차 검증 · requirements.txt</p>
              </div>
              <dl>
                <div><dt>취약 버전 확인</dt><dd className={progress >= 22 ? 'complete' : 'working'}>완료</dd></div>
                <div><dt>패치 전 테스트</dt><dd className={progress >= 44 ? 'complete' : progress >= 22 ? 'working' : 'waiting'}>{progress >= 44 ? '24/24 PASS' : progress >= 22 ? '실행 중' : '대기'}</dd></div>
                <div><dt>패치 후 테스트</dt><dd className={progress >= 82 ? 'complete' : progress >= 44 ? 'working' : 'waiting'}>{progress >= 82 ? '24/24 PASS' : progress >= 44 ? '실행 중' : '대기'}</dd></div>
                <div><dt>PR 생성</dt><dd className={isComplete ? 'complete' : 'waiting'}>{isComplete ? '완료' : '대기'}</dd></div>
              </dl>
              {isComplete && scanId ? (
                <Link className="result-button" href={`/results?scanId=${scanId}`} scroll={false}>
                  결과 보기
                </Link>
              ) : isComplete ? (
                <Link className="result-button" href="/results" scroll={false}>
                  결과 보기
                </Link>
              ) : (
                <button className="result-button" disabled>결과 보기</button>
              )}
            </aside>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanPageInner />
    </Suspense>
  )
}
