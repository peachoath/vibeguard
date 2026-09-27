"use client";

import { Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import DashboardNav from "../../components/dashboard-nav";
import ScreenContent from "../../components/screen-content";

const records = {
  pyyaml: { name: "pyyaml", current: "5.1", safe: "5.4", cve: "CVE-2019-20477", score: "9.8 Critical", source: "NVD · OSV · GHSA" },
  urllib3: { name: "urllib3", current: "1.24.1", safe: "1.26.18", cve: "CVE-2023-45803", score: "8.1 High", source: "NVD · OSV" },
  jinja2: { name: "jinja2", current: "3.1.2", safe: "3.1.4", cve: "CVE-2024-22195", score: "7.5 High", source: "GHSA · OSV" },
  cryptography: { name: "cryptography", current: "41.0.2", safe: "41.0.6", cve: "CVE-2023-49083", score: "7.8 High", source: "NVD · GHSA" },
  idna: { name: "idna", current: "3.4", safe: "3.7", cve: "CVE-2024-3651", score: "6.5 Moderate", source: "OSV" },
} as const;

type RecordKey = keyof typeof records;
type DetailTab = "overview" | "evidence" | "regression" | "diff";

const tabs: { id: DetailTab; label: string }[] = [
  { id: "overview", label: "개요" },
  { id: "evidence", label: "근거" },
  { id: "regression", label: "회귀 증거" },
  { id: "diff", label: "Diff" },
];

export default function FindingDetailPage() {
  const params = useParams<{ package: string }>();
  const key = decodeURIComponent(params.package ?? "pyyaml") as RecordKey;
  const finding = records[key] ?? records.pyyaml;
  const [tab, setTab] = useState<DetailTab>("regression");
  const [ignored, setIgnored] = useState(false);

  return (
    <main className="finding-page">
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
        <section className="finding-heading">
          <div>
            <h1>{finding.name} {finding.current} · {finding.cve}</h1>
            <p>payment-api / requirements.txt · CVSS {finding.score.split(" ")[0]} · 검증 완료</p>
          </div>
          <div className="finding-actions">
            <div><span>치명적</span><button type="button" onClick={() => setIgnored((value) => !value)}>{ignored ? "무시 취소" : "무시 처리"}</button><a href="https://github.com/peachoath/vibeguard/pulls" target="_blank" rel="noreferrer">→GitHub PR 열기</a></div>
            <small>회귀 통과 · PR #42 생성 완료 · 사람의 리뷰 필요</small>
          </div>
        </section>

        <nav className="finding-tabs" aria-label="Finding 상세 메뉴">
          {tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>

        <div className="finding-detail-layout">
          <section className="regression-panel">
            <div className="finding-section-title">
              <h2>{tab === "overview" ? "개요" : tab === "evidence" ? "취약점 근거" : tab === "diff" ? "변경 Diff" : "회귀 증거"}</h2>
              <p>{tab === "regression" ? "기존 테스트를 패치 전후로 실행해 ‘버전을 올려도 안 깨짐’을 증명합니다." : tab === "evidence" ? "공식 취약점 데이터베이스의 교차 검증 결과입니다." : tab === "diff" ? "안전 버전 적용으로 변경되는 매니페스트 한 줄입니다." : "탐지된 취약점과 자동 패치 검증 결과를 요약합니다."}</p>
            </div>

            <div className="regression-summary">
              <article><span>패치 전 기준선</span><strong>24 / 24 PASS</strong><small>기존 버전에서 정상</small></article>
              <article><span>버전 상향</span><strong>{finding.current} → {finding.safe}</strong><small>최소 안전 버전</small></article>
              <article><span>패치 후 회귀</span><strong>24 / 24 PASS</strong><small>기존 기능 유지</small></article>
            </div>

            <div className="regression-evidence-grid">
              <article className="pytest-log">
                <h3>pytest 회귀 로그</h3>
                <dl>
                  <div><dt>패치 전</dt><dd>24 passed in 2.18s</dd></div>
                  <div><dt>패치</dt><dd>requirements.txt&nbsp; {finding.name}=={finding.current} → {finding.name}=={finding.safe}</dd></div>
                  <div><dt>패치 후</dt><dd>24 passed in 2.24s</dd></div>
                </dl>
                <div className="test-environment"><span>테스트 환경</span><b>pytest 9.1.1 · linux/amd64 · network=none</b><span>결과</span><strong>하위 호환 유지 확인</strong></div>
              </article>
              <article className="diff-summary">
                <h3>Diff 요약</h3>
                <strong>requirements.txt</strong>
                <div className="diff-lines"><span>- {finding.name}=={finding.current}</span><span>+ {finding.name}=={finding.safe}</span></div>
                <small>변경 범위</small><b>매니페스트 버전 문자열 1줄</b><p>코드 리팩토링 없음</p><em>major jump 없음</em>
              </article>
            </div>
          </section>

          <aside className="verification-evidence">
            <h2>검증 근거</h2>
            <dl>
              <div><dt>패키지</dt><dd>{finding.name}</dd></div><div><dt>현재 버전</dt><dd>{finding.current}</dd></div><div><dt>최소 안전 버전</dt><dd>{finding.safe}</dd></div><div><dt>CVE</dt><dd>{finding.cve}</dd></div><div><dt>CVSS</dt><dd>{finding.score}</dd></div><div><dt>호환성 위험</dt><dd>LOW</dd></div><div><dt>메이저 점프</dt><dd>없음</dd></div><div><dt>출처</dt><dd>{finding.source}</dd></div>
            </dl>
            <div className="agent-judgment"><strong>Agent 2 판단</strong><p>모든 알려진 취약 범위를 해소하면서 major 점프를 피하는 {finding.safe}를 선택했습니다.</p></div>
            <a className="created-pr" href="https://github.com/peachoath/vibeguard/pulls" target="_blank" rel="noreferrer"><strong>PR #42 · 생성 완료</strong><small>vibeguard/fix-{finding.cve}-a3f9</small></a>
          </aside>
        </div>
      </ScreenContent>
    </main>
  );
}
