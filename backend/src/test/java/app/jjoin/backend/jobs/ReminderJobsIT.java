package app.jjoin.backend.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import app.jjoin.backend.PostgresIT;

// 하루 전·1시간 전 알림이 참여자에게만, 약속마다 한 번만 쌓이는지 + 여러 워커가 동시에 돌 때 잠금
class ReminderJobsIT extends PostgresIT {

	static final ZoneId KST = ZoneId.of("Asia/Seoul");
	final JobsProperties on = new JobsProperties(true, "-", "-", "-");

	final UUID going = UUID.randomUUID();
	final UUID maybe = UUID.randomUUID();
	final UUID group = UUID.randomUUID();
	ReminderJobs jobs;

	@BeforeEach
	void data() {
		truncateAll();
		jobs = new ReminderJobs(jdbc, new JobLock(jdbc, transaction), on);
		jdbc.sql("insert into public.profiles (id, nickname) values (:a, '참여'), (:b, '미정')").param("a", going).param("b", maybe).update();
		jdbc.sql("insert into public.groups (id, name) values (:id, '대학 동기')").param("id", group).update();
	}

	UUID event(Instant startsAt) {
		var id = UUID.randomUUID();
		jdbc.sql("insert into public.events (id, group_id, title, starts_at) values (:id, :g, '약속', :at)")
				.param("id", id).param("g", group).param("at", Timestamp.from(startsAt)).update();
		jdbc.sql("insert into public.event_participants values (:e, :a, 'going'), (:e, :b, 'maybe')")
				.param("e", id).param("a", going).param("b", maybe).update();
		return id;
	}

	List<String> queued(String kind) {
		return jdbc.sql("select user_id::text from public.notification_outbox where kind = :k").param("k", kind).query(String.class).list();
	}

	@Test
	void 하루_전은_내일_한국_날짜_약속의_참여자에게만_한_번() {
		var tomorrowNoon = ZonedDateTime.now(KST).plusDays(1).with(LocalTime.NOON).toInstant();
		event(tomorrowNoon);
		event(tomorrowNoon.plus(Duration.ofDays(1)));

		assertThat(jobs.queue("day-before", "select public.queue_day_before_notifications()")).isEqualTo(1);
		assertThat(queued("day_before")).containsExactly(going.toString());
		assertThat(jobs.queue("day-before", "select public.queue_day_before_notifications()")).isZero();
	}

	@Test
	void 한_시간_전은_곧_시작하는_약속만() {
		event(Instant.now().plus(Duration.ofMinutes(40)));
		event(Instant.now().plus(Duration.ofHours(3)));

		assertThat(jobs.queue("hour-before", "select public.queue_hour_before_notifications()")).isEqualTo(1);
		assertThat(jobs.queue("hour-before", "select public.queue_hour_before_notifications()")).isZero();
		assertThat(queued("hour_before")).hasSize(1);
	}

	@Test
	void 꺼져_있으면_돌지_않는다() {
		event(Instant.now().plus(Duration.ofMinutes(40)));
		var off = new ReminderJobs(jdbc, new JobLock(jdbc, transaction), new JobsProperties(false, "-", "-", "-"));

		assertThat(off.queue("hour-before", "select public.queue_hour_before_notifications()")).isZero();
		assertThat(queued("hour_before")).isEmpty();
	}

	@Test
	void 같은_작업이_다른_워커에서_돌고_있으면_건너뛴다() throws Exception {
		var lock = new JobLock(jdbc, transaction);
		var holding = new CountDownLatch(1);
		var release = new CountDownLatch(1);
		try (var pool = Executors.newSingleThreadExecutor()) {
			var other = pool.submit(() -> lock.runExclusive("hour-before", () -> {
				holding.countDown();
				try {
					release.await(10, TimeUnit.SECONDS);
				} catch (InterruptedException e) {
					Thread.currentThread().interrupt();
				}
			}));
			assertThat(holding.await(10, TimeUnit.SECONDS)).isTrue();

			assertThat(jobs.queue("hour-before", "select public.queue_hour_before_notifications()")).isEqualTo(-1);
			assertThat(lock.runExclusive("day-before", () -> { })).isTrue();

			release.countDown();
			assertThat(other.get(10, TimeUnit.SECONDS)).isTrue();
		}
		assertThat(lock.runExclusive("hour-before", () -> { })).isTrue();
	}

}
