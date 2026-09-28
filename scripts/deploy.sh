#!/usr/bin/env bash
# VibeGuard 단일 VM 배포 스크립트 (Docker Compose)
# 사용법: 저장소 루트에서  bash scripts/deploy.sh
# 자세한 절차·방화벽·OAuth 콜백은 DOCS/VibeGuard_Deployment.md 참고.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/4] 사전 확인 (docker / compose)"
command -v docker >/dev/null || { echo "docker 미설치 — DOCS/VibeGuard_Deployment.md §2 참고"; exit 1; }
docker compose version >/dev/null || { echo "docker compose 플러그인 미설치"; exit 1; }

echo "[2/4] .env 확인"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  .env 생성됨(.env.example 복사). GITHUB_CLIENT_ID/SECRET, TOKEN_ENC_KEY 등을 채운 뒤 다시 실행하세요."
  echo "  운영이면 SPRING_PROFILES_ACTIVE=prod, HTTPS/도메인/방화벽은 배포 가이드 §3.6 참고."
  exit 1
fi

echo "[3/4] 빌드 & 기동 (postgres → api-server)"
docker compose up -d --build

echo "[4/4] 헬스 대기"
PORT="$(grep -E '^API_HOST_PORT=' .env | cut -d= -f2)"; PORT="${PORT:-8088}"
for i in $(seq 1 30); do
  if curl -fsS "http://localhost:${PORT}/actuator/health" 2>/dev/null | grep -q UP; then
    echo "  OK — api-server UP (http://localhost:${PORT}/actuator/health)"
    docker compose ps
    exit 0
  fi
  sleep 5
done

echo "  헬스 확인 실패 — 로그를 확인하세요:  docker compose logs api-server"
docker compose ps
exit 1
