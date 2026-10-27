package app.jjoin.backend.jobs;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 예약 작업이 여러 워커(서버)에서 동시에 돌지 않게 막는다.
 * Postgres advisory lock(pg_try_advisory_xact_lock)을 트랜잭션 동안 잡고, 이미 누가 잡고 있으면 이번 차례는 건너뛴다.
 * 별도 잠금 표가 필요 없고, 워커가 죽으면 연결이 끊기면서 잠금도 저절로 풀린다.
 */
@Component
public class JobLock {

	private final JdbcClient jdbc;
	private final TransactionTemplate transaction;

	public JobLock(JdbcClient jdbc, TransactionTemplate transaction) {
		this.jdbc = jdbc;
		this.transaction = transaction;
	}

	/** 잠금을 잡았으면 작업을 돌리고 true, 다른 곳에서 돌고 있으면 바로 false. */
	public boolean runExclusive(String name, Runnable job) {
		Boolean ran = transaction.execute(status -> {
			boolean locked = jdbc.sql("select pg_try_advisory_xact_lock(hashtext(:name))")
					.param("name", "jjoin:" + name)
					.query(Boolean.class)
					.single();
			if (!locked) {
				return false;
			}
			job.run();
			return true;
		});
		return Boolean.TRUE.equals(ran);
	}

}
