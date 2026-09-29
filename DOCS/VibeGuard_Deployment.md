# VibeGuard 배포 가이드 (Deployment)

> 데모 배포: **단일 VM + Docker Compose** (PRD §12). 무료 인프라 목표.
> 담당: 민진홍(백엔드 코어·인프라·배포).

| 항목 | 내용 |
|---|---|
| 문서 버전 | **v1.4 · 2026-09-29 (EC2·DuckDNS 실배포 검증 반영)** |
| 대상 | `BE/api-server` (Spring Boot 4 / Java 21) + `BE/agent` + PostgreSQL + Caddy |
| **배포 인프라(확정)** | **AWS EC2** + DuckDNS/Caddy HTTPS · FE는 Vercel · 데모 DB는 EC2 로컬 PostgreSQL |
| 관련 문서 | [PRD](./VibeGuard_PRD.md) · [Architecture](./VibeGuard_Architecture.md) · [Team Roles](./VibeGuard_Team_Roles.md) |

> **배포 대상 확정 — AWS EC2.** api-server + agent-runner + 샌드박스 컨테이너 3종을 단일 EC2
> 인스턴스에서 Docker Compose로 구동한다. FE는 Vercel에 두고, 현재 대회 데모 DB는 같은 EC2의
> PostgreSQL 컨테이너를 사용한다. Supabase는 필요할 때 선택 가능한 관리형 DB 경로다.
>
> **인스턴스 선택(비용).** 프리티어는 `t2.micro`/`t3.micro`(1GB RAM, 12개월 무료)이지만, 스캐너·
> 테스트 컨테이너를 돌리기에 **1GB는 빠듯**하다. 데모 안정성을 위해 **`t3.small`(2GB) 이상**을
> 권장하며, 이 경우 소액 과금이 발생한다. 메모리 부족 시 스왑 2~4GB를 잡아 프리티어로도
> 리허설은 가능하지만, 시연 당일에는 여유 있는 인스턴스를 권장한다.

---

## 1. 구성 요약

```
[단일 VM]  docker compose
  ├─ postgres      (로컬 DB. Supabase 사용 시 불필요)
  ├─ api-server    (Spring Boot, :8080 → 호스트 :8088)
  └─ agent-runner  (Node + Claude SDK, :4000)
       │              └─ 컨테이너 3종(스캔/설치/테스트) 샌드박스를 호스트 Docker로 실행
       └─ FE(Vercel) ──REST/SSE──▶ api-server
```

- **DB 선택지 2가지**
  - (A) 컨테이너 postgres — `.env`의 DB_URL 미설정 시 기본. 완전 오프라인·데모용.
  - (B) Supabase 관리형 — `.env`에 `DB_URL/DB_USER/DB_PASSWORD` 지정. 공유 개발·운영용.
- **FE는 Vercel 분리 배포**. 현재 검증된 대회 데모는 postgres + api-server + agent-runner + Caddy를 EC2 Compose로 띄운다.
- **agent-runner**는 스캔·설치·테스트 샌드박스(컨테이너 3종, 방향 전환 v2)를 **호스트 Docker 소켓**을 통해 띄우므로 compose에서 소켓을 마운트한다(데모/신뢰 환경 한정, NFR-S1).

---

## 2. 사전 요구사항

- **배포 VM: AWS EC2 (확정)** — `t3.small`(2GB) 이상 권장, Ubuntu 22.04/24.04 LTS. VM에 **Docker + Docker Compose** 설치 (Docker Engine 24+ 권장).
  - 프리티어(`t2.micro`/`t3.micro`, 1GB)로도 리허설은 가능하나 스왑 2~4GB 권장(§2 상단 비용 노트 참고).
  - 대안(리허설/오프라인용): 팀원 머신에서도 동일 Compose로 구동 가능.
- GitHub OAuth App 1개 (Client ID/Secret) — 로그인용
- 무료 DuckDNS 서브도메인 1개 — 현재 백엔드 주소는 `https://vibeguard1st.duckdns.org`.
- Elastic IP는 사용하지 않는다. EC2 시작 시 `scripts/aws/start-free-tier.sh`가 DuckDNS를 새 공인 IP로 갱신한다.

> EC2 표준 인스턴스는 x86_64(amd64)다. 샌드박스/회귀 테스트 컨테이너는 재현성을 위해
> `--platform linux/amd64`로 고정한다(PRD §15 R2) — EC2에서는 네이티브 아키텍처와도 일치한다.
> (Apple Silicon 등 ARM 로컬에서 빌드해도 동일 태그로 재현.) 보안그룹 인바운드 개방은 §3.6 참고.

**Ubuntu VM에 Docker 설치 (없다면):**
```bash
# 공식 편의 스크립트 (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sudo sh
# 현재 사용자를 docker 그룹에 추가(sudo 없이 docker 사용) — 재로그인 필요
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version   # 설치 확인
```

---

## 2.5 AWS EC2 준비 (처음부터 — 실인스턴스 배포 테스트용)

EC2 인스턴스를 새로 만들고 접속·배포 준비까지 하는 전체 절차다. AWS 콘솔(브라우저)과 로컬 터미널을 오간다.

### (1) 리전·인스턴스 생성 (콘솔)
1. AWS 콘솔 → 리전을 **ap-northeast-2(서울)** 로 선택(지연 최소).
2. EC2 → **Launch instance**.
   - **Name**: `vibeguard-demo`
   - **AMI**: Ubuntu Server 24.04 LTS (x86_64)
   - **Instance type**: `t3.small`(2GB, 권장) — 프리티어만 쓰려면 `t3.micro`(1GB, 스왑 필수)
   - **Key pair**: 새로 생성(`vibeguard-key`) → **`.pem` 다운로드**(재발급 불가, 안전 보관)
   - **Network settings → Security group**: 새로 만들고 아래 인바운드 규칙(2번 항목)
   - **Storage**: gp3 20GB 이상(도커 이미지·Trivy DB 여유)
3. **Launch instance** → 몇 분 후 running.

### (2) 보안 그룹 인바운드 규칙
EC2 → 인스턴스 → Security → Security groups → Inbound rules 편집:

| Type | Port | Source | 용도 |
|---|---|---|---|
| SSH | 22 | **내 IP(My IP)** | 접속 (전체 개방 금지) |
| HTTP | 80 | 0.0.0.0/0 | Caddy HTTPS 리다이렉트·인증서 발급 |
| HTTPS | 443 | 0.0.0.0/0 | FE·브라우저 접속(Caddy TLS) |

> 프로덕션 오버레이는 API(8088)·Runner(4000)·DB(5433)의 호스트 포트 노출을 제거한다. 보안 그룹에도 이 포트들을 열지 않는다.

### (3) 무료 고정 도메인 — DuckDNS (확정)

Elastic IP는 공인 IPv4 비용을 피하기 위해 사용하지 않는다. DuckDNS에서 `vibeguard1st` 서브도메인을
만들고 저장소 루트에 아래 로컬 전용 파일을 둔다. 실제 토큰은 채팅·Git·명령행에 붙여 넣지 않는다.

```bash
cp .duckdns.local.example .duckdns.local
chmod 600 .duckdns.local
# 편집기로 DUCKDNS_TOKEN 입력. .duckdns.local은 Git에서 제외된다.
```

```dotenv
DUCKDNS_DOMAIN=vibeguard1st
DUCKDNS_TOKEN=<로컬 파일에만 입력>
```

`CONFIRM_START=YES scripts/aws/start-free-tier.sh`를 실행하면 새 EC2 공인 IP를 DuckDNS에 자동 반영한다.
따라서 EC2 IP가 바뀌어도 외부 백엔드 URL과 OAuth 콜백 URL은 바뀌지 않는다.

### (4) SSH 접속 (로컬 터미널)
```bash
chmod 400 vibeguard-key.pem                       # 키 권한(최초 1회)
ssh -i vibeguard-key.pem ubuntu@<EC2_PUBLIC_IP>   # Ubuntu AMI 기본 사용자: ubuntu
```

### (5) 인스턴스 초기 세팅
```bash
sudo apt-get update && sudo apt-get upgrade -y
# Docker 설치 (위 §2 스크립트와 동일)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version && docker compose version

# (t3.micro 등 1GB 인스턴스) 스왑 4GB — 메모리 부족 방지
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # Swap 확인
```

### (6) 소스 가져오기 → 배포는 §3
```bash
git clone https://github.com/peachoath/vibeguard.git && cd vibeguard
# 이후 §3.2 환경변수 설정 → §3.3 기동 (원클릭: bash scripts/deploy.sh)
```

> **배포 후 필수 확인(§3.6):** GitHub OAuth 콜백 URL을 `https://vibeguard1st.duckdns.org/login/oauth2/code/github`로, `.env`의 `CORS_ALLOWED_ORIGINS`·`POST_LOGIN_URI`를 FE(Vercel) 실제 도메인으로 맞춘다. 크로스 오리진 세션 쿠키 때문에 **HTTPS 필수** — 앞단 Caddy로 TLS 종단.

### (7) 비용·정리 (실테스트 종료 시)
- 인스턴스를 **Stop**하면 컴퓨팅 사용은 멈추지만 EBS 저장 비용은 계속될 수 있다.
- Elastic IP는 생성하지 않는다. 테스트가 완전히 끝나면 CloudFormation 스택을 삭제해 EC2·EBS·보안그룹을 함께 정리한다.

### (8) 무료 플랜 단기 리허설 경로

AWS 계정 생성 시점에 따라 무료 정책이 다르므로 인스턴스부터 만들지 않는다. 먼저 읽기 전용 점검을 실행한다.

```bash
scripts/aws/free-tier-preflight.sh
```

무료 플랜이 `ACTIVE`이고 크레딧이 충분할 때만 아래 자동화를 사용한다.

```bash
CONFIRM_FREE_PLAN_DEPLOY=YES scripts/aws/deploy-free-tier.sh
```

기본 안전값:

- 서울 리전 `t3.small`(x86_64) + 암호화 gp3 20GiB
- T3 CPU 크레딧 `standard` — surplus CPU 과금 방지
- Elastic IP를 생성하지 않음
- SSH는 실행 시점의 공인 IP `/32`로만 허용
- API·Runner·DB 포트는 열지 않고 80/443만 공개
- 자동 정지 시간은 `AUTO_STOP_HOURS`로 지정. 현재 대회 데모 스택은 **부팅 2시간 뒤 자동 정지**
- CloudFormation 삭제 시 EC2·루트 EBS·보안그룹 함께 제거

공인 IPv4는 Elastic IP 여부와 관계없이 시간당 비용 항목이므로 테스트가 끝나면 정지만 하지 말고 스택을 삭제한다.

```bash
# 잠시 보존하되 컴퓨팅·공인 IPv4 사용을 멈춤
scripts/aws/stop-free-tier.sh

# 다음 작업 때 재시작. .duckdns.local이 있으면 바뀐 공인 IP를 DuckDNS에 자동 반영
CONFIRM_START=YES scripts/aws/start-free-tier.sh

# 테스트가 완전히 끝났으면 EC2·EBS·보안그룹 삭제
CONFIRM_DESTROY=YES scripts/aws/destroy-free-tier.sh
```

> Elastic IP가 없어 정지 후 재시작하면 공인 IP는 바뀐다. 하지만 시작 스크립트가 DuckDNS를 갱신하므로
> 외부 URL `https://vibeguard1st.duckdns.org`는 유지된다. PostgreSQL·API·Runner·Caddy에는
> `restart: unless-stopped`가 적용되어 Docker 기동 뒤 자동 복구된다.

---

## 3. 배포 절차

> **원클릭:** 저장소 루트에서 `PROD=1 bash scripts/deploy.sh` — `.env` 및 운영 필수값 검증 → 작업·캐시 경로 준비 → **샌드박스 이미지 빌드** → compose 빌드·기동 → 헬스 대기까지 자동 처리한다. `.env`가 없으면 생성만 하고 값 입력을 안내한다. 수동 절차는 아래 3.1~3.6.
>
> **샌드박스 이미지 선빌드(중요).** agent-runner는 스캔·설치·테스트 컨테이너를 런타임에 `vibeguard-sandbox:0.1` / `vibeguard-scan:0.1` 태그로 띄운다. compose는 이 이미지들을 빌드하지 않으므로 **반드시 기동 전에 미리 빌드**해야 한다(스크립트가 자동 처리). 이 단계가 빠지면 스캔 파이프라인이 이미지 없음으로 실패한다. 상세는 §7.

### 3.0 로컬 비용 없는 통합 리허설

Docker Desktop을 실행한 뒤 아래 스크립트를 사용한다. 실제 `.env`를 읽지 않고 임시 키·로컬 DB를 만들며, `DRY_RUN=1`로 Claude API 호출 없이 API→Runner→HMAC callback→DB 상태 전이를 확인한다. 완료 후 컨테이너·볼륨·임시 키는 자동 삭제된다.

```bash
bash scripts/local-smoke.sh
```

디버깅을 위해 컨테이너를 남기려면 `KEEP_SMOKE=1 bash scripts/local-smoke.sh`를 사용한다.

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
- 로컬 PostgreSQL에서는 `DB_PASSWORD`를 따로 지정하지 않으면 api-server가 회전된 `POSTGRES_PASSWORD`를 자동 사용한다.
- **토큰 암호화 키**는 운영에서 반드시 교체: `openssl rand -base64 32` → `TOKEN_ENC_KEY`.
- **Runner 콜백 키**도 반드시 교체: `openssl rand -hex 32` → `RUNNER_CALLBACK_SECRET`.
- EC2 Docker 소켓 GID를 확인해 `.env`에 반영: `stat -c '%g' /var/run/docker.sock` → `DOCKER_GID`.
- Vercel에는 `NEXT_PUBLIC_API_URL=https://vibeguard1st.duckdns.org`을 지정하고 재배포한다. Base URL에 `/api/v1`은 붙이지 않는다.

### 3.3 기동
```bash
# (1) 샌드박스 이미지 2종 선빌드 — agent-runner가 런타임에 참조. compose는 빌드하지 않음.
#     scan은 sandbox를 FROM 하므로 순서 고정. 재현성 위해 --platform linux/amd64.
docker build --platform linux/amd64 -t vibeguard-sandbox:0.1 BE/agent/sandbox/image/
docker build --platform linux/amd64 -t vibeguard-scan:0.1 \
    -f BE/agent/sandbox/image/Dockerfile.scan BE/agent/sandbox/image/

# (2) compose 기동
docker compose up -d --build      # postgres → api-server → agent-runner 순으로 기동
docker compose ps                 # 모두 healthy 확인
docker compose logs -f api-server # 부팅 로그
```
> `scripts/deploy.sh`를 쓰면 위 (1)(2)가 자동으로 실행된다. 이미 있는 샌드박스 이미지는 재빌드하지 않는다(`REBUILD_SANDBOX=1`로 강제 재빌드).

**프로덕션(EC2 + HTTPS)으로 기동:** FE(Vercel)가 크로스 오리진이라 세션 쿠키에 HTTPS가 필수다. Caddy가 앞단에서 TLS를 종단하는 프로덕션 오버레이(`docker-compose.prod.yml`)를 함께 올린다.
```bash
# .env 에 DEPLOY_DOMAIN=vibeguard1st.duckdns.org, SPRING_PROFILES_ACTIVE=prod 지정
# DuckDNS가 EC2 퍼블릭 IP를 가리키고, 보안그룹 80/443 개방 필요
PROD=1 bash scripts/deploy.sh
# 또는 수동:
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
- Caddy가 Let's Encrypt 인증서를 자동 발급(첫 기동 시 수십 초). 발급된 인증서는 `caddy_data` 볼륨에 영속된다.
- 프로덕션 오버레이는 API(8088)·Runner(4000)·DB(5433)의 호스트 포트를 모두 닫고, 외부 진입을 Caddy(80/443)로만 제한한다.
- 도메인이 아직 없으면(IP만) `infra/Caddyfile`의 안내대로 `tls internal`(자체 서명, 브라우저 경고)로 리허설 가능.

### 3.4 확인
```bash
# 로컬 기본 compose
curl http://localhost:8088/actuator/health

# EC2 프로덕션 오버레이
curl https://vibeguard1st.duckdns.org/actuator/health
```

### 3.5 종료
```bash
docker compose down          # 컨테이너·네트워크 제거 (DB 볼륨은 유지)
docker compose down -v       # DB 볼륨까지 삭제 (초기화)
```

### 3.6 VM 배포 시 추가 확인 (실배포에서 가장 흔한 실패 지점)

**(a) 방화벽 / 클라우드 보안그룹 인바운드 개방**
EC2는 기본적으로 외부 포트가 막혀 있어, 포트를 열지 않으면 브라우저·FE에서 접속되지 않는다.
- **AWS EC2 (기본)**: 인스턴스의 **Security Group → Inbound rules**에 규칙 추가.
  - 22/TCP(SSH, 내 IP로 제한), 80/TCP(인증서 발급·HTTPS 리다이렉트), 443/TCP(HTTPS)를 연다.
  - API(8088)·Runner(4000)·DB(5433)는 **외부에 열지 않는다**. 프로덕션 오버레이에서도 호스트 노출이 제거된다.

**(b) GitHub OAuth App 콜백 URL**
EC2 배포 시 콜백이 로컬이 아니라 백엔드 공개 도메인이어야 한다. GitHub OAuth App 설정에서:
- Authorization callback URL: `https://<백엔드 도메인>/login/oauth2/code/github`
- 현재 확정값: `https://vibeguard1st.duckdns.org/login/oauth2/code/github`
- `.env`의 `CORS_ALLOWED_ORIGINS`·`POST_LOGIN_URI`는 **FE(Vercel) 오리진 `https://vibeguard-mu.vercel.app`** 으로 지정.

**(c) HTTPS — Caddy 리버스 프록시 + 도메인 (확정)**
FE가 Vercel(크로스 오리진)이면 세션 쿠키가 `SameSite=None; Secure`여야 하므로 **api-server 앞단에 HTTPS가 필수**다. **Caddy**를 리버스 프록시로 두면 Let's Encrypt로 **자동 TLS**가 발급·갱신된다.

> **도메인이 필요하다.** 현재는 무료 DuckDNS `vibeguard1st.duckdns.org`를 사용한다. EC2 재시작으로
> 공인 IP가 바뀌면 시작 스크립트가 DuckDNS 레코드를 자동 갱신하고, Caddy가 공개 인증서를 유지·갱신한다.

EC2에서는 저장소에 포함된 Caddy 오버레이로 실행한다.
```bash
PROD=1 bash scripts/deploy.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f caddy
```
- Security Group Inbound에 **443/TCP(및 80/TCP — Let's Encrypt HTTP-01 챌린지용)** 를 연다.
- FE는 Vercel의 `NEXT_PUBLIC_API_URL=https://vibeguard1st.duckdns.org`으로 백엔드를 호출한다.
- 데모를 동일 오리진으로 하면 생략 가능하나, FE가 Vercel이므로 이번 구성에서는 **필수**다.

### 3.7 현재 실배포 상태와 발표 당일 Runbook (2026-09-29 검증)

| 항목 | 현재 값 |
|---|---|
| GitHub 저장소 | `https://github.com/peachoath/vibeguard` |
| EC2 체크아웃 경로 | `/opt/vibeguard` |
| 배포 브랜치 | `docs/deploy-target-ec2` (PR #50) |
| 백엔드 Base URL | `https://vibeguard1st.duckdns.org` |
| FE 오리진 | `https://vibeguard-mu.vercel.app` |
| DB | EC2 내부 PostgreSQL 16 컨테이너 |
| 외부 공개 포트 | Caddy 80/443만 공개 |
| 테스트 모드 | `DRY_RUN=1` — Anthropic 호출 비용 없음 |
| 자동 정지 | 현재 스택은 부팅 2시간 후 |

검증 완료 항목:

- PostgreSQL·api-server·agent-runner 모두 Docker health `healthy`
- Caddy/Let's Encrypt 공개 인증서 발급 및 HTTPS health `200 UP`
- HTTP→HTTPS `308`, 운영 Swagger `401`
- Vercel 오리진 CORS 및 `Access-Control-Allow-Credentials: true`
- API→Runner HMAC→callback→DB 전체 DRY_RUN `COMPLETED`, Agent run 4건 기록
- 테스트용 DB 행은 검증 직후 삭제

현재 테스트 모드는 임의의 OAuth 기동값과 `DRY_RUN=1`을 사용한다. 따라서 **인프라·백엔드 통합은
검증 완료**지만 실제 GitHub 로그인과 Claude 분석은 회전된 운영 시크릿을 연결하기 전까지 비활성이다.

발표 당일에는 최소 1시간, 권장 1.5~2시간 전에 아래 순서로 준비한다.

```bash
# 1) EC2 시작 + DuckDNS 자동 갱신
CONFIRM_START=YES scripts/aws/start-free-tier.sh

# 2) 출력된 IP로 접속해 최신 GitHub 코드 반영
ssh -i ~/.ssh/vibeguard-demo.pem ubuntu@<출력된_PUBLIC_IP>
cd /opt/vibeguard
git pull --ff-only origin docs/deploy-target-ec2
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# 3) 외부 HTTPS 확인
curl https://vibeguard1st.duckdns.org/actuator/health
```

발표가 2시간을 넘기거나 사전 리허설 시간이 길면 시작 전에 CloudFormation의 자동 정지 시간을
발표 종료 이후로 조정한다. 사용이 끝나면 `scripts/aws/stop-free-tier.sh`로 즉시 정지한다.

---

## 4. 포트

| 서비스 | 컨테이너 | 호스트(기본) | 오버라이드 |
|---|---|---|---|
| api-server | 8080 | **8088** | `.env` `API_HOST_PORT` |
| postgres | 5432 | **5433** | `.env` `POSTGRES_HOST_PORT` |
| agent-runner | 4000 | **4000** | `.env` `RUNNER_HOST_PORT` |

> 위 호스트 포트는 로컬 기본 compose에서만 사용한다. `docker-compose.prod.yml`을 적용하면 세 포트 모두 제거되고 Caddy의 80/443만 노출된다.

---

## 5. 주요 환경변수 (compose가 읽는 루트 `.env`)

| 변수 | 기본 | 설명 |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | (없음) | `prod`면 운영 안전값. 비우면 개발 기본(Swagger 노출) |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | 컨테이너 postgres | Supabase 사용 시 지정. 로컬 DB에서 `DB_PASSWORD` 미지정 시 `POSTGRES_PASSWORD` 상속 |
| `POSTGRES_DB/USER/PASSWORD` | vibeguard | 컨테이너 postgres 초기화값. 운영에서는 비밀번호 필수 회전 |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | changeme | GitHub OAuth (필수) |
| `TOKEN_ENC_KEY` | dev 기본값 | 토큰 암호화 키(운영 필수 교체) |
| `CORS_ALLOWED_ORIGINS` | localhost:3000 | FE 배포 도메인 — 운영값 `https://vibeguard-mu.vercel.app` |
| `POST_LOGIN_URI` | localhost:3000/dashboard | 로그인 후 리다이렉트 — 운영값 `https://vibeguard-mu.vercel.app/dashboard` |
| `RUNNER_BASE_URL` / `RUNNER_CALLBACK_SECRET` | agent-runner:4000 / dev-secret | 런너 HMAC 연동 (api-server·agent 동일) |
| `ANTHROPIC_API_KEY` | (없음) | Claude Agent SDK. 없으면 런너 골격 모드(실제 분석 없음) |
| `DRY_RUN` | 0 | `1`이면 Anthropic 호출 없이 Agent 1~4 목 출력으로 통합 흐름 검증 |
| `DOCKER_GID` | 999 | agent-runner가 호스트 Docker 소켓에 접근하기 위한 그룹 GID. 호스트와 불일치 시 소켓 EACCES. 설정: `echo "DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)" >> .env` |

---

## 6. 운영(prod) 프로파일

`SPRING_PROFILES_ACTIVE=prod` 지정 시 `application-prod.yml`이 적용된다:
- SpringDoc(`/v3/api-docs`, `/swagger-ui.html`) 비활성화
- actuator 노출을 `health,info`로 축소, `health` 상세 정보 숨김
- 로깅 INFO / SQL WARN
- **DB 커넥션 풀(HikariCP)**: Supabase 세션 풀러 대비 작은 풀(`DB_POOL_MAX` 기본 5, `DB_POOL_MIN` 1), `max-lifetime` 30분. 무료 티어 커넥션 상한을 넘지 않게 조정 가능.

> 검증(2026-09-29): EC2 로컬 postgres에 `SPRING_PROFILES_ACTIVE=prod`로 실배포 → HTTPS health 200/UP,
> HTTP→HTTPS 308, Swagger 401, Vercel CORS credentials 허용, API→Runner HMAC→callback→DB DRY_RUN 완료를 확인했다.
> Supabase로 바꾸려면 `.env`의 `DB_URL/DB_USER/DB_PASSWORD`를 세션 풀러(5432)+`?sslmode=require` 값으로 교체한다.

> HTTPS·도메인·리버스 프록시(Nginx 등)는 VM 앞단에서 처리한다. FE가 크로스 오리진(Vercel)이면 세션 쿠키가 `SameSite=None; Secure`여야 하므로 **HTTPS가 필수**다.

---

## 7. 이미지 빌드

### 7.1 Compose가 빌드하는 이미지 (자동)
```bash
docker build -t vibeguard-api:local ./BE/api-server   # 단독 빌드도 가능
```
- **api-server**: 멀티스테이지 `eclipse-temurin:21-jdk`(빌드, `bootJar -x test`) → `21-jre-jammy`(런타임, 비특권 사용자).
- **agent-runner**: `BE/agent/Dockerfile`. compose `up --build`가 자동 빌드.
- 테스트는 Testcontainers(Docker)가 필요해 이미지 빌드 단계에서 제외한다. 테스트는 CI/로컬에서 `./gradlew build`로 별도 수행.

### 7.2 샌드박스 이미지 2종 (수동 선빌드 — compose가 빌드하지 않음)
agent-runner가 스캔·설치·테스트 컨테이너를 **런타임에** 아래 태그로 띄운다. compose 서비스가 아니므로 기동 전에 미리 만들어야 한다(스크립트가 자동 처리).
```bash
# 순서 고정: scan 이미지는 sandbox 이미지를 FROM 한다.
docker build --platform linux/amd64 -t vibeguard-sandbox:0.1 BE/agent/sandbox/image/
docker build --platform linux/amd64 -t vibeguard-scan:0.1 \
    -f BE/agent/sandbox/image/Dockerfile.scan BE/agent/sandbox/image/
```
- `vibeguard-sandbox:0.1`: `python:3.10-slim` + `pytest==9.1.1` + 비특권 사용자(uid/gid 1000). 설치·테스트 컨테이너의 베이스.
- `vibeguard-scan:0.1`: 위 이미지 + `aquasec/trivy:0.74.0` 바이너리. 스캔 컨테이너.
- **`--platform linux/amd64` 고정**: EC2 표준 인스턴스(x86_64)와 일치하며, ARM 로컬(Apple Silicon 등)에서 빌드해도 실행 아키텍처를 통일해 재현성 확보(PRD §15 R2). Trivy DB는 이미지에 굽지 않고 호스트 캐시를 마운트한다.
- **이 단계가 빠지면** 스캔 파이프라인이 이미지 없음으로 실패한다.

---

## 8. agent-runner 통합 (현황: 활성)

`docker-compose.yml`에 **agent-runner 서비스가 활성화되어 있다**(과거의 주석 placeholder 아님). 구성:
- `API_BASE_URL=http://api-server:8080` (내부 네트워크)
- `RUNNER_CALLBACK_SECRET`은 api-server와 **동일 값** (HMAC, NFR-S4)
- `ANTHROPIC_API_KEY`로 Claude Agent SDK 구동(없으면 골격 모드)
- 샌드박스 컨테이너 3종 실행을 위해 **호스트 Docker 소켓을 마운트**(`/var/run/docker.sock`)하고, `group_add: [${DOCKER_GID}]`로 소켓 접근 권한을 부여한다. 소켓 마운트는 강력한 권한이므로 **데모/신뢰 환경 한정**(NFR-S1).
- 호스트 docker 소켓 GID가 이미지 기본값(999)과 다르면 `.env`에 `DOCKER_GID`를 지정한다(§5).

---

## 9. 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `Bind for 0.0.0.0:8080 failed: port is already allocated` | 호스트 포트 충돌 → `.env`의 `API_HOST_PORT`/`POSTGRES_HOST_PORT` 변경 |
| api-server가 계속 `health: starting` | 부팅 40s+ 소요 정상(start_period 40s). 로그로 Flyway/DB 연결 확인 |
| `password authentication failed for user "vibeguard"` | 로컬 DB 암호 불일치. 최신 compose는 `DB_PASSWORD` 미지정 시 `POSTGRES_PASSWORD`를 상속한다. 최신 코드 pull 후 컨테이너 재생성 |
| `FlywayValidateException` | 엔티티와 스키마 불일치 → DB 마이그레이션(V*.sql) 확인. `down -v`로 초기화 후 재기동 |
| Supabase 연결 실패 | `DB_URL`에 `?sslmode=require`, 세션 풀러(5432) 사용 확인(트랜잭션 풀러 6543 금지) |
