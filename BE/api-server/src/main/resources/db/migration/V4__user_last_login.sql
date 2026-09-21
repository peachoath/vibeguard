-- V4: 마지막 로그인 시각 (이슈 #7, 마이페이지 계정 탭)
-- 로그인(OAuth 성공) 시마다 CustomOAuth2UserService가 갱신한다.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
