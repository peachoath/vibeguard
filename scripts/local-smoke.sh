#!/usr/bin/env bash
# 비용 없는 로컬 통합 스모크 테스트.
# API → Runner(HMAC) → DRY_RUN Agent 1~4 → API callback/DB 상태 전이를 검증한다.
set -euo pipefail

cd "$(dirname "$0")/.."

command -v docker >/dev/null || { echo "docker가 필요합니다."; exit 1; }
command -v jq >/dev/null || { echo "jq가 필요합니다."; exit 1; }
docker info >/dev/null

SMOKE_TMP="$(mktemp -d)"
SMOKE_ROOT="${SMOKE_TMP}/runner-data"
SMOKE_ENV="${SMOKE_TMP}/smoke.env"
PROJECT_NAME="vibeguard-smoke"
API_PORT="${SMOKE_API_PORT:-18088}"
RUNNER_PORT="${SMOKE_RUNNER_PORT:-14000}"
POSTGRES_PORT="${SMOKE_POSTGRES_PORT:-15433}"
mkdir -p "${SMOKE_ROOT}/work" "${SMOKE_ROOT}/cache"
chmod 0777 "${SMOKE_ROOT}" "${SMOKE_ROOT}/work" "${SMOKE_ROOT}/cache"

cleanup() {
  if [ "${KEEP_SMOKE:-0}" != "1" ]; then
    docker compose --project-name "$PROJECT_NAME" --env-file "$SMOKE_ENV" \
      -f docker-compose.yml -f docker-compose.local-smoke.yml \
      down --volumes --remove-orphans >/dev/null 2>&1 || true
    rm -rf -- "$SMOKE_TMP"
  else
    echo "KEEP_SMOKE=1 — 컨테이너와 임시 파일 유지: ${SMOKE_TMP}"
  fi
}
trap cleanup EXIT

TOKEN_KEY="$(openssl rand -base64 32)"
CALLBACK_SECRET="$(openssl rand -hex 32)"
cat >"$SMOKE_ENV" <<EOF
SPRING_PROFILES_ACTIVE=default
POSTGRES_DB=vibeguard
POSTGRES_USER=vibeguard
POSTGRES_PASSWORD=local-smoke-only
DB_URL=jdbc:postgresql://postgres:5432/vibeguard
DB_USER=vibeguard
DB_PASSWORD=local-smoke-only
POSTGRES_HOST_PORT=${POSTGRES_PORT}
API_HOST_PORT=${API_PORT}
RUNNER_HOST_PORT=${RUNNER_PORT}
GITHUB_CLIENT_ID=local-smoke
GITHUB_CLIENT_SECRET=local-smoke
TOKEN_ENC_KEY=${TOKEN_KEY}
CORS_ALLOWED_ORIGINS=http://localhost:3000
POST_LOGIN_URI=http://localhost:3000/dashboard
RUNNER_BASE_URL=http://agent-runner:4000
RUNNER_CALLBACK_SECRET=${CALLBACK_SECRET}
ANTHROPIC_API_KEY=
DRY_RUN=1
AGENT_MAX_BUDGET_USD=0
DOCKER_GID=0
VIBEGUARD_HOST_ROOT=${SMOKE_ROOT}
VIBEGUARD_WORK_DIR=${SMOKE_ROOT}/work
VIBEGUARD_CACHE_DIR=${SMOKE_ROOT}/cache
SMOKE_PG_VOLUME=${PROJECT_NAME}-pgdata
EOF

COMPOSE=(docker compose --project-name "$PROJECT_NAME" --env-file "$SMOKE_ENV"
  -f docker-compose.yml -f docker-compose.local-smoke.yml)

echo "[1/5] 호스트 Gradle 캐시로 API bootJar 생성"
(cd BE/api-server && ./gradlew bootJar -x test --no-daemon --console=plain)

echo "[2/5] 로컬 이미지 빌드 및 서비스 기동"
"${COMPOSE[@]}" up -d --build --wait --wait-timeout 360

echo "[3/5] API·Runner 헬스 확인"
curl -fsS "http://127.0.0.1:${API_PORT}/actuator/health" | jq -e '.status == "UP"' >/dev/null
curl -fsS "http://127.0.0.1:${RUNNER_PORT}/health" | jq -e '.status == "ok"' >/dev/null

echo "[4/5] DRY_RUN 스캔 생성 및 완료 대기"
CREATE_RESPONSE="$(curl -fsS -X POST "http://127.0.0.1:${API_PORT}/api/v1/internal/dev/scans" \
  -H 'content-type: application/json' \
  -d '{"repoUrl":"https://github.com/shinu61/vibeguard-seed-python","ref":"main"}')"
SCAN_ID="$(printf '%s' "$CREATE_RESPONSE" | jq -er '.scanId')"

FINAL_STATUS=""
for _ in $(seq 1 60); do
  STATUS_RESPONSE="$(curl -fsS "http://127.0.0.1:${API_PORT}/api/v1/internal/dev/scans/${SCAN_ID}")"
  FINAL_STATUS="$(printf '%s' "$STATUS_RESPONSE" | jq -r '.status')"
  case "$FINAL_STATUS" in
    COMPLETED|NO_FINDINGS|REGRESSION_BLOCKED|PATCH_FAILED) break ;;
    FAILED|CANCELLED)
      echo "스캔 실패: ${FINAL_STATUS}"
      "${COMPOSE[@]}" logs --tail=120 api-server agent-runner
      exit 1
      ;;
  esac
  sleep 2
done

if [ "$FINAL_STATUS" != "COMPLETED" ]; then
  echo "예상한 COMPLETED 상태가 아닙니다: ${FINAL_STATUS:-unknown}"
  "${COMPOSE[@]}" logs --tail=120 api-server agent-runner
  exit 1
fi

echo "[5/5] 통과 — API/DB/HMAC callback/DRY_RUN 파이프라인 정상"
"${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
