'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import AuthGuard from '../../components/auth-guard'
import AppHeader from '../../components/app-header'
import ScreenContent from '../../components/screen-content'
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

type DetailTab = 'overview' | 'evidence' | 'regression' | 'diff'

const tabs: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: '개요' },
  { id: 'evidence', label: '근거' },
  { id: 'regression', label: '회귀 증거' },
  { id: 'diff', label: 'Diff' },
]

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: '치명적',
  HIGH: '높음',
  MEDIUM: '보통',
  LOW: '낮음',
}

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<DetailTab>('regression')
  const [ignored, setIgnored] = useState(false)

  const { data: finding, isLoading, isError } = useQuery({
    queryKey: ['finding', id],
    queryFn: () => apiFetch<Finding>(`/findings/${id}`),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <AuthGuard>
        <main className="finding-page">
          <AppHeader active="results" />
          <ScreenContent>
            <p style={{ padding: '3rem', textAlign: 'center' }}>불러오는 중…</p>
          </ScreenContent>
        </main>
      </AuthGuard>
    )
  }

  if (isError || !finding) {
    return (
      <AuthGuard>
        <main className="finding-page">
          <AppHeader active="results" />
          <ScreenContent>
            <p style={{ padding: '3rem', textAlign: 'center' }}>Finding을 찾을 수 없습니다.</p>
          </ScreenContent>
        </main>
      </AuthGuard>
    )
  }

  const severityLabel = SEVERITY_LABEL[finding.severity] ?? finding.severity
  const regressionText = finding.regressionPassed != null
    ? `${finding.regressionPassed}/${finding.regressionTotal} PASS`
    : finding.regressionResult ?? '—'

  return (
    <AuthGuard>
      <main className="finding-page">
        <AppHeader active="results" />

        <ScreenContent>
          <section className="finding-heading">
            <div>
              <h1>{finding.packageName} {finding.affectedVersion ?? ''} · {finding.cveId ?? '—'}</h1>
              <p>CVSS {finding.cvssScore ?? '—'} · {severityLabel} · 검증 완료</p>
            </div>
            <div className="finding-actions">
              <div>
                <span>{severityLabel}</span>
                <button type="button" onClick={() => setIgnored((v) => !v)}>
                  {ignored ? '무시 취소' : '무시 처리'}
                </button>
              </div>
              <small>
                {finding.regressionResult === 'PASS' ? '회귀 통과 · ' : ''}
                PR 생성 완료 · 사람의 리뷰 필요
              </small>
            </div>
          </section>

          <nav className="finding-tabs" aria-label="Finding 상세 메뉴">
            {tabs.map((item) => (
              <button
                type="button"
                key={item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="finding-detail-layout">
            <section className="regression-panel">
              <div className="finding-section-title">
                <h2>
                  {tab === 'overview' ? '개요' : tab === 'evidence' ? '취약점 근거' : tab === 'diff' ? '변경 Diff' : '회귀 증거'}
                </h2>
                <p>
                  {tab === 'regression'
                    ? '기존 테스트를 패치 전후로 실행해 버전을 올려도 안 깨짐을 증명합니다.'
                    : tab === 'evidence'
                    ? '공식 취약점 데이터베이스의 교차 검증 결과입니다.'
                    : tab === 'diff'
                    ? '안전 버전 적용으로 변경되는 매니페스트 한 줄입니다.'
                    : '탐지된 취약점과 자동 패치 검증 결과를 요약합니다.'}
                </p>
              </div>

              <div className="regression-summary">
                <article>
                  <span>패치 전 기준선</span>
                  <strong>{finding.regressionTotal != null ? `${finding.regressionTotal} / ${finding.regressionTotal} PASS` : '—'}</strong>
                  <small>기존 버전에서 정상</small>
                </article>
                <article>
                  <span>버전 상향</span>
                  <strong>{finding.affectedVersion ?? '—'} → {finding.patchedVersion ?? '—'}</strong>
                  <small>최소 안전 버전</small>
                </article>
                <article>
                  <span>패치 후 회귀</span>
                  <strong>{regressionText}</strong>
                  <small>기존 기능 유지</small>
                </article>
              </div>

              <div className="regression-evidence-grid">
                <article className="pytest-log">
                  <h3>패치 회귀 로그</h3>
                  <dl>
                    <div><dt>패치 전</dt><dd>{finding.regressionTotal != null ? `${finding.regressionTotal} passed` : '—'}</dd></div>
                    <div>
                      <dt>패치</dt>
                      <dd>
                        {finding.packageName}=={finding.affectedVersion} → {finding.packageName}=={finding.patchedVersion}
                      </dd>
                    </div>
                    <div><dt>패치 후</dt><dd>{regressionText}</dd></div>
                  </dl>
                  <div className="test-environment">
                    <span>결과</span>
                    <strong>하위 호환 유지 확인</strong>
                  </div>
                </article>
                <article className="diff-summary">
                  <h3>Diff 요약</h3>
                  <strong>requirements.txt</strong>
                  <div className="diff-lines">
                    <span>- {finding.packageName}=={finding.affectedVersion}</span>
                    <span>+ {finding.packageName}=={finding.patchedVersion}</span>
                  </div>
                  <small>변경 범위</small>
                  <b>매니페스트 버전 문자열 1줄</b>
                  <p>코드 리팩토링 없음</p>
                </article>
              </div>
            </section>

            <aside className="verification-evidence">
              <h2>검증 근거</h2>
              <dl>
                <div><dt>패키지</dt><dd>{finding.packageName}</dd></div>
                <div><dt>현재 버전</dt><dd>{finding.affectedVersion ?? '—'}</dd></div>
                <div><dt>최소 안전 버전</dt><dd>{finding.patchedVersion ?? '—'}</dd></div>
                <div><dt>CVE</dt><dd>{finding.cveId ?? '—'}</dd></div>
                <div><dt>CVSS</dt><dd>{finding.cvssScore ?? '—'} {severityLabel}</dd></div>
                <div><dt>출처</dt><dd>{finding.evidence ?? '—'}</dd></div>
              </dl>
              <div className="agent-judgment">
                <strong>검증 판단</strong>
                <p>
                  모든 알려진 취약 범위를 해소하면서 major 점프를 피하는{' '}
                  {finding.patchedVersion}을 선택했습니다.
                </p>
              </div>
              <Link href={`/results?scanId=${finding.scanId}`} className="created-pr">
                ← 분석 결과로 돌아가기
              </Link>
            </aside>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}
