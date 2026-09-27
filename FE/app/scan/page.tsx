"use client";

import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import DashboardNav from "../components/dashboard-nav";
import ScreenContent from "../components/screen-content";
import { useEffect, useState } from "react";

const activity = [
  { time: "16:31:02", agent: "A1", running: "Trivy 취약점 스캔 실행 중…", complete: "Trivy 스캔 완료 · 취약 라이브러리 14건", tone: "" },
  { time: "16:31:10", agent: "A1", running: "requirements.txt 패키지 분석 중…", complete: "requirements.txt 패키지 48개 분석 완료", tone: "" },
  { time: "16:31:18", agent: "A2", running: "NVD · OSV · GHSA 교차 검증 중…", complete: "NVD · OSV · GHSA 교차 검증 · 실제 패치 대상 6건", tone: "" },
  { time: "16:31:28", agent: "A2", running: "공식 보안 권고와 대조 중…", complete: "공식 보안 권고 근거 확인 완료", tone: "" },
  { time: "16:31:36", agent: "A2", running: "최소 안전 버전 계산 중…", complete: "pyyaml 최소 안전 버전 5.4 확인", tone: "info" },
  { time: "16:31:44", agent: "A3", running: "기준 환경 의존성 설치 중…", complete: "pip install -r requirements.txt 완료", tone: "" },
  { time: "16:31:52", agent: "A3", running: "패치 전 기준 테스트 실행 중…", complete: "패치 전 기준 테스트 24/24 PASS", tone: "success" },
  { time: "16:32:03", agent: "A3", running: "안전 버전으로 매니페스트 수정 중…", complete: "pyyaml 5.1 → 5.4 매니페스트 한 줄 변경", tone: "info" },
  { time: "16:32:10", agent: "A3", running: "패치 환경 컨테이너 생성 중…", complete: "격리 테스트 컨테이너 생성 완료", tone: "" },
  { time: "16:32:18", agent: "A3", running: "패치 후 의존성 설치 중…", complete: "패치 후 의존성 설치 완료", tone: "" },
  { time: "16:32:29", agent: "A3", running: "패치 후 기준 테스트 실행 중…", complete: "패치 후 기준 테스트 24/24 PASS", tone: "success" },
  { time: "16:32:38", agent: "A3", running: "네트워크 격리 상태 확인 중…", complete: "네트워크 격리 · 파일시스템 읽기 전용 확인", tone: "" },
  { time: "16:32:47", agent: "A4", running: "변경 사항과 검증 근거 정리 중…", complete: "변경 사항과 검증 근거 정리 완료", tone: "info" },
  { time: "16:32:56", agent: "A4", running: "보안 패치 PR 생성 중…", complete: "보안 패치 PR 생성 완료", tone: "success" },
] as const;

const pipeline = [
  { code: "A1", title: "탐지기", detail: "Trivy", description: "Trivy SCA 취약점 탐지", result: "14건 발견", threshold: 0 },
  { code: "A2", title: "검증기", detail: "DB 대조", description: "NVD · OSV · GHSA 교차 검증", result: "6건 확정", threshold: 22 },
  { code: "A3", title: "회귀 검증", detail: "전후 비교", description: "설치→테스트→상향 · 패치 전후 회귀 검증", result: "진행 중", threshold: 44 },
  { code: "A4", title: "PR 작성", detail: "PR 생성", description: "회귀 통과 후 PR 생성", result: "대기", threshold: 82 },
] as const;

export default function ScanPage() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const duration = 6000;
    const startedAt = performance.now();
    let frame = 0;

    const update = (now: number) => {
      const next = Math.min(100, Math.floor(((now - startedAt) / duration) * 100));
      setProgress(next);
      if (next < 100) frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, []);

  const remaining = Math.max(0, Math.ceil((100 - progress) * 0.06));
  const stage = progress < 22 ? "A1 탐지 단계" : progress < 44 ? "A2 검증 단계" : progress < 82 ? "A3 회귀 검증 단계" : progress < 100 ? "A4 PR 작성 단계" : "검사가 완료되었습니다";
  const activeLogIndex = Math.min(activity.length - 1, Math.floor((progress / 100) * activity.length));
  const visibleActivity = activity.slice(Math.max(0, activeLogIndex - 6), activeLogIndex + 1);

  return (
    <main className="scan-page">
      <header className="dashboard-header">
        <Link className="dashboard-brand" href="/" aria-label="Vibe Guard 홈">
          <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
        </Link>

        <DashboardNav active="scan" />

        <div className="account-area">
          <button className="settings-button" aria-label="설정"><Settings size={21} /></button>
          <span className="account-avatar">KS</span>
          <span className="account-copy"><strong>김세원</strong><small>security@vibeguard.ai</small></span>
        </div>
      </header>

      <ScreenContent>
      <section className="scan-page-heading">
        <div><h1>실시간 검사</h1><p>payment-api / main · 검사 #1842가 실시간으로 검증 중입니다.</p></div>
        <div className="heading-buttons"><button>검사 정책</button><Link href="/repositories">전체 저장소</Link></div>
      </section>

      <div className="live-scan-layout">
        <div className="live-scan-main">
          <section className="progress-card" aria-live="polite">
            <Image className="detection-gif" src="/detect.gif" alt="보안 검사 중" width={188} height={140} unoptimized priority />
            <div className="progress-number"><span>진행도</span><strong>{progress}%</strong></div>
            <div className="progress-detail">
              <p>{stage} · {progress < 100 ? "패치 전 기준 테스트 24/24 PASS…" : "모든 검증이 안전하게 완료되었습니다."}</p>
              <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
              <b>{progress < 100 ? `예상 남은 시간 ${remaining}초` : "검사 완료"}</b>
            </div>
          </section>

          <section className="pipeline-card">
            <div className="section-title"><h2>멀티 에이전트 파이프라인</h2><p>독립 세션 + 단계별 MCP 화이트리스트</p></div>
            <div className="pipeline-grid">
              {pipeline.map((item, index) => {
                const nextThreshold = pipeline[index + 1]?.threshold ?? 101;
                const isActive = progress >= item.threshold && progress < nextThreshold;
                const isDone = progress >= nextThreshold || progress === 100;
                return (
                  <article className={`pipeline-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={item.code}>
                    <b>{item.code}</b><strong>{item.title}</strong><em>{isDone ? (item.code === "A4" ? "완료" : item.code === "A3" ? "검증 완료" : item.result) : isActive ? "진행 중" : "대기"}</em>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="activity-card">
            <div className="activity-heading"><h2>실시간 활동</h2><span>{progress < 100 ? "LIVE" : "DONE"}</span></div>
            <div className="activity-list">
              {visibleActivity.map((item) => {
                const index = activity.indexOf(item);
                const isComplete = index < activeLogIndex || progress === 100;
                return (
                  <div className={`activity-row ${isComplete ? item.tone : "running"}`} key={item.time}>
                    <time>{item.time}</time><b>{item.agent}</b><span>{isComplete ? item.complete : item.running}</span>
                  </div>
                );
              })}
            </div>
            <p className="activity-footer">테스트 컨테이너 · network=none · read-only · cap-drop=ALL · 300s timeout</p>
          </section>
        </div>

        <aside className="verification-status">
          <div>
            <h2>{progress < 100 ? "현재 검증 중.." : "검증 완료"}</h2>
            <h3>pyyaml 5.1</h3>
            <p>CVE-2019-20477 · requirements.txt</p>
          </div>
          <dl>
            <div><dt>취약 버전 확인</dt><dd className="complete">완료</dd></div>
            <div><dt>최소 안전 버전</dt><dd>5.4</dd></div>
            <div><dt>패치 전 테스트</dt><dd className="complete">24/24 PASS</dd></div>
            <div><dt>패치 후 테스트</dt><dd className={progress >= 82 ? "complete" : "working"}>{progress >= 82 ? "24/24 PASS" : "실행 중"}</dd></div>
            <div><dt>PR 생성</dt><dd className={progress === 100 ? "complete" : "waiting"}>{progress === 100 ? "완료" : "대기"}</dd></div>
          </dl>
          {progress < 100 ? (
            <button className="result-button" disabled>결과 보기</button>
          ) : (
            <Link className="result-button" href="/results" scroll={false}>결과 보기</Link>
          )}
        </aside>
      </div>
      </ScreenContent>
    </main>
  );
}
