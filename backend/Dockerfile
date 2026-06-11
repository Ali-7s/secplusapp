# ── Stage 1: Build with Maven ──────────────────────────────────────────────
FROM maven:3.9-eclipse-temurin-22 AS build
WORKDIR /app

# Cache dependencies first
COPY pom.xml .
RUN mvn dependency:go-offline -q

COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Run with slim JRE ─────────────────────────────────────────────
FROM eclipse-temurin:22-jre
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# H2 database files live here — mount a volume to persist across container restarts
VOLUME /app/data

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
