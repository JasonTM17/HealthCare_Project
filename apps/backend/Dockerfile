# Pin the builder manifest so a release can be rebuilt from the same toolchain.
FROM maven:3.9-eclipse-temurin-26@sha256:b2c1ad85954592f9928e84327c65201f308ad9b5d8ed7d5b823717c97bf23fbb AS build
WORKDIR /app
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Dstyle.color=never -DskipTests \
        -Dmaven.wagon.http.retryHandler.count=5 \
        -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true \
        dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Dstyle.color=never -DskipTests \
        -Dmaven.wagon.http.retryHandler.count=5 \
        -Dmaven.wagon.http.retryHandler.requestSentRetryEnabled=true \
        package

FROM eclipse-temurin:21-jre@sha256:7a65df4b22d2de92d4e04056e884f3b9122d70b21e2847fd66084278bd0ce037
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project"
RUN groupadd --system healthcare \
    && useradd --system --gid healthcare --home-dir /nonexistent \
       --shell /usr/sbin/nologin healthcare
COPY --from=build --chown=healthcare:healthcare /app/target/*.jar app.jar
USER healthcare:healthcare
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/actuator/health" | grep -q '"status":"UP"' || exit 1
ENV JAVA_TOOL_OPTIONS="-XX:+UseSerialGC -Xms64m -Xmx180m -XX:MaxMetaspaceSize=128m -Xss384k -XX:+ExitOnOutOfMemoryError -XX:+TieredCompilation -XX:TieredStopAtLevel=1 -Djava.security.egd=file:/dev/./urandom" \
    MALLOC_ARENA_MAX=2
ENTRYPOINT ["java", "-jar", "app.jar"]
