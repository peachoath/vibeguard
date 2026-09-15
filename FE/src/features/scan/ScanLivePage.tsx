import { useVirtualizer } from '@tanstack/react-virtual'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Info,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { toast } from '@/components/toast'
import type { SseDoneEvent, SseFindingEvent, SseLogEvent, SseStageEvent } from './types'
import type { ScanDto } from './types'
import { useScanStream, MAX_RETRIES } from './useScanStream'
import type { ConnectionStatus } from './useScanStream'

// ── 파이프라인 ─────────────────────────────────────────────
const PIPELINE = [
  { id: 'CLONING',          label: '클론',    weight: 1 },
  { id: 'SCANNING',         label: 'A1 탐색', weight: 2 },
  { id: 'VERIFYING',        label: 'A2 검증', weight: 2 },
  { id: 'REGRESSION_CHECK', label: 'A3 회귀', weight: 2 },
  { id: 'PR_CREATING',      label: 'A4 PR',   weight: 1 },
]
const TOTAL_WEIGHT = PIPELINE.reduce((s, p) => s + p.weight, 0)

type DoneVariant = 'success' | 'info' | 'warn' | 'error'
type LogFilter   = 'ALL' | 'WARN' | 'ERROR'
type FindingTab  = 'ALL' | 'CRITICAL' | 'HIGH'

const DONE_META: Record<string, { title: string; sub: string; variant: DoneVariant }> = {
  COMPLETED:          { title: '스캔 완료',   sub: 'PR이 생성됐어요.',              variant: 'success' },
  NO_FINDINGS:        { title: '취약점 없음', sub: '리포지토리가 안전해요.',         variant: 'info'    },
  FAILED:             { title: '스캔 실패',   sub: '에이전트 오류가 발생했어요.',    variant: 'error'   },
  PATCH_FAILED:       { title: '패치 실패',   sub: '자동 패치를 적용하지 못했어요.', variant: 'warn'    },
  REGRESSION_BLOCKED: { title: '회귀 차단됨', sub: '패치 후 테스트가 실패했어요.',  variant: 'warn'    },
}
const DONE_ICONS: Record<DoneVariant, typeof CheckCircle2> = {
  success: CheckCircle2, info: Info, warn: AlertTriangle, error: XCircle,
}

// ── 유틸 ──────────────────────────────────────────────────

function stepStatus(id: string, stages: Record<string, SseStageEvent>) {
  const ev = stages[id]
  if (!ev) return 'pending'
  if (ev.status === 'DONE')   return 'done'
  if (ev.status === 'FAILED') return 'failed'
  return 'running'
}

function calcProgress(stages: Record<string, SseStageEvent>): number {
  let done = 0, running = 0
  for (const p of PIPELINE) {
    const s = stepStatus(p.id, stages)
    if (s === 'done')    done    += p.weight
    if (s === 'running') running += p.weight * 0.5
  }
  return Math.min(((done + running) / TOTAL_WEIGHT) * 100, 99)
}

function fmtDuration(ms: number): string {
  if (ms < 1000)   return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtRelTs(iso: string, startedAt: number): string {
  const diff = Math.max(0, new Date(iso).getTime() - startedAt)
  const ms   = diff % 1000
  const sec  = Math.floor(diff / 1000) % 60
  const min  = Math.floor(diff / 60_000)
  return `+${min}:${String(sec).padStart(2, '0')}.${Math.floor(ms / 100)}`
}

// #6 CSV / JSON 내보내기
function exportFindings(findings: SseFindingEvent[], format: 'csv' | 'json') {
  let content: string, type: string, filename: string
  if (format === 'json') {
    content  = JSON.stringify(findings, null, 2)
    type     = 'application/json'
    filename = 'findings.json'
  } else {
    const header = 'severity,title,cveId,cvssScore,packageName,affectedVersion,patchedVersion\n'
    const rows   = findings.map(f =>
      `${f.severity},"${f.title.replace(/"/g, '""')}",${f.cveId ?? ''},${f.cvssScore ?? ''},${f.packageName ?? ''},${f.affectedVersion ?? ''},${f.patchedVersion ?? ''}`
    ).join('\n')
    content  = header + rows
    type     = 'text/csv'
    filename = 'findings.csv'
  }
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}

// #1 검색어 하이라이트
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts   = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="scan-log-highlight">{part}</mark>
          : part
      )}
    </>
  )
}

// ── 서브 컴포넌트 ─────────────────────────────────────────

function ConnDot({ status }: { status: ConnectionStatus }) {
  const label: Record<ConnectionStatus, string> = {
    connecting: '연결 중', open: '연결됨', done: '완료', error: '연결 실패',
  }
  return (
    <span className="scan-conn-status">
      <span className={`scan-conn-dot scan-conn-dot--${status}`} />
      {label[status]}
    </span>
  )
}

function ScanProgressBar({ stages, isDone }: { stages: Record<string, SseStageEvent>; isDone: boolean }) {
  const pct = isDone ? 100 : calcProgress(stages)
  return (
    <div className="scan-progress" aria-hidden>
      <div
        className={`scan-progress-bar${isDone ? ' scan-progress-bar--done' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function Pipeline({
  stages, stageTimes, awaitingReview, findingCount,
}: {
  stages: Record<string, SseStageEvent>
  stageTimes: Record<string, { startedAt: number; duration?: number }>
  awaitingReview?: boolean
  findingCount: number
}) {
  return (
    <div className="scan-pipeline">
      {PIPELINE.map((step, i) => {
        const rawStatus  = stepStatus(step.id, stages)
        const isWaiting  = awaitingReview && step.id === 'PR_CREATING' && rawStatus === 'pending'
        const connPaused = awaitingReview && step.id === 'PR_CREATING'
        const prevDone   = i > 0 && stepStatus(PIPELINE[i - 1].id, stages) === 'done'
        const dotStatus  = isWaiting ? 'waiting' : rawStatus
        const time       = stageTimes[step.id]
        const showBadge  = step.id === 'SCANNING' && findingCount > 0

        let labelClass = 'scan-step-label'
        if (rawStatus === 'running' || isWaiting) labelClass += ' scan-step-label--active'
        else if (rawStatus === 'done')             labelClass += ' scan-step-label--done'

        return (
          <div key={step.id} className="scan-step-group">
            {i > 0 && (
              <div className={[
                'scan-step-connector',
                prevDone   ? 'scan-step-connector--done'   : '',
                connPaused ? 'scan-step-connector--paused' : '',
              ].filter(Boolean).join(' ')} />
            )}
            <div className="scan-step">
              <div className="scan-step-dot-wrap">
                <div className={`scan-step-dot scan-step-dot--${dotStatus}`} />
                {showBadge && <span className="scan-step-badge">{findingCount}</span>}
              </div>
              <span className={labelClass}>{step.label}</span>
              {time?.duration != null && (
                <span className="scan-step-time">{fmtDuration(time.duration)}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// #1 로그 검색 + #4 복사 + #9 aria-live
function LogFeed({ logs, startedAt }: { logs: SseLogEvent[]; startedAt: number | null }) {
  const [levelFilter, setLevelFilter] = useState<LogFilter>('ALL')
  const [search, setSearch]           = useState('')
  const atBottomRef  = useRef(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const byLevel   = levelFilter === 'ALL' ? logs : logs.filter(l => l.level === levelFilter)
  const filtered  = search.trim()
    ? byLevel.filter(l => l.message.toLowerCase().includes(search.toLowerCase()))
    : byLevel

  const warnCount  = logs.filter(l => l.level === 'WARN').length
  const errorCount = logs.filter(l => l.level === 'ERROR').length

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 22,
    overscan: 20,
  })
  const virtRef = useRef(virtualizer)
  virtRef.current = virtualizer

  function onScroll() {
    const el = containerRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  }

  useEffect(() => {
    if (!atBottomRef.current || filtered.length === 0) return
    virtRef.current.scrollToIndex(filtered.length - 1, { align: 'end' })
  }, [filtered.length])

  // 검색 시 첫 번째 결과로 스크롤
  useEffect(() => {
    if (!search.trim() || filtered.length === 0) return
    virtRef.current.scrollToIndex(0, { align: 'start' })
  }, [search, filtered.length])

  const isSearching = search.trim().length > 0

  return (
    <div className="scan-logs">
      <div className="scan-log-filter">
        {(['ALL', 'WARN', 'ERROR'] as const).map(level => {
          const count    = level === 'WARN' ? warnCount : level === 'ERROR' ? errorCount : logs.length
          const hasItems = count > 0
          return (
            <button
              key={level}
              type="button"
              className={`scan-log-filter-btn scan-log-filter-btn--${level}${levelFilter === level ? ' active' : ''}${!hasItems && level !== 'ALL' ? ' empty' : ''}`}
              onClick={() => setLevelFilter(level)}
            >
              {level}
              {level !== 'ALL' && hasItems && (
                <span className="scan-log-filter-count">{count}</span>
              )}
            </button>
          )
        })}
        <div className="scan-log-search">
          <Search size={11} className="scan-log-search-icon" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="로그 검색…"
            className="scan-log-search-input"
            aria-label="로그 검색"
          />
          {isSearching && (
            <>
              <span className="scan-log-search-count">{filtered.length}건</span>
              <button type="button" className="scan-log-search-clear" onClick={() => setSearch('')} aria-label="검색 지우기">
                <X size={10} />
              </button>
            </>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <span className="scan-logs-empty">
          {isSearching ? `"${search}" 에 일치하는 로그가 없어요` : levelFilter === 'ALL' ? '스트리밍 대기 중…' : '해당 레벨 로그가 없어요'}
        </span>
      ) : (
        // #9 aria-live
        <div
          ref={containerRef}
          className="scan-logs-body"
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-label="스캔 로그"
          aria-relevant="additions"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(item => (
              <div
                key={item.index}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}
              >
                <LogLine log={filtered[item.index]} startedAt={startedAt} searchQuery={search} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LogLine({ log, startedAt, searchQuery }: { log: SseLogEvent; startedAt: number | null; searchQuery: string }) {
  const [copied, setCopied] = useState(false)

  function copy(e: React.MouseEvent) {
    e.stopPropagation()
    const text = `${log.ts} [${log.level}]${log.agent != null ? ` A${log.agent}` : ''} ${log.message}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const tsDisplay = startedAt ? fmtRelTs(log.ts, startedAt) : log.ts.slice(11, 19)

  return (
    <div className={`scan-log-line scan-log-line--${log.level}`}>
      <span className="scan-log-ts">{tsDisplay}</span>
      <span className="scan-log-agent">{log.agent != null ? `A${log.agent}` : '  '}</span>
      <span className={`scan-log-level scan-log-level--${log.level}`}>{log.level}</span>
      <span className="scan-log-msg">
        <HighlightText text={log.message} query={searchQuery} />
      </span>
      <button type="button" className="scan-log-copy" onClick={copy} title="복사">
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </div>
  )
}

// #6 내보내기 포함 파인딩 패널
function FindingsPanel({ findings }: { findings: SseFindingEvent[] }) {
  const [tab, setTab]       = useState<FindingTab>('ALL')
  const [exporting, setExp] = useState(false)
  const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length
  const highCount     = findings.filter(f => f.severity === 'HIGH').length
  const filtered      = tab === 'ALL' ? findings : findings.filter(f => f.severity === tab)

  function doExport(format: 'csv' | 'json') {
    exportFindings(findings, format)
    setExp(false)
  }

  return (
    <div className="scan-findings">
      <div className="scan-findings-head">
        발견된 취약점
        {findings.length > 0 && <span className="scan-findings-count">{findings.length}</span>}
        {findings.length > 0 && (
          <div className="scan-findings-export" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              className="btn-ghost scan-findings-export-btn"
              onClick={() => setExp(v => !v)}
              title="내보내기"
            >
              <Download size={12} />
            </button>
            {exporting && (
              <div className="scan-findings-export-menu">
                <button type="button" onClick={() => doExport('json')}>JSON</button>
                <button type="button" onClick={() => doExport('csv')}>CSV</button>
              </div>
            )}
          </div>
        )}
      </div>

      {findings.length > 1 && (
        <div className="scan-findings-tabs">
          {([
            { key: 'ALL',      label: '전체',    count: findings.length },
            { key: 'CRITICAL', label: 'CRITICAL', count: criticalCount },
            { key: 'HIGH',     label: 'HIGH',     count: highCount },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              className={`scan-findings-tab${tab === key ? ' active' : ''}${count === 0 ? ' empty' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
              {count > 0 && key !== 'ALL' && <span className="scan-findings-tab-count">{count}</span>}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <span className="scan-findings-empty">
          {findings.length === 0 ? '아직 없어요' : '해당 심각도 없음'}
        </span>
      ) : (
        filtered.map(f => <FindingRow key={f.findingId} finding={f} />)
      )}
    </div>
  )
}

function FindingRow({ finding }: { finding: SseFindingEvent }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(finding.cveId || finding.packageName || finding.cvssScore)

  return (
    <div
      className={`scan-finding${hasDetail ? ' scan-finding--expandable' : ''}${expanded ? ' scan-finding--expanded' : ''}`}
      onClick={() => hasDetail && setExpanded(e => !e)}
    >
      <div className="scan-finding-main">
        <span className={`scan-finding-severity scan-finding-severity--${finding.severity}`}>
          {finding.severity}
        </span>
        <span className="scan-finding-title">{finding.title}</span>
        {hasDetail && (
          <ChevronDown size={12} className={`scan-finding-chevron${expanded ? ' open' : ''}`} />
        )}
      </div>
      {expanded && (
        <div className="scan-finding-detail">
          {finding.cveId && <span className="scan-finding-cve">{finding.cveId}</span>}
          {finding.cvssScore != null && (
            <span className="scan-finding-cvss">CVSS {finding.cvssScore.toFixed(1)}</span>
          )}
          {finding.packageName && (
            <span className="scan-finding-pkg">
              {finding.packageName}
              {finding.affectedVersion && ` ${finding.affectedVersion}`}
              {finding.patchedVersion  && ` → ${finding.patchedVersion}`}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewGate({
  findings, isPending, onApprove,
}: {
  findings: SseFindingEvent[]
  isPending: boolean
  onApprove: () => void
}) {
  const critical = findings.filter(f => f.severity === 'CRITICAL').length
  const high     = findings.filter(f => f.severity === 'HIGH').length
  const rest     = findings.length - critical - high
  return (
    <div className="scan-review">
      <div className="scan-review-header">
        <span className="scan-review-icon-wrap"><ShieldCheck size={15} /></span>
        <span className="scan-review-title">PR 생성 검토</span>
      </div>
      <div className="scan-review-inner">
        <div className="scan-review-body">
          <p className="scan-review-desc">회귀 테스트를 모두 통과했어요. 아래 취약점을 확인한 후 PR을 생성하세요.</p>
          {findings.length > 0 && (
            <div className="scan-review-findings">
              {critical > 0 && <span className="scan-finding-severity scan-finding-severity--CRITICAL">{critical} CRITICAL</span>}
              {high > 0     && <span className="scan-finding-severity scan-finding-severity--HIGH">{high} HIGH</span>}
              {rest > 0     && <span className="scan-review-rest">+{rest}건</span>}
            </div>
          )}
        </div>
        <div className="scan-review-actions">
          <button type="button" className="btn-primary scan-review-btn" onClick={onApprove} disabled={isPending}>
            {isPending ? '생성 중…' : 'PR 생성'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DoneBanner({ done }: { done: SseDoneEvent }) {
  const meta = DONE_META[done.status] ?? { title: done.status, sub: '스캔이 종료됐어요.', variant: 'info' as const }
  const Icon = DONE_ICONS[meta.variant]
  return (
    <div className={`scan-done scan-done--${meta.variant}`}>
      <div className="scan-done-icon"><Icon size={19} /></div>
      <div className="scan-done-label">
        <div className="scan-done-title">{meta.title}</div>
        <div className="scan-done-sub">{meta.sub}</div>
      </div>
      {done.prUrl && (
        <a href={done.prUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
          <ExternalLink size={13} />
          GitHub PR 보기
        </a>
      )}
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────

export function ScanLivePage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const stream   = useScanStream(id!)

  const { data: scan } = useQuery({
    queryKey: ['scan', id],
    queryFn: () => apiFetch<ScanDto>(`/scans/${id}`),
    enabled: !!id, staleTime: 60_000, retry: false,
  })

  const cancelMutation  = useMutation({
    mutationFn: () => apiFetch(`/scans/${id}`, { method: 'DELETE' }),
    onSuccess: () => toast.info('스캔을 취소했어요.'),
    onError:   () => toast.error('취소하지 못했어요.'),
  })
  const approveMutation = useMutation({
    mutationFn: () => apiFetch(`/scans/${id}/approve`, { method: 'POST' }),
    onSuccess: () => toast.success('PR 생성을 승인했어요.'),
    onError:   () => toast.error('승인 요청이 실패했어요.'),
  })

  // 이탈 경고
  useEffect(() => {
    if (stream.done) return
    function warn(e: BeforeUnloadEvent) { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stream.done])

  // #2 스캔 완료 브라우저 알림
  useEffect(() => {
    if (!stream.done) return
    if (document.visibilityState === 'visible') return
    if (!('Notification' in window)) return

    const show = () => {
      const meta = DONE_META[stream.done!.status]
      new Notification('VibeGuard 스캔 완료', {
        body: meta ? `${meta.title} — ${meta.sub}` : '스캔이 종료됐어요.',
        icon: '/favicon.ico',
        tag: `scan-${id}`,
      })
    }

    if (Notification.permission === 'granted') {
      show()
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => { if (p === 'granted') show() })
    }
  }, [stream.done, id])

  const isActive       = !stream.done && !stream.awaitingReview
  const showReviewGate = stream.awaitingReview && !stream.stages['PR_CREATING'] && !stream.done
  const showReconnect  = stream.connectionStatus === 'connecting' && stream.retryCount > 0

  const activeStage  = Object.values(stream.stages).find(s => s.status === 'RUNNING')
  const currentLabel = activeStage
    ? (PIPELINE.find(p => p.id === activeStage.stage)?.label ?? activeStage.stage)
    : stream.awaitingReview && !stream.done ? 'PR 검토 대기'
    : stream.done ? (DONE_META[stream.done.status]?.title ?? '완료')
    : '진행 중'

  return (
    <div className="scan-live">
      <div className="scan-live-header">
        <button type="button" className="btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />뒤로
        </button>
        <div className="scan-live-meta">
          <div className="scan-live-title">
            {scan?.ref ?? id}
            {scan?.commitSha && <span className="scan-live-sha">{scan.commitSha.slice(0, 7)}</span>}
          </div>
          <div className="scan-live-sub">{currentLabel}</div>
        </div>
        {isActive && !cancelMutation.isSuccess && (
          <button type="button" className="btn-ghost scan-cancel-btn" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
            <X size={13} />
            {cancelMutation.isPending ? '취소 중…' : '취소'}
          </button>
        )}
        <ConnDot status={stream.connectionStatus} />
      </div>

      <ScanProgressBar stages={stream.stages} isDone={!!stream.done} />

      {showReconnect && (
        <div className="scan-reconnect-banner">
          <RefreshCw size={12} className="spin" />
          연결이 끊어졌어요. 재연결 중… ({stream.retryCount}/{MAX_RETRIES})
        </div>
      )}

      <Pipeline
        stages={stream.stages}
        stageTimes={stream.stageTimes}
        awaitingReview={stream.awaitingReview}
        findingCount={stream.findings.length}
      />

      <div className="scan-body">
        <LogFeed logs={stream.logs} startedAt={stream.streamStartedAt} />
        <FindingsPanel findings={stream.findings} />
      </div>

      {showReviewGate && (
        <ReviewGate
          findings={stream.findings}
          isPending={approveMutation.isPending}
          onApprove={() => approveMutation.mutate()}
        />
      )}

      {stream.done && <DoneBanner done={stream.done} />}
    </div>
  )
}
