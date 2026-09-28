#!/usr/bin/env bash
# VibeGuard 단일 VM 배포 스크립트 (Docker Compose)
# 사용법: 저장소 루트에서  bash scripts/deploy.sh
# 자세한 절차·방화벽·OAuth 콜백은 DOCS/VibeGuard_Deployment.md 참고.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/5] 사전 확인 (docker / compose)"
command -v docker >/dev/null || { echo "docker 미설치 — DOCS/VibeGuard_Deployment.md §2 참고"; exit 1; }
docker compose version >/dev/null || { echo "docker compose 플러그인 미설치"; exit 1; }

echo "[2/5] .env 확인"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  .env 생성됨(.env.example 복사). GITHUB_CLIENT_ID/SECRET, TOKEN_ENC_KEY 등을 채운 뒤 다시 실행하세요."
  echo "  운영이면 SPRING_PROFILES_ACTIVE=prod, HTTPS/도메인/방화벽은 배포 가이드 §3.6 참고."
  exit 1
fi

echo "[3/5] 샌드박스 이미지 빌드 (스캔/설치/테스트 컨테이너용)"
# agent-runner가 런타임에 vibeguard-sandbox:0.1 / vibeguard-scan:0.1 로 컨테이너를 띄운다.
# compose가 빌드하지 않으므로 여기서 먼저 만든다. scan은 sandbox를 FROM 하므로 순서 고정.
# 재현성을 위해 --platform linux/amd64 (PRD §15 R2). REBUILD_SANDBOX=1 이면 강제 재빌드.
SANDBOX_DIR="BE/agent/sandbox/image"
if [ -f "${SANDBOX_DIR}/Dockerfile" ]; then
  if [ "${REBUILD_SANDBOX:-0}" != "1" ] && docker image inspect vibeguard-sandbox:0.1 >/dev/null 2>&1; then
    echo "  vibeguard-sandbox:0.1 존재(스킵). 재빌드하려면 REBUILD_SANDBOX=1"
  else
    docker build --platform linux/amd64 -t vibeguard-sandbox:0.1 "$SANDBOX_DIR"
  fi
  if [ "${REBUILD_SANDBOX:-0}" != "1" ] && docker image inspect vibeguard-scan:0.1 >/dev/null 2>&1; then
    echo "  vibeguard-scan:0.1 존재(스킵). 재빌드하려면 REBUILD_SANDBOX=1"
  else
    docker build --platform linux/amd64 -t vibeguard-scan:0.1 \
      -f "${SANDBOX_DIR}/Dockerfile.scan" "$SANDBOX_DIR"
  fi
else
  echo "  경고: ${SANDBOX_DIR}/Dockerfile 없음 — 샌드박스 이미지 빌드 스킵" >&2
fi

echo "[4/5] 빌드 & 기동 (postgres → api-server → agent-runner)"
docker compose up -d --build

echo "[5/5] 헬스 대기"
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
