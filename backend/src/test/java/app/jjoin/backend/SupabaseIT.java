package app.jjoin.backend;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.UUID;

import org.junit.jupiter.api.BeforeAll;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Supabase 흉내(supabase-stub.sql) 위에 실제 마이그레이션(supabase/migrations 0001~)을 모두 올린 DB.
 * 앱처럼 워커 계정(jjoin_worker)으로 접속한다. Docker가 없으면 건너뛴다.
 */
@Testcontainers(disabledWithoutDocker = true)
public abstract class SupabaseIT {

	@Container
	protected static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

	/** 관리자 계정 (테스트 준비용) */
	protected static JdbcClient owner;
	/** 워커 계정 (앱과 같은 권한) */
	protected static JdbcClient jdbc;
	protected static TransactionTemplate transaction;

	@BeforeAll
	static void migrate() throws Exception {
		var admin = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
		owner = JdbcClient.create(admin);
		// 이름 붙은 매개변수(:name) 해석 없이 SQL 파일을 그대로 실행한다.
		try (var connection = admin.getConnection(); var statement = connection.createStatement();
				var files = Files.list(Path.of("../supabase/migrations"))) {
			statement.execute(new ClassPathResource("supabase-stub.sql").getContentAsString(StandardCharsets.UTF_8));
			for (var file : files.filter(f -> f.toString().endsWith(".sql")).sorted().toList()) {
				statement.execute(Files.readString(file));
			}
		}
		owner.sql("alter role jjoin_worker password 'worker'").update();
		var worker = new DriverManagerDataSource(postgres.getJdbcUrl(), "jjoin_worker", "worker");
		jdbc = JdbcClient.create(worker);
		transaction = new TransactionTemplate(new DataSourceTransactionManager(worker));
	}

	/** 가입한 사용자 (가입 트리거가 프로필을 만든다) */
	protected static UUID signUp(String name) {
		var id = UUID.randomUUID();
		owner.sql("insert into auth.users (id, raw_user_meta_data) values (:id, cast(:meta as jsonb))")
				.param("id", id)
				.param("meta", "{\"name\":\"" + name + "\"}")
				.update();
		return id;
	}

	/** Supabase가 발급하는 것과 같은 모양의 로그인 토큰 (서명은 여기서 확인하지 않는다) */
	protected static Jwt token(UUID userId) {
		var payload = "{\"sub\":\"" + userId + "\",\"role\":\"authenticated\",\"aud\":\"authenticated\"}";
		var value = "e30." + Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8)) + ".sig";
		return Jwt.withTokenValue(value).header("alg", "ES256").subject(userId.toString()).audience(java.util.List.of("authenticated")).build();
	}

}
