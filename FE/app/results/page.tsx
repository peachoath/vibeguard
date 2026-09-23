'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Search } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'
import { apiFetch } from '@/lib/api'

interface Finding {
  id: string
  scanId: string
  packageName: string
  cveId: string | null
  cvssScore: number | null
  severity: string
  affectedVersion: string | null
  patchedVersion: string | null
  evidence: string | null
  verdict: string
  regressionResult: string | null
  regressionPassed: number | null
  regressionTotal: number | null
}

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: '치명적',
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

const VERDICT_LABEL: Record<string, { label: string; cls: string }> = {
  PATCH: { label: '패치', cls: 'patch' },
  IGNORE: { label: '무시', cls: 'ignore' },
  MANUAL: { label: '수동 확인', cls: 'manual' },
}

const REGRESSION_LABEL: Record<string, { label: string; cls: string }> = {
  PASS: { label: '통과', cls: 'pass' },
  FAIL: { label: '실패', cls: 'fail' },
  PENDING: { label: '대기', cls: 'waiting' },
  NOT_AFFECTED: { label: '영향 없음', cls: 'neutral' },
  MANUAL: { label: '수동 확인', cls: 'manual' },
}

const severities = [
  { id: 'all', label: '전체' },
  { id: 'CRITICAL', label: '치명적' },
  { id: 'HIGH', label: '높음' },
  { id: 'MEDIUM', label: '보통' },
  { id: 'LOW', label: '낮음' },
]

function ResultsPageInner() {
  const searchParams = useSearchParams()
  const scanId = searchParams.get('scanId') ?? 'scan-1'

  const [severity, setSeverity] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('score-desc')

  const { data: findings = [], isLoading } = useQuery({
    queryKey: ['findings', scanId],
    queryFn: () => apiFetch<Finding[]>(`/scans/${scanId}/findings`),
  })

  const visibleFindings = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return findings
      .filter((f) => severity === 'all' || f.severity === severity)
      .filter((f) => verdict === 'all' || f.verdict === verdict)
      .filter((f) => !needle || f.packageName.toLowerCase().includes(needle) || (f.cveId ?? '').toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sort === 'name') return a.packageName.localeCompare(b.packageName)
        if (sort === 'score-asc') return (a.cvssScore ?? 0) - (b.cvssScore ?? 0)
        return (b.cvssScore ?? 0) - (a.cvssScore ?? 0)
      })
  }, [findings, severity, verdict, query, sort])

  const countBySeverity = (sev: string) => findings.filter((f) => f.severity === sev).length

  return (
    <AuthGuard>
      <main className="results-page">
        <AppHeader active="results" />

        <ScreenContent>
          <section className="results-heading">
            <div>
              <h1>보안 분석 결과</h1>
              <p>검증된 취약점만 우선순위와 근거를 함께 표시합니다.</p>
            </div>
            <div className="results-actions">
              <label>
                <select aria-label="위험도 필터" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  {severities.map((item) => (
                    <option key={item.id} value={item.id}>{item.id === 'all' ? '위험도' : item.label}</option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
              <label>
                <select aria-label="판정 상태 필터" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                  <option value="all">상태</option>
                  <option value="PATCH">패치</option>
                  <option value="IGNORE">무시</option>
                  <option value="MANUAL">수동 확인</option>
                </select>
                <ChevronDown size={13} />
              </label>
            </div>
          </section>

          <div className="results-layout">
            <aside className="results-filter">
              <h2>필터</h2>
              <h3>심각도</h3>
              <div className="severity-options">
                {severities.map((item) => (
                  <button
                    key={item.id}
                    className={severity === item.id ? 'active' : item.id.toLowerCase()}
                    onClick={() => setSeverity(item.id)}
                  >
                    <span>{item.label}</span>
                    <b>{item.id === 'all' ? findings.length : countBySeverity(item.id)}</b>
                  </button>
                ))}
              </div>
              <div className="filter-divider" />
              <h3>판정</h3>
              <div className="verdict-options">
                {Object.entries(VERDICT_LABEL).map(([key, meta]) => (
                  <button
                    key={key}
                    className={verdict === key ? `active ${meta.cls}` : meta.cls}
                    onClick={() => setVerdict(verdict === key ? 'all' : key)}
                  >
                    <span>{meta.label}</span>
                    <b>{findings.filter((f) => f.verdict === key).length}</b>
                  </button>
                ))}
              </div>
              <Link className="filter-history-link" href="/history" scroll={false}>검사 이력 보기</Link>
            </aside>

            <div className="results-main">
              <section className="risk-summary" aria-label="위험도 요약">
                <article className="critical"><span>치명적</span><strong>{countBySeverity('CRITICAL')}</strong><small>즉시 수정 권장</small></article>
                <article className="high"><span>높음</span><strong>{countBySeverity('HIGH')}</strong><small>확인 필요</small></article>
                <article className="moderate"><span>보통</span><strong>{countBySeverity('MEDIUM')}</strong><small>낮은 위험</small></article>
                <article className="excluded"><span>낮음</span><strong>{countBySeverity('LOW')}</strong><small>모니터링</small></article>
              </section>

              <section className="findings-card">
                <div className="findings-toolbar">
                  <div>
                    <h2>Finding 목록</h2>
                    <p>취약 라이브러리 · 공식 DB 근거 · 최소 안전 버전 · 회귀 상태</p>
                  </div>
                  <div className="findings-controls">
                    <label className="findings-search">
                      <Search size={13} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="패키지 또는 CVE 검색"
                        aria-label="패키지 또는 CVE 검색"
                      />
                    </label>
                    <label className="finding-select">
                      <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Finding 정렬">
                        <option value="score-desc">정렬</option>
                        <option value="score-asc">낮은 위험순</option>
                        <option value="name">이름순</option>
                      </select>
                      <ChevronDown size={15} />
                    </label>
                  </div>
                </div>

                {isLoading ? (
                  <p style={{ padding: '2rem', textAlign: 'center' }}>불러오는 중…</p>
                ) : (
                  <div className="findings-table-wrap">
                    <table className="findings-table">
                      <thead>
                        <tr>
                          <th>패키지</th>
                          <th>CVE / CVSS</th>
                          <th>버전 변경</th>
                          <th>근거</th>
                          <th>판정</th>
                          <th>회귀</th>
                          <th>동작</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleFindings.map((f) => {
                          const verdictMeta = VERDICT_LABEL[f.verdict] ?? { label: f.verdict, cls: '' }
                          const regrMeta = REGRESSION_LABEL[f.regressionResult ?? ''] ?? { label: '—', cls: '' }
                          const regression = f.regressionPassed != null
                            ? `${f.regressionPassed}/${f.regressionTotal} PASS`
                            : regrMeta.label
                          return (
                            <tr key={f.id}>
                              <td><strong>{f.packageName}</strong></td>
                              <td>{f.cveId ?? '—'} {f.cvssScore != null ? `· ${f.cvssScore}` : ''}</td>
                              <td><strong>{f.affectedVersion ?? '—'} → {f.patchedVersion ?? '—'}</strong></td>
                              <td>{f.evidence ?? '—'}</td>
                              <td>
                                <span className={`finding-verdict ${verdictMeta.cls}`}>{verdictMeta.label}</span>
                              </td>
                              <td>
                                <span className={`finding-regression ${regrMeta.cls}`}>{regression}</span>
                              </td>
                              <td>
                                <Link className="finding-detail-link" href={`/findings/${f.id}`} scroll={false}>
                                  상세 보기 →
                                </Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {visibleFindings.length === 0 && (
                      <p className="findings-empty">조건에 맞는 Finding이 없습니다.</p>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <ResultsPageInner />
    </Suspense>
  )
}
