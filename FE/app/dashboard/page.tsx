"use client";

import { ArrowUp, ChevronDown, ListFilter, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { apiFetch } from "@/lib/api";

interface SummaryDto {
  severityDistribution: Record<string, number>;
  patchSuccessRate: number;
  avgDurationMs: number | null;
  totalScans: number;
  totalPrs: number;
}

interface ScanDto {
  id: string;
  repositoryId: string;
  ref: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

interface Repository {
  id: string;
  fullName: string;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

function statusTone(status: string): string {
  if (status === "COMPLETED") return "complete";
  if (status === "REGRESSION_BLOCKED") return "blocked";
  if (status === "FAILED") return "failed";
  return "untested";
}

function statusLabel(status: string): string {
  if (status === "COMPLETED") return "완료";
  if (status === "REGRESSION_BLOCKED") return "회귀 차단";
  if (status === "FAILED") return "실패";
  if (status === "QUEUED") return "대기 중";
  if (status === "RUNNING") return "진행 중";
  return status;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryDto | null>(null);
  const [recentScans, setRecentScans] = useState<ScanDto[]>([]);
  const [repoMap, setRepoMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("30");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [rateMenuOpen, setRateMenuOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<SummaryDto>("/api/v1/dashboard/summary"),
      apiFetch<ScanDto[]>("/api/v1/scans"),
      apiFetch<Repository[]>("/api/v1/repositories"),
    ])
      .then(([sum, scans, repos]) => {
        setSummary(sum);
        setRecentScans(scans.slice(0, 5));
        setRepoMap(Object.fromEntries(repos.map((r) => [r.id, r.fullName])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const dist = summary?.severityDistribution ?? {};
  const totalFindings = Object.values(dist).reduce((a, b) => a + b, 0);
  const patchRate = summary ? Math.round(summary.patchSuccessRate * 100) : 0;

  function exportSummary() {
    const rows = recentScans.map((s) => [
      repoMap[s.repositoryId] ?? s.repositoryId,
      s.ref,
      statusLabel(s.status),
      s.startedAt ? new Date(s.startedAt).toLocaleString("ko-KR") : "-",
    ].join(","));
    const csv = ["repository,branch,status,time", ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `vibeguard-security-${range}days.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="security-dashboard-page">
      <AppHeader active="dashboard" />

      <ScreenContent>
        <section className="security-heading">
          <div><h1>보안 현황</h1><p>VibeGuard의 현재 보안 현황과 검증된 패치 성과를 확인합니다.</p></div>
          <div className="security-controls">
            <label>
              <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="보안 현황 기간">
                <option value="7">최근 7일</option>
                <option value="30">최근 30일</option>
                <option value="90">최근 90일</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <button type="button" onClick={exportSummary}><ArrowUp size={13} /> 내보내기</button>
            <button type="button" className={filtersVisible ? "active" : ""} onClick={() => setFiltersVisible((v) => !v)}><ListFilter size={13} /> 필터</button>
          </div>
        </section>

        {loading ? (
          <p className="history-empty">불러오는 중…</p>
        ) : (
          <>
            <section className="security-kpis" aria-label="보안 현황 요약">
              <article className="primary"><span>미조치 취약점</span><strong>{totalFindings}</strong><small>{dist.CRITICAL ?? 0}개 치명적</small></article>
              <article><span>패치 성공률</span><strong>{patchRate}%</strong><small>검증 완료 기준</small></article>
              <article><span>생성된 PR</span><strong>{summary?.totalPrs ?? 0}</strong><small>자동 머지 없음 · 사람 리뷰 필요</small></article>
              <article><span>총 스캔</span><strong>{summary?.totalScans ?? 0}</strong><small>전체 스캔 수</small></article>
            </section>

            {filtersVisible && <div className="security-filter-note" role="status">전체 저장소 · 모든 심각도 · 검증 완료 포함</div>}

            <div className="security-chart-row">
              <section className="patch-trend-card">
                <div className="security-card-heading">
                  <div><h2>패치 성공률</h2><p>패치 후 기존 테스트 전체 통과 비율</p></div>
                </div>
                <div className="gauge">
                  <div><strong>{patchRate}%</strong><span>패치 성공률</span></div>
                </div>
                <div className="gauge-summary">
                  <div><span>평균 처리 시간</span><strong>{formatDuration(summary?.avgDurationMs ?? null)}</strong></div>
                  <div><span>총 스캔</span><strong>{summary?.totalScans ?? 0}건</strong></div>
                </div>
              </section>

              <section className="regression-rate-card">
                <div className="security-card-heading">
                  <h2>회귀 통과율</h2>
                  <button type="button" aria-label="메뉴" aria-expanded={rateMenuOpen} onClick={() => setRateMenuOpen((v) => !v)}>
                    <MoreHorizontal size={17} />
                  </button>
                </div>
                {rateMenuOpen && (
                  <div className="rate-card-menu">
                    <Link href="/results" scroll={false} onClick={() => setRateMenuOpen(false)}>분석 결과 보기</Link>
                    <Link href="/history" scroll={false} onClick={() => setRateMenuOpen(false)}>검사 이력 보기</Link>
                    <button type="button" onClick={() => { exportSummary(); setRateMenuOpen(false); }}>요약 내보내기</button>
                  </div>
                )}
                <div className="gauge">
                  <div><strong>{patchRate}%</strong><span>회귀 통과율</span></div>
                </div>
                <div className="gauge-summary">
                  <div><span>총 PR</span><strong>{summary?.totalPrs ?? 0}건</strong></div>
                </div>
              </section>
            </div>

            <div className="security-bottom-row">
              <section className="recent-scans-card">
                <div className="security-card-heading">
                  <div><h2>최근 검사</h2><p>최근 파이프라인 결과</p></div>
                  <Link href="/history" scroll={false}>검사 이력 보기</Link>
                </div>
                <div className="recent-scan-table">
                  <div className="recent-scan-head"><span>저장소</span><span>브랜치</span><span>상태</span><span>시간</span></div>
                  {recentScans.map((scan) => (
                    <div className="recent-scan-row" key={scan.id}>
                      <strong>{repoMap[scan.repositoryId] ?? "…"}</strong>
                      <span>{scan.ref}</span>
                      <b className={statusTone(scan.status)}>{statusLabel(scan.status)}</b>
                      <span>{scan.startedAt ? new Date(scan.startedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</span>
                    </div>
                  ))}
                  {recentScans.length === 0 && <p className="history-empty">검사 기록이 없습니다.</p>}
                </div>
              </section>

              <section className="severity-card">
                <div className="security-card-heading"><div><h2>심각도 분포</h2><p>현재 Finding {totalFindings}건</p></div></div>
                <div className="severity-content">
                  <div className="severity-donut"><strong>{totalFindings}</strong><span>건</span></div>
                  <ul>
                    <li className="critical"><span>치명적</span><b>{dist.CRITICAL ?? 0}</b></li>
                    <li className="high"><span>높음</span><b>{dist.HIGH ?? 0}</b></li>
                    <li className="medium"><span>보통</span><b>{dist.MEDIUM ?? 0}</b></li>
                    <li className="low"><span>낮음</span><b>{dist.LOW ?? 0}</b></li>
                  </ul>
                </div>
              </section>

              <section className="processing-card">
                <div className="security-card-heading">
                  <div><h2>평균 처리 시간</h2><p>전체 스캔 평균</p></div>
                  <strong>{formatDuration(summary?.avgDurationMs ?? null)}</strong>
                </div>
              </section>
            </div>
          </>
        )}
      </ScreenContent>
    </main>
  );
}
