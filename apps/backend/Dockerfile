# Pin the builder manifest so a release can be rebuilt from the same toolchain.
FROM maven:3.9.12-eclipse-temurin-21@sha256:c3c9d3ac4ce8431a3995c0318b8d390f448e693dd4fabc16e9b68d2e1f3d7b46 AS build
WORKDIR /app
COPY pom.xml ./
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Dstyle.color=never -DskipTests dependency:go-offline
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Dstyle.color=never -DskipTests package

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
ENTRYPOINT ["java", "-jar", "app.jar"]
