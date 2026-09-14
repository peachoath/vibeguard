"""testrunner-mcp가 부르는 CLI 입구 (JSON 입력 → JSON 출력).

러너는 파이썬이고 `testrunner-mcp`는 타입스크립트라, 둘을 잇는 경계가 필요하다.
이 스크립트가 그 경계다. 표준입력으로 JSON 한 덩어리를 받고, 표준출력으로 JSON 한
줄을 돌려준다. 그 외에는 아무것도 출력하지 않는다. 호출하는 쪽이 출력을 통째로
JSON.parse 하기 때문이다.

    echo '{"tool":"install","repoPath":"/절대/경로","stack":"python-pytest",
           "phase":"PRE_PATCH"}' | ./.venv/bin/python cli.py

컨테이너 3종을 모두 여기서 연다. run_trivy는 scanner-mcp가, 나머지 둘은
testrunner-mcp가 부른다.

    run_trivy  ① 스캔 컨테이너. 네트워크 O(DB 갱신). 매니페스트를 읽기만 한다
    install    ② 설치 컨테이너. 네트워크 O. --only-binary=:all: 로 임의 코드 차단
    run_tests  ③ 테스트 컨테이너. --network none(절대). 남의 코드가 도는 곳

두 단계는 /venv 마운트로 이어진다. 설치가 거기에 쓰고(rw), 테스트가 거기서 읽는다(ro).
테스트 컨테이너에는 네트워크가 없으므로 그 시점에 설치를 할 방법이 아예 없다.
이것이 설치를 따로 떼어 둔 이유다.

경로 규칙: 호출자는 repoPath 하나만 넘긴다. 나머지는 그 리포의 부모 디렉터리를
한 번의 검사가 쓰는 작업 폴더로 보고 그 아래에서 유도한다.

    <작업 폴더>/repo        repoPath. 컨테이너에 /repo로 읽기 전용 마운트
    <작업 폴더>/venv        설치 결과. 설치 때 rw, 테스트 때 ro
    <작업 폴더>/artifacts   junit 보고서 등 결과물. /out으로 마운트

pip 캐시는 검사마다 다시 받으면 느리므로 작업 폴더가 아니라 호스트 공유 위치에 둔다.
"""

import json
import os
import sys
import xml.etree.ElementTree as ElementTree

from runner import SCAN_IMAGE, TIMEOUT_EXIT_CODE, RunResult, run_in_sandbox

# 회귀 증명이 1급으로 지원하는 스택. 방향 전환 v2에서 파이썬으로 좁힌 결정이며,
# 이유는 의존성 설치와 테스트 실행이 파이썬에서 가장 단순하기 때문이다.
# 다른 스택은 조용히 통과시키지 않고 명시적으로 거절한다.
SUPPORTED_STACK = "python-pytest"

# 컨테이너 안에서 설치 결과가 놓이는 자리. pip --target으로 여기에 깔고,
# 테스트 컨테이너는 PYTHONPATH로 여기를 본다. 가상환경을 만들지 않고 --target을
# 쓰는 이유는 활성화 절차가 없어 단계 사이에 넘기기 쉽기 때문이다.
VENV_MOUNT = "/venv"

# pip이 받은 휠을 모아 두는 자리. 검사 사이에 재사용해서 설치를 줄인다.
# 실측에서 병목은 컨테이너가 아니라 pip install이었다.
PIP_CACHE_MOUNT = "/pip-cache"
PIP_CACHE_HOST = os.path.expanduser("~/.cache/vibeguard/pip")

# 리포가 의존성을 선언하는 파일. lock 파일이 있는 리포는 여기까지 오지 않는다.
# 탐지만 하고 "수동 확인 필요"로 안내하기로 결정되어 있어, 상류에서 걸러진다.
REQUIREMENTS_FILE = "requirements.txt"

# Trivy 취약점 DB를 두는 자리. 전개 후 1.3GB라 검사마다 받을 수 없어 호스트에 공유한다.
# :ro 없이 얹는다. 네트워크가 열린 스캔 컨테이너가 DB를 스스로 갱신하기 때문이다
# (2026-09-13 결정).
TRIVY_CACHE_MOUNT = "/trivy-cache"
TRIVY_CACHE_HOST = os.path.expanduser("~/.cache/vibeguard/trivy")
TRIVY_REPORT = "trivy.json"

# Trivy는 DB 압축파일(113MB)을 임시 폴더에 받은 뒤 캐시에 푼다. 샌드박스의 /tmp는 64MB
# tmpfs라 여기서 "공간 없음"으로 멈춘다(2026-09-14 실측). 그래서 스캔 컨테이너만 임시
# 폴더를 디스크에 있는 캐시 마운트 아래로 돌린다. /tmp 상한은 남의 코드가 디스크를
# 채우는 공격을 막는 장치인데, 스캔 컨테이너는 남의 코드를 실행하지 않는다.
TRIVY_TMP = TRIVY_CACHE_MOUNT + "/tmp"


def _fail(message: str) -> None:
    """계약을 지킨 채로 실패를 알리고 끝낸다."""
    print(json.dumps({"error": message}, ensure_ascii=False))
    raise SystemExit(1)


def _paths(repo_path: str) -> tuple[str, str, str]:
    """repoPath에서 리포·venv·artifacts 세 경로를 유도한다."""
    repo_abs = os.path.abspath(repo_path)
    workdir = os.path.dirname(repo_abs)
    return (
        repo_abs,
        os.path.join(workdir, "venv"),
        os.path.join(workdir, "artifacts"),
    )


def install(repo_path: str, phase: str) -> dict:
    """② 설치 컨테이너. 리포의 의존성을 /venv에 깐다.

    네트워크가 열려 있는 두 역할 중 하나다. 열지 않으면 pip이 아무것도 받을 수
    없어 다음 단계의 pytest가 ModuleNotFoundError로 무너진다. 대신 휠만 받도록
    묶어서(--only-binary=:all:), 설치 과정에 남의 setup.py가 실행되는 길을 막는다.
    """
    repo_abs, venv_dir, artifacts_dir = _paths(repo_path)
    requirements = os.path.join(repo_abs, REQUIREMENTS_FILE)

    # 의존성 선언이 없는 리포는 설치할 것이 없다. 빈 컨테이너를 띄우는 대신
    # 곧바로 성공으로 답한다. 표준 라이브러리만 쓰는 리포가 실제로 이렇다.
    if not os.path.exists(requirements):
        return {
            "tool": "install",
            "outcome": "OK",
            "exitCode": 0,
            "note": REQUIREMENTS_FILE + " 없음 — 설치할 의존성이 없다",
        }

    # 호스트 쪽에서 미리 만든다. 도커가 만들게 두면 root 소유가 되어
    # 비특권 컨테이너가 쓰지 못한다. artifacts는 러너가 알아서 만든다.
    os.makedirs(venv_dir, exist_ok=True)
    os.makedirs(PIP_CACHE_HOST, exist_ok=True)

    # ponytail: 매번 전부 다시 깐다. PRE_PATCH 뒤의 POST_PATCH를 바뀐 패키지만
    # 올리는 방식으로 줄일 수 있지만, 그건 측정해서 느릴 때 할 일이다.
    result = run_in_sandbox(
        [
            "pip", "install",
            "--only-binary=:all:",       # 휠만. 설치 중 임의 코드 실행 차단
            "--cache-dir", PIP_CACHE_MOUNT,
            "--target", VENV_MOUNT,
            "-r", "/repo/" + REQUIREMENTS_FILE,
        ],
        repo_abs,
        artifacts_dir,
        network=True,                    # ② 설치는 네트워크가 있어야 한다
        extra_mounts=[
            (venv_dir, VENV_MOUNT, "rw"),
            (PIP_CACHE_HOST, PIP_CACHE_MOUNT, "rw"),
        ],
    )

    return {
        "tool": "install",
        "outcome": "OK" if result.exit_code == 0 else "INSTALL_FAILED",
        "exitCode": result.exit_code,
        "timedOut": result.timed_out,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _outcome(result: RunResult) -> str:
    """종료 코드를 v2가 쓰는 outcome 이름으로 옮긴다.

    종료 코드는 재사용하지 않기로 약속되어 있어 이 대응이 1대1로 성립한다.
    약속에 없는 코드(pytest의 사용법 오류 등)는 FAILED로 모은다. 조용히
    통과시키는 것보다 낫고, v2가 정한 이름 밖으로 나가지도 않는다.
    """
    if result.timed_out or result.exit_code == TIMEOUT_EXIT_CODE:
        return "TIMED_OUT"
    return {
        0: "PASSED",
        1: "FAILED",
        5: "NO_TESTS",
        137: "OOM_KILLED",
    }.get(result.exit_code, "FAILED")


def _counts(report_path: str) -> tuple[int, int]:
    """junit XML에서 (전체, 통과 못 함) 건수를 읽는다.

    보고서가 없거나 깨졌으면 (0, 0)이다. 이 값은 사람이 읽는 참고 수치이고,
    통과 여부 판정은 종료 코드가 한다. 숫자를 못 읽었다고 판정이 흔들려서는 안 된다.
    errors를 failures와 합치는 이유는, 둘 다 "통과하지 못한 테스트"이기 때문이다.
    """
    if not os.path.exists(report_path):
        return (0, 0)
    try:
        root = ElementTree.parse(report_path).getroot()
    except ElementTree.ParseError:
        return (0, 0)

    # pytest는 <testsuites><testsuite .../></testsuites> 또는 <testsuite .../>를 낸다.
    suites = root.findall("testsuite") if root.tag == "testsuites" else [root]
    total = sum(int(suite.get("tests", 0)) for suite in suites)
    failed = sum(
        int(suite.get("failures", 0)) + int(suite.get("errors", 0))
        for suite in suites
    )
    return (total, failed)


def run_tests(repo_path: str, phase: str) -> dict:
    """③ 테스트 컨테이너. 리포에 원래 있던 테스트를 돌린다.

    남의 코드가 실제로 실행되는 유일한 곳이므로 네트워크를 절대 열지 않는다.
    /venv는 읽기 전용으로 얹는다. 테스트가 설치 결과를 고쳐서 다음 단계를
    오염시킬 수 없어야 하기 때문이다.

    테스트 경로를 지정하지 않고 pytest의 자동 수집에 맡긴다. 분석 대상은 남의
    리포라서 tests/ 라는 폴더가 있다는 보장이 없다.
    """
    repo_abs, venv_dir, artifacts_dir = _paths(repo_path)

    # 설치 단계가 아무것도 깔지 않았어도(의존성 없는 리포) 마운트 자체는 있어야
    # 도커가 root 소유로 만들어 버리지 않는다.
    os.makedirs(venv_dir, exist_ok=True)

    result = run_in_sandbox(
        [
            "python", "-m", "pytest", "-q",
            "-p", "no:cacheprovider",     # /repo가 읽기 전용이라 캐시를 못 쓴다
            "--junitxml=/out/report.xml",
        ],
        repo_abs,
        artifacts_dir,
        network=False,                   # ③ 테스트는 절대 열지 않는다
        extra_mounts=[(venv_dir, VENV_MOUNT, "ro")],
        env={"PYTHONPATH": VENV_MOUNT},  # --target으로 깐 패키지를 찾게 한다
    )

    outcome = _outcome(result)
    total, failed = _counts(os.path.join(artifacts_dir, "report.xml"))

    return {
        "tool": "run_tests",
        "outcome": outcome,
        "passed": outcome == "PASSED",
        "exitCode": result.exit_code,
        "timedOut": result.timed_out,
        "total": total,
        "failed": failed,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def _findings(report_path: str) -> list[dict] | None:
    """Trivy JSON 보고서에서 패치 판단에 필요한 필드만 뽑는다.

    보고서가 없거나 깨졌으면 None이다. 빈 목록과 반드시 구분한다. 빈 목록은
    "취약점 없음"이라는 결론이고, None은 "스캔이 결론을 내지 못했다"는 뜻이다.
    둘을 섞으면 실패한 스캔이 깨끗한 리포로 보고된다.
    """
    if not os.path.exists(report_path):
        return None
    try:
        with open(report_path) as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None

    findings = []
    # 취약점이 없으면 Trivy는 Results나 Vulnerabilities를 아예 빼거나 null로 둔다.
    for target in data.get("Results") or []:
        for vuln in target.get("Vulnerabilities") or []:
            findings.append({
                "target": target.get("Target"),
                "pkgName": vuln.get("PkgName"),
                "installedVersion": vuln.get("InstalledVersion"),
                # 고친 버전이 아직 나오지 않은 취약점도 있다. 이때는 패치할 수 없다.
                "fixedVersion": vuln.get("FixedVersion"),
                "vulnerabilityId": vuln.get("VulnerabilityID"),
                "severity": vuln.get("Severity"),
            })
    return findings


def run_trivy(repo_path: str) -> dict:
    """① 스캔 컨테이너. Trivy로 매니페스트를 읽어 취약한 라이브러리를 찾는다.

    네트워크를 여는 나머지 한 역할이며, 이유는 DB 갱신이다. 남의 코드는 실행하지
    않는다. Trivy는 매니페스트와 lock 파일을 읽기만 한다. 탐지는 다국어이므로
    stack을 받지 않는다.
    """
    repo_abs, _, artifacts_dir = _paths(repo_path)
    # 임시 폴더는 미리 있어야 한다. Trivy는 TMPDIR 아래에 새 폴더를 만들 뿐 TMPDIR 자체는
    # 만들지 않는다. 호스트에서 만들어야 root 소유가 되지 않는 것은 다른 마운트와 같다.
    os.makedirs(os.path.join(TRIVY_CACHE_HOST, "tmp"), exist_ok=True)

    # 이전 실행의 보고서가 남아 있으면, 이번 스캔이 실패해도 결과가 있는 것처럼 읽힌다.
    report = os.path.join(artifacts_dir, TRIVY_REPORT)
    if os.path.exists(report):
        os.remove(report)

    result = run_in_sandbox(
        [
            "trivy", "fs",
            "--scanners", "vuln",         # SCA만. 시크릿·설정 검사는 범위 밖
            "--format", "json",
            "--output", "/out/" + TRIVY_REPORT,
            "--cache-dir", TRIVY_CACHE_MOUNT,
            "/repo",
        ],
        repo_abs,
        artifacts_dir,
        network=True,                    # ① 스캔은 DB 갱신에 네트워크가 필요하다
        image=SCAN_IMAGE,
        extra_mounts=[(TRIVY_CACHE_HOST, TRIVY_CACHE_MOUNT, "rw")],
        env={"TMPDIR": TRIVY_TMP},
    )

    # Trivy는 취약점을 찾아도 기본적으로 0으로 끝난다. 0이 아니면 스캔 자체가 실패한 것이다.
    findings = _findings(report) if result.exit_code == 0 else None
    if result.timed_out:
        outcome = "TIMED_OUT"
    elif findings is None:
        outcome = "SCAN_FAILED"
    else:
        outcome = "OK"

    return {
        "tool": "run_trivy",
        "outcome": outcome,
        "findings": findings or [],
        "exitCode": result.exit_code,
        "timedOut": result.timed_out,
        "stderr": result.stderr,
    }


def main() -> None:
    try:
        request = json.loads(sys.stdin.read())
    except json.JSONDecodeError as broken:
        _fail("입력이 JSON이 아니다: " + str(broken))

    tool = request.get("tool")
    repo_path = request.get("repoPath")

    if not repo_path:
        _fail("repoPath가 없다")
    if not os.path.isdir(repo_path):
        _fail("repoPath가 디렉터리가 아니다: " + str(repo_path))

    if tool == "run_trivy":
        answer = run_trivy(repo_path)
    elif tool in ("install", "run_tests"):
        stack = request.get("stack")
        phase = request.get("phase")
        if stack != SUPPORTED_STACK:
            _fail("지원하지 않는 stack: " + str(stack) + " (지원: " + SUPPORTED_STACK + ")")
        if phase not in ("PRE_PATCH", "POST_PATCH"):
            _fail("phase는 PRE_PATCH 또는 POST_PATCH여야 한다: " + str(phase))
        answer = install(repo_path, phase) if tool == "install" else run_tests(repo_path, phase)
        answer["phase"] = phase
    else:
        _fail("tool은 run_trivy, install, run_tests 중 하나여야 한다: " + str(tool))

    print(json.dumps(answer, ensure_ascii=False))


if __name__ == "__main__":
    main()
