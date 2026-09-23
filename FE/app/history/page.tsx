'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'
import { apiFetch } from '@/lib/api'

interface Scan {
  id: string
  repositoryName: string
  branch: string
  status: string
  startedAt: string
  completedAt: string | null
  findingCount: number
  passedTests: number | null
  totalTests: number | null
  prNumber: number | null
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  COMPLETED: { label: '완료', tone: 'complete' },
  REGRESSION_BLOCKED: { label: '회귀 차단', tone: 'blocked' },
  INSTALL_FAILED: { label: '설치 실패', tone: 'failed' },
  QUEUED: { label: '대기 중', tone: 'untested' },
  SCANNING: { label: '스캔 중', tone: 'untested' },
  VERIFYING: { label: '검증 중', tone: 'untested' },
  NO_TESTS: { label: '테스트 없음', tone: 'untested' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (d.toDateString() === today.toDateString()) return `오늘 ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `어제 ${time}`
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`
}

function fmtDuration(start: string, end: string | null) {
  if (!end) return '진행 중'
  const secs = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)
  const mins = Math.floor(secs / 60)
  return mins > 0 ? `${mins}분 ${secs % 60}초` : `${secs}초`
}

export default function HistoryPage() {
  const [range, setRange] = useState('30')
  const [status, setStatus] = useState('all')
  const [auditOpen, setAuditOpen] = useState(false)

  const { data: scans = [], isLoading } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiFetch<Scan[]>('/scans'),
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<{ unresolvedFindings: number; regressionPassed: number; regressionBlocked: number; prsCreated: number }>('/dashboard/stats'),
  })

  const visibleScans = useMemo(
    () => scans.filter((s) => status === 'all' || s.status === status.toUpperCase()),
    [scans, status],
  )

  const completedCount = scans.filter((s) => s.status === 'COMPLETED').length
  const blockedCount = scans.filter((s) => s.status === 'REGRESSION_BLOCKED').length
  const failedCount = scans.filter((s) => s.status === 'INSTALL_FAILED').length
  const cleanCount = scans.filter((s) => s.status === 'COMPLETED' && s.findingCount === 0).length

  function exportCsv() {
    const csv = [
      'time,repository,branch,status,findings,tests,pr,duration',
      ...visibleScans.map((s) =>
        [
          fmtDate(s.startedAt),
          s.repositoryName,
          s.branch,
          STATUS_META[s.status]?.label ?? s.status,
          s.findingCount,
          s.passedTests != null ? `${s.passedTests}/${s.totalTests}` : '—',
          s.prNumber ? `PR #${s.prNumber}` : '—',
          fmtDuration(s.startedAt, s.completedAt),
        ].join(','),
      ),
    ].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `vibeguard-history-${range}days.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <AuthGuard>
      <main className="history-page">
        <AppHeader active="history" />

        <ScreenContent>
          <section className="history-heading">
            <div>
              <h1>검사 이력</h1>
              <p>과거 검사와 패치 결과, PR 상태를 시간순으로 추적합니다.</p>
            </div>
            <div className="history-controls">
              <label>
                <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="조회 기간">
                  <option value="7">최근 7일</option>
                  <option value="30">최근 30일</option>
                  <option value="90">최근 90일</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="검사 상태">
                  <option value="all">전체 상태</option>
                  <option value="COMPLETED">완료</option>
                  <option value="REGRESSION_BLOCKED">회귀 차단</option>
                  <option value="NO_TESTS">테스트 없음</option>
                  <option value="INSTALL_FAILED">설치 실패</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <button type="button" onClick={exportCsv}>내보내기</button>
            </div>
          </section>

          <section className="history-summary" aria-label="검사 이력 요약">
            <article className="complete"><span>완료</span><strong>{completedCount}</strong><small>검증 완료</small></article>
            <article className="clean"><span>발견 없음</span><strong>{cleanCount}</strong><small>안전한 스캔</small></article>
            <article className="failed"><span>패치 실패</span><strong>{failedCount}</strong><small>수정 후보 없음</small></article>
            <article className="blocked"><span>회귀 차단</span><strong>{blockedCount}</strong><small>PR 생성 차단</small></article>
            <Link className="history-dashboard-link" href="/dashboard" scroll={false}>보안 현황</Link>
          </section>

          <section className="history-timeline-card">
            <div className="history-card-heading">
              <div>
                <h2>스캔 타임라인</h2>
                <p>완료·차단·증명 없음·설치 실패 등 종료 원인을 숨기지 않고 보존합니다.</p>
              </div>
              <button
                type="button"
                className={auditOpen ? 'active' : ''}
                onClick={() => setAuditOpen((v) => !v)}
              >
                감사 로그 보기
              </button>
            </div>
            {auditOpen && <p className="audit-message" role="status">모든 검사 상태 변경과 PR 생성 기록이 보존되고 있습니다.</p>}

            {isLoading ? (
              <p style={{ padding: '2rem', textAlign: 'center' }}>불러오는 중…</p>
            ) : (
              <div className="history-timeline" tabIndex={0} aria-label="스캔 이력 목록">
                {visibleScans.map((scan) => {
                  const meta = STATUS_META[scan.status] ?? { label: scan.status, tone: '' }
                  const tests = scan.passedTests != null ? `${scan.passedTests}/${scan.totalTests}` : '—'
                  const duration = fmtDuration(scan.startedAt, scan.completedAt)
                  return (
                    <article className={`history-row ${meta.tone}`} key={scan.id}>
                      <span className="timeline-dot" aria-hidden="true" />
                      <div className="history-repository">
                        <time>{fmtDate(scan.startedAt)}</time>
                        <strong>{scan.repositoryName} / {scan.branch}</strong>
                      </div>
                      <span className="history-state">{meta.label}</span>
                      <p>{scan.findingCount}건 · 테스트 {tests}</p>
                      <b>{duration}</b>
                      {scan.prNumber ? (
                        <a className="history-pr" href="https://github.com" target="_blank" rel="noreferrer">
                          PR #{scan.prNumber} 열기
                        </a>
                      ) : (
                        <span className="history-pr unavailable">PR 없음</span>
                      )}
                      <Link className="history-detail" href={`/results?scanId=${scan.id}`} scroll={false}>
                        상세 보기 →
                      </Link>
                    </article>
                  )
                })}
                {visibleScans.length === 0 && (
                  <p className="history-empty">선택한 상태의 검사 이력이 없습니다.</p>
                )}
              </div>
            )}
          </section>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}
