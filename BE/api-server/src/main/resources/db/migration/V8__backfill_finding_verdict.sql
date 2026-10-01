-- V8: A2(Verifier) 산출물 콜백 누락 이전에 생성된 Finding의 판정 복구.
-- 기존 데이터에는 A1이 저장한 권장 안전 버전은 남아 있으므로,
-- 권장 버전이 있는 항목은 PATCH, 없는 항목은 수동 검토(MANUAL)로 복구한다.

UPDATE findings
SET verdict = CASE
        WHEN recommended_version IS NOT NULL AND btrim(recommended_version) <> '' THEN 'PATCH'
        ELSE 'MANUAL'
    END,
    rationale = COALESCE(
        rationale,
        CASE
            WHEN recommended_version IS NOT NULL AND btrim(recommended_version) <> ''
                THEN '기존 스캔에 저장된 권장 안전 버전을 기준으로 패치 판정을 복구했습니다.'
            ELSE '자동 판정 근거가 남아 있지 않아 수동 확인이 필요합니다.'
        END
    )
WHERE verdict IS NULL;
