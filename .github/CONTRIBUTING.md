# 기여 가이드 (Contributing)

VibeGuard 협업 규칙입니다. 브랜치 · 커밋 · PR 컨벤션을 통일합니다.

## 브랜치 전략

```
main  ← (배포 시 PR) ← dev ← (기능 PR) ← feature/*, fix/*, chore/* ...
```

| 브랜치 | 용도 | 규칙 |
|---|---|---|
| `main` | 배포(production) | 직접 push 금지. `dev → main` PR로만 병합 |
| `dev` | 개발 통합 | 작업 브랜치가 여기로 병합됨 |
| `feature/*` `fix/*` `chore/*` `docs/*` `refactor/*` | 작업 단위 | `dev`에서 분기 → `dev`로 PR |

> 초기 셋업 단계에선 `dev` 직접 커밋을 허용합니다. **팀 병렬 개발이 시작되면 작업 브랜치 + PR을 필수로** 전환합니다.

**브랜치 이름**: `<type>/<이슈번호>-<짧은-설명>`
예) `feature/12-github-oauth`, `fix/23-flyway-autoconfig`

## 커밋 컨벤션 (Conventional Commits)

형식: **`type(scope): 제목`**

- 제목은 한국어 OK. 명령형/현재형, 마침표 없이, 50자 내외.
- 하나의 커밋은 하나의 논리적 변경만.

**type**

| type | 의미 |
|---|---|
| `feat` | 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 |
| `style` | 포맷팅(로직 변화 없음) |
| `refactor` | 리팩터링 |
| `perf` | 성능 |
| `test` | 테스트 |
| `build` | 빌드/의존성 |
| `ci` | CI 설정 |
| `chore` | 기타 잡무 |
| `revert` | 되돌리기 |

**scope**(예): `fe`, `be`, `agent`, `mcp`, `db`, `infra`, `docs`, `ci`

**예시**
```
feat(be): GitHub OAuth2 로그인 추가
fix(be): Flyway 자동설정 활성화
chore(env): 루트 .env 제거, 컴포넌트별 .env로 일원화
```

본문(선택)에는 "무엇을/왜". 꼬리말에 이슈 연결: `Closes #12`, 파괴적 변경은 `BREAKING CHANGE: ...`.

## PR 규칙

- 대상 브랜치: **`dev`** (배포 시에만 `dev → main`)
- **리뷰 1인 이상 승인** 후 병합
- CI가 있으면 통과 필수
- PR 제목도 커밋 컨벤션 권장
- 병합 방식: **Squash merge 권장**(히스토리 정리)

## 스키마 변경

- DB 스키마 변경은 **반드시 Flyway 마이그레이션 파일**(`V2__...`)로. **기존 마이그레이션 파일 수정 금지.**

## 보안

- 시크릿/토큰을 코드·로그·PR·이슈에 노출 금지.
- `.env`는 커밋하지 않습니다(`.gitignore` 처리됨). 공유는 `.env.example`로.

---

### (선택) 커밋 메시지 자동 검사

commitlint + husky로 컨벤션을 강제할 수 있습니다. 도입 시 `FE` 또는 별도 루트 툴링에 설정합니다. 지금은 규칙 준수로 운영합니다.
