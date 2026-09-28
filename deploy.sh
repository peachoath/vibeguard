#!/usr/bin/env bash
# VibeGuard 원클릭 배포 (단일 VM + Docker Compose, PRD §12)
#
# 사용법:
#   cp BE/api-server/.env.example .env   # 루트에 .env 두고 값 채우기
#   ./deploy.sh                          # 빌드 + 기동 + 헬스 확인
#   ./deploy.sh down                     # 중지
#   ./deploy.sh logs                     # 로그 팔로우
#
# 구성: postgres + api-server + agent-runner. 자세한 환경변수는 docker-compose.yml 참고.
set -euo pipefail

cd "$(dirname "$0")"

# docker compose v2(플러그인) 우선, 없으면 docker-compose 폴백
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "[deploy] Docker Compose를 찾을 수 없습니다. Docker를 먼저 설치하세요." >&2
  exit 1
fi

cmd="${1:-up}"

case "$cmd" in
  down)
    echo "[deploy] 컨테이너 중지"
    $COMPOSE down
    ;;
  logs)
    $COMPOSE logs -f
    ;;
  up)
    if [ ! -f .env ]; then
      echo "[deploy] 경고: 루트 .env가 없습니다. 기본값으로 진행합니다."
      echo "         실제 배포는 'cp BE/api-server/.env.example .env' 후 값을 채우세요."
    fi
    echo "[deploy] 빌드 + 기동 (postgres + api-server + agent-runner)"
    $COMPOSE up -d --build

    echo "[deploy] 헬스 확인 대기 (최대 90초)..."
    api_port="${API_HOST_PORT:-8088}"
    runner_port="${RUNNER_HOST_PORT:-4000}"
    for i in $(seq 1 18); do
      api_ok=$(curl -fsS "http://localhost:${api_port}/actuator/health" 2>/dev/null | grep -c UP || true)
      runner_ok=$(curl -fsS "http://localhost:${runner_port}/health" 2>/dev/null | grep -c ok || true)
      if [ "$api_ok" -ge 1 ] && [ "$runner_ok" -ge 1 ]; then
        echo "[deploy] 완료 — api-server:${api_port}, agent-runner:${runner_port} 정상"
        exit 0
      fi
      sleep 5
    done
    echo "[deploy] 경고: 헬스 확인 시간 초과. '$COMPOSE logs -f'로 상태를 확인하세요." >&2
    exit 1
    ;;
  *)
    echo "사용법: ./deploy.sh [up|down|logs]" >&2
    exit 1
    ;;
esac
