# ==========================================
# Build Stage: Compile and package Spring Boot
# ==========================================
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the executable JAR (skipping unit tests during image build)
RUN mvn clean package -Dmaven.test.skip=true

# ==========================================
# Runtime Stage: Lightweight JRE execution
# ==========================================
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create non-root system user for container security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser:appgroup

# Copy the compiled JAR artifact from the build stage
COPY --from=build /app/target/*.jar app.jar

# Cloud Run compatibility: bind to $PORT with safe default of 8080
ENV PORT=8080
EXPOSE 8080

# Execute Spring Boot application
ENTRYPOINT ["java", "-jar", "app.jar"]
