package app.jjoin.backend;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.BeforeAll;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * 실제 Postgres(Docker)로 도는 통합 테스트의 공통 틀. 테스트 클래스마다 새 DB를 띄우고 최소 스키마(outbox-schema.sql)를 올린다.
 * Docker가 없으면 건너뛴다. (GitHub Actions에서는 항상 돈다)
 */
@Testcontainers(disabledWithoutDocker = true)
public abstract class PostgresIT {

	@Container
	protected static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:17-alpine");

	protected static DriverManagerDataSource dataSource;
	protected static JdbcClient jdbc;
	protected static TransactionTemplate transaction;

	@BeforeAll
	static void schema() throws Exception {
		dataSource = new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword());
		jdbc = JdbcClient.create(dataSource);
		transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
		jdbc.sql(new ClassPathResource("outbox-schema.sql").getContentAsString(StandardCharsets.UTF_8)).update();
	}

	/** 모든 표를 비운다. */
	protected static void truncateAll() {
		jdbc.sql("""
				truncate public.notification_outbox, public.push_subscriptions, public.event_comments, public.event_participants,
				  public.events, public.groups, public.app_admins, public.inquiries, public.client_errors, public.profiles cascade
				""").update();
	}

}
