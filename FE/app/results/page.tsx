"use client";

import { ChevronDown, Search, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import DashboardNav from "../components/dashboard-nav";
import ScreenContent from "../components/screen-content";

const findings = [
  { pkg: "pyyaml", cve: "CVE-2019-20477", score: 9.8, severity: "critical", version: "5.1 → 5.4", evidence: "NVD · OSV · GHSA", verdict: "패치", regression: "24/24 PASS", regressionTone: "pass" },
  { pkg: "urllib3", cve: "CVE-2023-45803", score: 8.1, severity: "high", version: "1.24.1 → 1.26.18", evidence: "NVD · OSV", verdict: "패치", regression: "검증 완료", regressionTone: "neutral" },
  { pkg: "jinja2", cve: "CVE-2024-22195", score: 7.5, severity: "high", version: "3.1.2 → 3.1.4", evidence: "GHSA · OSV", verdict: "패치", regression: "대기", regressionTone: "waiting" },
  { pkg: "cryptography", cve: "CVE-2023-49083", score: 7.8, severity: "high", version: "41.0.2 → 41.0.6", evidence: "NVD · GHSA", verdict: "수동 확인", regression: "lock 재생성", regressionTone: "manual" },
  { pkg: "idna", cve: "CVE-2024-3651", score: 6.5, severity: "moderate", version: "3.4 → 3.7", evidence: "OSV", verdict: "무시", regression: "영향 없음", regressionTone: "neutral" },
] as const;

const severities = [
  { id: "all", label: "전체", count: 31 },
  { id: "critical", label: "치명적", count: 6 },
  { id: "high", label: "높음", count: 9 },
  { id: "moderate", label: "보통", count: 12 },
  { id: "low", label: "낮음", count: 4 },
] as const;

export default function ResultsPage() {
  const [severity, setSeverity] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("score-desc");

  const visibleFindings = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return findings
      .filter((item) => severity === "all" || item.severity === severity)
      .filter((item) => verdict === "all" || item.verdict === verdict)
      .filter((item) => !needle || item.pkg.includes(needle) || item.cve.toLowerCase().includes(needle))
      .sort((a, b) => sort === "name" ? a.pkg.localeCompare(b.pkg) : sort === "score-asc" ? a.score - b.score : b.score - a.score);
  }, [query, severity, sort, verdict]);

  return (
    <main className="results-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈">
          <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
        </Link>
        <DashboardNav active="results" />
        <div className="account-area">
          <button className="settings-button" aria-label="설정"><Settings size={21} /></button>
          <span className="account-avatar">KS</span>
          <span className="account-copy"><strong>김세원</strong><small>security@vibeguard.ai</small></span>
        </div>
      </header>

      <ScreenContent>
        <section className="results-heading">
          <div><h1>보안 분석 결과</h1><p>검증된 취약점만 우선순위와 근거를 함께 표시합니다.</p></div>
          <div className="results-actions">
            <label><select aria-label="위험도 필터" value={severity} onChange={(event) => setSeverity(event.target.value)}>{severities.map((item) => <option key={item.id} value={item.id}>{item.id === "all" ? "위험도" : item.label}</option>)}</select><ChevronDown size={13} /></label>
            <label><select aria-label="판정 상태 필터" value={verdict} onChange={(event) => setVerdict(event.target.value)}><option value="all">상태</option><option value="패치">패치</option><option value="무시">무시</option><option value="수동 확인">수동 확인</option></select><ChevronDown size={13} /></label>
            <a className="results-pr-link" href="https://github.com/peachoath/vibeguard/pulls" target="_blank" rel="noreferrer">→ GitHub PR 열기</a>
          </div>
        </section>

        <div className="results-layout">
          <aside className="results-filter">
            <h2>필터</h2><h3>심각도</h3>
            <div className="severity-options">
              {severities.map((item) => <button key={item.id} className={severity === item.id ? "active" : item.id} onClick={() => setSeverity(item.id)}><span>{item.label}</span><b>{item.count}</b></button>)}
            </div>
            <div className="filter-divider" />
            <h3>판정</h3>
            <div className="verdict-options">
              <button className={verdict === "패치" ? "active patch" : "patch"} onClick={() => setVerdict(verdict === "패치" ? "all" : "패치")}><span>패치</span><b>18</b></button>
              <button className={verdict === "무시" ? "active ignore" : "ignore"} onClick={() => setVerdict(verdict === "무시" ? "all" : "무시")}><span>무시</span><b>7</b></button>
              <button className={verdict === "수동 확인" ? "active manual" : "manual"} onClick={() => setVerdict(verdict === "수동 확인" ? "all" : "수동 확인")}><span>수동 확인</span><b>6</b></button>
            </div>
            <Link className="filter-history-link" href="/history" scroll={false}>검사 이력 보기</Link>
          </aside>

          <div className="results-main">
            <section className="risk-summary" aria-label="위험도 요약">
              <article className="critical"><span>치명적</span><strong>6</strong><small>즉시 수정 권장</small></article>
              <article className="high"><span>높음</span><strong>9</strong><small>확인 필요</small></article>
              <article className="moderate"><span>보통</span><strong>12</strong><small>낮은 위험</small></article>
              <article className="excluded"><span>제외됨</span><strong>4</strong><small>오탐 제거</small></article>
            </section>

            <section className="findings-card">
              <div className="findings-toolbar">
                <div><h2>Finding 목록</h2><p>취약 라이브러리 · 공식 DB 근거 · 최소 안전 버전 · 회귀 상태</p></div>
                <div className="findings-controls">
                  <label className="findings-search"><Search size={13} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="패키지 또는 CVE 검색" aria-label="패키지 또는 CVE 검색" /></label>
                  <label className="finding-select"><select value={verdict} onChange={(event) => setVerdict(event.target.value)} aria-label="Finding 상태"><option value="all">상태</option><option value="패치">패치</option><option value="무시">무시</option><option value="수동 확인">수동 확인</option></select><ChevronDown size={15} /></label>
                  <label className="finding-select"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Finding 정렬"><option value="score-desc">정렬</option><option value="score-asc">낮은 위험순</option><option value="name">이름순</option></select><ChevronDown size={15} /></label>
                </div>
              </div>
              <div className="findings-table-wrap">
                <table className="findings-table">
                  <thead><tr><th>패키지</th><th>CVE / CVSS</th><th>버전 변경</th><th>근거</th><th>판정</th><th>회귀</th><th>동작</th></tr></thead>
                  <tbody>{visibleFindings.map((item) => <tr key={item.pkg}><td><strong>{item.pkg}</strong></td><td>{item.cve} · {item.score}</td><td><strong>{item.version}</strong></td><td>{item.evidence}</td><td><span className={`finding-verdict ${item.verdict === "수동 확인" ? "manual" : item.verdict === "무시" ? "ignore" : "patch"}`}>{item.verdict}</span></td><td><span className={`finding-regression ${item.regressionTone}`}>{item.regression}</span></td><td><Link className="finding-detail-link" href={`/results/${item.pkg}`} scroll={false}>상세 보기 →</Link></td></tr>)}</tbody>
                </table>
                {visibleFindings.length === 0 && <p className="findings-empty">조건에 맞는 Finding이 없습니다.</p>}
              </div>
            </section>
          </div>
        </div>
      </ScreenContent>
    </main>
  );
}
