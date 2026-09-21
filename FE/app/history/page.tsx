"use client";

import { ChevronDown, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import DashboardNav from "../components/dashboard-nav";
import ScreenContent from "../components/screen-content";

const scans = [
  { time: "오늘 16:28", repo: "payment-api", branch: "main", state: "완료", tone: "complete", summary: "6 Finding · 24/24 PASS", duration: "4분 38초", pr: "PR #42 열기", pkg: "pyyaml" },
  { time: "오늘 15:52", repo: "auth-service", branch: "develop", state: "회귀 차단", tone: "blocked", summary: "23/24 · 1개 회귀 실패", duration: "5분 12초", pr: "PR 미생성", pkg: "urllib3" },
  { time: "오늘 14:10", repo: "web-client", branch: "main", state: "테스트 없음", tone: "untested", summary: "기존 테스트 없음 · 증명 없음", duration: "2분 44초", pr: "PR #39 열기", pkg: "jinja2" },
  { time: "어제 21:06", repo: "billing-worker", branch: "main", state: "설치 실패", tone: "failed", summary: "의존성 설치 실패 · Finding 스킵", duration: "3분 02초", pr: "PR 없음", pkg: "cryptography" },
  { time: "어제 18:31", repo: "api-gateway", branch: "main", state: "완료", tone: "complete", summary: "3 Finding · 110/110 PASS", duration: "4분 05초", pr: "PR #38 열기", pkg: "idna" },
] as const;

export default function HistoryPage() {
  const [range, setRange] = useState("30");
  const [status, setStatus] = useState("all");
  const [auditOpen, setAuditOpen] = useState(false);

  const visibleScans = useMemo(() => scans.filter((scan) => status === "all" || scan.tone === status), [status]);

  function exportCsv() {
    const csv = ["time,repository,branch,status,summary,duration,pr", ...visibleScans.map((scan) => [scan.time, scan.repo, scan.branch, scan.state, scan.summary, scan.duration, scan.pr].join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `vibeguard-history-${range}days.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="history-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈"><Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority /></Link>
        <DashboardNav active="history" />
        <div className="account-area">
          <button className="settings-button" aria-label="설정"><Settings size={21} /></button>
          <span className="account-avatar">KS</span><span className="account-copy"><strong>김세원</strong><small>security@vibeguard.ai</small></span>
        </div>
      </header>

      <ScreenContent>
        <section className="history-heading">
          <div><h1>검사 이력</h1><p>과거 검사와 패치 결과, PR 상태를 시간순으로 추적합니다.</p></div>
          <div className="history-controls">
            <label><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="조회 기간"><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select><ChevronDown size={13} /></label>
            <label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="검사 상태"><option value="all">전체 상태</option><option value="complete">완료</option><option value="blocked">회귀 차단</option><option value="untested">테스트 없음</option><option value="failed">설치 실패</option></select><ChevronDown size={13} /></label>
            <button type="button" onClick={exportCsv}>내보내기</button>
          </div>
        </section>

        <section className="history-summary" aria-label="검사 이력 요약">
          <article className="complete"><span>완료</span><strong>28</strong><small>검증 완료</small></article>
          <article className="clean"><span>발견 없음</span><strong>17</strong><small>안전한 스캔</small></article>
          <article className="failed"><span>패치 실패</span><strong>2</strong><small>수정 후보 없음</small></article>
          <article className="blocked"><span>회귀 차단</span><strong>3</strong><small>PR 생성 차단</small></article>
          <Link className="history-dashboard-link" href="/dashboard" scroll={false}>보안 현황</Link>
        </section>

        <section className="history-timeline-card">
          <div className="history-card-heading">
            <div><h2>스캔 타임라인</h2><p>완료·차단·증명 없음·설치 실패 등 종료 원인을 숨기지 않고 보존합니다.</p></div>
            <button type="button" className={auditOpen ? "active" : ""} onClick={() => setAuditOpen((value) => !value)}>감사 로그 보기</button>
          </div>
          {auditOpen && <p className="audit-message" role="status">모든 검사 상태 변경과 PR 생성 기록이 보존되고 있습니다.</p>}
          <div className="history-timeline" tabIndex={0} aria-label="스캔 이력 목록">
            {visibleScans.map((scan) => (
              <article className={`history-row ${scan.tone}`} key={`${scan.repo}-${scan.time}`}>
                <span className="timeline-dot" aria-hidden="true" />
                <div className="history-repository"><time>{scan.time}</time><strong>{scan.repo} / {scan.branch}</strong></div>
                <span className="history-state">{scan.state}</span>
                <p>{scan.summary}</p><b>{scan.duration}</b>
                {scan.pr.startsWith("PR #") ? <a className="history-pr" href="https://github.com/peachoath/vibeguard/pulls" target="_blank" rel="noreferrer">{scan.pr}</a> : <span className="history-pr unavailable">{scan.pr}</span>}
                <Link className="history-detail" href={`/results/${scan.pkg}`} scroll={false}>상세 보기 →</Link>
              </article>
            ))}
            {visibleScans.length === 0 && <p className="history-empty">선택한 상태의 검사 이력이 없습니다.</p>}
          </div>
        </section>
      </ScreenContent>
    </main>
  );
}
