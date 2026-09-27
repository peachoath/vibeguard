'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { ChevronDown, ChevronsUpDown, Search, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuthGuard from '../components/auth-guard'
import AppHeader from '../components/app-header'
import ScreenContent from '../components/screen-content'
import { apiFetch } from '@/lib/api'
import { toast } from '../components/providers'

interface Repository {
  id: string
  name: string
  fullName: string
  branch: string
  language: string
  lastScannedAt: string | null
  findingCount: number
  status: string
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  PROTECTED: { label: '보호 중', tone: 'safe' },
  SAFE: { label: '안전', tone: 'safe' },
  NEEDS_ACTION: { label: '조치 필요', tone: 'warning' },
  REVIEW_REQUIRED: { label: '검토 필요', tone: 'danger' },
}

function fmtRelative(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  const days = Math.floor(hrs / 24)
  return days === 1 ? '어제' : `${days}일 전`
}

const statsConfig = [
  { label: '연결됨', icon: '/chain.png', tone: 'blue', detail: '지난 30일' },
  { label: '보호 브랜치', icon: '/g_guard.png', tone: 'green', detail: 'main / develop' },
  { label: '자동 검사', icon: '/check.png', tone: 'amber', detail: 'PR 이벤트에서 실행' },
  { label: '마지막 동기화', icon: '/synchro.png', tone: 'purple', detail: 'GitHub 연결 정상' },
]

export default function RepositoriesPage() {
  const [query, setQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('default')
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [selectedBranch, setSelectedBranch] = useState('main')
  const router = useRouter()

  const { data: repositories = [], isLoading } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => apiFetch<Repository[]>('/repositories'),
  })

  const startScan = useMutation({
    mutationFn: (vars: { repositoryId: string; branch: string }) =>
      apiFetch<{ id: string }>('/scans', {
        method: 'POST',
        body: JSON.stringify(vars),
      }),
    onSuccess: (scan) => {
      toast.success('스캔이 시작되었습니다.')
      router.push(`/scan?id=${scan.id}`)
    },
    onError: () => toast.error('스캔 시작에 실패했습니다.'),
  })

  const visibleRepositories = repositories
    .filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'name-asc') return a.name.localeCompare(b.name)
      if (sortOrder === 'name-desc') return b.name.localeCompare(a.name)
      if (sortOrder === 'findings') return b.findingCount - a.findingCount || a.name.localeCompare(b.name)
      if (a.lastScannedAt && b.lastScannedAt) return new Date(b.lastScannedAt).getTime() - new Date(a.lastScannedAt).getTime()
      return 0
    })

  const displayRepo = selectedRepo ?? repositories[0]

  const stats = [
    { ...statsConfig[0], value: String(repositories.length) },
    { ...statsConfig[1], value: String(repositories.filter((r) => r.branch).length) },
    { ...statsConfig[2], value: String(repositories.length) },
    { ...statsConfig[3], value: displayRepo?.lastScannedAt ? fmtRelative(displayRepo.lastScannedAt) : '—' },
  ]

  return (
    <AuthGuard>
      <main className="repositories-page">
        <AppHeader active="repositories" />

        <ScreenContent>
          <section className="repositories-heading" id="repositories">
            <div>
              <h1>저장소</h1>
              <p>보안 검증을 적용할 GitHub 저장소를 연결하고 관리합니다.</p>
            </div>
            <div className="heading-buttons">
              <button>검사 정책</button>
              <button>전체 저장소</button>
            </div>
          </section>

          <div className="repository-layout">
            <div className="repository-main">
              <section className="stats-grid" aria-label="저장소 요약">
                {stats.map((stat) => (
                  <article className={`stat-card ${stat.tone}`} key={stat.label}>
                    <div>
                      <span>{stat.label}</span>
                      <strong>{stat.value}</strong>
                      <small>{stat.detail}</small>
                    </div>
                    <Image src={stat.icon} alt="" width={90} height={90} />
                  </article>
                ))}
              </section>

              <section className="repository-card">
                <div className="repository-card-header">
                  <div>
                    <h2>저장소 목록</h2>
                    <p>연결된 저장소와 최근 검사 상태</p>
                  </div>
                  <div className="repository-tools">
                    <label htmlFor="repository-search">
                      <Search size={17} />
                      <input
                        id="repository-search"
                        aria-label="저장소 이름 검색"
                        placeholder="검색"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') setQuery('') }}
                      />
                      <button className="search-clear" type="button" aria-label="검색어 지우기" disabled={!query} onClick={() => setQuery('')}>
                        <X size={14} />
                      </button>
                    </label>
                    <div className="repository-sort">
                      <select aria-label="저장소 정렬 기준" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="default">정렬 기준</option>
                        <option value="recent">최근 검사순</option>
                        <option value="name-asc">이름 오름차순</option>
                        <option value="name-desc">이름 내림차순</option>
                        <option value="findings">발견 수 많은 순</option>
                      </select>
                      <ChevronsUpDown size={15} aria-hidden="true" />
                    </div>
                  </div>
                </div>

                {isLoading ? (
                  <p style={{ padding: '2rem', textAlign: 'center' }}>불러오는 중…</p>
                ) : (
                  <div className="repository-table" role="table" aria-label="저장소 목록">
                    <div className="repository-row repository-table-head" role="row">
                      <span>저장소</span>
                      <span>기본 브랜치</span>
                      <span>마지막 검사</span>
                      <span>분석 결과</span>
                      <span>상태</span>
                    </div>
                    {visibleRepositories.map((repo) => {
                      const meta = STATUS_META[repo.status] ?? { label: repo.status, tone: '' }
                      return (
                        <button
                          className="repository-row"
                          role="row"
                          key={repo.id}
                          onClick={() => setSelectedRepo(repo)}
                        >
                          <strong>{repo.name}</strong>
                          <span>{repo.branch}</span>
                          <span>{fmtRelative(repo.lastScannedAt)}</span>
                          <span>{repo.findingCount}건</span>
                          <b className={meta.tone}>{meta.label}</b>
                        </button>
                      )
                    })}
                    {visibleRepositories.length === 0 && (
                      <p className="repository-empty" role="status">검색 결과가 없습니다.</p>
                    )}
                  </div>
                )}
              </section>
            </div>

            <aside className="scan-panel" id="scan">
              <div className="scan-heading">
                <h2>스캔 시작</h2>
                <p>선택한 저장소와 브랜치로 파이프라인을 실행합니다.</p>
              </div>
              {displayRepo ? (
                <>
                  <div className="selected-repository">
                    <div>
                      <strong>{displayRepo.name}</strong>
                      <span>{displayRepo.fullName}</span>
                    </div>
                    <b>{displayRepo.language}</b>
                  </div>
                  <label className="scan-label" htmlFor="scan-branch">브랜치</label>
                  <div className="branch-dropdown">
                    <select
                      className="branch-select"
                      id="scan-branch"
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                    >
                      <option value="main">main</option>
                      <option value="develop">develop</option>
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </div>
                  <div className="scan-divider" />
                  <dl className="scan-details">
                    <div><dt>마지막 검사</dt><dd>{fmtRelative(displayRepo.lastScannedAt)} · Finding {displayRepo.findingCount}건</dd></div>
                    <div><dt>기본 브랜치</dt><dd>{displayRepo.branch}</dd></div>
                  </dl>
                  <button
                    className="scan-start-button"
                    disabled={startScan.isPending}
                    onClick={() => startScan.mutate({ repositoryId: displayRepo.id, branch: selectedBranch })}
                  >
                    {startScan.isPending ? '시작 중…' : '스캔 시작'}
                  </button>
                </>
              ) : (
                <p style={{ padding: '1rem', color: 'var(--muted)' }}>저장소를 선택하세요.</p>
              )}
            </aside>
          </div>
        </ScreenContent>
      </main>
    </AuthGuard>
  )
}
