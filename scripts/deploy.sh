#!/usr/bin/env bash
# VibeGuard 단일 VM 배포 스크립트 (Docker Compose)
# 사용법: 저장소 루트에서  bash scripts/deploy.sh
# 자세한 절차·방화벽·OAuth 콜백은 DOCS/VibeGuard_Deployment.md 참고.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/6] 사전 확인 (docker / compose)"
command -v docker >/dev/null || { echo "docker 미설치 — DOCS/VibeGuard_Deployment.md §2 참고"; exit 1; }
docker compose version >/dev/null || { echo "docker compose 플러그인 미설치"; exit 1; }

echo "[2/6] .env 확인"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  .env 생성됨(.env.example 복사). GITHUB_CLIENT_ID/SECRET, TOKEN_ENC_KEY 등을 채운 뒤 다시 실행하세요."
  echo "  운영이면 SPRING_PROFILES_ACTIVE=prod, HTTPS/도메인/방화벽은 배포 가이드 §3.6 참고."
  exit 1
fi

env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' .env
}

if [ "${PROD:-0}" = "1" ]; then
  echo "[3/6] 프로덕션 환경변수 검증"
  required_vars=(
    DEPLOY_DOMAIN SPRING_PROFILES_ACTIVE GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET
    TOKEN_ENC_KEY RUNNER_CALLBACK_SECRET ANTHROPIC_API_KEY
    CORS_ALLOWED_ORIGINS POST_LOGIN_URI DOCKER_GID
  )
  for name in "${required_vars[@]}"; do
    if [ -z "$(env_value "$name")" ]; then
      echo "  필수 환경변수 ${name}가 .env에 비어 있습니다."
      exit 1
    fi
  done

  if [ "$(env_value SPRING_PROFILES_ACTIVE)" != "prod" ]; then
    echo "  PROD=1 배포는 SPRING_PROFILES_ACTIVE=prod 여야 합니다."
    exit 1
  fi
  if [ "$(env_value RUNNER_CALLBACK_SECRET)" = "dev-secret-change-me" ]; then
    echo "  RUNNER_CALLBACK_SECRET 기본값을 안전한 임의 값으로 교체하세요."
    exit 1
  fi
  if [ "$(env_value TOKEN_ENC_KEY)" = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=" ]; then
    echo "  TOKEN_ENC_KEY 개발 기본값을 새 AES-256 키로 교체하세요."
    exit 1
  fi
  if [ -z "$(env_value DB_URL)" ] && [ "$(env_value POSTGRES_PASSWORD)" = "vibeguard" ]; then
    echo "  로컬 PostgreSQL을 운영에 쓰려면 POSTGRES_PASSWORD 기본값을 교체하세요."
    exit 1
  fi
  case "$(env_value CORS_ALLOWED_ORIGINS)" in https://*) ;; *)
    echo "  운영 CORS_ALLOWED_ORIGINS는 https:// 오리진이어야 합니다."
    exit 1
  esac
  case "$(env_value POST_LOGIN_URI)" in https://*) ;; *)
    echo "  운영 POST_LOGIN_URI는 https:// URL이어야 합니다."
    exit 1
  esac

  SOCKET_GID="$(stat -c '%g' /var/run/docker.sock)"
  if [ "$(env_value DOCKER_GID)" != "$SOCKET_GID" ]; then
    echo "  DOCKER_GID 불일치: .env=$(env_value DOCKER_GID), docker.sock=${SOCKET_GID}"
    echo "  .env의 DOCKER_GID를 ${SOCKET_GID}로 수정하세요."
    exit 1
  fi
else
  echo "[3/6] 프로덕션 환경변수 검증 (로컬 모드라 스킵)"
fi

echo "[4/6] 작업·캐시 디렉터리 준비"
# agent-runner(node uid 1000)와 샌드박스(uid 1000)가 함께 쓰는 호스트 경로.
if [ "$(id -u)" -eq 0 ]; then
  install -d -m 0750 -o 1000 -g 1000 /srv/vibeguard/work /srv/vibeguard/cache
else
  sudo install -d -m 0750 -o 1000 -g 1000 /srv/vibeguard/work /srv/vibeguard/cache
fi

echo "[5/6] 샌드박스 이미지 빌드 (스캔/설치/테스트 컨테이너용)"
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

echo "[6/6] 빌드 & 기동 (postgres → api-server → agent-runner)"
# PROD=1 이면 AWS EC2용 프로덕션 오버레이(Caddy HTTPS + api-server 포트 비노출)를 함께 적용.
COMPOSE_FILES=(-f docker-compose.yml)
if [ "${PROD:-0}" = "1" ]; then
  DOMAIN="$(env_value DEPLOY_DOMAIN)"
  if [ -z "$DOMAIN" ]; then
    echo "  PROD=1 이지만 .env의 DEPLOY_DOMAIN 이 비어 있습니다. (예: api.example.com)"
    echo "  DNS A 레코드가 이 EC2의 퍼블릭 IP를 가리키고, 보안그룹 80/443 을 열어야 합니다."
    exit 1
  fi
  COMPOSE_FILES+=(-f docker-compose.prod.yml)
  echo "  프로덕션 모드 — Caddy HTTPS(도메인: ${DOMAIN}) 적용"
fi
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo "[완료 대기] 헬스 확인"
if [ "${PROD:-0}" = "1" ]; then
  DOMAIN="$(env_value DEPLOY_DOMAIN)"
  echo "  프로덕션: Caddy TLS 발급에 수십 초 걸릴 수 있습니다. https://${DOMAIN}/actuator/health 확인."
  for i in $(seq 1 30); do
    if curl -fsS "https://${DOMAIN}/actuator/health" 2>/dev/null | grep -q UP; then
      echo "  OK — api-server UP (https://${DOMAIN}/actuator/health)"
      docker compose "${COMPOSE_FILES[@]}" ps
      exit 0
    fi
    sleep 5
  done
  echo "  헬스 확인 실패 — 로그 확인:  docker compose ${COMPOSE_FILES[*]} logs caddy api-server"
  docker compose "${COMPOSE_FILES[@]}" ps
  exit 1
fi

PORT="$(env_value API_HOST_PORT)"; PORT="${PORT:-8088}"
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
