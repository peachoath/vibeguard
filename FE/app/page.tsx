import Image from "next/image";
import Link from "next/link";
import ScreenContent from "./components/screen-content";

export default function Home() {
  return (
    <main className="landing-page">
      <Image className="landing-background" src="/landing_back.png?v=2" alt="" width={3844} height={3420} unoptimized priority />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Vibe Guard 홈">
          <Image src="/vibeguard_logo_1.png" alt="Vibe Guard" width={452} height={170} priority />
        </a>
        <nav aria-label="주요 메뉴">
          <a href="#product">제품</a>
          <a href="#security">보안 원리</a>
          <a href="#docs">문서</a>
          <a className="header-cta" href="#github">GitHub로 시작하기</a>
        </nav>
      </header>

      <ScreenContent>
      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>취약점은 줄이고<br />기능은 그대로</h1>
          <p>공식 DB 검증부터 안전 버전 결정, 회귀 테스트, PR 생성까지 자동으로 이어집니다.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/repositories" scroll={false}>GitHub 저장소 연결</Link>
            <a className="button button-secondary" href="#product">작동 방식 보기</a>
          </div>
        </div>

        <article className="verification-panel" aria-label="PyYAML 취약 버전 검증 결과">
          <div className="panel-heading">
            <div><h2>PyYAML 취약 버전</h2><span className="cve-badge">CVE-2019-20477</span></div>
            <span className="verified-badge">검증 완료</span>
          </div>

          <div className="test-summary">
            <div className="summary-box summary-danger"><span>기존 버전</span><strong>24/24 PASS</strong></div>
            <div className="summary-box summary-safe"><span>안전 버전</span><strong>24/24 PASS</strong></div>
            <div className="summary-box summary-regression"><span>회귀 테스트</span><strong>24/24</strong></div>
          </div>

          <div className="result-grid">
            <div className="test-detail"><strong>pytest 기존 테스트</strong><span>requirements.txt&nbsp; pyyaml==5.1 → pyyaml==5.4</span></div>
            <div className="pr-detail"><span>PR #42</span><strong>검토 준비 완료</strong><small>+12&nbsp; −4</small></div>
          </div>

          <div className="panel-footer">
            <strong>검증 완료 · 최종 리뷰만 남았어요</strong>
            <a className="button panel-button" href="#pr-example">PR 예시 보기</a>
          </div>
        </article>
      </section>

      <section className="features" id="product" aria-label="주요 기능">
        <article className="feature-card">
          <Image src="/search.png?v=2" alt="" width={480} height={480} unoptimized />
          <div><h2>NVD · OSV · GHSA 교차 검증</h2><p>공식 취약점 DB와 근거를 다시 확인합니다.</p></div>
        </article>
        <article className="feature-card" id="security">
          <Image src="/guard.png?v=2" alt="" width={444} height={444} unoptimized />
          <div><h2>격리된 테스트 실행</h2><p>격리 환경에서 테스트를 안전하게 실행<br />합니다.</p></div>
        </article>
        <article className="feature-card">
          <Image src="/choose.png?v=2" alt="" width={480} height={480} unoptimized />
          <div><h2>사람이 머지 결정</h2><p>자동 머지를 하지 않습니다.</p></div>
        </article>
      </section>

      </ScreenContent>
      <span id="docs" className="anchor-target" />
      <span id="github" className="anchor-target" />
      <span id="pr-example" className="anchor-target" />
    </main>
  );
}
