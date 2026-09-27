# malicious_repo — 호스트에서 절대 실행하지 말 것

VibeGuard 샌드박스가 신뢰할 수 없는 코드를 실제로 가둬두는지 증명하기 위해 일부러 만든
적대적 pytest 프로젝트다. 겉보기에는 평범한 테스트 스위트지만, `conftest.py`가 import 시점에
공격 코드를 실행한다. pytest는 테스트를 수집하기 전에 conftest부터 import하기 때문이다.

## 경고

**이 디렉터리의 pytest·python·그 어떤 파일도 호스트에서 직접 실행하지 말 것.**
이 파일들의 존재 목적 자체가 크리덴셜 탈취, 네트워크 접근, 호스트 파일 열람, 리포 변조,
권한 상승, Docker 소켓 접근을 시도하는 것이다. 호스트에서 실행하면 그 시도들이 **당신의 권한으로**
그대로 동작한다.

반드시 샌드박스를 통해서만 실행한다. 가장 간단한 방법은 프로젝트 루트의 검증 스크립트다.

    cd ~/vibeguard
    ./.venv/bin/python verify_hostile.py

직접 호출하려면 이렇게 한다.

    from runner import run_in_sandbox
    run_in_sandbox(
        ["python", "-m", "pytest", "/repo/tests", "-q", "-p", "no:cacheprovider"],
        "/home/shinwoo/vibeguard/malicious_repo",
        "/home/shinwoo/vibeguard/artifacts",
    )

샌드박스 안에서는 모든 공격이 차단되며, 결과는 마운트된 artifacts 디렉터리의
`/out/attack_log.txt`에 기록되어 실행 후 방어 내역을 검토할 수 있다.

로그의 `BLOCKED`·`SUCCEEDED`는 검증 스크립트가 문자열로 찾아 판정하는 표시이므로
번역하지 않고 그대로 둔다.
