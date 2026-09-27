"use client";

import { ChevronDown, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";
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
  id: number;
  fullName: string;
  defaultBranch: string;
  language: string | null;
  private: boolean;
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
    setAddLoading(true);
    apiFetch<GitHubRepo[]>("/api/v1/repositories?source=github")
      .then(setGithubRepos)
      .catch(() => setGithubRepos([]))
      .finally(() => setAddLoading(false));
  }

  async function connectRepo(repo: GitHubRepo) {
    try {
      const added = await apiFetch<Repository>("/api/v1/repositories", {
        method: "POST",
        body: JSON.stringify({ githubRepoId: repo.id, fullName: repo.fullName, defaultBranch: repo.defaultBranch, language: repo.language }),
      });
      setRepos((prev) => [added, ...prev]);
      setAddOpen(false);
    } catch {
      // 이미 연결된 경우 등
    }
  }

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
          <div className="add-repo-modal">
            <div className="add-repo-content">
              <h2>GitHub 저장소 연결</h2>
              {addLoading ? <p>불러오는 중…</p> : (
                <div className="github-repo-list">
                  {githubRepos.map((r) => (
                    <button key={r.id} className="github-repo-row" onClick={() => connectRepo(r)}>
                      <strong>{r.fullName}</strong>
                      <span>{r.language ?? "Unknown"}</span>
                    </button>
                  ))}
                  {githubRepos.length === 0 && <p>연결 가능한 저장소가 없습니다.</p>}
                </div>
              )}
              <button onClick={() => setAddOpen(false)}>닫기</button>
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
