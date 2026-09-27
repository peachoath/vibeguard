"use client";

import { ChevronDown, ChevronsUpDown, Lock, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { apiFetch } from "@/lib/api";

interface Repository {
  id: string;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  connectedAt: string;
}

interface GitHubRepo {
  githubRepoId: number;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  isPrivate: boolean;
}

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("default");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanBranch, setScanBranch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [connecting, setConnecting] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<Repository[]>("/api/v1/repositories")
      .then(setRepos)
      .catch(() => setRepos([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = repos.find((r) => r.id === selectedId) ?? repos[0] ?? null;

  const visible = repos
    .filter((r) => r.fullName.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "name-asc") return a.fullName.localeCompare(b.fullName);
      if (sortOrder === "name-desc") return b.fullName.localeCompare(a.fullName);
      return new Date(b.connectedAt).getTime() - new Date(a.connectedAt).getTime();
    });

  function openAdd() {
    setAddOpen(true);
    setAddQuery("");
    setAddLoading(true);
    apiFetch<GitHubRepo[]>("/api/v1/repositories?source=github")
      .then(setGithubRepos)
      .catch(() => setGithubRepos([]))
      .finally(() => {
        setAddLoading(false);
        setTimeout(() => searchRef.current?.focus(), 50);
      });
  }

  function closeAdd() {
    setAddOpen(false);
    setAddQuery("");
  }

  async function connectRepo(repo: GitHubRepo) {
    setConnecting(repo.githubRepoId);
    try {
      const added = await apiFetch<Repository>("/api/v1/repositories", {
        method: "POST",
        body: JSON.stringify({ githubRepoId: repo.githubRepoId, fullName: repo.fullName, defaultBranch: repo.defaultBranch, language: repo.language }),
      });
      setRepos((prev) => [added, ...prev]);
      closeAdd();
    } catch {
      // already connected etc.
    } finally {
      setConnecting(null);
    }
  }

  const connectedNames = new Set(repos.map((r) => r.fullName));

  const filteredGithubRepos = githubRepos.filter((r) =>
    r.fullName.toLowerCase().includes(addQuery.trim().toLowerCase())
  );

  return (
    <main className="repositories-page">
      <AppHeader active="repositories" />

      <ScreenContent>
        <section className="repositories-heading" id="repositories">
          <div><h1>저장소</h1><p>보안 검증을 적용할 GitHub 저장소를 연결하고 관리합니다.</p></div>
          <div className="heading-buttons">
            <button onClick={openAdd}><Plus size={15} /> 저장소 추가</button>
          </div>
        </section>

        {addOpen && (
          <div
            className="add-repo-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) closeAdd(); }}
            onKeyDown={(e) => { if (e.key === "Escape") closeAdd(); }}
            role="dialog"
            aria-modal="true"
            aria-label="GitHub 저장소 연결"
          >
            <div className="add-repo-modal" ref={modalRef}>
              <div className="add-repo-header">
                <div>
                  <h2>GitHub 저장소 연결</h2>
                  <p>연결할 저장소를 선택하면 보안 검증 파이프라인에 추가됩니다.</p>
                </div>
                <button className="add-repo-close" onClick={closeAdd} aria-label="닫기">
                  <X size={18} />
                </button>
              </div>

              <div className="add-repo-search">
                <Search size={15} />
                <input
                  ref={searchRef}
                  placeholder="저장소 이름으로 검색"
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Escape") { if (addQuery) setAddQuery(""); else closeAdd(); } }}
                />
                {addQuery && (
                  <button type="button" aria-label="검색어 지우기" onClick={() => setAddQuery("")}>
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="add-repo-list">
                {addLoading ? (
                  <div className="add-repo-loading">
                    <span className="add-repo-spinner" />
                    <span>GitHub에서 저장소를 불러오는 중…</span>
                  </div>
                ) : filteredGithubRepos.length === 0 ? (
                  <p className="add-repo-empty">
                    {addQuery ? `"${addQuery}"와 일치하는 저장소가 없습니다.` : "연결 가능한 저장소가 없습니다."}
                  </p>
                ) : (
                  filteredGithubRepos.map((r) => {
                    const [owner, name] = r.fullName.split("/");
                    const already = connectedNames.has(r.fullName);
                    return (
                      <div key={r.githubRepoId} className={`add-repo-row${already ? " already" : ""}`}>
                        <div className="add-repo-avatar" aria-hidden="true">
                          {(owner?.[0] ?? "?").toUpperCase()}
                        </div>
                        <div className="add-repo-info">
                          <div className="add-repo-name">
                            <span className="add-repo-owner">{owner}/</span>
                            <strong>{name}</strong>
                            {r.isPrivate && (
                              <span className="add-repo-badge private"><Lock size={9} />Private</span>
                            )}
                          </div>
                          {r.language && (
                            <span className="add-repo-lang">{r.language}</span>
                          )}
                        </div>
                        {already ? (
                          <span className="add-repo-connected">연결됨</span>
                        ) : (
                          <button
                            className="add-repo-btn"
                            onClick={() => connectRepo(r)}
                            disabled={connecting === r.githubRepoId}
                          >
                            {connecting === r.githubRepoId ? "연결 중…" : "연결"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="add-repo-footer">
                <span>{filteredGithubRepos.length}개 저장소</span>
                <button className="add-repo-cancel" onClick={closeAdd}>닫기</button>
              </div>
            </div>
          </div>
        )}

        <div className="repository-layout">
          <div className="repository-main">
            <section className="repository-card">
              <div className="repository-card-header">
                <div><h2>저장소 목록</h2><p>연결된 저장소</p></div>
                <div className="repository-tools">
                  <label htmlFor="repository-search">
                    <Search size={17} />
                    <input id="repository-search" placeholder="검색" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setQuery(""); }} />
                    <button type="button" aria-label="지우기" disabled={!query} onClick={() => setQuery("")}><X size={14} /></button>
                  </label>
                  <div className="repository-sort">
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                      <option value="default">최근 연결순</option>
                      <option value="name-asc">이름 오름차순</option>
                      <option value="name-desc">이름 내림차순</option>
                    </select>
                    <ChevronsUpDown size={15} aria-hidden="true" />
                  </div>
                </div>
              </div>

              <div className="repository-table" role="table">
                <div className="repository-row repository-table-head" role="row">
                  <span>저장소</span><span>기본 브랜치</span><span>언어</span><span>연결일</span>
                </div>
                {loading && <p className="repository-empty">불러오는 중…</p>}
                {!loading && visible.map((r) => (
                  <button
                    className={`repository-row${selectedId === r.id ? " selected" : ""}`}
                    key={r.id}
                    onClick={() => { setSelectedId(r.id); setScanBranch(r.defaultBranch); }}
                  >
                    <strong>{r.fullName}</strong>
                    <span>{r.defaultBranch}</span>
                    <span>{r.language ?? "-"}</span>
                    <span>{new Date(r.connectedAt).toLocaleDateString("ko-KR")}</span>
                  </button>
                ))}
                {!loading && visible.length === 0 && <p className="repository-empty">저장소가 없습니다. 저장소를 추가해주세요.</p>}
              </div>
            </section>
          </div>

          <aside className="scan-panel">
            <div className="scan-heading"><h2>스캔 시작</h2><p>선택한 저장소와 브랜치로 파이프라인을 실행합니다.</p></div>
            {selected ? (
              <>
                <div className="selected-repository">
                  <div><strong>{selected.fullName}</strong><span>github.com/{selected.fullName}</span></div>
                  <b>{selected.language ?? "-"}</b>
                </div>
                <label className="scan-label" htmlFor="scan-branch">브랜치</label>
                <div className="branch-dropdown">
                  <input id="scan-branch" className="branch-select" value={scanBranch} onChange={(e) => setScanBranch(e.target.value)} placeholder={selected.defaultBranch} />
                  <ChevronDown size={16} aria-hidden="true" />
                </div>
                <Link
                  className="scan-start-button"
                  href={`/scan?repoId=${selected.id}&ref=${encodeURIComponent(scanBranch || selected.defaultBranch)}`}
                >
                  스캔 시작
                </Link>
              </>
            ) : (
              <p className="repository-empty">저장소를 선택하세요.</p>
            )}
          </aside>
        </div>
      </ScreenContent>
    </main>
  );
}
