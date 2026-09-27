"use client";

import { ChevronDown, ChevronsUpDown, Search, Settings, X } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import DashboardNav from "../components/dashboard-nav";
import ScreenContent from "../components/screen-content";

const repositories = [
  { name: "payment-api", branch: "main", checked: "2분 전", checkedMinutes: 2, findings: 3, result: "3개 치명적", status: "보호 중", tone: "safe" },
  { name: "auth-service", branch: "main", checked: "18분 전", checkedMinutes: 18, findings: 1, result: "1개 높음", status: "조치 필요", tone: "warning" },
  { name: "web-client", branch: "develop", checked: "1시간 전", checkedMinutes: 60, findings: 0, result: "0", status: "안전", tone: "safe" },
  { name: "billing-worker", branch: "main", checked: "어제", checkedMinutes: 1440, findings: 2, result: "2개 보통", status: "보호 중", tone: "safe" },
  { name: "admin-console", branch: "main", checked: "2일 전", checkedMinutes: 2880, findings: 5, result: "5개 미조치", status: "검토 필요", tone: "danger" },
];

const stats = [
  { label: "연결됨", value: "12", detail: "지난 30일 +2", icon: "/chain.png", tone: "blue" },
  { label: "보호 브랜치", value: "18", detail: "main / develop", icon: "/g_guard.png", tone: "green" },
  { label: "자동 검사", value: "9", detail: "PR 이벤트에서 실행", icon: "/check.png", tone: "amber" },
  { label: "마지막 동기화", value: "2분 전", detail: "GitHub 연결 정상", icon: "/synchro.png", tone: "purple" },
];

export default function RepositoriesPage() {
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("default");
  const visibleRepositories = repositories
    .filter((repository) => repository.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "name-asc") return a.name.localeCompare(b.name);
      if (sortOrder === "name-desc") return b.name.localeCompare(a.name);
      if (sortOrder === "findings") return b.findings - a.findings || a.name.localeCompare(b.name);
      return a.checkedMinutes - b.checkedMinutes;
    });
  return (
    <main className="repositories-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈">
          <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
        </Link>

        <DashboardNav active="repositories" />

        <div className="account-area">
          <button className="settings-button" aria-label="설정"><Settings size={21} /></button>
          <span className="account-avatar">KS</span>
          <span className="account-copy"><strong>김세원</strong><small>security@vibeguard.ai</small></span>
        </div>
      </header>

      <ScreenContent>
      <section className="repositories-heading" id="repositories">
        <div><h1>저장소</h1><p>보안 검증을 적용할 GitHub 저장소를 연결하고 관리합니다.</p></div>
        <div className="heading-buttons"><button>검사 정책</button><button>전체 저장소</button></div>
      </section>

      <div className="repository-layout">
        <div className="repository-main">
          <section className="stats-grid" aria-label="저장소 요약">
            {stats.map((stat) => (
              <article className={`stat-card ${stat.tone}`} key={stat.label}>
                <div><span>{stat.label}</span><strong>{stat.value}</strong><small>{stat.detail}</small></div>
                <Image src={stat.icon} alt="" width={90} height={90} />
              </article>
            ))}
          </section>

          <section className="repository-card">
            <div className="repository-card-header">
              <div><h2>저장소 목록</h2><p>연결된 저장소와 최근 검사 상태</p></div>
              <div className="repository-tools">
                <label htmlFor="repository-search">
                  <Search size={17} />
                  <input id="repository-search" aria-label="저장소 이름 검색" placeholder="검색" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} />
                  <button className="search-clear" type="button" aria-label="검색어 지우기" disabled={!query} onClick={() => setQuery("")}><X size={14} /></button>
                </label>
                <div className="repository-sort">
                  <select aria-label="저장소 정렬 기준" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
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

            <div className="repository-table" role="table" aria-label="저장소 목록">
              <div className="repository-row repository-table-head" role="row">
                <span>저장소</span><span>기본 브랜치</span><span>마지막 검사</span><span>분석 결과</span><span>상태</span>
              </div>
              {visibleRepositories.map((repository) => (
                <button className="repository-row" role="row" key={repository.name}>
                  <strong>{repository.name}</strong><span>{repository.branch}</span><span>{repository.checked}</span><span>{repository.result}</span><b className={repository.tone}>{repository.status}</b>
                </button>
              ))}
              {visibleRepositories.length === 0 && <p className="repository-empty" role="status">검색 결과가 없습니다.</p>}
            </div>
          </section>
        </div>

        <aside className="scan-panel" id="scan">
          <div className="scan-heading"><h2>스캔 시작</h2><p>선택한 저장소와 브랜치로 파이프라인을 실행합니다.</p></div>
          <div className="selected-repository"><div><strong>payment-api</strong><span>github.com/acme/payment-api</span></div><b>Python</b></div>
          <label className="scan-label" htmlFor="scan-branch">브랜치</label>
          <div className="branch-dropdown">
            <select className="branch-select" id="scan-branch" name="branch" defaultValue="main">
              <option value="main">main</option>
              <option value="develop">develop</option>
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
          <span className="scan-label">지원 등급</span>
          <div className="support-badges"><b>검증 지원 · pytest</b><b>lock 없음</b></div>
          <div className="scan-divider" />
          <dl className="scan-details">
            <div><dt>매니페스트</dt><dd>requirements.txt</dd></div>
            <div><dt>최근 검사</dt><dd>2분 전 · Finding 6건</dd></div>
            <div><dt>기본 브랜치</dt><dd>main</dd></div>
          </dl>
          <div className="regression-note">회귀 검증: 설치 컨테이너 → 네트워크 없는 pytest 컨테이너</div>
          <Link className="scan-start-button" href="/scan">스캔 시작</Link>
        </aside>
      </div>
      </ScreenContent>
    </main>
  );
}
