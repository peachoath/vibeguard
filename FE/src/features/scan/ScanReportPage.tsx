import { useMutation, useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Play,
  XCircle,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { getErrorMessage } from '@/lib/scanErrors'
import type { ScanDto } from './types'

interface ReportFindingDto {
  id: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  cveId?: string
  packageName?: string
  affectedVersion?: string
  patchedVersion?: string
  cvssScore?: number
}

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const
const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: 'var(--color-severity-critical)',
  HIGH:     'var(--color-severity-high)',
  MEDIUM:   'var(--color-severity-medium)',
  LOW:      'var(--color-severity-low)',
}
const TERMINAL = new Set(['COMPLETED', 'NO_FINDINGS', 'FAILED', 'PATCH_FAILED', 'REGRESSION_BLOCKED'])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—'
  if (ms < 1000)   return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

// 심각도 분포 가로 바 차트
function SeverityBreakdown({ findings }: { findings: ReportFindingDto[] }) {
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1
  const total = findings.length
  if (total === 0) return null

  return (
    <div className="report-severity">
      {SEVERITY_ORDER.map(sev => {
        const count = counts[sev]
        const pct   = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={sev} className="report-sev-row">
            <span className="report-sev-label" style={{ color: SEVERITY_COLOR[sev] }}>{sev}</span>
            <div className="report-sev-bar-wrap">
              <div
                className="report-sev-bar"
                style={{ width: `${pct}%`, background: SEVERITY_COLOR[sev] }}
              />
            </div>
            <span className="report-sev-count">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function FindingRow({ finding }: { finding: ReportFindingDto }) {
  const navigate = useNavigate()

  return (
    <div
      className="scan-finding scan-finding--expandable"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/findings/${finding.id}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(`/findings/${finding.id}`)}
    >
      <div className="scan-finding-main">
        <span className={`scan-finding-severity scan-finding-severity--${finding.severity}`}>
          {finding.severity}
        </span>
        <span className="scan-finding-title">{finding.title}</span>
        <ArrowRight size={12} className="scan-finding-chevron" />
      </div>
    </div>
  )
}

function exportFindings(findings: ReportFindingDto[], format: 'csv' | 'json') {
  let content: string, type: string, filename: string
  if (format === 'json') {
    content = JSON.stringify(findings, null, 2); type = 'application/json'; filename = 'findings.json'
  } else {
    const header = 'severity,title,cveId,cvssScore,packageName,affectedVersion,patchedVersion\n'
    const rows   = findings.map(f =>
      `${f.severity},"${f.title.replace(/"/g, '""')}",${f.cveId ?? ''},${f.cvssScore ?? ''},${f.packageName ?? ''},${f.affectedVersion ?? ''},${f.patchedVersion ?? ''}`
    ).join('\n')
    content = header + rows; type = 'text/csv'; filename = 'findings.csv'
  }
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

export function ScanReportPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: scan, isLoading: scanLoading } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => apiFetch<ScanDto>(`/scans/${id}`),
    enabled: !!id,
  })

  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ['scan-findings', id],
    queryFn: () => apiFetch<ReportFindingDto[]>(`/scans/${id}/findings`),
    enabled: !!id,
  })

  const retryMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/scans', {
        method: 'POST',
        body: JSON.stringify({ repositoryId: scan?.repositoryId, ref: scan?.ref ?? 'main' }),
      }),
    onSuccess: newScan => navigate(`/scans/${newScan.id}/live`),
  })

  const isLoading = scanLoading || findingsLoading
  const isActive  = scan && !TERMINAL.has(scan.status)
  const isFailed  = scan && ['FAILED', 'PATCH_FAILED', 'REGRESSION_BLOCKED'].includes(scan.status)
  const statusCls = scan?.status === 'COMPLETED' || scan?.status === 'NO_FINDINGS' ? 'success'
    : isFailed ? 'error' : 'muted'

  return (
    <div className="report-page">
      <div className="report-header">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />뒤로
        </button>
        {!isLoading && scan && (
          <>
            <div className="report-meta">
              <div className="report-title">{scan.ref}</div>
              <div className="report-sub">
                {scan.commitSha && <span className="history-commit">{scan.commitSha.slice(0, 7)}</span>}
                <span className="report-date">{fmtDate(scan.startedAt)}</span>
                <span className="report-dur">{fmtDuration(scan.durationMs)}</span>
              </div>
            </div>
            <div className="report-actions">
              {isActive && (
                <Link to={`/scans/${id}/live`} className="btn-ghost">
                  <Clock size={13} />
                  라이브 보기
                </Link>
              )}
              {isFailed && (
                <button type="button" className="btn-ghost" onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}>
                  <Play size={13} />
                  {retryMutation.isPending ? '시작 중…' : '재스캔'}
                </button>
              )}
              {findings.length > 0 && (
                <>
                  <button type="button" className="btn-ghost" onClick={() => exportFindings(findings, 'json')}>
                    <Download size={13} />JSON
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => exportFindings(findings, 'csv')}>
                    <Download size={13} />CSV
                  </button>
                </>
              )}
              {scan.status === 'COMPLETED' && (
                <a href="#" className="btn-ghost" onClick={e => e.preventDefault()}>
                  <ExternalLink size={13} />PR 보기
                </a>
              )}
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="report-skeleton">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />)}
        </div>
      ) : scan ? (
        <>
          {/* 상태 + 에러 메시지 */}
          <div className={`report-status-bar report-status-bar--${statusCls}`}>
            {isFailed ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
            <span>
              {scan.status === 'COMPLETED' ? 'PR 생성 완료' : scan.status === 'NO_FINDINGS' ? '취약점 없음'
                : isFailed ? getErrorMessage(scan.errorCode) : scan.status}
            </span>
          </div>

          {/* 심각도 분포 */}
          {findings.length > 0 && (
            <div className="report-section">
              <div className="report-section-title">
                취약점 분포
                <span className="report-section-count">{findings.length}건</span>
              </div>
              <SeverityBreakdown findings={findings} />
            </div>
          )}

          {/* Finding 목록 */}
          <div className="report-section">
            <div className="report-section-title">Finding 목록</div>
            {findings.length === 0 ? (
              <div className="report-empty">발견된 취약점이 없어요.</div>
            ) : (
              <div className="scan-findings" style={{ borderRadius: 12 }}>
                {findings.map(f => <FindingRow key={f.id} finding={f} />)}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="report-empty">스캔 정보를 불러오지 못했어요.</div>
      )}
    </div>
  )
}
