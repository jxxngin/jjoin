plugins {
	java
	id("org.springframework.boot") version "4.1.2"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "app.jjoin"
version = "0.0.1-SNAPSHOT"
description = "jjoin backend (push worker)"

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	// 상태 확인(/actuator/health)과 지표를 HTTP로 내보낸다.
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.springframework.boot:spring-boot-starter-actuator")
	implementation("org.springframework.boot:spring-boot-starter-jdbc")
	runtimeOnly("org.postgresql:postgresql")

	// 웹 푸시(VAPID). 라이브러리가 쓰는 예전 BouncyCastle 대신 최신 jdk18on을 쓴다.
	implementation("nl.martijndwars:web-push:5.1.1") {
		exclude(group = "org.bouncycastle", module = "bcprov-jdk15on")
	}
	implementation("org.bouncycastle:bcprov-jdk18on:1.80")

	annotationProcessor("org.springframework.boot:spring-boot-configuration-processor")
	testImplementation("org.springframework.boot:spring-boot-starter-actuator-test")
	testImplementation("org.springframework.boot:spring-boot-starter-jdbc-test")
	testImplementation("org.springframework.boot:spring-boot-testcontainers")
	testImplementation("org.testcontainers:testcontainers-junit-jupiter")
	testImplementation("org.testcontainers:testcontainers-postgresql")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
}
