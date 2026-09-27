"use client";

import { ArrowUp, ChevronDown, ListFilter, MoreHorizontal, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import DashboardNav from "../components/dashboard-nav";
import ScreenContent from "../components/screen-content";

const trendSeries = {
  week: [
    { short: "9/21", long: "9월 21일", rate: 62, passed: "8/13" },
    { short: "9/22", long: "9월 22일", rate: 44, passed: "7/16" },
    { short: "9/23", long: "9월 23일", rate: 38, passed: "6/16" },
    { short: "9/24", long: "9월 24일", rate: 74, passed: "11/15" },
    { short: "9/25", long: "9월 25일", rate: 51, passed: "10/20" },
    { short: "9/26", long: "9월 26일", rate: 60, passed: "12/20" },
    { short: "9/27", long: "9월 27일", rate: 84, passed: "16/19" },
  ],
  eightWeeks: [
    { short: "8/3", long: "8월 3일", rate: 48, passed: "12/25" },
    { short: "8/10", long: "8월 10일", rate: 55, passed: "16/29" },
    { short: "8/17", long: "8월 17일", rate: 61, passed: "19/31" },
    { short: "8/24", long: "8월 24일", rate: 68, passed: "21/31" },
    { short: "8/31", long: "8월 31일", rate: 64, passed: "18/28" },
    { short: "9/7", long: "9월 7일", rate: 72, passed: "23/32" },
    { short: "9/14", long: "9월 14일", rate: 78, passed: "25/32" },
    { short: "9/21", long: "9월 21일", rate: 81, passed: "26/32" },
  ],
} as const;

const recentScans = [
  { repo: "payment-api", status: "완료", tone: "complete", findings: 6, tests: "24/24", pr: "#42", time: "2분 전" },
  { repo: "auth-service", status: "회귀 차단", tone: "blocked", findings: 2, tests: "23/24", pr: "—", time: "18분 전" },
  { repo: "web-client", status: "테스트 없음", tone: "untested", findings: 3, tests: "—", pr: "#39", time: "1시간 전" },
] as const;

export default function DashboardPage() {
  const [range, setRange] = useState("30");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const [trendRange, setTrendRange] = useState<keyof typeof trendSeries>("week");
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const weeklyData = trendSeries[trendRange];

  function exportSummary() {
    const csv = ["repository,status,findings,tests,pr,time", ...recentScans.map((scan) => [scan.repo, scan.status, scan.findings, scan.tests, scan.pr, scan.time].join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `vibeguard-security-${range}days.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="security-dashboard-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈"><Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority /></Link>
        <DashboardNav active="dashboard" />
        <div className="account-area">
          <button className="settings-button" aria-label="설정"><Settings size={21} /></button>
          <span className="account-avatar">KS</span><span className="account-copy"><strong>김세원</strong><small>security@vibeguard.ai</small></span>
        </div>
      </header>

      <ScreenContent>
        <section className="security-heading">
          <div><h1>보안 현황</h1><p>VibeGuard의 현재 보안 현황과 검증된 패치 성과를 확인합니다.</p></div>
          <div className="security-controls">
            <label><select value={range} onChange={(event) => setRange(event.target.value)} aria-label="보안 현황 기간"><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option></select><ChevronDown size={13} /></label>
            <button type="button" onClick={exportSummary}><ArrowUp size={13} /> 내보내기</button>
            <button type="button" className={filtersVisible ? "active" : ""} onClick={() => setFiltersVisible((value) => !value)}><ListFilter size={13} /> 필터</button>
          </div>
        </section>

        <section className="security-kpis" aria-label="보안 현황 요약">
          <article className="primary"><span>미조치 취약점</span><strong>18</strong><small>6개 치명적 · 지난달 대비 -12%</small></article>
          <article><span>회귀 통과</span><strong>18</strong><small>78% 성공 · 18/23</small></article>
          <article><span>회귀 차단</span><strong>3</strong><small>PR 차단 · 안전하게 차단</small></article>
          <article><span>생성된 PR</span><strong>14</strong><small>자동 머지 없음 · 사람 리뷰 필요</small></article>
        </section>

        {filtersVisible && <div className="security-filter-note" role="status">전체 저장소 · 모든 심각도 · 검증 완료 포함</div>}

        <div className="security-chart-row">
          <section className="patch-trend-card">
            <div className="security-card-heading"><div><h2>패치 성공률 추이</h2><p>{trendRange === "week" ? "최근 7일" : "최근 8주"} · 패치 후 기존 테스트 전체 통과 비율</p></div><label className="trend-range-select"><select value={trendRange} onChange={(event) => { setTrendRange(event.target.value as keyof typeof trendSeries); setHoveredWeek(null); }} aria-label="패치 성공률 조회 기간"><option value="week">9월 21일–9월 27일</option><option value="eightWeeks">최근 8주</option></select><ChevronDown size={15} /></label></div>
            <div className="trend-chart">
              <div className="trend-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
              <div className="trend-plot" style={{ gridTemplateColumns: `repeat(${weeklyData.length}, minmax(0, 1fr))` }}>
                {weeklyData.map((week, index) => (
                  <button
                    type="button"
                    className="trend-column"
                    key={week.short}
                    aria-label={`${week.long} 회귀 통과율 ${week.rate}%, ${week.passed} 통과`}
                    onMouseEnter={() => setHoveredWeek(index)}
                    onMouseLeave={() => setHoveredWeek(null)}
                    onFocus={() => setHoveredWeek(index)}
                    onBlur={() => setHoveredWeek(null)}
                  >
                    <div className={index === hoveredWeek ? "trend-bar active" : "trend-bar"} style={{ height: `${week.rate}%` }} />
                    {index === hoveredWeek && <div className="trend-tooltip"><span>{week.long}</span><small>회귀 통과율</small><b>{week.rate}%</b><em>● {week.passed} 통과</em></div>}
                    <small>{week.short}</small>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="regression-rate-card">
            <div className="security-card-heading"><h2>회귀 통과율</h2><button type="button" aria-label="회귀 통과율 메뉴" aria-expanded={rateMenuOpen} onClick={() => setRateMenuOpen((value) => !value)} onKeyDown={(event) => { if (event.key === "Escape") setRateMenuOpen(false); }}><MoreHorizontal size={17} /></button></div>
            {rateMenuOpen && <div className="rate-card-menu"><Link href="/results" scroll={false} onClick={() => setRateMenuOpen(false)}>분석 결과 보기</Link><Link href="/history" scroll={false} onClick={() => setRateMenuOpen(false)}>검사 이력 보기</Link><button type="button" onClick={() => { exportSummary(); setRateMenuOpen(false); }}>요약 내보내기</button></div>}
            <div className="gauge"><div><strong>78%</strong><span>회귀 통과율</span></div></div>
            <div className="gauge-summary"><div><span>회귀 통과</span><strong>18 / 23</strong></div><div><span>차단됨</span><strong>회귀 차단 3건</strong></div></div>
          </section>
        </div>

        <div className="security-bottom-row">
          <section className="recent-scans-card">
            <div className="security-card-heading"><div><h2>최근 검사</h2><p>최근 파이프라인 결과와 PR 상태</p></div><Link href="/history" scroll={false}>검사 이력 보기</Link></div>
            <div className="recent-scan-table"><div className="recent-scan-head"><span>저장소</span><span>상태</span><span>Finding</span><span>테스트</span><span>PR</span><span>시간</span></div>{recentScans.map((scan) => <div className="recent-scan-row" key={scan.repo}><strong>{scan.repo}</strong><b className={scan.tone}>{scan.status}</b><span>{scan.findings}</span><span>{scan.tests}</span><a href="https://github.com/peachoath/vibeguard/pulls" target="_blank" rel="noreferrer">{scan.pr}</a><span>{scan.time}</span></div>)}</div>
          </section>

          <section className="severity-card">
            <div className="security-card-heading"><div><h2>심각도 분포</h2><p>현재 Finding 31건</p></div></div>
            <div className="severity-content"><div className="severity-donut"><strong>31</strong><span>건</span></div><ul><li className="critical"><span>치명적</span><b>6</b></li><li className="high"><span>높음</span><b>9</b></li><li className="medium"><span>보통</span><b>12</b></li><li className="low"><span>낮음</span><b>4</b></li></ul></div>
          </section>

          <section className="processing-card">
            <div className="security-card-heading"><div><h2>평균 처리 시간</h2><p>단계별 평균 소요 시간</p></div><strong>총 4분 12초</strong></div>
            <div className="processing-grid"><article className="scan"><span>스캔</span><strong>38초</strong></article><article className="verify"><span>검증</span><strong>54초</strong></article><article className="regression"><span>회귀</span><strong>126초</strong><small>최장</small></article><article className="pr"><span>PR</span><strong>34초</strong></article></div>
          </section>
        </div>
      </ScreenContent>
    </main>
  );
}
