import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCode,
  Package,
  Shield,
  XCircle,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/toast'

interface FindingDetailDto {
  id: string
  type: 'SAST' | 'SCA'
  ruleId?: string | null
  cveId?: string | null
  cweId?: string | null
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  cvssScore?: number | null
  filePath?: string | null
  lineStart?: number | null
  lineEnd?: number | null
  snippet?: string | null
  manifestPath?: string | null
  packageName?: string | null
  currentVersion?: string | null
  recommendedVersion?: string | null
  verdict?: string | null
  rationale?: string | null
  status: 'OPEN' | 'IGNORED' | 'PATCHED' | 'MANUAL'
}

const SEVERITY_META = {
  CRITICAL: { color: 'var(--color-severity-critical)', label: 'CRITICAL' },
  HIGH:     { color: 'var(--color-severity-high)',     label: 'HIGH' },
  MEDIUM:   { color: 'var(--color-severity-medium)',   label: 'MEDIUM' },
  LOW:      { color: 'var(--color-severity-low)',      label: 'LOW' },
}

const STATUS_META = {
  OPEN:    { label: '오픈',      cls: 'error'   },
  IGNORED: { label: '무시됨',    cls: 'muted'   },
  PATCHED: { label: '패치 완료', cls: 'success' },
  MANUAL:  { label: '수동 처리', cls: 'info'    },
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fd-field">
      <dt className="fd-field-label">{label}</dt>
      <dd className="fd-field-value">{children}</dd>
    </div>
  )
}

function SkeletonPage() {
  return (
    <div className="fd-page">
      <div className="fd-header">
        <div className="skeleton" style={{ width: 60, height: 32, borderRadius: 8 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 22, width: '55%' }} />
          <div className="skeleton" style={{ height: 14, width: '35%' }} />
        </div>
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="fd-section">
          <div className="skeleton" style={{ height: 16, width: 80, marginBottom: 12 }} />
          <div className="fd-fields">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="fd-field">
                <div className="skeleton" style={{ height: 12, width: 70 }} />
                <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function FindingDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: finding, isLoading, isError } = useQuery({
    queryKey: ['finding', id],
    queryFn: () => apiFetch<FindingDetailDto>(`/findings/${id}`),
    enabled: !!id,
  })

  const ignoreMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/findings/${id}/ignore`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: '오탐으로 판단됨' }),
      }),
    onSuccess: () => toast.success('Finding을 무시됨으로 처리했어요.'),
    onError: () => toast.error('처리하지 못했어요.'),
  })

  if (isLoading) return <SkeletonPage />

  if (isError || !finding) {
    return (
      <div className="fd-page">
        <div className="repo-error">Finding 정보를 불러오지 못했어요.</div>
      </div>
    )
  }

  const sevMeta    = SEVERITY_META[finding.severity]
  const statusMeta = STATUS_META[finding.status]
  const isSca      = finding.type === 'SCA'
  const isSast     = finding.type === 'SAST'

  return (
    <div className="fd-page">
      {/* 헤더 */}
      <div className="fd-header">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />뒤로
        </button>

        <div className="fd-title-wrap">
          <div className="fd-title">
            <span
              className="scan-finding-severity"
              style={{
                background: `color-mix(in srgb, ${sevMeta.color} 13%, transparent)`,
                color: sevMeta.color,
              }}
            >
              {sevMeta.label}
            </span>
            <span className="fd-title-text">
              {finding.cveId ?? finding.ruleId ?? 'Finding'}
            </span>
            <span className={`history-badge history-badge--${statusMeta.cls}`}>
              {statusMeta.label}
            </span>
          </div>
          <div className="fd-subtitle">
            {finding.type} 취약점
            {finding.cvssScore != null && (
              <span className="fd-cvss">CVSS {Number(finding.cvssScore).toFixed(1)}</span>
            )}
          </div>
        </div>

        {finding.status === 'OPEN' && (
          <button
            type="button"
            className="btn-ghost fd-ignore-btn"
            onClick={() => ignoreMutation.mutate()}
            disabled={ignoreMutation.isPending}
          >
            <XCircle size={13} />
            {ignoreMutation.isPending ? '처리 중…' : '오탐 처리'}
          </button>
        )}
      </div>

      {/* 분석 결과 */}
      {(finding.rationale || finding.verdict) && (
        <div className="fd-section">
          <div className="fd-section-title">
            <Shield size={13} />
            분석 결과
          </div>
          <div className="fd-fields">
            {finding.verdict && (
              <Field label="판정">
                <span className={`fd-verdict fd-verdict--${finding.verdict.toLowerCase()}`}>
                  {finding.verdict === 'CONFIRMED' ? '확정' : finding.verdict === 'FALSE_POSITIVE' ? '오탐' : finding.verdict}
                </span>
              </Field>
            )}
            {finding.rationale && (
              <Field label="근거">
                <p className="fd-rationale">{finding.rationale}</p>
              </Field>
            )}
          </div>
        </div>
      )}

      {/* SCA — 패키지 */}
      {isSca && (finding.packageName || finding.cveId) && (
        <div className="fd-section">
          <div className="fd-section-title">
            <Package size={13} />
            패키지 정보
          </div>
          <div className="fd-fields">
            {finding.manifestPath && <Field label="매니페스트">{finding.manifestPath}</Field>}
            {finding.packageName   && <Field label="패키지">{finding.packageName}</Field>}
            {finding.currentVersion && (
              <Field label="버전">
                <span className="fd-version fd-version--current">{finding.currentVersion}</span>
                {finding.recommendedVersion && (
                  <>
                    <span className="fd-version-arrow">→</span>
                    <span className="fd-version fd-version--patch">{finding.recommendedVersion}</span>
                  </>
                )}
              </Field>
            )}
            {finding.cveId && (
              <Field label="CVE">
                <a
                  href={`https://nvd.nist.gov/vuln/detail/${finding.cveId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fd-link"
                >
                  {finding.cveId}
                  <ExternalLink size={11} />
                </a>
              </Field>
            )}
            {finding.cweId && <Field label="CWE">{finding.cweId}</Field>}
          </div>
        </div>
      )}

      {/* SAST — 코드 위치 */}
      {isSast && finding.filePath && (
        <div className="fd-section">
          <div className="fd-section-title">
            <FileCode size={13} />
            코드 위치
          </div>
          <div className="fd-fields">
            <Field label="파일">
              <code className="fd-code-inline">{finding.filePath}</code>
              {finding.lineStart != null && (
                <span className="fd-line-info">
                  L{finding.lineStart}{finding.lineEnd != null && finding.lineEnd !== finding.lineStart && `–${finding.lineEnd}`}
                </span>
              )}
            </Field>
            {finding.ruleId && <Field label="규칙">{finding.ruleId}</Field>}
          </div>
          {finding.snippet && (
            <pre className="fd-snippet">{finding.snippet}</pre>
          )}
        </div>
      )}

      {/* 메타 */}
      <div className="fd-section">
        <div className="fd-section-title">
          <AlertTriangle size={13} />
          메타
        </div>
        <div className="fd-fields">
          <Field label="유형">{finding.type}</Field>
          <Field label="심각도">
            <span style={{ color: sevMeta.color, fontWeight: 660 }}>{finding.severity}</span>
          </Field>
          {finding.cvssScore != null && (
            <Field label="CVSS">{Number(finding.cvssScore).toFixed(1)}</Field>
          )}
          <Field label="상태">
            <span className={`history-badge history-badge--${statusMeta.cls}`}>{statusMeta.label}</span>
          </Field>
        </div>
      </div>

      {finding.status === 'OPEN' && (
        <div className="fd-actions">
          <button
            type="button"
            className="btn-ghost fd-ignore-btn"
            onClick={() => ignoreMutation.mutate()}
            disabled={ignoreMutation.isPending || ignoreMutation.isSuccess}
          >
            <XCircle size={13} />
            {ignoreMutation.isSuccess ? '처리됨' : ignoreMutation.isPending ? '처리 중…' : '오탐으로 무시'}
          </button>
        </div>
      )}

      {finding.status === 'PATCHED' && (
        <div className="fd-patched-banner">
          <CheckCircle2 size={14} />
          이 취약점은 자동으로 패치됐어요.
        </div>
      )}
    </div>
  )
}
