import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Clock, GitBranch, Play, ShieldAlert, XCircle, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '@/lib/api'
import type { ScanListItem } from '@/features/scan/types'

interface TrendPoint { date: string; scans: number; findings: number }
interface StatsDto {
  totalScans: number
  successRate: number
  totalFindings: number
  fixedFindings: number
  trend: TrendPoint[]
}

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-icon" style={color ? { color, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}>
        {icon}
      </div>
      <div className="dash-card-body">
        <div className="dash-card-value">{value}</div>
        <div className="dash-card-label">{label}</div>
        {sub && <div className="dash-card-sub">{sub}</div>}
      </div>
    </div>
  )
}

// CSS 바 차트 — 7일 트렌드
function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const maxFindings = Math.max(...trend.map(t => t.findings), 1)
  const maxScans    = Math.max(...trend.map(t => t.scans), 1)

  return (
    <div className="trend-chart">
      <div className="trend-bars">
        {trend.map(point => {
          const fPct = (point.findings / maxFindings) * 100
          const sPct = (point.scans    / maxScans)    * 100
          const date = new Date(point.date)
          const label = date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
          return (
            <div key={point.date} className="trend-col" title={`${label}: 스캔 ${point.scans}회, 취약점 ${point.findings}건`}>
              <div className="trend-bar-pair">
                <div className="trend-bar trend-bar--findings" style={{ height: `${fPct}%` }} />
                <div className="trend-bar trend-bar--scans"    style={{ height: `${sPct}%` }} />
              </div>
              <div className="trend-label">{label}</div>
            </div>
          )
        })}
      </div>
      <div className="trend-legend">
        <span className="trend-legend-item trend-legend-item--findings">취약점</span>
        <span className="trend-legend-item trend-legend-item--scans">스캔</span>
      </div>
    </div>
  )
}

const TERMINAL = new Set(['COMPLETED', 'NO_FINDINGS', 'FAILED', 'PATCH_FAILED', 'REGRESSION_BLOCKED'])
const SCAN_STATUS_META: Record<string, { label: string; cls: string }> = {
  COMPLETED:          { label: '완료',       cls: 'success' },
  NO_FINDINGS:        { label: '취약점 없음', cls: 'info'    },
  FAILED:             { label: '실패',        cls: 'error'   },
  PATCH_FAILED:       { label: '패치 실패',   cls: 'warn'    },
  REGRESSION_BLOCKED: { label: '회귀 차단',   cls: 'warn'    },
  QUEUED:             { label: '대기 중',     cls: 'muted'   },
  SCANNING:           { label: '스캔 중',     cls: 'muted'   },
  AWAITING_REVIEW:    { label: '검토 대기',   cls: 'muted'   },
}

function fmtDate(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return '방금 전'
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function RecentScanRow({ scan }: { scan: ScanListItem }) {
  const navigate = useNavigate()
  const meta    = SCAN_STATUS_META[scan.status] ?? { label: scan.status, cls: 'muted' }
  const isActive = !TERMINAL.has(scan.status)

  const StatusIcon = scan.status === 'COMPLETED' || scan.status === 'NO_FINDINGS'
    ? CheckCircle2
    : scan.status.includes('FAILED') || scan.status === 'REGRESSION_BLOCKED'
    ? XCircle : Clock

  return (
    <div
      className="dash-recent-row"
      role="button"
      tabIndex={0}
      onClick={() => navigate(isActive ? `/scans/${scan.id}/live` : `/scans/${scan.id}`)}
      onKeyDown={e => e.key === 'Enter' && navigate(isActive ? `/scans/${scan.id}/live` : `/scans/${scan.id}`)}
    >
      <span className={`dash-recent-status dash-recent-status--${meta.cls}`}>
        <StatusIcon size={12} />
      </span>
      <span className="dash-recent-repo">{scan.repositoryFullName ?? scan.repositoryId}</span>
      <span className="dash-recent-ref">{scan.ref}</span>
      <span className={`dash-recent-badge dash-recent-badge--${meta.cls}`}>
        {isActive ? 'LIVE' : meta.label}
      </span>
      <span className="dash-recent-time">{fmtDate(scan.startedAt)}</span>
    </div>
  )
}

function OnboardingCard({ onStart }: { onStart: () => void }) {
  return (
    <div className="dash-onboarding">
      <div className="dash-onboarding-icon">
        <ShieldAlert size={32} />
      </div>
      <h2 className="dash-onboarding-title">첫 번째 보안 스캔을 시작해보세요</h2>
      <p className="dash-onboarding-desc">
        리포지토리를 연결하면 VibeGuard가 취약점을 자동으로 탐지하고<br />
        패치 PR까지 생성해드려요.
      </p>
      <button type="button" className="btn-primary dash-onboarding-btn" onClick={onStart}>
        <Play size={14} />
        리포지토리 연결하기
      </button>
    </div>
  )
}

function DashSkeleton() {
  return (
    <div className="dash-page">
      <div className="dash-header">
        <div className="skeleton" style={{ height: 28, width: 120, borderRadius: 8 }} />
      </div>
      <div className="dash-cards">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="dash-card">
            <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 12 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ height: 28, width: 60 }} />
              <div className="skeleton" style={{ height: 13, width: 90 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<StatsDto>('/dashboard/stats'),
    staleTime: 60_000,
  })

  const { data: allScans = [] } = useQuery({
    queryKey: ['scans'],
    queryFn: () => apiFetch<ScanListItem[]>('/scans'),
    staleTime: 30_000,
  })

  if (isLoading) return <DashSkeleton />

  if (isError || !stats) {
    return (
      <div className="dash-page">
        <div className="repo-error">통계를 불러오지 못했어요.</div>
      </div>
    )
  }

  const fixRate = stats.totalFindings > 0
    ? Math.round((stats.fixedFindings / stats.totalFindings) * 100)
    : 0

  const recentScans = [...allScans]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 5)

  if (stats.totalScans === 0) {
    return (
      <div className="dash-page">
        <div className="dash-header">
          <h1 className="dash-title">대시보드</h1>
        </div>
        <OnboardingCard onStart={() => navigate('/repositories')} />
        <div className="dash-section">
          <div className="dash-section-title">빠른 이동</div>
          <div className="dash-quick-links">
            <button type="button" className="dash-quick-card" onClick={() => navigate('/repositories')}>
              <GitBranch size={22} />
              <span>리포지토리</span>
            </button>
            <button type="button" className="dash-quick-card" onClick={() => navigate('/history')}>
              <Zap size={22} />
              <span>스캔 이력</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-page">
      <div className="dash-header">
        <h1 className="dash-title">대시보드</h1>
        <div className="dash-actions">
          <button type="button" className="btn-ghost" onClick={() => navigate('/repositories')}>
            <GitBranch size={13} />
            새 스캔 시작
          </button>
        </div>
      </div>

      <div className="dash-cards">
        <StatCard
          icon={<Zap size={18} />}
          label="총 스캔"
          value={stats.totalScans}
          sub="전체 기간"
          color="var(--color-accent)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="성공률"
          value={`${Math.round(stats.successRate * 100)}%`}
          sub={`${Math.round(stats.totalScans * stats.successRate)}건 완료`}
          color="#34c759"
        />
        <StatCard
          icon={<ShieldAlert size={18} />}
          label="발견 취약점"
          value={stats.totalFindings}
          sub="전체 기간"
          color="var(--color-severity-critical)"
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="패치 완료"
          value={stats.fixedFindings}
          sub={`${fixRate}% 해결됨`}
          color="var(--color-severity-high)"
        />
      </div>

      {stats.trend.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-title">최근 7일 트렌드</div>
          <TrendChart trend={stats.trend} />
        </div>
      )}

      {recentScans.length > 0 && (
        <div className="dash-section">
          <div className="dash-section-header">
            <div className="dash-section-title">최근 스캔</div>
            <button type="button" className="btn-ghost dash-section-more" onClick={() => navigate('/history')}>
              전체 보기
            </button>
          </div>
          <div className="dash-recent-list">
            {recentScans.map(scan => <RecentScanRow key={scan.id} scan={scan} />)}
          </div>
        </div>
      )}

      <div className="dash-section">
        <div className="dash-section-title">빠른 이동</div>
        <div className="dash-quick-links">
          <button type="button" className="dash-quick-card" onClick={() => navigate('/repositories')}>
            <GitBranch size={22} />
            <span>리포지토리</span>
          </button>
          <button type="button" className="dash-quick-card" onClick={() => navigate('/history')}>
            <Zap size={22} />
            <span>스캔 이력</span>
          </button>
        </div>
      </div>
    </div>
  )
}
