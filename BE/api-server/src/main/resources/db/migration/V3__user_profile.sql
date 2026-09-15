-- V3: 마이페이지 / 계정 관리 (F-01 확장)
-- 근거: 이슈 #7, PRD §10 데이터 모델.
-- V1/V2는 이미 배포되어 수정 금지이므로, 스키마 변경은 이 마이그레이션으로만 한다.
--
-- 변경 요약:
--   1) users: 사용자 편집 가능한 표시 이름(display_name)·이메일(email)·수정 시각(updated_at) 추가
--   2) user_settings: 사용자별 알림/정책 기본값(최소 심각도·제외 경로·이메일 알림) 신설
--      - findings 필터(F-05)·정책 설정(F-15)의 사용자 레벨 기본값으로 사용
--      - users 삭제 시 ON DELETE CASCADE 로 함께 제거(회원 탈퇴 정합)

ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email        VARCHAR(320);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE user_settings (
    user_id        UUID        PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    min_severity   VARCHAR(16) NOT NULL DEFAULT 'LOW'
                   CHECK (min_severity IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    excluded_paths JSONB       NOT NULL DEFAULT '[]'::jsonb, -- 스캔 제외 glob 경로 목록
    notify_email   BOOLEAN     NOT NULL DEFAULT false,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
