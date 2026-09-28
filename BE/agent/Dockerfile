# VibeGuard agent-runner — 멀티스테이지 빌드 (Node 22, npm workspace)
# 데모 배포: 단일 VM + Docker Compose (PRD §12).
#
# 이 이미지는 오케스트레이션 런너(@vibeguard/runner)를 실행한다.
# 스캐너·설치·테스트 샌드박스는 이 컨테이너가 호스트의 Docker 소켓을 통해
# 별도 컨테이너로 띄운다(컨테이너 3종, NFR-S1). 소켓 마운트는 compose에서 주입.

# ── 1) 빌드 스테이지 ─────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
# 의존성 레이어 캐싱: workspace 매니페스트 먼저 복사
COPY package.json package-lock.json ./
COPY runner/package.json ./runner/
COPY mcp/scanner-mcp/package.json ./mcp/scanner-mcp/
COPY mcp/advisory-mcp/package.json ./mcp/advisory-mcp/
COPY mcp/testrunner-mcp/package.json ./mcp/testrunner-mcp/
RUN npm ci
# 소스 복사 후 전체 workspace 빌드(runner + mcp 3종)
COPY tsconfig.base.json ./
COPY runner ./runner
COPY mcp ./mcp
RUN npm run build

# ── 2) 런타임 스테이지 ───────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# 런타임 의존 패키지:
#   - git      : 대상 리포 클론 (Agent가 스캔할 저장소를 가져옴)
#   - python3  : 샌드박스 CLI 실행 (testrunner-mcp가 sandbox/.venv/bin/python cli.py 호출)
#   - docker.io: docker CLI만 필요(데몬 불필요). 컨테이너 3종은 호스트 소켓으로 띄운다
# 한 레이어로 설치하고 apt 캐시 제거(이미지 경량화).
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        python3 python3-venv \
        docker.io \
    && rm -rf /var/lib/apt/lists/*

# 빌드 결과 + 프로덕션 의존성만 복사
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/runner/package.json ./runner/package.json
COPY --from=build /app/runner/dist ./runner/dist
COPY --from=build /app/mcp ./mcp

# 샌드박스 러너 복사 + 호스트 도구용 venv 생성.
# testrunner-mcp가 sandbox/.venv/bin/python 과 cli.py 를 하드코딩해 호출한다.
# (.venv/fixtures/artifacts 는 .dockerignore로 제외 — 여기서 venv를 새로 만든다)
COPY sandbox ./sandbox
RUN python3 -m venv sandbox/.venv

# node(비특권) 유저를 docker 그룹에 추가해 소켓 접근 시 EACCES 방지.
# GID 999는 대부분 Linux 배포판의 docker 그룹 기본값. 호스트 GID가 다르면
# compose의 group_add(${DOCKER_GID})로 런타임에 보정한다.
RUN groupadd -fg 999 docker 2>/dev/null || true \
    && usermod -aG docker node \
    && chown -R node:node /app/sandbox

# node 이미지 기본 비특권 사용자로 실행 (보안)
USER node
EXPOSE 4000
# 런너 진입점 (Express: /health, /scans). 설정은 환경변수로 주입(config.ts).
CMD ["node", "runner/dist/index.js"]
