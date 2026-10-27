package app.jjoin.backend.jobs;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 약속 리마인더. 대기열(notification_outbox)에 쌓기만 하고, 실제 발송은 PushWorker가 몇 초 안에 한다.
 * - 하루 전: 매일 오전 10시, 내일(한국 날짜) 시작하는 약속의 참여자에게
 * - 1시간 전: 5분마다, 1시간 안에 시작하는 약속의 참여자에게
 * 쌓는 SQL 함수(0011·0014)가 약속마다 보냈다는 표시를 남기므로, 여러 번 불려도 한 번만 쌓인다.
 * (예전에는 Vercel Cron·Supabase pg_cron이 Next의 /api/cron/day-before·hour-before를 불렀다)
 */
@Component
public class ReminderJobs {

	private static final Logger log = LoggerFactory.getLogger(ReminderJobs.class);

	private final JdbcClient jdbc;
	private final JobLock lock;
	private final JobsProperties properties;

	public ReminderJobs(JdbcClient jdbc, JobLock lock, JobsProperties properties) {
		this.jdbc = jdbc;
		this.lock = lock;
		this.properties = properties;
	}

	@Scheduled(cron = "${jjoin.jobs.day-before-cron}", zone = "Asia/Seoul")
	public void dayBefore() {
		queue("day-before", "select public.queue_day_before_notifications()");
	}

	@Scheduled(cron = "${jjoin.jobs.hour-before-cron}", zone = "Asia/Seoul")
	public void hourBefore() {
		queue("hour-before", "select public.queue_hour_before_notifications()");
	}

	/** 쌓은 알림 수 (다른 워커가 돌고 있어 건너뛰었으면 -1) */
	int queue(String name, String sql) {
		if (!properties.enabled()) {
			return 0;
		}
		int[] queued = { 0 };
		boolean ran = lock.runExclusive(name, () -> queued[0] = jdbc.sql(sql).query(Integer.class).single());
		if (!ran) {
			return -1;
		}
		if (queued[0] > 0) {
			log.info("{} 알림 {}건을 대기열에 넣었어요", name, queued[0]);
		}
		return queued[0];
	}

}
