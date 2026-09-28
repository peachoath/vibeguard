"""cli.py의 판정 로직 자체 검사 (도커 없이 도는 부분만).

컨테이너를 띄우는 부분은 도커가 있어야 하므로 여기서 다루지 않는다. 그쪽은
runner.py의 검사 9종과 실제 install/run_tests 실행으로 확인한다. 여기서 지키는 것은
"종료 코드를 outcome으로 옮기는 대응"과 "junit 보고서에서 숫자를 읽는 일"이다.
둘 다 조용히 틀리기 쉬운 자리다. 통과 판정이 뒤집히면 증명 전체가 무의미해진다.

    ./.venv/bin/python test_cli.py
"""

import json
import os
import tempfile

from cli import _counts, _findings, _outcome
from runner import TIMEOUT_EXIT_CODE, RunResult


def _result(exit_code: int, timed_out: bool = False) -> RunResult:
    return RunResult(exit_code=exit_code, stdout="", stderr="", timed_out=timed_out)


def test_outcome():
    """종료 코드 약속이 v2의 outcome 이름으로 정확히 옮겨진다."""
    assert _outcome(_result(0)) == "PASSED"
    assert _outcome(_result(1)) == "FAILED"
    assert _outcome(_result(5)) == "NO_TESTS"
    assert _outcome(_result(137)) == "OOM_KILLED"
    assert _outcome(_result(TIMEOUT_EXIT_CODE, timed_out=True)) == "TIMED_OUT"

    # 시간 초과는 종료 코드보다 우선한다. 강제 종료된 실행이 평범한 실패로
    # 읽히면 재시도 판단이 틀어진다.
    assert _outcome(_result(1, timed_out=True)) == "TIMED_OUT"

    # 약속에 없는 코드는 FAILED로 모은다. 통과로 새어 나가지 않는 것이 핵심이다.
    assert _outcome(_result(2)) == "FAILED"
    assert _outcome(_result(4)) == "FAILED"


def test_counts():
    """junit 보고서에서 전체·통과 못 한 건수를 읽는다."""
    with tempfile.TemporaryDirectory() as workdir:
        # pytest가 실제로 내는 모양. errors는 failures와 합쳐야 한다.
        nested = os.path.join(workdir, "nested.xml")
        with open(nested, "w") as handle:
            handle.write(
                '<testsuites><testsuite name="pytest" tests="3" failures="1" '
                'errors="1" skipped="0"></testsuite></testsuites>'
            )
        assert _counts(nested) == (3, 2)

        # testsuite가 최상위로 오는 모양도 받는다.
        flat = os.path.join(workdir, "flat.xml")
        with open(flat, "w") as handle:
            handle.write('<testsuite tests="7" failures="2" errors="0"></testsuite>')
        assert _counts(flat) == (7, 2)

        # 보고서가 깨졌으면 0으로 답하고 넘어간다. 숫자는 참고용이고 판정은
        # 종료 코드가 하므로, 여기서 예외를 던지면 멀쩡한 실행이 통째로 죽는다.
        broken = os.path.join(workdir, "broken.xml")
        with open(broken, "w") as handle:
            handle.write("<testsuite tests=")
        assert _counts(broken) == (0, 0)

        # 보고서 자체가 없는 경우. 컨테이너가 시간 초과로 죽으면 이렇게 된다.
        assert _counts(os.path.join(workdir, "없는파일.xml")) == (0, 0)


def test_findings():
    """Trivy 보고서에서 필드를 뽑고, 실패한 스캔을 깨끗한 리포와 구분한다."""
    with tempfile.TemporaryDirectory() as workdir:
        def write(name: str, content: str) -> str:
            path = os.path.join(workdir, name)
            with open(path, "w") as handle:
                handle.write(content)
            return path

        # 취약점이 있는 보고서. FixedVersion이 없는 항목도 섞는다.
        found = write("found.json", json.dumps({
            "Results": [
                {"Target": "requirements.txt", "Vulnerabilities": [
                    {"VulnerabilityID": "CVE-2019-11324", "PkgName": "urllib3",
                     "InstalledVersion": "1.24.1", "FixedVersion": "1.24.2",
                     "Severity": "HIGH"},
                    {"VulnerabilityID": "CVE-0000-0000", "PkgName": "urllib3",
                     "InstalledVersion": "1.24.1", "Severity": "LOW"},
                ]},
                # 취약점이 없는 매니페스트는 Vulnerabilities가 빠진다.
                {"Target": "pyproject.toml"},
            ]
        }))
        result = _findings(found)
        assert len(result) == 2
        assert result[0] == {
            "target": "requirements.txt", "pkgName": "urllib3",
            "installedVersion": "1.24.1", "fixedVersion": "1.24.2",
            "vulnerabilityId": "CVE-2019-11324", "severity": "HIGH",
        }
        assert result[1]["fixedVersion"] is None

        # 깨끗한 리포는 빈 목록이다. None이 아니다.
        assert _findings(write("clean.json", '{"Results": null}')) == []
        assert _findings(write("empty.json", "{}")) == []

        # 결론을 못 낸 스캔은 None이다. 여기서 []가 나오면 실패가 "안전"으로 위장된다.
        assert _findings(os.path.join(workdir, "없는파일.json")) is None
        assert _findings(write("broken.json", '{"Results": [')) is None
        assert _findings(write("list.json", "[]")) is None


if __name__ == "__main__":
    test_outcome()
    test_counts()
    test_findings()
    print("통과: outcome 판정, junit 파싱, Trivy 보고서 파싱이 약속대로 동작한다.")
