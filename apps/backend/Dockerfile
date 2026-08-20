FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
RUN mvn -B -ntp -Dstyle.color=never -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
ARG VCS_REF=unknown
LABEL org.opencontainers.image.revision=${VCS_REF} \
      org.opencontainers.image.source="https://github.com/JasonTM17/HealthCare_Project"
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
