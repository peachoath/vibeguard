# VibeGuard 샌드박스 이미지.
#
# 분석에 필요한 모든 것을 여기서 미리 구워 넣는다. 4단계부터 컨테이너가
# --network=none으로 실행되어 실행 시점에는 아무것도 설치할 수 없기 때문이다.
#
# 빌드:  docker build --platform linux/amd64 -t vibeguard-sandbox:0.1 BE/agent/sandbox/image/

# FROM 줄에 플랫폼을 고정한다. ARM 맥에서 빌드해도 x86 이미지가 만들어져,
# 러너가 실행 시점에 요구하는 것과 일치하게 된다.
FROM --platform=linux/amd64 python:3.10-slim

# pytest를 정확한 버전으로 고정한 것은 의도적이다. 버전을 고정하지 않으면 테스트 러너의
# 동작이나 규칙이 빌드마다 달라질 수 있고, 그러면 어제 통과한 리포가 오늘 실패하게 된다.
# 분석 대상 코드와는 아무 상관 없는 이유로 말이다.
RUN pip install --no-cache-dir pytest==9.1.1

# 샌드박스용 비특권 사용자. 4단계에서 --user 1000:1000으로 선택하며,
# 이 단계에서는 생성만 한다. uid와 gid를 1000으로 고정하는 이유는
# 바인드 마운트된 /out에 쓴 파일이 root가 아니라 호스트 사용자 소유가 되게 하기 위함이다.
RUN groupadd --gid 1000 sandbox \
    && useradd --uid 1000 --gid 1000 --no-create-home --shell /usr/sbin/nologin sandbox

# 마운트 지점. 아무것도 덮어씌워지지 않은 경우에도 알려진 소유권으로 존재하도록
# 미리 만들어 둔다. 쓰기가 가능한 것은 /out뿐이다.
RUN mkdir -p /repo /out \
    && chown 1000:1000 /out

WORKDIR /repo
