import { useQuery } from '@tanstack/react-query'
import { GitBranch, Lock, Play, RefreshCw, Search, X } from 'lucide-react'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { EmptyState } from '@/components/EmptyState'
import { ScanStartModal } from '@/features/scan/ScanStartModal'

interface RepositoryDto {
  id: string
  fullName: string
  description?: string | null
  language?: string | null
  private: boolean
  defaultBranch?: string
}

const LANG_COLOR: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Java:       '#ed8b00',
  Python:     '#3572a5',
  Go:         '#00add8',
  Rust:       '#dea584',
  Kotlin:     '#7f52ff',
}

function RepoCard({ repo }: { repo: RepositoryDto }) {
  const [showModal, setShowModal] = useState(false)
  const color = repo.language ? LANG_COLOR[repo.language] : undefined

  return (
    <>
      <div className="repo-card">
        <div className="repo-card-header">
          <GitBranch size={13} className="repo-card-icon" />
          <span className="repo-card-name">{repo.fullName}</span>
          {repo.private && (
            <span className="repo-card-private">
              <Lock size={10} />
              Private
            </span>
          )}
        </div>

        {repo.description && (
          <p className="repo-card-desc">{repo.description}</p>
        )}

        <div className="repo-card-footer">
          <div className="repo-card-meta">
            {repo.language && (
              <span className="repo-card-lang">
                <span className="repo-card-lang-dot" style={{ background: color ?? 'var(--color-muted)' }} />
                {repo.language}
              </span>
            )}
            {repo.defaultBranch && (
              <span className="repo-card-branch">{repo.defaultBranch}</span>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost repo-card-scan"
            onClick={() => setShowModal(true)}
          >
            <Play size={11} />
            스캔
          </button>
        </div>
      </div>

      {showModal && (
        <ScanStartModal repo={repo} onClose={() => setShowModal(false)} />
      )}
    </>
  )
}

function RepoSkeleton() {
  return (
    <div className="repo-card repo-card--skeleton">
      <div className="skeleton skeleton--name" />
      <div className="skeleton skeleton--desc" />
      <div className="skeleton skeleton--footer" />
    </div>
  )
}

export function RepositoriesPage() {
  const [search, setSearch] = useState('')
  const { data: repos, isLoading, isError, refetch } = useQuery({
    queryKey: ['repositories'],
    queryFn: () => apiFetch<RepositoryDto[]>('/repositories'),
  })

  // #4 클라이언트 검색 필터
  const filtered = search.trim()
    ? (repos ?? []).filter(r => r.fullName.toLowerCase().includes(search.toLowerCase()))
    : (repos ?? [])

  return (
    <div className="repo-page">
      <div className="repo-page-header">
        <h1 className="repo-page-title">리포지토리</h1>
        <div className="repo-page-actions">
          <div className="repo-search">
            <Search size={12} className="repo-search-icon" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="리포지토리 검색…"
              className="repo-search-input"
              aria-label="리포지토리 검색"
            />
            {search && (
              <button type="button" className="repo-search-clear" onClick={() => setSearch('')} aria-label="검색 지우기">
                <X size={10} />
              </button>
            )}
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {isError && (
        <div className="repo-error">
          리포지토리를 불러오지 못했어요.
          <button type="button" className="btn-ghost" onClick={() => refetch()}>
            다시 시도
          </button>
        </div>
      )}

      {isLoading && (
        <div className="repo-grid">
          {[...Array(6)].map((_, i) => <RepoSkeleton key={i} />)}
        </div>
      )}

      {!isLoading && !isError && repos?.length === 0 && (
        <EmptyState
          icon={<GitBranch size={28} />}
          title="연결된 리포지토리가 없어요"
          description="GitHub에서 리포지토리를 연결하면 자동으로 취약점을 검사할 수 있어요."
          action={{ label: '리포지토리 연결', onClick: () => {} }}
        />
      )}

      {!isLoading && !isError && repos && repos.length > 0 && filtered.length === 0 && (
        <EmptyState
          icon={<Search size={28} />}
          title="검색 결과가 없어요"
          description={`"${search}"에 해당하는 리포지토리가 없어요.`}
          action={{ label: '검색 초기화', onClick: () => setSearch('') }}
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="repo-grid">
          {filtered.map(repo => <RepoCard key={repo.id} repo={repo} />)}
        </div>
      )}
    </div>
  )
}
