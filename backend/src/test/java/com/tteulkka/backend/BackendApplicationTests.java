package com.tteulkka.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Testcontainers 기반 컨텍스트 로드 테스트.
 * PostGIS 확장이 필요하므로 postgis 이미지를 사용한다 (Flyway 마이그레이션에 spatial 인덱스 포함).
 */
@SpringBootTest
@Testcontainers
class BackendApplicationTests {

	@Container
	static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>(
			DockerImageName.parse("imresamu/postgis:16-3.4").asCompatibleSubstituteFor("postgres"));

	@DynamicPropertySource
	static void overrideProperties(DynamicPropertyRegistry registry) {
		registry.add("spring.datasource.url", postgres::getJdbcUrl);
		registry.add("spring.datasource.username", postgres::getUsername);
		registry.add("spring.datasource.password", postgres::getPassword);
		registry.add("public-data.api-key", () -> "test-api-key");
		registry.add("admin.secret-key", () -> "test-secret-key");
	}

	@Test
	void contextLoads() {
	}

}
