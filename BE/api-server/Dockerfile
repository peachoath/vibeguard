# VibeGuard api-server — 멀티스테이지 빌드 (Spring Boot 4 / Java 21)
# 데모 배포: 단일 VM + Docker Compose (PRD §12).
#
# 빌드 스테이지는 Java 21 JDK로 고정한다(Gradle 8.x는 최신 JDK 미지원 이슈 회피).
# 런타임 스테이지는 JRE 21 slim + 비특권 사용자.

# ── 1) 빌드 스테이지 ─────────────────────────────────────────
FROM eclipse-temurin:21-jdk-jammy AS build
WORKDIR /workspace

# 의존성 레이어 캐싱: 빌드 스크립트/래퍼 먼저 복사
COPY gradlew ./
COPY gradle ./gradle
COPY settings.gradle.kts build.gradle.kts ./
RUN chmod +x gradlew && ./gradlew --version >/dev/null

# 소스 복사 후 실행 가능한 jar 빌드 (테스트는 Testcontainers/Docker 필요 → 이미지 빌드 단계에선 제외)
COPY src ./src
RUN ./gradlew bootJar -x test --no-daemon

# ── 2) 런타임 스테이지 ───────────────────────────────────────
FROM eclipse-temurin:21-jre-jammy AS runtime
WORKDIR /app

# 비특권 사용자로 실행 (보안)
RUN groupadd --system app && useradd --system --gid app --home /app app

# 빌드 산출물만 복사 (bootJar 결과, -plain.jar 제외)
COPY --from=build /workspace/build/libs/*-SNAPSHOT.jar app.jar

USER app
EXPOSE 8080

# 컨테이너 환경에 맞춘 JVM 옵션(컨테이너 메모리 인식). 설정은 환경변수로 주입(application.yml).
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
