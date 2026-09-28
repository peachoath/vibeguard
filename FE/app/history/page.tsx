"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Sk } from "../components/skeleton";
import { ErrorView } from "../components/error-view";
import AppHeader from "../components/app-header";
import ScreenContent from "../components/screen-content";
import { useRepositories, useScans } from "@/lib/queries";

function statusTone(status: string): string {
  if (status === "COMPLETED") return "complete";
  if (status === "REGRESSION_BLOCKED") return "blocked";
  if (status === "FAILED") return "failed";
  return "waiting";
}

function statusLabel(status: string): string {
  if (status === "COMPLETED") return "완료";
  if (status === "REGRESSION_BLOCKED") return "회귀 차단";
  if (status === "FAILED") return "실패";
  if (status === "QUEUED") return "대기 중";
  if (status === "RUNNING") return "진행 중";
  return status;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "-";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}분 ${s % 60}초` : `${s}초`;
}

export default function HistoryPage() {
  const scansQuery = useScans();
  const reposQuery = useRepositories();
  const [range, setRange] = useState("30");
  const [status, setStatus] = useState("all");
  // 페이지 진입 시각을 한 번만 고정 — 렌더 중 Date.now() 호출(비순수) 회피.
  const [now] = useState(() => Date.now());

  const scans = useMemo(() => scansQuery.data ?? [], [scansQuery.data]);
  const loading = scansQuery.isPending || reposQuery.isPending;
  const error = scansQuery.isError || reposQuery.isError;
  const repoMap = useMemo(
    () => Object.fromEntries((reposQuery.data ?? []).map((r) => [r.id, r.fullName])),
    [reposQuery.data],
  );

  const visible = useMemo(() => {
    const rangeDays = parseInt(range, 10);
    return scans.filter((s) => {
      if (status !== "all" && statusTone(s.status) !== status) return false;
      if (s.startedAt && (now - new Date(s.startedAt).getTime()) > rangeDays * 86_400_000) return false;
      return true;
    });
  }, [scans, status, range, now]);

  const summary = useMemo(() => ({
    complete: scans.filter((s) => s.status === "COMPLETED").length,
    clean: scans.filter((s) => s.status === "COMPLETED" && !s.errorCode).length,
    failed: scans.filter((s) => s.status === "FAILED").length,
    blocked: scans.filter((s) => s.status === "REGRESSION_BLOCKED").length,
  }), [scans]);

  function exportCsv() {
    const rows = visible.map((s) => [
      s.startedAt ? new Date(s.startedAt).toLocaleString("ko-KR") : "-",
      repoMap[s.repositoryId] ?? s.repositoryId,
      s.ref,
      statusLabel(s.status),
      formatDuration(s.durationMs),
      s.errorCode ?? "-",
    ].join(","));
    const csv = ["time,repository,branch,status,duration,error", ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `vibeguard-history-${range}days.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="history-page">
      <AppHeader active="history" />

      <ScreenContent>
        <section className="history-heading">
          <div><h1>검사 이력</h1><p>과거 검사와 패치 결과, PR 상태를 시간순으로 추적합니다.</p></div>
          <div className="history-controls">
            <label>
              <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="조회 기간">
                <option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="검사 상태">
                <option value="all">전체 상태</option>
                <option value="complete">완료</option>
                <option value="blocked">회귀 차단</option>
                <option value="failed">실패</option>
                <option value="waiting">진행 중</option>
              </select>
              <ChevronDown size={13} />
            </label>
            <button type="button" onClick={exportCsv}>내보내기</button>
          </div>
        </section>

        <section className="history-summary" aria-label="검사 이력 요약">
          <article className="complete"><span>완료</span><strong>{summary.complete}</strong><small>검증 완료</small><Image src="/history_1.png" alt="" width={440} height={440} unoptimized /></article>
          <article className="clean"><span>발견 없음</span><strong>{summary.clean}</strong><small>안전한 스캔</small><Image src="/history_2.png" alt="" width={440} height={440} unoptimized /></article>
          <article className="failed"><span>패치 실패</span><strong>{summary.failed}</strong><small>수정 후보 없음</small><Image src="/history_3.png" alt="" width={440} height={440} unoptimized /></article>
          <article className="blocked"><span>회귀 차단</span><strong>{summary.blocked}</strong><small>PR 생성 차단</small><Image src="/history_4.png" alt="" width={440} height={440} unoptimized /></article>
          <Link className="history-dashboard-link" href="/dashboard" scroll={false}>보안 현황</Link>
        </section>

        <section className="history-timeline-card">
          <div className="history-card-heading">
            <div><h2>스캔 타임라인</h2><p>완료·차단·증명 없음·설치 실패 등 종료 원인을 숨기지 않고 보존합니다.</p></div>
          </div>

          {error && !loading && <ErrorView onRetry={() => { scansQuery.refetch(); reposQuery.refetch(); }} />}

          <div className="history-timeline" tabIndex={0} aria-label="스캔 이력 목록">
            {loading && Array.from({ length: 4 }, (_, i) => (
              <article key={i} className="sk-history-row" aria-hidden="true">
                <div className="history-repository">
                  <Sk w={100} h={10} r={4} />
                  <Sk w={180} h={13} r={4} style={{ marginTop: 6 }} />
                </div>
                <Sk w={80} h={28} r={14} />
                <Sk w={90} h={12} r={4} />
                <Sk w={44} h={12} r={4} />
                <Sk w={70} h={28} r={14} />
              </article>
            ))}
            {!loading && visible.map((scan) => (
              <article className={`history-row ${statusTone(scan.status)}`} key={scan.id}>
                <span className="timeline-dot" aria-hidden="true" />
                <div className="history-repository">
                  <time>{scan.startedAt ? new Date(scan.startedAt).toLocaleString("ko-KR") : "-"}</time>
                  <strong>{repoMap[scan.repositoryId] ?? "…"} / {scan.ref}</strong>
                </div>
                <span className="history-state">{statusLabel(scan.status)}</span>
                <p>{scan.commitSha ? `커밋 ${scan.commitSha.slice(0, 7)}` : "커밋 정보 없음"}</p>
                <b>{formatDuration(scan.durationMs)}</b>
                <Link className="history-detail" href={`/results?scanId=${scan.id}`} scroll={false}>상세 보기 →</Link>
              </article>
            ))}
            {!loading && visible.length === 0 && (
              scans.length === 0 ? (
                <div className="empty-state" style={{ alignSelf: "center" }}>
                  <svg className="empty-state-icon" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3>스캔 기록이 없습니다</h3>
                  <p>저장소를 연결하고 스캔을 실행하면 이력이 쌓입니다.</p>
                  <Link className="empty-cta" href="/repositories">저장소 관리</Link>
                </div>
              ) : (
                <p className="history-empty" style={{ alignSelf: "center" }}>선택한 조건의 검사 이력이 없습니다.</p>
              )
            )}
          </div>
        </section>
      </ScreenContent>
    </main>
  );
}
