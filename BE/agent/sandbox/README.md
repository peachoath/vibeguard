# VibeGuard 샌드박스 러너 — 현황

최종 이동: 2026-09-13. `/home/shinwoo/vibeguard`(git 저장소 아님, 임시 작업 폴더)에서
저장소의 `BE/agent/sandbox/`로 옮겨졌다(`Team_Roles.md` Q3 확정). 이 문서는 그때 있던
`STATUS.md`를 옮기며 경로를 새 위치에 맞게 고친 것이다.

1~5단계가 모두 완료되었다. 러너는 격리되어 있으며, 적대적 픽스처 리포가 신뢰할 수 없는
코드를 실제로 가둔다는 것을 확인해 준다. 이동 후 검사 9종과 `verify_hostile.py`를
다시 돌려 결과가 그대로임을 재확인했다(아래 "최근 검증 결과" 참고).

2026-09-10에 격리 설정을 제품 요구사항(NFR-S1, NFR-S2)에 맞췄다. `--cap-drop=ALL`을
추가하고, `--memory`를 512m에서 2g로, `--pids-limit`을 128에서 256으로, 기본 타임아웃을
60초에서 300초로 올렸다. 검사 6도 함께 조정했는데, 기존 요구량이 새 상한과 정확히 같아졌기
때문이다.

요구사항과 아직 다른 부분은 옛 위치의 `VibeGuard_PRD_Gap.md`를 참고할 것(이번 이동에는
포함하지 않았다 — §7 이동 구조 제안에 없던 파일).

## 무엇이 있나

    runner.py                     러너 본체. 백엔드는 run_in_sandbox(command,
                                  repo_path, artifacts_path)만 호출하면 된다.
                                  역할별로 network·image·extra_mounts·env를
                                  선택 인자로 넘긴다(기본값은 가장 안전한 쪽)
    cli.py                        scanner-mcp·testrunner-mcp가 부르는 입구.
                                  표준입력 JSON → 표준출력 JSON.
                                  run_trivy(①), install(②), run_tests(③)
    test_cli.py                   outcome 판정·junit 파싱·Trivy 보고서 파싱 자체 검사
                                  (도커 불필요)
    verify_hostile.py             5단계를 필요할 때 실행한다. fixtures/malicious_repo를
                                  샌드박스에 통과시킨 뒤 호스트 무결성을 재확인한다
    image/Dockerfile              설치·테스트 이미지. 태그는 vibeguard-sandbox:0.1.
                                  하위 폴더에 둔 이유는 빌드 컨텍스트에
                                  fixtures/malicious_repo가 딸려 들어가지 않게 하기 위함
    image/Dockerfile.scan         스캔 이미지. 태그는 vibeguard-scan:0.1 (442MB).
                                  위 이미지에 Trivy 0.74.0 바이너리만 얹었다
    fixtures/sample_repo/         검사에 쓰이는 픽스처 리포
      calculator.py               add()와, 0 나눗셈을 막지 않는 divide()
      conftest.py                 비어 있음. 리포 루트를 sys.path에 올린다
      tests/test_sample.py        통과 2건, 의도적 실패 1건
    fixtures/malicious_repo/      적대적 픽스처. README부터 읽을 것
    .venv/                        호스트 도구용 Python 3.14 (git 추적 안 함)
    artifacts/                    마지막 실행의 결과물 (git 추적 안 함, 지워도 무방)

## 실행 방법

    cd BE/agent/sandbox
    python3 -m venv .venv                                               # 최초 1회
    docker build --platform linux/amd64 -t vibeguard-sandbox:0.1 image/
    docker build --platform linux/amd64 -t vibeguard-scan:0.1 -f image/Dockerfile.scan image/   # 위 이미지를 먼저
    ./.venv/bin/python runner.py            # 검사 9종, 약 20초
    ./.venv/bin/python verify_hostile.py    # 5단계. 침해 시 0이 아닌 코드로 종료
    ./.venv/bin/python test_cli.py          # 판정 로직 검사 (도커 불필요)

CLI 입구는 이렇게 부른다. 호출자는 repoPath 하나만 넘기고, venv·artifacts는
그 부모 폴더 아래에서 유도된다.

    echo '{"tool":"run_trivy","repoPath":"/작업폴더/repo"}' | ./.venv/bin/python cli.py
    echo '{"tool":"install","repoPath":"/작업폴더/repo",
           "stack":"python-pytest","phase":"PRE_PATCH"}' | ./.venv/bin/python cli.py
    echo '{"tool":"run_tests","repoPath":"/작업폴더/repo",
           "stack":"python-pytest","phase":"PRE_PATCH"}' | ./.venv/bin/python cli.py

`run_trivy`는 `OK`/`SCAN_FAILED`/`TIMED_OUT`과 `findings` 목록을 돌려준다. outcome을
따로 두는 이유는 **실패한 스캔과 취약점 없는 리포를 구분하기 위해서다.** 둘 다 findings가
비어 있지만, 앞의 것을 "안전"으로 읽으면 안 된다.
`install`은 `OK`/`INSTALL_FAILED`를, `run_tests`는 `PASSED`/`FAILED`/`NO_TESTS`/
`OOM_KILLED`/`TIMED_OUT`과 함께 `total`·`failed` 건수를 돌려준다.

격리 플래그를 건드린 뒤에는 두 가지를 모두 실행할 것. `verify_hostile.py`는 알려진 무해
2건에 해당하지 않는 공격이 성공했을 때, 디스크의 적대적 리포가 변경되었을 때, 컨테이너가
남았을 때 실패한다. 따라서 로그를 읽지 않고도 종료 코드만으로 CI에서 신뢰할 수 있다.

venv는 Python 3.14로, 샌드박스 이미지는 Python 3.10으로 돌아간다. 이것은 의도된 것이다.
호스트 도구와 분석 환경은 서로 별개다. venv에는 표준 라이브러리 외에 아무것도 필요 없다
(러너 코드가 서드파티 패키지를 쓰지 않는다).

## 각 단계가 어디에 도달했나

**1단계 — 컨테이너에서 명령을 실행하고 종료 코드와 출력을 돌려준다.**
리스트를 넘기는 `subprocess.run`, `shell=True`는 절대 사용하지 않음, `--rm`,
`--platform linux/amd64`.

**2단계 — 마운트.**
`repo_path`를 `/repo`에 읽기 전용으로, `artifacts_path`를 `/out`에 읽기·쓰기로, `-w /repo`.
양쪽 모두 `os.path.abspath`로 변환한다. 상대 경로를 넘기면 Docker가 바인드 마운트 대신
이름 있는 볼륨을 찾기 때문이다. `repo_path`가 없으면 `FileNotFoundError`,
디렉터리가 아니면 `NotADirectoryError`가 나고, artifacts 디렉터리가 없으면 새로 만든다.

**3단계 — 전용 이미지.**
`pytest==9.1.1`을 구워 넣어 실행에 네트워크가 필요 없다. uid/gid 1000의 `sandbox` 사용자를
만들지만 이 단계에서 선택하지는 않는다. `-p no:cacheprovider`는 읽기 전용 `/repo` 때문에
생기는 캐시 경고를 없앤다.

**4단계 — 격리.**
`--network none`, `--user 1000:1000`, `--cap-drop ALL`, `--memory 2g`, `--cpus 1`,
`--pids-limit 256`, `--read-only`와 `/tmp`의 64m tmpfs. 실행마다 고유한 `--name`을 붙여,
제한 시간을 넘긴 실행을 `docker rm --force`로 지울 수 있게 한다. 로컬 docker 클라이언트만
죽이면 컨테이너는 데몬 쪽에 살아남기 때문이다. `RunResult`에 `timed_out`이 추가되었고,
시간 초과된 실행은 `exit_code -1`을 보고해 pytest의 코드(0 통과, 1 실패, 5 수집 없음)와
결코 혼동될 수 없다.

정상 동작: pytest는 여전히 1로 끝나면서 `tests="3" failures="1"`인 junit 보고서를
남기고, `id`는 `uid=1000(sandbox)`를 보고하며, 결과물은 호스트 사용자 소유로 떨어진다.
방어 항목은 각각 실패해야 한다. 네트워크 없음(URLError, 이름 해석), 무한 루프(`timed_out`과
컨테이너 제거), 메모리 폭탄(exit 137, OOM kill), 포크 폭탄(pid 상한에서 `BlockingIOError`),
읽기 전용 컨테이너 파일시스템. `/tmp`는 쓰기 가능한 상태로 남는다.

**5단계 — 적대적 리포.**
`fixtures/malicious_repo/`는 `conftest.py`가 import 시점에 공격 8종을 실행하고 각각을
`/out/attack_log.txt`에 기록하는 pytest 프로젝트다. 호스트에서 절대 실행하지 말 것.
그쪽 README에도 그렇게 적혀 있다. 샌드박스를 통해 실행하면 pytest는 0으로 끝나면서
(평범한 테스트 2건 통과) 모든 공격이 차단된다. 크리덴셜(호스트 홈이 마운트되지 않음),
유출(네트워크 없음), `/etc/shadow`(비root), 리포 변조(읽기 전용 `/repo`), setuid(EPERM),
docker 소켓(마운트되지 않아 부재), `/tmp` 채우기(64m tmpfs 상한에서 ENOSPC).

로그의 두 줄은 SUCCEEDED로 찍히지만 어느 쪽도 침해가 아니다. `/proc/1/environ` 읽기는
성공하지만 `--pid=host`를 쓰지 않으므로 pid 1은 컨테이너 자신의 init이고, 결국 컨테이너
자신의 환경변수를 다시 읽을 뿐이다. 환경변수 덤프에 나오는 `GPG_KEY`는 python 이미지의
공개 서명키이지 호스트의 비밀이 아니다. 호스트 환경변수는 하나도 새지 않았다.
호스트 무결성도 확인했다. `fixtures/malicious_repo`의 md5 불변, `backdoor.py` 없음,
`artifacts/` 밖에 새 파일 없음, 잔류 컨테이너 0건.

## 종료 코드 읽는 법

    0     테스트 통과
    1     테스트 실패
    5     pytest가 아무 테스트도 수집하지 못함
    137   OOM으로 종료. --memory 상한을 넘김
    -1    시간 초과. TIMEOUT_EXIT_CODE이며 컨테이너는 강제로 제거됨

## 이어받는 사람을 위한 메모

`runner.py`의 **검사 8**은 `/etc/passwd`에 쓰기를 시도하며, 읽기 전용 오류가 아니라
`PermissionError`로 실패한다. 비특권 사용자가 애초에 그곳에 쓸 수 없기 때문이다.
따라서 이 검사가 증명하는 것은 `--read-only`가 아니라 `--user`다. `--read-only`는
마운트가 아니면서 모드가 1777인 `/var/tmp`에 써 보는 방식으로 따로 확인했고,
`OSError Errno 30, read-only file system`으로 실패한다. 검사를 손볼 일이 생기면
이 구분을 기억해 둘 것.

Dockerfile의 `chown 1000:1000 /out`은 `/out` 위에 아무것도 마운트되지 않았을 때만
적용된다. 실행 시점에는 호스트 디렉터리의 소유권이 쓰기 권한을 결정한다. 여기서 잘
동작하는 이유는 호스트 사용자 `shinwoo`가 uid 1000 gid 1000이라 샌드박스 사용자와
일치하기 때문이다. **호스트 사용자가 uid 1000이 아닌 곳에서는** `--user`를 하드코딩하는
대신 `os.getuid()`에서 유도해야 한다.

자원 상한은 파라미터가 아니라 모듈 수준 상수다. 어떤 리포지토리가 정당하게 2g 상한보다
많이 필요하다면, 그것은 한 줄 수정이 아니라 시그니처 변경 사안이 된다. 타임아웃은 예외로,
처음부터 파라미터였고 이제 기본값이 `DEFAULT_TIMEOUT`에서 온다.

**검사 6은 의도적으로 `MEMORY_LIMIT`의 두 배를 요구한다.** 상한과 정확히 같은 크기의
메모리 폭탄은 상한이 아니라 인터프리터 오버헤드가 결과를 가르므로 통과와 실패를 오간다.
`MEMORY_LIMIT`을 올릴 때는 이 요구량도 함께 올릴 것.

## 컨테이너 역할 (v2)

| 역할 | 네트워크 | 마운트 | 담당 |
|---|---|---|---|
| ① 스캔 (Trivy) | **O** | Trivy DB 캐시 rw (`TMPDIR`도 여기) | `cli.py run_trivy` |
| ② 설치 (pip) | **O** | `/venv` rw, pip 캐시 rw | `cli.py install` |
| ③ 테스트 (pytest) | **X (절대)** | `/venv` ro | `cli.py run_tests` |

공통 격리(비특권 사용자·`--read-only`·`--cap-drop=ALL`·메모리/PID 상한·300초)는 셋 다
유지한다. 네트워크를 여는 ②에서도 나머지는 그대로다. 원칙은 하나다 — **남의 테스트
코드가 도는 컨테이너에만 네트워크가 없다.**

②와 ③은 `/venv` 마운트로 이어진다. 설치가 거기 쓰고(rw) 테스트가 거기서 읽는다(ro).
테스트 컨테이너에는 네트워크가 없어 그 시점에 설치할 방법이 아예 없기 때문에 설치를
따로 뗀 것이다. 의존성 없이 pytest를 돌리면 `ModuleNotFoundError`로 무너진다(실측).

**스캔 컨테이너만 `TMPDIR`을 바꾼다.** Trivy는 DB 압축파일(113MB)을 임시 폴더에 받는데,
샌드박스 `/tmp`는 64MB라 "공간 없음"으로 멈춘다(실측). 그래서 스캔 컨테이너만 임시 폴더를
디스크에 있는 Trivy 캐시 마운트 아래로 돌렸다. `/tmp` 상한은 남의 코드가 디스크를 채우는
공격을 막는 장치인데, 스캔 컨테이너는 남의 코드를 실행하지 않는다.

**`fixedVersion`은 쉼표로 여러 개가 올 수 있다.** 예: `"2.0.6, 1.26.17"`. 버전 줄기마다
고친 버전이 따로 나온 경우다. 러너는 문자열을 그대로 넘기며, 나눠 읽고 최소 안전 버전을
고르는 일은 advisory-mcp의 몫이다.

아직 안 한 것:

- scanner-mcp·testrunner-mcp(TypeScript)에서 `cli.py`를 실제로 호출하는 연결
- POST_PATCH의 증분 설치 (지금은 매번 전체 재설치)
- 동시 스캔 3건(NFR-P2)이 같은 Trivy 캐시를 함께 쓸 때의 잠금·충돌 — **미검증**

## 언어에 대한 메모

문서와 코드 주석은 한국어로 쓴다. 다만 다음은 영어 그대로 둔다.

- `attack_log.txt`의 `BLOCKED`·`SUCCEEDED`와 각 공격 이름 — `verify_hostile.py`가
  문자열로 찾아 판정하는 표시이므로 번역하면 검증이 깨진다.
- `run_in_sandbox`가 던지는 예외 메시지 — 파이썬 표준 예외의 관례를 따른다.
- Docker 플래그, pytest 옵션, 식별자 등 코드 자체.

## 최근 검증 결과

- **2026-09-10** (이동 전, `/home/shinwoo/vibeguard`): 검사 9종 전부 통과, 약 20초.
  적대적 리포 공격 8종 전부 차단, 컨테이너 안 capability 바운딩 셋까지 전부 0 확인.
- **2026-09-13** (이동 후, 이 폴더): `image/`에서 이미지 재빌드 후 검사 9종·
  `verify_hostile.py` 재실행. 결과 완전히 동일: 검사 9종 전부 통과(1번은 의도된 실패
  1건 포함, `tests="3" failures="1"`), 적대적 리포 공격 11건 전부 차단(예상 밖 성공
  없음, 리포 파일 변경 없음, `backdoor.py` 없음, 잔류 컨테이너 없음), 종료 코드 0.
- **2026-09-14** (역할별 컨테이너·CLI 입구 추가 후): 검사 9종과 `verify_hostile.py`를
  다시 돌려 리팩터링 회귀가 없음을 확인. CLI는 임시 리포(`six==1.16.0` 의존)로 실측:

  | 확인한 것 | 결과 |
  |---|---|
  | 설치 없이 테스트 | `ImportError` → 종료 코드 2 → `FAILED` (통과로 새지 않음) |
  | `install` (네트워크 O) | `OK`, 휠 내려받아 `/venv`에 설치, 약 2초 |
  | `run_tests` (설치 후) | `PASSED`, total 2 / failed 0 |
  | 테스트 컨테이너 네트워크 | 컨테이너 안에서 접속 시도 → 차단 확인 |
  | 테스트 컨테이너의 `/venv` | 쓰기 시도 → 읽기 전용으로 차단 확인 |
  | 테스트 없는 리포 | `NO_TESTS` (종료 코드 5) |
  | `requirements.txt` 없음 | 컨테이너를 띄우지 않고 `OK` |
  | 설치 컨테이너 격리 | uid 1000 유지, 컨테이너 루트 쓰기 `PermissionError` |
  | 잘못된 입력 | 스택 미지원·경로 없음 모두 JSON 오류로 거절, 종료 코드 1 |

- **2026-09-14** (① 스캔 이미지·`run_trivy` 추가 후): 검사 9종·`verify_hostile.py`
  재실행으로 회귀 없음 확인. 스캔은 `urllib3==1.24.1` 임시 리포로 실측:

  | 확인한 것 | 결과 |
  |---|---|
  | 이미지 | `vibeguard-scan:0.1` 442MB, Trivy 0.74.0, uid 1000으로 실행 |
  | 첫 스캔 (`/tmp` 64MB 그대로) | DB 압축파일이 `/tmp`를 채워 실패 → `SCAN_FAILED` (빈 목록이 "안전"으로 새지 않음) |
  | 첫 스캔 (`TMPDIR` 수정 후) | `OK`, DB 다운로드 포함 **18초**, 캐시 1.3GB, 취약점 12건 |
  | 캐시 찬 상태의 스캔 | `OK`, **1초**, 12건 동일 |
  | 매니페스트 없는 리포 | `OK`, `findings: []` (실패와 구분됨) |
  | 스캔 컨테이너 격리 | uid 1000, 루트·`/repo` 쓰기 차단, CapEff 0 |
  | 잔류 컨테이너 | 없음 |

  첫 DB 다운로드는 옛 기록(약 10분)과 달리 18초였다. 공통 제한시간 300초 안에 든다.
  다만 네트워크가 느린 환경에서는 달라질 수 있다.
