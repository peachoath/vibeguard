"""5단계 검증: 적대적 픽스처 리포를 샌드박스에 통과시킨다.

fixtures/malicious_repo/는 conftest.py가 import 시점에 공격 8종을 실행하는 pytest 프로젝트다.
샌드박스를 통해 실행하면 pytest는 반드시 0으로 끝나야 하고(평범한 테스트 2건이 통과하므로),
그러는 동안 모든 공격이 차단되고 호스트는 손상되지 않아야 한다.

README.md가 이 절차를 서술만 해두고 실행 수단을 남기지 않아, 재검증할 때마다 호출을 손으로
다시 써야 했다. 이 스크립트가 그 절차다. 실행 후 호스트 무결성까지 다시 확인하는데,
이쪽이 잊히기 쉬운 절반이다. 호스트가 어차피 바뀌었다면 공격이 차단됐다는 로그는 의미가 없다.

    ./.venv/bin/python verify_hostile.py

fixtures/malicious_repo를 직접 실행하지 말 것. 그것을 가둬 실행하는 이 스크립트만 실행한다.
"""

import hashlib
import os
import subprocess

from runner import run_in_sandbox

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
HOSTILE_REPO = os.path.join(PROJECT_DIR, "fixtures", "malicious_repo")
ARTIFACTS = os.path.join(PROJECT_DIR, "artifacts")
ATTACK_LOG = os.path.join(ARTIFACTS, "attack_log.txt")

# 침해가 아니면서 SUCCEEDED로 기록되는 두 줄이며, 둘 다 손으로 확인을 마쳤다.
# /proc/1/environ 읽기는 성공하지만 --pid=host를 쓰지 않으므로 pid 1은 컨테이너 자신의
# init이다. 즉 컨테이너 자신의 환경변수를 다시 읽는 것에 지나지 않는다. 거기서 발견되는
# GPG_KEY는 python 이미지마다 들어 있는 공개 서명키이지 호스트의 비밀이 아니다.
# 읽는 사람이 매번 이 추론을 다시 하지 않도록 여기에 적어 둔다.
# 로그가 영어로 기록되므로 대조 문자열도 영어 그대로 둔다.
KNOWN_BENIGN = ("read /proc/1/environ", "sensitive-looking keys: ['GPG_KEY']")


def digest_repo(path: str) -> dict[str, str]:
    """path 아래 모든 파일을 md5로 대응시킨다. 변조가 있으면 차이로 드러난다."""
    digests = {}
    for root, _, files in os.walk(path):
        if "__pycache__" in root:
            continue
        for name in files:
            if name.endswith(".pyc"):
                continue
            full = os.path.join(root, name)
            with open(full, "rb") as handle:
                digests[os.path.relpath(full, path)] = hashlib.md5(
                    handle.read()
                ).hexdigest()
    return digests


def main() -> int:
    print("=== 5단계: 적대적 리포를 샌드박스에 통과시킨다 ===")
    print()

    # 실행 전에 찍어 둔다. 리포 변조 공격이 뚫렸다면 실행 후에 항목이 바뀌거나
    # 추가된 것으로 드러난다.
    before = digest_repo(HOSTILE_REPO)

    result = run_in_sandbox(
        [
            "python", "-m", "pytest", "/repo/tests", "-q",
            "-p", "no:cacheprovider",
        ],
        HOSTILE_REPO,
        ARTIFACTS,
    )

    print("종료 코드:", result.exit_code, "(기대값 0)")
    print("시간 초과:", result.timed_out)
    print()

    print("--- 공격 로그 ---")
    if not os.path.exists(ATTACK_LOG):
        print("없음: conftest가", ATTACK_LOG, "을 쓰지 않았다")
        return 1
    with open(ATTACK_LOG) as handle:
        log = handle.read()
    print(log)

    # SUCCEEDED로 찍힌 모든 줄은 위의 알려진 무해 2건 중 하나여야 한다.
    # 새로운 것이 나오면 그것은 실제 발견이므로, 그냥 지나가지 않고 이 스크립트를
    # 실패시켜야 한다.
    unexpected = [
        line
        for line in log.splitlines()
        if "SUCCEEDED" in line
        and not any(benign in line for benign in KNOWN_BENIGN)
    ]

    print("--- 호스트 무결성 ---")
    after = digest_repo(HOSTILE_REPO)
    tampered = sorted(
        name
        for name in set(before) | set(after)
        if before.get(name) != after.get(name)
    )
    backdoor = os.path.exists(os.path.join(HOSTILE_REPO, "backdoor.py"))
    strays = subprocess.run(
        [
            "docker", "ps", "-a",
            "--filter", "name=vibeguard-",
            "--format", "{{.Names}} {{.Status}}",
        ],
        capture_output=True,
        text=True,
    ).stdout.strip()

    print("변경된 리포 파일 :", tampered or "없음")
    print("backdoor.py 생성 :", backdoor)
    print("잔류 컨테이너    :", strays or "없음")
    print()

    blocked = log.count("BLOCKED")
    print("--- 판정 ---")
    print("차단된 공격      :", blocked)
    print("예상 밖 성공     :", unexpected or "없음")

    failures = []
    if result.exit_code != 0:
        failures.append("pytest가 0으로 끝나지 않았다")
    if unexpected:
        failures.append("무해하다고 알려지지 않은 공격이 성공했다")
    if tampered:
        failures.append("호스트의 적대적 리포 파일이 변경되었다")
    if backdoor:
        failures.append("backdoor.py가 생성되었다")
    if strays:
        failures.append("컨테이너가 남았다")

    if failures:
        print()
        for failure in failures:
            print("실패:", failure)
        return 1

    print()
    print("통과: 모든 공격이 차단되었고 호스트는 온전하다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
