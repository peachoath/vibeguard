-- V6: Patch·TestRun 멱등성 보장 — Runner 콜백 재전송 시 중복 레코드 방지
-- 근거: PRD §10, ScanEventHandler REQUIRES_NEW 트랜잭션 패턴과 짝으로 동작.
-- 기존 migration 수정 금지이므로 이 파일에서 인덱스만 추가한다.

-- patches: finding_id + attempt_no 조합 유니크 (attempt 번호당 하나의 패치만 허용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_patch_finding_attempt
    ON patches (finding_id, attempt_no);

-- test_runs: patch_id + phase 조합 유니크 (하나의 패치에 PRE/POST 각 1회만 허용)
CREATE UNIQUE INDEX IF NOT EXISTS uq_testrun_patch_phase
    ON test_runs (patch_id, phase);
