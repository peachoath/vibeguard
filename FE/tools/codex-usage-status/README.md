# Codex Usage Status

VS Code 오른쪽 상태바에 Codex의 남은 ChatGPT 사용량을 항상 표시합니다.

- 60초마다 자동 갱신
- 상태바 클릭 시 즉시 갱신
- 마우스를 올리면 사용 비율과 초기화 시간 표시
- 잔여량 25% 이하에서는 경고색, 10% 이하에서는 오류색 표시

Codex CLI의 공식 App Server `account/rateLimits/read` 메서드를 사용하며, 현재 Codex 로그인을 그대로 재사용합니다. 인증 파일이나 토큰을 직접 읽지 않습니다.

## 설정

- `codexUsage.refreshIntervalSeconds`: 자동 갱신 주기(기본 60초)
- `codexUsage.codexPath`: Codex 실행 파일을 자동으로 찾지 못할 때 절대 경로 지정
