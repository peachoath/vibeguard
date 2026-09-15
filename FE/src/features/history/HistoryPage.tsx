import { useMutation, useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronDown, Clock, GitBranch, Info, RefreshCw, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import { getErrorMessage } from '@/lib/scanErrors'
import { toast } from '@/components/toast'
import type { ScanListItem } from '@/features/scan/types'
import { EmptyState } from '@/components/EmptyState'

type StatusFilter = 'all' | 'active' | 'success' | 'failed'
type SortOrder    = 'newest' | 'oldest'

const PAGE_SIZE = 10

const TERMINAL = new Set(['COMPLETED', 'NO_FINDINGS', 'FAILED', 'PATCH_FAILED', 'REGRESSION_BLOCKED'])
const FAILED   = new Set(['FAILED', 'PATCH_FAILED', 'REGRESSION_BLOCKED'])

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  COMPLETED:          { label: '완료',       icon: CheckCircle2, cls: 'success' },
  NO_FINDINGS:        { label: '취약점 없음', icon: Info,         cls: 'info'    },
  FAILED:             { label: '실패',        icon: XCircle,      cls: 'error'   },
  PATCH_FAILED:       { label: '패치 실패',   icon: XCircle,      cls: 'warn'    },
  REGRESSION_BLOCKED: { label: '회귀 차단',   icon: XCircle,      cls: 'warn'    },
  QUEUED:             { label: '대기 중',     icon: Clock,        cls: 'muted'   },
  SCANNING:           { label: '스캔 중',     icon: Clock,        cls: 'muted'   },
  AWAITING_REVIEW:    { label: '검토 대기',   icon: Clock,        cls: 'muted'   },
}

function fmtDate(iso: string) {
  const d    = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60)        return '방금 전'
  if (diff < 3600)      return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function fmtDuration(ms: number | null) {
  if (!ms) return null
  if (ms < 1000)   return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}m ${s}s`
}

function HistoryRow({
  scan, onNavigate, onRetry, isRetrying,
}: {
  scan: ScanListItem
  onNavigate: () => void
  onRetry: () => void
  isRetrying: boolean
}) {
  const meta    = STATUS_META[scan.status] ?? { label: scan.status, icon: Clock, cls: 'muted' }
  const Icon    = meta.icon
  const dur     = fmtDuration(scan.durationMs)
  const isActive = !TERMINAL.has(scan.status)
  const isFailed = FAILED.has(scan.status)

  return (
    <div className="history-row" onClick={onNavigate} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onNavigate()}>
      <div className={`history-status history-status--${meta.cls}`}>
        <Icon size={13} />
      </div>
      <div className="history-info">
        <div className="history-repo">
          <GitBranch size={11} className="history-repo-icon" />
          {scan.repositoryFullName ?? scan.repositoryId}
        </div>
        <div className="history-ref">
          <span className="history-sha">{scan.ref}</span>
          {scan.commitSha && <span className="history-commit">{scan.commitSha.slice(0, 7)}</span>}
        </div>
        {/* #10 에러 코드 → 사람말 */}
        {isFailed && scan.errorCode && (
          <div className="history-error-msg">{getErrorMessage(scan.errorCode)}</div>
        )}
      </div>
      <div className="history-meta">
        <span className={`history-badge history-badge--${meta.cls}`}>{meta.label}</span>
        {dur && <span className="history-dur">{dur}</span>}
        {isActive && <span className="history-badge history-badge--live">LIVE</span>}
        {/* #7 재시작 버튼 */}
        {isFailed && (
          <button
            type="button"
            className="btn-ghost history-retry-btn"
            disabled={isRetrying}
            onClick={e => { e.stopPropagation(); onRetry() }}
            title="동일 설정으로 재시작"
          >
            <RefreshCw size={11} className={isRetrying ? 'spin' : ''} />
            {isRetrying ? '시작 중…' : '재시작'}
          </button>
        )}
      </div>
      <div className="history-time">{fmtDate(scan.startedAt)}</div>
    </div>
  )
}

function HistorySkeleton() {
  return (
    <div className="history-row history-row--skeleton">
      <div className="skeleton" style={{ width: 28, height: 28, borderRadius: '50%' }} />
      <div className="history-info">
        <div className="skeleton skeleton--name" />
        <div className="skeleton" style={{ height: 10, width: '35%' }} />
      </div>
      <div className="skeleton" style={{ height: 20, width: 60, borderRadius: 20 }} />
      <div className="skeleton" style={{ height: 11, width: 48 }} />
    </div>
  )
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortOrder,    setSortOrder]     = useState<SortOrder>('newest')
  const [visibleCount, setVisibleCount]  = useState(PAGE_SIZE)

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [statusFilter, sortOrder])

  const { data: scans, isLoading, isError } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiFetch<ScanListItem[]>('/scans'),
    refetchInterval: 15_000,
  })

  // #7 재시작 mutation
  const retryMutation = useMutation({
    mutationFn: (scan: ScanListItem) =>
      apiFetch<{ id: string }>('/scans', {
        method: 'POST',
        body: JSON.stringify({ repositoryId: scan.repositoryId, ref: scan.ref }),
      }),
    onSuccess: newScan => {
      toast.success('스캔을 재시작했어요.')
      navigate(`/scans/${newScan.id}/live`)
    },
    onError: () => toast.error('스캔을 재시작하지 못했어요.'),
  })

  const filtered = (scans ?? [])
    .filter(s => {
      if (statusFilter === 'active')  return !TERMINAL.has(s.status)
      if (statusFilter === 'success') return s.status === 'COMPLETED' || s.status === 'NO_FINDINGS'
      if (statusFilter === 'failed')  return FAILED.has(s.status)
      return true
    })
    .sort((a, b) => {
      const diff = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      return sortOrder === 'newest' ? -diff : diff
    })

  return (
    <div className="history-page">
      <div className="history-header">
        <h1 className="history-title">스캔 이력</h1>
        <div className="history-controls">
          {/* 상태 필터 */}
          <div className="history-filter-group">
            {([
              { key: 'all',     label: '전체' },
              { key: 'active',  label: '진행 중' },
              { key: 'success', label: '완료' },
              { key: 'failed',  label: '실패' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`history-filter-btn${statusFilter === key ? ' active' : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          {/* 정렬 */}
          <button
            type="button"
            className="btn-ghost history-sort-btn"
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
          >
            {sortOrder === 'newest' ? '최신순' : '오래된순'}
          </button>
        </div>
      </div>

      {isError && <div className="repo-error">이력을 불러오지 못했어요.</div>}

      <div className="history-list">
        {isLoading && [...Array(5)].map((_, i) => <HistorySkeleton key={i} />)}

        {!isLoading && !isError && filtered.length === 0 && (
          <EmptyState
            icon={<Clock size={28} />}
            title={statusFilter === 'all' ? '스캔 이력이 없어요' : '해당하는 스캔이 없어요'}
            description={statusFilter === 'all' ? '리포지토리를 선택해서 첫 번째 스캔을 시작해보세요.' : '필터를 변경해보세요.'}
            action={statusFilter === 'all' ? { label: '리포지토리 보기', onClick: () => navigate('/repositories') } : undefined}
          />
        )}

        {!isLoading && !isError && filtered.slice(0, visibleCount).map(scan => (
          <HistoryRow
            key={scan.id}
            scan={scan}
            onNavigate={() => navigate(`/scans/${scan.id}/live`)}
            onRetry={() => retryMutation.mutate(scan)}
            isRetrying={retryMutation.isPending && retryMutation.variables?.id === scan.id}
          />
        ))}
      </div>

      {!isLoading && !isError && filtered.length > visibleCount && (
        <button
          type="button"
          className="history-load-more"
          onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
        >
          <ChevronDown size={14} />
          더보기 ({filtered.length - visibleCount}건 남음)
        </button>
      )}
    </div>
  )
}
