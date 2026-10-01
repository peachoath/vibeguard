"use client";

import { ChevronDown, Search, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { Sk } from "../components/skeleton";
import { ErrorView } from "../components/error-view";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { EmptyState } from "../components/empty-state";
import { useScanFindings, usePrefetch } from "@/lib/queries";

const SEVERITY_LABELS: Record<string, string> = {
  CRITICAL: "치명적",
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

const VERDICT_LABELS: Record<string, string> = {
  PATCH: "패치",
  IGNORE: "무시",
  MANUAL: "수동 확인",
};

function ResultsContent() {
  const params = useSearchParams();
  const scanId = params.get("scanId");

  const [severity, setSeverity] = useState("all");
  const [verdict, setVerdict] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("score-desc");

  const prefetch = usePrefetch();
  const findingsQuery = useScanFindings(scanId);
  const loading = !!scanId && findingsQuery.isPending;
  const error = findingsQuery.isError;
  const findings = useMemo(() => findingsQuery.data?.content ?? [], [findingsQuery.data]);

  const counts = useMemo(() => ({
    CRITICAL: findings.filter((f) => f.severity === "CRITICAL").length,
    HIGH: findings.filter((f) => f.severity === "HIGH").length,
    MEDIUM: findings.filter((f) => f.severity === "MEDIUM").length,
    LOW: findings.filter((f) => f.severity === "LOW").length,
  }), [findings]);

  const verdictCounts = useMemo(() => ({
    PATCH: findings.filter((f) => f.verdict === "PATCH").length,
    IGNORE: findings.filter((f) => f.verdict === "IGNORE").length,
    MANUAL: findings.filter((f) => f.verdict === "MANUAL").length,
  }), [findings]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return findings
      .filter((f) => severity === "all" || f.severity === severity)
      .filter((f) => verdict === "all" || f.verdict === verdict)
      .filter((f) => !needle || (f.packageName ?? "").toLowerCase().includes(needle) || (f.cveId ?? "").toLowerCase().includes(needle))
      .sort((a, b) => sort === "name" ? (a.packageName ?? "").localeCompare(b.packageName ?? "") : sort === "score-asc" ? (a.cvssScore ?? 0) - (b.cvssScore ?? 0) : (b.cvssScore ?? 0) - (a.cvssScore ?? 0));
  }, [findings, query, severity, verdict, sort]);

  const severities = [
    { id: "all", label: "전체", count: findings.length },
    { id: "CRITICAL", label: "치명적", count: counts.CRITICAL },
    { id: "HIGH", label: "높음", count: counts.HIGH },
    { id: "MEDIUM", label: "보통", count: counts.MEDIUM },
    { id: "LOW", label: "낮음", count: counts.LOW },
  ];

  return (
    <main className="results-page">
      <AppHeader active="results" />

      <ScreenContent>
        <section className="results-heading">
          <div><h1>보안 분석 결과</h1><p>검증된 취약점만 우선순위와 근거를 함께 표시합니다.</p></div>
          <div className="results-actions">
            <label>
              <select aria-label="위험도 필터" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                {severities.map((s) => <option key={s.id} value={s.id}>{s.id === "all" ? "위험도" : s.label}</option>)}
              </select>
              <ChevronDown size={13} />
            </label>
            <label>
              <select aria-label="판정 상태 필터" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
                <option value="all">상태</option>
                <option value="PATCH">패치</option>
                <option value="IGNORE">무시</option>
                <option value="MANUAL">수동 확인</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>
        </section>

        <div className="results-layout">
          <aside className="results-filter">
            <h2>필터</h2><h3>심각도</h3>
            <div className="severity-options">
              {severities.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  className={`${s.id.toLowerCase()}${severity === s.id ? " active" : ""}`}
                  aria-pressed={severity === s.id}
                  onClick={() => setSeverity(s.id)}
                >
                  <span>{s.label}</span><b>{s.count}</b>
                </button>
              ))}
            </div>
            <div className="filter-divider" />
            <h3>판정</h3>
            <div className="verdict-options">
              <button type="button" className={verdict === "PATCH" ? "active patch" : "patch"} aria-pressed={verdict === "PATCH"} onClick={() => setVerdict(verdict === "PATCH" ? "all" : "PATCH")}><span>패치</span><b>{verdictCounts.PATCH}</b></button>
              <button type="button" className={verdict === "IGNORE" ? "active ignore" : "ignore"} aria-pressed={verdict === "IGNORE"} onClick={() => setVerdict(verdict === "IGNORE" ? "all" : "IGNORE")}><span>무시</span><b>{verdictCounts.IGNORE}</b></button>
              <button type="button" className={verdict === "MANUAL" ? "active manual" : "manual"} aria-pressed={verdict === "MANUAL"} onClick={() => setVerdict(verdict === "MANUAL" ? "all" : "MANUAL")}><span>수동 확인</span><b>{verdictCounts.MANUAL}</b></button>
            </div>
            <Link className="filter-history-link" href="/history" scroll={false}>검사 이력 보기</Link>
          </aside>

          <div className="results-main">
            <section className="risk-summary" aria-label="위험도 요약">
              <article className="critical"><span>치명적</span><strong>{counts.CRITICAL}</strong><small>즉시 수정 권장</small><Image className="risk-summary-icon" src="/finding_1.png" alt="치명적 위험" width={396} height={396} unoptimized /></article>
              <article className="high"><span>높음</span><strong>{counts.HIGH}</strong><small>확인 필요</small><Image className="risk-summary-icon" src="/finding_2.png" alt="높은 위험" width={396} height={396} unoptimized /></article>
              <article className="moderate"><span>보통</span><strong>{counts.MEDIUM}</strong><small>낮은 위험</small><Image className="risk-summary-icon" src="/finding_3.png" alt="보통 위험" width={396} height={396} unoptimized /></article>
              <article className="excluded"><span>제외됨</span><strong>{counts.LOW}</strong><small>오탐 제거</small><Image className="risk-summary-icon" src="/finding_4.png" alt="제외된 항목" width={396} height={396} unoptimized /></article>
            </section>

            <section className="findings-card">
              <div className="findings-toolbar">
                <div><h2>Finding 목록</h2><p>취약 라이브러리 · 공식 DB 근거 · 최소 안전 버전 · 회귀 상태</p></div>
                <div className="findings-controls">
                  <label className="findings-search">
                    <Search size={13} />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="패키지 또는 CVE 검색" aria-label="패키지 또는 CVE 검색" />
                  </label>
                  <label className="finding-select">
                    <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Finding 정렬">
                      <option value="score-desc">높은 위험순</option>
                      <option value="score-asc">낮은 위험순</option>
                      <option value="name">이름순</option>
                    </select>
                    <ChevronDown size={15} />
                  </label>
                </div>
              </div>

              {error && !loading && <ErrorView onRetry={() => findingsQuery.refetch()} />}
              {!scanId && !loading && <p className="findings-empty">검사를 먼저 선택하세요. <Link href="/history">검사 이력 보기</Link></p>}

              <div className="findings-table-wrap">
                <table className="findings-table">
                  <thead>
                    <tr>
                      <th>패키지</th>
                      <th>CVE / CVSS</th>
                      <th>버전 변경</th>
                      <th>심각도</th>
                      <th>판정</th>
                      <th>상태</th>
                      <th>동작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && Array.from({ length: 5 }, (_, i) => (
                      <tr key={i} aria-hidden="true">
                        <td><Sk w="80%" h={13} /></td>
                        <td><Sk w="75%" h={13} /></td>
                        <td><Sk w="85%" h={13} /></td>
                        <td><Sk w={56} h={22} r={8} /></td>
                        <td><Sk w={52} h={22} r={8} /></td>
                        <td><Sk w={64} h={22} r={8} /></td>
                        <td><Sk w={56} h={13} /></td>
                      </tr>
                    ))}
                    {!loading && visible.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.packageName ?? item.filePath ?? "-"}</strong></td>
                        <td>{item.cveId ?? item.ruleId ?? "-"}{item.cvssScore ? ` · ${item.cvssScore}` : ""}</td>
                        <td>
                          {item.currentVersion && item.recommendedVersion
                            ? <strong>{item.currentVersion} → {item.recommendedVersion}</strong>
                            : "-"}
                        </td>
                        <td><span className={`severity-badge ${item.severity.toLowerCase()}`}>{SEVERITY_LABELS[item.severity] ?? item.severity}</span></td>
                        <td>
                          <span className={`finding-verdict ${item.verdict === "MANUAL" ? "manual" : item.verdict === "IGNORE" ? "ignore" : "patch"}`}>
                            {VERDICT_LABELS[item.verdict] ?? item.verdict}
                          </span>
                        </td>
                        <td><span className={`finding-regression ${item.status.toLowerCase()}`}>{item.status}</span></td>
                        <td><Link className="finding-detail-link" href={`/findings/${item.id}`} scroll={false} onMouseEnter={() => prefetch.finding(item.id)} onFocus={() => prefetch.finding(item.id)}>상세 보기 →</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!loading && visible.length === 0 && findings.length > 0 && (
                  <p className="findings-empty">조건에 맞는 Finding이 없습니다.</p>
                )}
                {!loading && findings.length === 0 && scanId && (
                  <EmptyState
                    tone="positive"
                    icon={<ShieldCheck size={28} />}
                    title="취약점이 발견되지 않았습니다"
                    description="이 스캔에서 모든 의존성이 안전합니다."
                  />
                )}
              </div>
            </section>
          </div>
        </div>
      </ScreenContent>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={null}>
      <ResultsContent />
    </Suspense>
  );
}
