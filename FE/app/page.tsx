import Image from "next/image";
import Link from "next/link";
import { LoginModalProvider } from "./components/login-modal-trigger";
import ScreenContent from "./components/screen-content";
import LandingHeader from "./components/landing-header";
import ScrollDots from "./components/scroll-dots";
import PageAnimations from "./components/page-animations";
import CountUp from "./components/count-up";
import PRTabs from "./components/pr-tabs";

export default function Home() {
  return (
    <LoginModalProvider>
    <main className="landing-page">
      <Image className="landing-background" src="/landing_back.png?v=2" alt="" width={3844} height={3420} unoptimized priority />

      <LandingHeader />
      <ScrollDots />
      <PageAnimations />

      <ScreenContent>

        {/* ── Viewport 1: 히어로 + 피처 카드 ─────────────────── */}
        <div className="landing-fold">

          <section className="hero" id="top">
            <div className="hero-copy">
              <h1><span className="hero-highlight">취약점</span>은 줄이고<br />기능은 그대로</h1>
              <p>공식 DB 검증부터 안전 버전 결정, 회귀 테스트, PR 생성까지 순서대로 처리됩니다.</p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/repositories" scroll={false}>GitHub 저장소 연결</Link>
                <a className="button button-secondary" href="#how-it-works">작동 방식 보기</a>
              </div>
            </div>

            <article className="verification-panel" aria-label="PyYAML 취약 버전 검증 결과">
              <div className="panel-heading">
                <div><h2>PyYAML 취약 버전</h2><span className="cve-badge">CVE-2019-20477</span></div>
                <span className="verified-badge">검증 완료</span>
              </div>
              <div className="test-summary">
                <div className="summary-box summary-danger">
                  <span>기존 버전</span>
                  <strong><CountUp to={24} />/24 PASS</strong>
                </div>
                <div className="summary-box summary-safe">
                  <span>안전 버전</span>
                  <strong><CountUp to={24} delay={180} />/24 PASS</strong>
                </div>
                <div className="summary-box summary-regression">
                  <span>회귀 테스트</span>
                  <strong><CountUp to={24} delay={360} />/24</strong>
                </div>
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

          {/* 기존 피처 카드 3개 */}
          <section className="features" id="product" aria-label="주요 기능">
            <article className="feature-card">
              <Image src="/search.png?v=2" alt="" width={480} height={480} unoptimized />
              <div><h2>NVD · OSV · GHSA 교차 검증</h2><p>공식 취약점 DB와 근거를 다시 확인합니다.</p></div>
            </article>
            <article className="feature-card" id="security">
              <Image src="/guard.png?v=2" alt="" width={444} height={444} unoptimized />
              <div><h2>격리된 테스트 실행</h2><p>격리 환경에서 테스트를 안전하게 실행합니다.</p></div>
            </article>
            <article className="feature-card">
              <Image src="/choose.png?v=2" alt="" width={480} height={480} unoptimized />
              <div><h2>사람이 머지 결정</h2><p>자동 머지를 하지 않습니다.</p></div>
            </article>
          </section>

        </div>{/* /landing-fold */}

        {/* ── Viewport 2: 작동 방식 ───────────────────────────── */}
        <section className="hiw-section" id="how-it-works">
          <div className="hiw-inner">
            <div className="hiw-meta">
              <span className="hiw-eyebrow">작동 방식</span>
              <h2>발견부터 PR까지<br />4단계</h2>
              <p>Trivy 스캔부터 DB 검증·회귀 테스트·PR 생성까지 순서대로 처리됩니다.</p>
            </div>
            <ol className="hiw-steps">
              <li className="hiw-step">
                <span className="hiw-step-no">01</span>
                <h3>취약점 탐지</h3>
                <p>Trivy가 의존성 파일을 분석해 CVE를 식별합니다.</p>
              </li>
              <li className="hiw-step">
                <span className="hiw-step-no">02</span>
                <h3>공식 DB 검증</h3>
                <p>NVD · OSV · GHSA를 교차 조회해 실제 위협인지 판별합니다.</p>
              </li>
              <li className="hiw-step">
                <span className="hiw-step-no">03</span>
                <h3>회귀 테스트</h3>
                <p>Docker 격리 환경에서 기존 테스트 전체를 실행해 호환성을 확인합니다.</p>
              </li>
              <li className="hiw-step">
                <span className="hiw-step-no">04</span>
                <h3>PR 생성</h3>
                <p>안전 버전으로 패치한 뒤 PR을 올립니다. 머지는 사람이 결정합니다.</p>
              </li>
            </ol>
          </div>
        </section>

        {/* ── Viewport 3: 보고서 & PR 예시 ──────────────────── */}
        <section className="pre-section" id="pr-example">
          <div className="pre-top">
            <span className="hiw-eyebrow">결과 예시</span>
            <h2>스캔 결과와 자동 생성된 PR</h2>
            <p>VibeGuard가 분석한 내용과 준비된 패치를 그대로 확인하세요.</p>
          </div>

          <div className="pre-cards">
            {/* 스캔 결과 카드 */}
            <div className="pre-card pre-report">
              <div className="pre-card-head">
                <span className="pre-card-label">스캔 결과</span>
                <span className="pre-repo-badge">shinu61/vibeguard-seed-python</span>
              </div>
              <div className="pre-finding-list">
                <div className="pre-finding pre-finding-high">
                  <span className="pre-sev-badge sev-high">HIGH</span>
                  <div>
                    <strong>urllib3</strong>
                    <span>1.24.1 → 2.0.7</span>
                  </div>
                  <code>CVE-2023-43804</code>
                </div>
                <div className="pre-finding pre-finding-high">
                  <span className="pre-sev-badge sev-high">HIGH</span>
                  <div>
                    <strong>urllib3</strong>
                    <span>1.24.1 → 2.0.7</span>
                  </div>
                  <code>CVE-2019-11324</code>
                </div>
                <div className="pre-finding pre-finding-medium">
                  <span className="pre-sev-badge sev-medium">MED</span>
                  <div>
                    <strong>requests</strong>
                    <span>2.18.4 → 2.31.0</span>
                  </div>
                  <code>CVE-2023-32681</code>
                </div>
                <div className="pre-finding pre-finding-medium">
                  <span className="pre-sev-badge sev-medium">MED</span>
                  <div>
                    <strong>certifi</strong>
                    <span>2018.4.16 → 2023.7.22</span>
                  </div>
                  <code>CVE-2023-37920</code>
                </div>
                <div className="pre-finding-more">+8개 항목 더보기</div>
              </div>
              <div className="pre-card-foot">
                <span className="pre-stat"><b>12</b> 취약점 발견</span>
                <span className="pre-stat"><b>100%</b> 패치 가능</span>
              </div>
            </div>

            {/* PR 탭 카드 */}
            <PRTabs />
          </div>

          <div className="pre-cta">
            <h2>지금 내 저장소를 분석해보세요</h2>
            <p>GitHub 계정으로 로그인하면 바로 시작할 수 있습니다.</p>
            <Link className="button button-primary pre-cta-btn" href="/login">GitHub로 무료 시작</Link>
          </div>
        </section>

      </ScreenContent>

      <span id="docs" className="anchor-target" />
    </main>
    </LoginModalProvider>
  );
}
