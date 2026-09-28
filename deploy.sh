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

# 샌드박스 이미지 태그(러너가 런타임에 이 태그로 컨테이너를 띄운다)
SANDBOX_IMAGE="vibeguard-sandbox:0.1"
SCAN_IMAGE="vibeguard-scan:0.1"
SANDBOX_DIR="BE/agent/sandbox/image"

# 작업/캐시 공유 디렉토리 (요구사항 7). 호스트·컨테이너 동일 경로(/srv/vibeguard).
# 러너(uid 1000)가 써야 하므로 도커가 만들기 전에 1000:1000 소유로 미리 생성한다.
# (도커가 대신 만들면 root 소유가 되어 러너가 EACCES로 못 쓴다.)
SHARE_ROOT="${VIBEGUARD_SHARE_ROOT:-/srv/vibeguard}"
RUNNER_UID="${RUNNER_UID:-1000}"
RUNNER_GID="${RUNNER_GID:-1000}"

prepare_share_dir() {
  if [ -d "$SHARE_ROOT" ] && [ "$(stat -c '%u' "$SHARE_ROOT" 2>/dev/null || echo -1)" = "$RUNNER_UID" ]; then
    echo "[deploy] 공유 디렉토리 준비됨: ${SHARE_ROOT} (uid ${RUNNER_UID})"
    return 0
  fi
  echo "[deploy] 공유 디렉토리 생성: ${SHARE_ROOT} (work/cache, 소유 ${RUNNER_UID}:${RUNNER_GID})"
  sudo mkdir -p "${SHARE_ROOT}/work" "${SHARE_ROOT}/cache"
  sudo chown -R "${RUNNER_UID}:${RUNNER_GID}" "$SHARE_ROOT"
}

# 샌드박스 이미지 2종 빌드 (agent-runner가 실행 시점에 참조).
# compose는 이 이미지를 빌드하지 않으므로 배포 전에 여기서 만든다.
# scan 이미지는 sandbox 이미지를 FROM 하므로 반드시 sandbox → scan 순서로 빌드한다.
# 재현성을 위해 --platform linux/amd64 로 고정(PRD §15 R2).
build_sandbox_images() {
  if [ ! -f "${SANDBOX_DIR}/Dockerfile" ]; then
    echo "[deploy] 경고: ${SANDBOX_DIR}/Dockerfile 없음 — 샌드박스 이미지 빌드를 건너뜁니다." >&2
    return 0
  fi
  local rebuild="${REBUILD_SANDBOX:-0}"

  if [ "$rebuild" != "1" ] && docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
    echo "[deploy] 샌드박스 이미지 존재: ${SANDBOX_IMAGE} (재빌드하려면 REBUILD_SANDBOX=1)"
  else
    echo "[deploy] 샌드박스 베이스 이미지 빌드: ${SANDBOX_IMAGE}"
    docker build --platform linux/amd64 -t "$SANDBOX_IMAGE" "$SANDBOX_DIR"
  fi

  if [ "$rebuild" != "1" ] && docker image inspect "$SCAN_IMAGE" >/dev/null 2>&1; then
    echo "[deploy] 스캔 이미지 존재: ${SCAN_IMAGE} (재빌드하려면 REBUILD_SANDBOX=1)"
  else
    echo "[deploy] 스캔 이미지 빌드: ${SCAN_IMAGE}"
    docker build --platform linux/amd64 -t "$SCAN_IMAGE" \
      -f "${SANDBOX_DIR}/Dockerfile.scan" "$SANDBOX_DIR"
  fi
}

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
      echo "         실제 배포는 'cp .env.example .env' 후 값을 채우세요."
    fi
    # 작업/캐시 공유 디렉토리를 러너 소유로 먼저 만든다(요구사항 7).
    # 이 단계가 없으면 러너가 샌드박스에 빈 폴더를 붙여 스캔이 0건으로 나온다.
    prepare_share_dir
    # agent-runner가 런타임에 참조하는 샌드박스 이미지를 먼저 만든다.
    # 이 단계가 없으면 스캔·설치·테스트 컨테이너 기동이 실패한다.
    build_sandbox_images
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
