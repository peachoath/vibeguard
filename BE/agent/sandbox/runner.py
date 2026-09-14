"""VibeGuard용 Docker 샌드박스 러너 (4단계).

일회용 Docker 컨테이너 안에서 명령을 실행한다. 외부 리포지토리에서 온 신뢰할 수 없는
코드가 호스트에서 직접 실행되는 일이 없도록 하기 위함이다.

데이터는 두 개의 마운트로 드나든다.

    repo_path      -> /repo   읽기 전용. 분석 대상 리포지토리
    artifacts_path -> /out    읽기·쓰기. 실행이 만들어 낸 보고서

4단계에서 이 프로젝트가 의존하는 격리가 더해진다. 컨테이너에는 네트워크가 없고,
비특권 사용자로 실행되며, 호스트의 메모리·CPU·프로세스 슬롯을 고갈시킬 수 없고,
/out과 /tmp 외에는 어디에도 쓸 수 없으며, 제한 시간을 넘기면 강제로 종료된다.

백엔드가 알아야 할 것은 run_in_sandbox 하나뿐이다. Docker와 관련된 모든 세부사항은
이 모듈 안에 가둬 둔다.
"""

import os
import subprocess
import uuid
from dataclasses import dataclass

# image/Dockerfile로 빌드한 전용 샌드박스 이미지. 버전이 고정된 pytest를 품고 있어
# 실행에 네트워크가 필요 없다. 새 이미지 버전을 빌드하면 여기 한 곳만 바꾸면 된다.
SANDBOX_IMAGE = "vibeguard-sandbox:0.1"

# ① 스캔 컨테이너 이미지. image/Dockerfile.scan으로 빌드하며, 샌드박스 이미지 위에
# 버전을 고정한 Trivy 바이너리만 얹었다. 설치·테스트에는 쓰지 않는다.
SCAN_IMAGE = "vibeguard-scan:0.1"

# 아키텍처를 명시적으로 고정한다. 팀원 일부가 ARM 맥을 쓰는데, 샌드박스는 모두에게
# 동일하게 동작해야 하기 때문이다.
SANDBOX_PLATFORM = "linux/amd64"

# 컨테이너 내부의 마운트 지점. 호출자는 이것을 볼 일이 없다. 호스트 경로만 넘기고,
# 실행할 명령 안에서 /repo와 /out을 가리키기만 하면 된다.
REPO_MOUNT = "/repo"
ARTIFACTS_MOUNT = "/out"

# 제한 시간을 넘긴 실행도 찾아서 지울 수 있도록 컨테이너에 이름을 붙인다.
# 접두사를 두면 docker ps로 잔류물을 쉽게 알아볼 수 있다.
CONTAINER_NAME_PREFIX = "vibeguard-"

# 너무 오래 걸려 강제 종료된 실행에서 실제 종료 코드 대신 반환하는 값.
# pytest가 결과를 알리는 코드(0 통과, 1 실패, 5 수집된 테스트 없음)와 겹치지 않아야 한다.
# 겹치면 게이트가 시간 초과를 평범한 테스트 결과로 읽어 버린다.
TIMEOUT_EXIT_CODE = -1

# 이미지에 구워 넣은 비특권 사용자. 호스트 사용자의 uid·gid와 일치시켜서
# /out에 쓴 파일이 호스트 사용자 소유로 돌아오게 한다.
SANDBOX_USER = "1000:1000"

# 자원 상한. NFR-S1이 요구하는 값으로 맞췄다. 신뢰할 수 없는 코드가 호스트를 굶겨서는
# 안 되지만, 실제 리포지토리의 테스트 스위트에는 처음의 512m보다 넉넉한 공간이 필요하다.
# 상한을 올리는 것은 맞바꿈이다. 적대적인 리포가 커널에 제지당하기 전까지 2g를 차지할 수
# 있게 되고, 따라서 동시 스캔 3건(NFR-P2)에는 호스트에 6g의 여유가 필요하다.
MEMORY_LIMIT = "2g"
CPU_LIMIT = "1"
PIDS_LIMIT = "256"

# 컨테이너 파일시스템이 읽기 전용이므로 /tmp를 작은 tmpfs로 따로 제공한다.
# pytest를 비롯한 도구들에는 임시 파일을 둘 곳이 필요하다.
TMPFS_SPEC = "/tmp:size=64m"

# NFR-S2에서 온, 실행이 강제 종료되기까지 허용되는 초. 이것은 멈춰 버린 실행과 느린
# 실행을 가르는 상한이지 예상 소요 시간이 아니다. 정상적인 스위트는 몇 초 만에 끝나며
# 이 값 근처에도 가지 않는다.
DEFAULT_TIMEOUT = 300


@dataclass
class RunResult:
    """샌드박스에서 실행한 명령 하나의 결과."""

    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool


def _as_text(stream) -> str:
    """캡처된 출력을 str로 정규화한다.

    text=True일 때 subprocess.run은 str을 돌려주지만, TimeoutExpired 예외에 딸려 오는
    출력은 여전히 bytes로 올 수 있어 양쪽 모두를 처리한다.
    """
    if stream is None:
        return ""
    if isinstance(stream, bytes):
        return stream.decode("utf-8", errors="replace")
    return stream


def run_in_sandbox(
    command: list[str],
    repo_path: str,
    artifacts_path: str,
    timeout: int = DEFAULT_TIMEOUT,
    network: bool = False,
    image: str = SANDBOX_IMAGE,
    extra_mounts: list[tuple[str, str, str]] | None = None,
    env: dict[str, str] | None = None,
) -> RunResult:
    """일회용으로 격리된 Docker 컨테이너 안에서 명령을 실행한다.

    Args:
        command: 명령과 인자를 담은 문자열 리스트.
            예: ["python", "-c", "exit(3)"]. 이 리스트는 argv로 컨테이너에
            그대로 전달된다.
        repo_path: 분석 대상 리포지토리가 있는 호스트 디렉터리.
            /repo에 읽기 전용으로 마운트되며, 작업 디렉터리이기도 하다.
        artifacts_path: 실행이 만들어 낸 결과물을 모으는 호스트 디렉터리.
            /out에 읽기·쓰기로 마운트되고, 없으면 새로 만든다.
        timeout: 실행을 강제 종료하기까지 기다리는 초. 시간이 지나면
            컨테이너를 지우고 결과에 timed_out을 표시한다.
        network: 컨테이너에 네트워크를 줄지 여부. 기본값 False는 --network none이며,
            이것이 안전한 쪽이다. v2의 컨테이너 3종 중 ① 스캔과 ② 설치만 True로 연다.
            ③ 테스트는 남의 코드를 실행하므로 절대 열지 않는다(방향 전환 v2 원칙).
        image: 사용할 이미지. 기본값은 설치·테스트용 샌드박스 이미지이며,
            ① 스캔 컨테이너처럼 다른 도구가 필요한 역할만 바꿔 넘긴다.
        extra_mounts: (호스트 경로, 컨테이너 경로, "ro"|"rw") 튜플 목록.
            /venv·pip 캐시·Trivy DB 캐시처럼 역할별로만 필요한 마운트를 얹는다.
            호스트 경로는 절대 경로로 바뀌며, 없으면 만들지 않는다(호출자 책임).
        env: 컨테이너에 넘길 환경변수. 예: 설치된 패키지를 찾게 하는 PYTHONPATH.

    Returns:
        컨테이너의 종료 코드와 캡처된 stdout·stderr를 담은 RunResult.
        제한 시간을 넘긴 실행은 timed_out이 True이고 exit_code가
        TIMEOUT_EXIT_CODE인 상태로 돌아온다.

    Raises:
        FileNotFoundError: repo_path가 존재하지 않는다.
        NotADirectoryError: repo_path는 있지만 디렉터리가 아니다.

    명령은 항상 리스트로 전달하며 shell=True는 절대 쓰지 않는다. 덕분에 셸
    메타문자가 든 인자도 해석되지 않고 문자 그대로의 값으로 취급된다.
    명령어 주입은 바로 이 프로젝트가 찾아내려는 취약점 유형이므로,
    스캐너 자신이 그것을 품고 있어서는 안 된다.
    """
    # Docker는 맨 상대 경로를 바인드 마운트가 아니라 이름 있는 볼륨으로 읽는다.
    # 그래서 양쪽 모두 명령에 닿기 전에 절대 경로여야 한다.
    repo_abs = os.path.abspath(repo_path)
    artifacts_abs = os.path.abspath(artifacts_path)

    if not os.path.exists(repo_abs):
        raise FileNotFoundError(
            "repo_path does not exist: " + repo_abs
        )
    if not os.path.isdir(repo_abs):
        raise NotADirectoryError(
            "repo_path is not a directory: " + repo_abs
        )

    # artifacts 디렉터리는 우리가 관리하는 것이므로 필요할 때 만든다.
    # 이것이 없으면 Docker가 root 소유로 만들어 버려 호스트 사용자가 보고서를
    # 다시 읽지 못하게 된다.
    os.makedirs(artifacts_abs, exist_ok=True)

    container_name = CONTAINER_NAME_PREFIX + uuid.uuid4().hex[:12]

    docker_cmd = [
        "docker", "run",
        "--rm",                            # 종료되면 컨테이너를 제거한다
        "--name", container_name,          # 시간 초과된 실행을 지울 수 있도록
        "--platform", SANDBOX_PLATFORM,
    ]

    # 네트워크는 역할이 정한다. 기본값은 아예 없애는 쪽이다. 이미지가 실행에 필요한
    # 도구를 모두 품고 있으므로, 신뢰할 수 없는 코드는 외부로 연락할 수도 페이로드를
    # 받아올 수도 없다. 설치·스캔처럼 네트워크가 있어야만 되는 역할만 열어 준다.
    # 여는 경우에도 나머지 격리(비특권 사용자·읽기 전용·cap-drop·자원 상한)는 그대로다.
    if not network:
        docker_cmd += ["--network", "none"]

    docker_cmd += [
        # root를 버린다. 이미지가 바로 이 목적으로 사용자를 준비해 두었다.
        "--user", SANDBOX_USER,
        # 모든 리눅스 capability를 제거한다(NFR-S1). 비특권 사용자로 실행하는 것만으로도
        # 뻔한 공격은 막히지만, capability는 그와 별개로 주어지는 두 번째 권한이다.
        # capability를 지닌 실행 파일이 있거나 앞으로 root가 다시 도입되면 그 권한은
        # 그대로 살아 있게 된다. 전부 버려서 그 경로를 미리 닫는다.
        # 샌드박스가 실행하는 것 중에 capability가 필요한 것은 없다.
        "--cap-drop", "ALL",
        # 자원 상한. 폭주하는 리포지토리가 호스트까지 끌고 가지 못하게 한다.
        # 포크 폭탄을 멈추는 것은 pids-limit이다.
        "--memory", MEMORY_LIMIT,
        "--cpus", CPU_LIMIT,
        "--pids-limit", PIDS_LIMIT,
        # 마운트 바깥은 어디도 쓸 수 없다. 실행 도중 컨테이너 파일시스템이
        # 변조되는 것을 막아 준다.
        "--read-only",
        "--tmpfs", TMPFS_SPEC,
        # 읽기 전용이라 신뢰할 수 없는 코드가 원본 리포지토리를 고칠 수 없다.
        # 패치는 나중에 별도의 사본에 적용하므로, 파이프라인의 어느 단계에서도
        # 여기에 쓰기 권한이 필요하지 않다.
        "-v", repo_abs + ":" + REPO_MOUNT + ":ro",
        "-v", artifacts_abs + ":" + ARTIFACTS_MOUNT,
        "-w", REPO_MOUNT,
    ]

    # 역할별 추가 마운트. /venv는 설치 컨테이너에서 rw, 테스트 컨테이너에서 ro로 얹혀
    # 설치 결과를 다음 단계로 넘긴다. pip·Trivy 캐시는 속도 목적의 호스트 공유
    # 디렉터리이며 :ro를 붙이지 않는다(2026-09-13 결정). 컨테이너 루트는 여전히
    # 읽기 전용이라, 쓸 수 있는 곳은 여기서 명시한 마운트와 /tmp뿐이다.
    for host_path, container_path, mode in (extra_mounts or []):
        docker_cmd += ["-v", os.path.abspath(host_path) + ":" + container_path + ":" + mode]

    # 환경변수. --target으로 설치한 패키지를 테스트 컨테이너가 찾게 하는 PYTHONPATH가
    # 대표적인 쓰임이다. 값은 argv로 전달되므로 셸이 해석하지 않는다.
    for key, value in (env or {}).items():
        docker_cmd += ["-e", key + "=" + value]

    docker_cmd += [image] + command

    try:
        proc = subprocess.run(
            docker_cmd, capture_output=True, text=True, timeout=timeout
        )
    except subprocess.TimeoutExpired as expired:
        # 시간 초과가 죽이는 것은 로컬의 docker 클라이언트뿐이다. 컨테이너는 데몬 쪽
        # 프로세스라 계속 돌아가므로, 이름으로 찾아 지워야 한다. 그러지 않으면
        # 남아서 CPU를 계속 태운다.
        subprocess.run(
            ["docker", "rm", "--force", container_name],
            capture_output=True,
            text=True,
        )
        return RunResult(
            exit_code=TIMEOUT_EXIT_CODE,
            stdout=_as_text(expired.stdout),
            stderr=_as_text(expired.stderr),
            timed_out=True,
        )

    return RunResult(
        exit_code=proc.returncode,
        stdout=proc.stdout,
        stderr=proc.stderr,
        timed_out=False,
    )


if __name__ == "__main__":
    project_dir = os.path.dirname(os.path.abspath(__file__))
    repo = os.path.join(project_dir, "fixtures", "sample_repo")
    artifacts = os.path.join(project_dir, "artifacts")

    def show(label: str, result: RunResult) -> None:
        print("=== " + label + " ===")
        print("종료 코드:", result.exit_code)
        print("시간 초과:", result.timed_out)
        print("stdout:", repr(result.stdout))
        print("stderr:", repr(result.stderr))
        print()

    def stray_containers() -> str:
        """호스트에 아직 남아 있는 샌드박스 컨테이너를 나열한다."""
        listing = subprocess.run(
            [
                "docker", "ps", "-a",
                "--filter", "name=" + CONTAINER_NAME_PREFIX,
                "--format", "{{.Names}} {{.Status}}",
            ],
            capture_output=True,
            text=True,
        )
        return listing.stdout.strip()

    # 아래 검사들이 만들어 내는 두 파일을 미리 지운다. 그래야 나중에 그 파일이
    # 있다는 것이 이전 실행이 아니라 이번 실행이 만들었다는 증거가 된다.
    for stale in ("hello.txt", "report.xml"):
        stale_path = os.path.join(artifacts, stale)
        if os.path.exists(stale_path):
            os.remove(stale_path)

    print("### 정상 동작 ###")
    print()

    # 1. 3단계의 pytest 실행이 모든 제약을 건 상태에서도 여전히 동작한다.
    show(
        "1. pytest + junitxml",
        run_in_sandbox(
            [
                "python", "-m", "pytest", "/repo/tests", "-q",
                "-p", "no:cacheprovider",
                "--junitxml=/out/report.xml",
            ],
            repo,
            artifacts,
        ),
    )
    report = os.path.join(artifacts, "report.xml")
    print("호스트에 report.xml 존재:", os.path.exists(report))
    if os.path.exists(report):
        with open(report) as handle:
            head = handle.read(400)
        for marker in ('tests="3"', 'failures="1"'):
            print("report.xml에 " + marker + " 포함:", marker in head)
    print()

    # 2. 컨테이너가 더 이상 root가 아니다.
    show("2. id", run_in_sandbox(["id"], repo, artifacts))

    # 3. 결과물이 root가 아니라 호스트 사용자 소유로 돌아온다.
    show(
        "3. /out에 쓰기",
        run_in_sandbox(
            ["python", "-c", "open('/out/hello.txt','w').write('ok')"],
            repo,
            artifacts,
        ),
    )
    hello = os.path.join(artifacts, "hello.txt")
    print("호스트에 hello.txt 존재:", os.path.exists(hello))
    if os.path.exists(hello):
        print("소유자 uid:", os.stat(hello).st_uid, "호스트 uid:", os.getuid())
        print("호스트 사용자 소유:", os.stat(hello).st_uid == os.getuid())
    print()

    print("### 공격 방어: 아래는 모두 실패해야 한다 ###")
    print()

    # 4. 네트워크 없음.
    show(
        "4. 인터넷 접속",
        run_in_sandbox(
            [
                "python", "-c",
                "import urllib.request; "
                "urllib.request.urlopen('http://example.com', timeout=5)",
            ],
            repo,
            artifacts,
        ),
    )

    # 5. 무한 루프. 실행 후 컨테이너는 죽은 클라이언트에서 분리된 채 살아 있는 것이
    #    아니라, 아예 사라져 있어야 한다.
    print("시간 초과 검사 전 잔류물:", repr(stray_containers()))
    show(
        "5. 무한 루프",
        run_in_sandbox(
            ["python", "-c", "while True: pass"], repo, artifacts, timeout=10
        ),
    )
    print("시간 초과 검사 후 잔류물:", repr(stray_containers()))
    print()

    # 6. 메모리 폭탄. 2g 상한을 상대로 4GB를 요구한다. 커널의 OOM 킬러가 137로 답한다.
    #
    #    요구량은 MEMORY_LIMIT보다 확실히 커야 한다. 예전에는 2GB를 요구했는데,
    #    이는 옛 상한 512m의 네 배였지만 지금 상한과는 정확히 같다. 상한과 같기만 한
    #    요구량은 상한이 아니라 인터프리터 오버헤드가 결과를 가르므로, 검사가 매번
    #    통과했다 실패했다 한다. MEMORY_LIMIT을 다시 올리면 이 값도 함께 올려야 한다.
    show(
        "6. 메모리 폭탄",
        run_in_sandbox(
            ["python", "-c", "x = bytearray(4 * 1024 * 1024 * 1024)"],
            repo,
            artifacts,
        ),
    )

    # 7. 포크 폭탄. --pids-limit이 막아 준다. 호스트는 계속 반응해야 한다.
    show(
        "7. 포크 폭탄",
        run_in_sandbox(
            ["python", "-c", "import os\nwhile True: os.fork()"],
            repo,
            artifacts,
            timeout=15,
        ),
    )
    print("포크 폭탄 후 잔류물:", repr(stray_containers()))
    print()

    # 8. 컨테이너 루트 파일시스템이 읽기 전용이다.
    #
    #    다만 이 검사가 실제로 증명하는 것은 --read-only가 아니라 --user다.
    #    /etc/passwd는 비특권 사용자가 애초에 쓸 수 없는 파일이라 읽기 전용이
    #    아니었더라도 막힌다. --read-only는 마운트가 아니면서 모드가 1777인
    #    /var/tmp에 써 보는 방식으로 따로 확인했다. STATUS.md 참고.
    show(
        "8. /etc/passwd에 쓰기",
        run_in_sandbox(
            ["python", "-c", "open('/etc/passwd','a')"], repo, artifacts
        ),
    )

    # 9. /tmp는 쓰기 가능한 상태로 남는다. pytest에 임시 공간이 필요하기 때문이다.
    show(
        "9. /tmp에 쓰기",
        run_in_sandbox(
            ["python", "-c", "open('/tmp/x','w').write('ok')"], repo, artifacts
        ),
    )
