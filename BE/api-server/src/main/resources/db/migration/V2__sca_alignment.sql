-- V2: 방향 전환(v2) 반영 — SCA 집중 / 회귀 증명 / 컨테이너 3종
-- 근거: DOCS/VibeGuard_방향전환.md, PRD §10.
-- V1__init.sql은 이미 배포되어 수정 금지이므로, 스키마 변경은 이 마이그레이션으로만 한다.
--
-- 변경 요약:
--   1) test_runs: phase를 2단계(PRE_PATCH/POST_PATCH)로, exit_code·outcome 컬럼 추가
--   2) patches: test_code(재현 테스트 코드) 컬럼 제거 — 재현 테스트를 만들지 않음
--   3) findings: manifest_path 추가, type을 SCA 중심으로(SAST 신규 삽입 차단)

-- ── 1) test_runs ──────────────────────────────────────────────
-- phase CHECK 제약 교체: REGRESSION 단계 제거(설치 2회 + 테스트 2회 구조)
ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_phase_check;
ALTER TABLE test_runs
    ADD CONSTRAINT test_runs_phase_check CHECK (phase IN ('PRE_PATCH', 'POST_PATCH'));

-- 컨테이너 실행 결과를 원인까지 구분 (정직성 원칙 — PRD §10)
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS exit_code INT;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS outcome VARCHAR(16);
ALTER TABLE test_runs DROP CONSTRAINT IF EXISTS test_runs_outcome_check;
ALTER TABLE test_runs
    ADD CONSTRAINT test_runs_outcome_check
    CHECK (outcome IS NULL OR outcome IN
        ('PASSED', 'FAILED', 'NO_TESTS', 'OOM_KILLED', 'TIMED_OUT', 'INSTALL_FAILED'));

-- ── 2) patches ────────────────────────────────────────────────
-- 재현 테스트 코드는 더 이상 저장하지 않는다(패치는 매니페스트 버전 한 줄 수정만)
ALTER TABLE patches DROP COLUMN IF EXISTS test_code;

-- ── 3) findings ───────────────────────────────────────────────
-- 매니페스트 경로(requirements.txt 등) 저장
ALTER TABLE findings ADD COLUMN IF NOT EXISTS manifest_path TEXT;

-- type을 SCA 중심으로: 기존 데이터는 유지하되 신규 SAST 삽입을 차단(MVP는 SCA만)
ALTER TABLE findings DROP CONSTRAINT IF EXISTS findings_type_check;
ALTER TABLE findings
    ADD CONSTRAINT findings_type_check CHECK (type IN ('SCA'));
