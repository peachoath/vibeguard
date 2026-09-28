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
# 빌드 결과 + 프로덕션 의존성만 복사
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/runner/package.json ./runner/package.json
COPY --from=build /app/runner/dist ./runner/dist
COPY --from=build /app/mcp ./mcp
# node 이미지 기본 비특권 사용자로 실행 (보안)
USER node
EXPOSE 4000
# 런너 진입점 (Express: /health, /scans). 설정은 환경변수로 주입(config.ts).
CMD ["node", "runner/dist/index.js"]
