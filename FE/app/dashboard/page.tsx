'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowUp, ChevronDown, ListFilter, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'
import { apiFetch } from '@/lib/api'

interface DashboardStats {
  unresolvedFindings: number
  criticalCount: number
  regressionPassed: number
  regressionTotal: number
  regressionBlocked: number
  prsCreated: number
}

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

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  COMPLETED: { label: '완료', tone: 'complete' },
  REGRESSION_BLOCKED: { label: '회귀 차단', tone: 'blocked' },
  INSTALL_FAILED: { label: '설치 실패', tone: 'failed' },
  QUEUED: { label: '대기 중', tone: 'untested' },
  SCANNING: { label: '스캔 중', tone: 'untested' },
  VERIFYING: { label: '검증 중', tone: 'untested' },
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

const trendSeries = [
  { short: '9/17', long: '9월 17일', rate: 62, passed: '8/13' },
  { short: '9/18', long: '9월 18일', rate: 44, passed: '7/16' },
  { short: '9/19', long: '9월 19일', rate: 38, passed: '6/16' },
  { short: '9/20', long: '9월 20일', rate: 74, passed: '11/15' },
  { short: '9/21', long: '9월 21일', rate: 51, passed: '10/20' },
  { short: '9/22', long: '9월 22일', rate: 60, passed: '12/20' },
  { short: '9/23', long: '9월 23일', rate: 84, passed: '16/19' },
]

export default function DashboardPage() {
  const [range, setRange] = useState('30')
  const [filtersVisible, setFiltersVisible] = useState(false)
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null)
  const [rateMenuOpen, setRateMenuOpen] = useState(false)

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiFetch<DashboardStats>('/dashboard/stats'),
  })

  const { data: scans } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiFetch<Scan[]>('/scans'),
  })

  const recentScans = (scans ?? []).slice(0, 3)
  const regressionRate = stats
    ? Math.round((stats.regressionPassed / (stats.regressionTotal || 1)) * 100)
    : 0

  function exportSummary() {
    const rows = recentScans.map((s) =>
      [
        s.repositoryName,
        STATUS_LABEL[s.status]?.label ?? s.status,
        s.findingCount,
        s.passedTests != null ? `${s.passedTests}/${s.totalTests}` : '—',
        s.prNumber ? `#${s.prNumber}` : '—',
        fmtRelative(s.startedAt),
      ].join(','),
    )
    const csv = ['repository,status,findings,tests,pr,time', ...rows].join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = `vibeguard-security-${range}days.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <AuthGuard>
      <main className="security-dashboard-page">
        <AppHeader active="dashboard" />

        <ScreenContent>
          <section className="security-heading">
            <div>
              <h1>보안 현황</h1>
              <p>VibeGuard의 현재 보안 현황과 검증된 패치 성과를 확인합니다.</p>
            </div>
            <div className="security-controls">
              <label>
                <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="보안 현황 기간">
                  <option value="7">최근 7일</option>
                  <option value="30">최근 30일</option>
                  <option value="90">최근 90일</option>
                </select>
                <ChevronDown size={13} />
              </label>
              <button type="button" onClick={exportSummary}>
                <ArrowUp size={13} /> 내보내기
              </button>
              <button type="button" className={filtersVisible ? 'active' : ''} onClick={() => setFiltersVisible((v) => !v)}>
                <ListFilter size={13} /> 필터
              </button>
            </div>
          </section>

          <section className="security-kpis" aria-label="보안 현황 요약">
            <article className="primary">
              <span>미조치 취약점</span>
              <strong>{stats?.unresolvedFindings ?? '—'}</strong>
              <small>{stats?.criticalCount ?? 0}개 치명적</small>
            </article>
            <article>
              <span>회귀 통과</span>
              <strong>{stats?.regressionPassed ?? '—'}</strong>
              <small>{regressionRate}% 성공 · {stats?.regressionPassed ?? 0}/{stats?.regressionTotal ?? 0}</small>
            </article>
            <article>
              <span>회귀 차단</span>
              <strong>{stats?.regressionBlocked ?? '—'}</strong>
              <small>PR 차단 · 안전하게 차단</small>
            </article>
            <article>
              <span>생성된 PR</span>
              <strong>{stats?.prsCreated ?? '—'}</strong>
              <small>자동 머지 없음 · 사람 리뷰 필요</small>
            </article>
          </section>

          {filtersVisible && (
            <div className="security-filter-note" role="status">
              전체 저장소 · 모든 심각도 · 검증 완료 포함
            </div>
          )}

          <div className="security-chart-row">
            <section className="patch-trend-card">
              <div className="security-card-heading">
                <div>
                  <h2>패치 성공률 추이</h2>
                  <p>최근 7일 · 패치 후 기존 테스트 전체 통과 비율</p>
                </div>
              </div>
              <div className="trend-chart">
                <div className="trend-y">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                  <span>0%</span>
                </div>
                <div className="trend-plot" style={{ gridTemplateColumns: `repeat(${trendSeries.length}, minmax(0, 1fr))` }}>
                  {trendSeries.map((week, index) => (
                    <button
                      type="button"
                      className="trend-column"
                      key={week.short}
                      aria-label={`${week.long} 회귀 통과율 ${week.rate}%, ${week.passed} 통과`}
                      onMouseEnter={() => setHoveredWeek(index)}
                      onMouseLeave={() => setHoveredWeek(null)}
                    >
                      <div className={index === hoveredWeek ? 'trend-bar active' : 'trend-bar'} style={{ height: `${week.rate}%` }} />
                      {index === hoveredWeek && (
                        <div className="trend-tooltip">
                          <span>{week.long}</span>
                          <small>회귀 통과율</small>
                          <b>{week.rate}%</b>
                          <em>● {week.passed} 통과</em>
                        </div>
                      )}
                      <small>{week.short}</small>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="regression-rate-card">
              <div className="security-card-heading">
                <h2>회귀 통과율</h2>
                <button
                  type="button"
                  aria-label="회귀 통과율 메뉴"
                  aria-expanded={rateMenuOpen}
                  onClick={() => setRateMenuOpen((v) => !v)}
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
              {rateMenuOpen && (
                <div className="rate-card-menu">
                  <Link href="/results" scroll={false} onClick={() => setRateMenuOpen(false)}>
                    분석 결과 보기
                  </Link>
                  <Link href="/history" scroll={false} onClick={() => setRateMenuOpen(false)}>
                    검사 이력 보기
                  </Link>
                  <button type="button" onClick={() => { exportSummary(); setRateMenuOpen(false) }}>
                    요약 내보내기
                  </button>
                </div>
              )}
              <div className="gauge">
                <div>
                  <strong>{regressionRate}%</strong>
                  <span>회귀 통과율</span>
                </div>
              </div>
              <div className="gauge-summary">
                <div>
                  <span>회귀 통과</span>
                  <strong>{stats?.regressionPassed ?? 0} / {stats?.regressionTotal ?? 0}</strong>
                </div>
                <div>
                  <span>차단됨</span>
                  <strong>회귀 차단 {stats?.regressionBlocked ?? 0}건</strong>
                </div>
              </div>
            </section>
          </div>

          <div className="security-bottom-row">
            <section className="recent-scans-card">
              <div className="security-card-heading">
                <div>
                  <h2>최근 검사</h2>
                  <p>최근 파이프라인 결과와 PR 상태</p>
                </div>
                <Link href="/history" scroll={false}>검사 이력 보기</Link>
              </div>
              <div className="recent-scan-table">
                <div className="recent-scan-head">
                  <span>저장소</span><span>상태</span><span>Finding</span><span>테스트</span><span>PR</span><span>시간</span>
                </div>
                {recentScans.map((scan) => {
                  const meta = STATUS_LABEL[scan.status] ?? { label: scan.status, tone: '' }
                  const tests = scan.passedTests != null ? `${scan.passedTests}/${scan.totalTests}` : '—'
                  const pr = scan.prNumber ? `#${scan.prNumber}` : '—'
                  return (
                    <div className="recent-scan-row" key={scan.id}>
                      <strong>{scan.repositoryName}</strong>
                      <b className={meta.tone}>{meta.label}</b>
                      <span>{scan.findingCount}</span>
                      <span>{tests}</span>
                      <span>{pr}</span>
                      <span>{fmtRelative(scan.startedAt)}</span>
                    </div>
                  )
                })}
                {recentScans.length === 0 && (
                  <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>
                    아직 스캔 기록이 없습니다.
                  </p>
                )}
              </div>
            </section>

            <section className="severity-card">
              <div className="security-card-heading">
                <div>
                  <h2>심각도 분포</h2>
                  <p>현재 Finding {stats?.unresolvedFindings ?? 0}건</p>
                </div>
              </div>
              <div className="severity-content">
                <div className="severity-donut">
                  <strong>{stats?.unresolvedFindings ?? 0}</strong>
                  <span>건</span>
                </div>
                <ul>
                  <li className="critical"><span>치명적</span><b>{stats?.criticalCount ?? 0}</b></li>
                  <li className="high"><span>높음</span><b>—</b></li>
                  <li className="medium"><span>보통</span><b>—</b></li>
                  <li className="low"><span>낮음</span><b>—</b></li>
                </ul>
              </div>
            </section>

            <section className="processing-card">
              <div className="security-card-heading">
                <div>
                  <h2>평균 처리 시간</h2>
                  <p>단계별 평균 소요 시간</p>
                </div>
                <strong>총 4분 12초</strong>
              </div>
              <div className="processing-grid">
                <article className="scan"><span>스캔</span><strong>38초</strong></article>
                <article className="verify"><span>검증</span><strong>54초</strong></article>
                <article className="regression"><span>회귀</span><strong>126초</strong><small>최장</small></article>
                <article className="pr"><span>PR</span><strong>34초</strong></article>
              </div>
            </section>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}
