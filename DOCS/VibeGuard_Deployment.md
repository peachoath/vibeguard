# VibeGuard 배포 가이드 (Deployment)

> 데모 배포: **단일 VM + Docker Compose** (PRD §12). 무료 인프라 목표.
> 담당: 민진홍(백엔드 코어·인프라·배포).

| 항목 | 내용 |
|---|---|
| 문서 버전 | v1.0 · 2026-09-27 |
| 대상 | `BE/api-server` (Spring Boot 4 / Java 21) + PostgreSQL |
| 관련 문서 | [PRD](./VibeGuard_PRD.md) · [Architecture](./VibeGuard_Architecture.md) · [Team Roles](./VibeGuard_Team_Roles.md) |

---

## 1. 구성 요약

```
[단일 VM]  docker compose
  ├─ postgres      (로컬 DB. Supabase 사용 시 불필요)
  └─ api-server    (Spring Boot, :8080 → 호스트 :8088)
       └─ FE(Vercel) ──REST/SSE──▶ api-server
       └─ agent-runner (에이전트 팀 담당, 추후 통합)
```

- **DB 선택지 2가지**
  - (A) 컨테이너 postgres — `.env`의 DB_URL 미설정 시 기본. 완전 오프라인·데모용.
  - (B) Supabase 관리형 — `.env`에 `DB_URL/DB_USER/DB_PASSWORD` 지정. 공유 개발·운영용.
- **FE는 Vercel 분리 배포**, DB는 Supabase 권장. api-server만 VM의 Compose로 띄운다.
- **agent-runner**는 에이전트 팀 담당이라 아직 Compose에 placeholder(주석)로만 있다.

---

## 2. 사전 요구사항

- VM에 **Docker + Docker Compose** 설치 (Docker Engine 24+ 권장)
- (선택) 무료 VM: Oracle Cloud Always Free 등. 데모만이면 팀원 머신도 가능.
- GitHub OAuth App 1개 (Client ID/Secret) — 로그인용

---

## 3. 배포 절차

### 3.1 저장소 클론
```bash
git clone https://github.com/peachoath/vibeguard.git
cd vibeguard
```

### 3.2 환경변수 설정
```bash
cp .env.example .env
# .env 편집: GITHUB_CLIENT_ID/SECRET, TOKEN_ENC_KEY(운영 필수), CORS/POST_LOGIN_URI 등
```
- **운영이면** `.env`에 `SPRING_PROFILES_ACTIVE=prod` 지정 (Swagger·상세 health 비노출).
- **Supabase를 쓰면** `.env`에 `DB_URL/DB_USER/DB_PASSWORD` 지정. 안 쓰면 컨테이너 postgres가 기본.
- **토큰 암호화 키**는 운영에서 반드시 교체: `openssl rand -base64 32` → `TOKEN_ENC_KEY`.

### 3.3 기동
```bash
docker compose up -d --build      # postgres → (healthy) → api-server 순으로 기동
docker compose ps                 # 둘 다 healthy 확인
docker compose logs -f api-server # 부팅 로그
```

### 3.4 확인
```bash
curl http://localhost:8088/actuator/health   # {"status":"UP"}
# 개발 프로파일이면 Swagger: http://localhost:8088/swagger-ui.html
```

### 3.5 종료
```bash
docker compose down          # 컨테이너·네트워크 제거 (DB 볼륨은 유지)
docker compose down -v       # DB 볼륨까지 삭제 (초기화)
```

---

## 4. 포트

| 서비스 | 컨테이너 | 호스트(기본) | 오버라이드 |
|---|---|---|---|
| api-server | 8080 | **8088** | `.env` `API_HOST_PORT` |
| postgres | 5432 | **5433** | `.env` `POSTGRES_HOST_PORT` |

> 호스트 기본 포트를 8088/5433으로 둔 이유: 로컬에 8080/5432를 쓰는 다른 프로세스가 흔해 충돌을 피하려는 것. 컨테이너 간 통신(api-server→postgres)은 내부 네트워크의 5432를 쓰므로 호스트 포트와 무관하다. 깨끗한 VM이라면 8080/5432로 바꿔도 된다.

---

## 5. 주요 환경변수 (compose가 읽는 루트 `.env`)

| 변수 | 기본 | 설명 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | (없음) | `prod`면 운영 안전값. 비우면 개발 기본(Swagger 노출) |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | 컨테이너 postgres | Supabase 사용 시 지정 |
| `POSTGRES_DB/USER/PASSWORD` | vibeguard | 컨테이너 postgres 초기화값 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | changeme | GitHub OAuth (필수) |
| `TOKEN_ENC_KEY` | dev 기본값 | 토큰 암호화 키(운영 필수 교체) |
| `CORS_ALLOWED_ORIGINS` | localhost:5173 | FE 배포 도메인 |
| `POST_LOGIN_URI` | localhost:5173/dashboard | 로그인 후 리다이렉트 |
| `RUNNER_BASE_URL` / `RUNNER_CALLBACK_SECRET` | agent-runner:4000 / dev-secret | 런너 HMAC 연동 |

---

## 6. 운영(prod) 프로파일

`SPRING_PROFILES_ACTIVE=prod` 지정 시 `application-prod.yml`이 적용된다:
- SpringDoc(`/v3/api-docs`, `/swagger-ui.html`) 비활성화
- actuator 노출을 `health,info`로 축소, `health` 상세 정보 숨김
- 로깅 INFO / SQL WARN

> HTTPS·도메인·리버스 프록시(Nginx 등)는 VM 앞단에서 처리한다. FE가 크로스 오리진(Vercel)이면 세션 쿠키가 `SameSite=None; Secure`여야 하므로 **HTTPS가 필수**다.

---

## 7. 이미지 빌드 (참고)

Compose가 자동 빌드하지만, 단독 빌드도 가능하다.
```bash
docker build -t vibeguard-api:local ./BE/api-server
```
- 멀티스테이지: `eclipse-temurin:21-jdk`(빌드, `bootJar -x test`) → `21-jre-jammy`(런타임, 비특권 사용자).
- 테스트는 Testcontainers(Docker)가 필요해 이미지 빌드 단계에서 제외한다. 테스트는 CI/로컬에서 `./gradlew build`로 별도 수행.

---

## 8. agent-runner 통합 (에이전트 팀)

`docker-compose.yml`에 agent-runner placeholder가 주석으로 있다. 에이전트 팀이 `BE/agent` Dockerfile을 작성하면 주석을 해제해 통합한다. 이때 고려 사항:
- `API_BASE_URL=http://api-server:8080` (내부 네트워크)
- `RUNNER_CALLBACK_SECRET`은 api-server와 **동일 값** (HMAC)
- 스캐너·테스트 샌드박스 실행을 위한 Docker 소켓 마운트 여부는 에이전트 팀이 결정

---

## 9. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | 호스트 포트 충돌 → `.env`의 `API_HOST_PORT`/`POSTGRES_HOST_PORT` 변경 |
| api-server가 계속 `health: starting` | 부팅 40s+ 소요 정상(start_period 40s). 로그로 Flyway/DB 연결 확인 |
| `FlywayValidateException` | 엔티티와 스키마 불일치 → DB 마이그레이션(V*.sql) 확인. `down -v`로 초기화 후 재기동 |
| Supabase 연결 실패 | `DB_URL`에 `?sslmode=require`, 세션 풀러(5432) 사용 확인(트랜잭션 풀러 6543 금지) |
