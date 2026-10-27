# jjoin 백엔드 이미지. 빌드는 JDK, 실행은 JRE만 담는다.
# jar는 CPU와 상관없으므로 빌드는 이미지를 만드는 컴퓨터에서 그대로 하고(BUILDPLATFORM), 실행 이미지만 x86·ARM 각각 만든다.
FROM --platform=$BUILDPLATFORM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle.kts build.gradle.kts ./
COPY gradle gradle
RUN ./gradlew dependencies --no-daemon > /dev/null
COPY src src
RUN ./gradlew bootJar --no-daemon -x test

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 jjoin
COPY --from=build /app/build/libs/*.jar app.jar
USER jjoin
EXPOSE 8080
# 작은 서버(1GB)에서도 돌도록 힙을 메모리의 70%로 묶는다.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/app.jar"]
