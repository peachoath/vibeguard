"use client";

import { ArrowUp, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { type CSSProperties, useMemo, useState } from "react";
import { Sk } from "../components/skeleton";
import { ErrorView } from "../components/error-view";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { useDashboardSummary, useRepositories, useScans, type ScanDto } from "@/lib/queries";

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

/**
 * 회귀 통과율 — 회귀 테스트 단계까지 도달한 스캔 중 통과 비율.
 * COMPLETED(통과) / (COMPLETED + REGRESSION_BLOCKED(차단)). 패치 성공률과 달리
 * 패치 자체를 못 만든 PATCH_FAILED는 분모에서 제외한다.
 */
function regressionPassRate(scans: ScanDto[]): number {
  const completed = scans.filter((s) => s.status === "COMPLETED").length;
  const blocked = scans.filter((s) => s.status === "REGRESSION_BLOCKED").length;
  const total = completed + blocked;
  return total === 0 ? 0 : Math.round((completed / total) * 100);
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
  const summaryQuery = useDashboardSummary();
  const scansQuery = useScans({ poll: true });
  const reposQuery = useRepositories();
  const [rateMenuOpen, setRateMenuOpen] = useState(false);

  const summary = summaryQuery.data ?? null;
  const loading = summaryQuery.isPending || scansQuery.isPending || reposQuery.isPending;
  const error = summaryQuery.isError || scansQuery.isError || reposQuery.isError;

  const allScans = useMemo(() => scansQuery.data ?? [], [scansQuery.data]);
  const recentScans = useMemo(() => allScans.slice(0, 5), [allScans]);
  const regressionRate = useMemo(() => regressionPassRate(allScans), [allScans]);
  const repoMap = useMemo(
    () => Object.fromEntries((reposQuery.data ?? []).map((r) => [r.id, r.fullName])),
    [reposQuery.data],
  );

  function load() {
    summaryQuery.refetch();
    scansQuery.refetch();
    reposQuery.refetch();
  }

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
    link.download = "vibeguard-security-summary.csv";
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
            <button type="button" onClick={exportSummary}><ArrowUp size={13} /> 내보내기</button>
          </div>
        </section>

        {error && !loading && <ErrorView onRetry={load} />}

        {loading ? (
          <div aria-hidden="true">
            <section className="security-kpis">
              {Array.from({ length: 4 }, (_, i) => (
                <article key={i} style={{ padding: "15px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <Sk w={80} h={12} r={4} />
                  <Sk w={55} h={30} r={6} />
                  <Sk w={110} h={11} r={4} />
                </article>
              ))}
            </section>
            <div className="security-chart-row" style={{ marginTop: 20 }}>
              <section className="patch-trend-card"><Sk h={180} r={10} /></section>
              <section className="regression-rate-card"><Sk h={180} r={10} /></section>
            </div>
            <div className="security-bottom-row" style={{ marginTop: 18 }}>
              <section className="recent-scans-card">
                <div className="security-card-heading" style={{ marginBottom: 12 }}>
                  <div><Sk w={80} h={16} /><Sk w={140} h={11} r={4} style={{ marginTop: 4 }} /></div>
                </div>
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="recent-scan-row">
                    <Sk w="55%" h={13} />
                    <Sk w="40%" h={13} />
                    <Sk w={64} h={22} r={8} />
                    <Sk w="35%" h={13} />
                  </div>
                ))}
              </section>
              <section className="severity-card"><Sk h={160} r={10} /></section>
              <section className="processing-card"><Sk h={80} r={10} /></section>
            </div>
          </div>
        ) : (
          <>
            <section className="security-kpis" aria-label="보안 현황 요약">
              <article className="primary"><span>미조치 취약점</span><strong>{totalFindings}</strong><small>{dist.CRITICAL ?? 0}개 치명적</small></article>
              <article><span>패치 성공률</span><strong>{patchRate}%</strong><small>검증 완료 기준</small></article>
              <article><span>생성된 PR</span><strong>{summary?.totalPrs ?? 0}</strong><small>자동 머지 없음 · 사람 리뷰 필요</small></article>
              <article><span>총 스캔</span><strong>{summary?.totalScans ?? 0}</strong><small>전체 스캔 수</small></article>
            </section>

            <div className="security-chart-row">
              <section className="patch-trend-card">
                <div className="security-card-heading">
                  <div><h2>패치 성공률</h2><p>패치 후 기존 테스트 전체 통과 비율</p></div>
                </div>
                <div className="gauge" style={{ "--gauge-deg": `${Math.round(patchRate * 1.8)}deg` } as CSSProperties}>
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
                <div className="gauge" style={{ "--gauge-deg": `${Math.round(regressionRate * 1.8)}deg` } as CSSProperties}>
                  <div><strong>{regressionRate}%</strong><span>회귀 통과율</span></div>
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
                  {recentScans.length === 0 && (
                    <div className="empty-state empty-state-sm">
                      <svg className="empty-state-icon" width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3>스캔 기록이 없습니다</h3>
                      <p>저장소를 연결하고 첫 스캔을 실행해보세요.</p>
                      <Link className="empty-cta" href="/repositories">저장소 관리</Link>
                    </div>
                  )}
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
