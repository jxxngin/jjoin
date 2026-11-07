package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import app.jjoin.backend.PostgresIT;

// 실제 Postgres(Docker)로 대기열 잠금·상태 변화를 확인한다. Docker가 없으면 건너뛴다.
class OutboxRepositoryIT extends PostgresIT {

	static OutboxRepository outbox;
	static SubscriptionRepository subscriptions;

	final UUID minsu = UUID.randomUUID();
	final UUID jiwon = UUID.randomUUID();
	final UUID group = UUID.randomUUID();
	final UUID event = UUID.randomUUID();
	final UUID comment = UUID.randomUUID();

	@BeforeAll
	static void repositories() {
		outbox = new OutboxRepository(jdbc);
		subscriptions = new SubscriptionRepository(jdbc);
	}

	@BeforeEach
	void data() {
		truncateAll();
		jdbc.sql("insert into public.profiles (id, nickname) values (:a, '민수'), (:b, '지원')").param("a", minsu).param("b", jiwon).update();
		jdbc.sql("insert into public.groups (id, name) values (:id, '대학 동기')").param("id", group).update();
		// 지원만 그룹 멤버 (민수는 나간 사람)
		jdbc.sql("insert into public.group_members (group_id, user_id) values (:g, :u)").param("g", group).param("u", jiwon).update();
		jdbc.sql("insert into public.events (id, group_id, title, starts_at, place_name) values (:id, :g, '연말 송년회', :at, '을지로')")
				.param("id", event).param("g", group).param("at", java.sql.Timestamp.from(Instant.parse("2026-10-30T10:00:00Z"))).update();
		jdbc.sql("insert into public.comments (id, event_id, user_id, body) values (:id, :e, :u, '몇 시까지 가능해?')")
				.param("id", comment).param("e", event).param("u", minsu).update();
	}

	long queue(UUID user, String kind, UUID commentId) {
		return jdbc.sql("insert into public.notification_outbox (user_id, event_id, comment_id, kind) values (:u, :e, :c, :k) returning id")
				.param("u", user).param("e", event).param("c", commentId).param("k", kind)
				.query(Long.class).single();
	}

	String status(long id) {
		return jdbc.sql("select status from public.notification_outbox where id = :id").param("id", id).query(String.class).single();
	}

	@Test
	void 꺼내면_보내는_중이_되고_문구에_필요한_정보가_함께_온다() {
		long id = queue(jiwon, "comment", comment);

		var items = outbox.claim(10);

		assertThat(items).hasSize(1);
		var item = items.getFirst();
		assertThat(item.id()).isEqualTo(id);
		assertThat(item.attempts()).isEqualTo(1);
		assertThat(item.eventTitle()).isEqualTo("연말 송년회");
		assertThat(item.groupName()).isEqualTo("대학 동기");
		assertThat(item.commentAuthor()).isEqualTo("민수");
		assertThat(item.preferences().comment()).isTrue();
		assertThat(status(id)).isEqualTo("sending");
		assertThat(outbox.claim(10)).isEmpty();
	}

	@Test
	void 보내는_순간_그룹을_나간_사람인지_함께_온다() {
		queue(jiwon, "new_event", null);
		queue(minsu, "new_event", null);

		var items = outbox.claim(10);

		assertThat(items).extracting(OutboxItem::userId, OutboxItem::recipientInGroup)
				.containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple(jiwon, true), org.assertj.core.groups.Tuple.tuple(minsu, false));
	}

	@Test
	void 투표_댓글_알림은_투표_제목과_그룹이_함께_온다() {
		var poll = UUID.randomUUID();
		var pollComment = UUID.randomUUID();
		jdbc.sql("insert into public.date_polls (id, group_id, title) values (:id, :g, '다음 모임 날짜')").param("id", poll).param("g", group).update();
		jdbc.sql("insert into public.comments (id, poll_id, user_id, body) values (:id, :p, :u, '토요일 어때?')")
				.param("id", pollComment).param("p", poll).param("u", minsu).update();
		jdbc.sql("insert into public.notification_outbox (user_id, poll_id, comment_id, kind) values (:u, :p, :c, 'mention')")
				.param("u", jiwon).param("p", poll).param("c", pollComment).update();

		var item = outbox.claim(10).getFirst();

		assertThat(item.eventId()).isNull();
		assertThat(item.pollId()).isEqualTo(poll);
		assertThat(item.pollTitle()).isEqualTo("다음 모임 날짜");
		assertThat(item.groupName()).isEqualTo("대학 동기");
		assertThat(item.commentBody()).isEqualTo("토요일 어때?");
		assertThat(item.commentAuthor()).isEqualTo("민수");
	}

	@Test
	void 여러_워커가_동시에_꺼내도_같은_알림을_두_번_잡지_않는다() throws Exception {
		for (int i = 0; i < 200; i++) {
			queue(i % 2 == 0 ? minsu : jiwon, "new_event", null);
		}
		var tasks = new ArrayList<Callable<List<Long>>>();
		for (int w = 0; w < 4; w++) {
			tasks.add(() -> {
				var mine = new ArrayList<Long>();
				List<OutboxItem> batch;
				while (!(batch = outbox.claim(7)).isEmpty()) {
					batch.forEach(item -> mine.add(item.id()));
				}
				return mine;
			});
		}
		try (var pool = Executors.newFixedThreadPool(4)) {
			var all = new ArrayList<Long>();
			for (var future : pool.invokeAll(tasks)) {
				all.addAll(future.get());
			}
			assertThat(all).hasSize(200);
			assertThat(new HashSet<>(all)).hasSize(200);
		}
	}

	@Test
	void 다시_시도하면_대기로_돌아가고_정한_시간이_지나야_다시_꺼낸다() {
		long id = queue(minsu, "new_event", null);
		outbox.claim(10);

		outbox.retryLater(id, Duration.ofMinutes(5), "HTTP 503");

		assertThat(status(id)).isEqualTo("pending");
		assertThat(outbox.claim(10)).isEmpty();
		jdbc.sql("update public.notification_outbox set next_attempt_at = now() - interval '1 second' where id = :id").param("id", id).update();
		var again = outbox.claim(10);
		assertThat(again).hasSize(1);
		assertThat(again.getFirst().attempts()).isEqualTo(2);
	}

	@Test
	void 보내다_멈춘_행은_다시_대기로() {
		long id = queue(minsu, "new_event", null);
		outbox.claim(10);
		jdbc.sql("update public.notification_outbox set locked_at = now() - interval '10 minutes' where id = :id").param("id", id).update();

		assertThat(outbox.releaseStale(Duration.ofMinutes(5))).isEqualTo(1);
		assertThat(status(id)).isEqualTo("pending");
	}

	@Test
	void 끝낸_결과를_남기고_오래된_기록은_지운다() {
		long sent = queue(minsu, "new_event", null);
		long failed = queue(jiwon, "new_event", null);
		outbox.claim(10);
		outbox.markSent(sent);
		outbox.markFailed(failed, "HTTP 400");

		assertThat(status(sent)).isEqualTo("sent");
		assertThat(status(failed)).isEqualTo("failed");
		assertThat(outbox.purge(Duration.ofDays(7), Duration.ofDays(30))).isZero();
		jdbc.sql("update public.notification_outbox set sent_at = now() - interval '8 days', created_at = now() - interval '8 days'").update();
		assertThat(outbox.purge(Duration.ofDays(7), Duration.ofDays(30))).isEqualTo(1);
		assertThat(status(failed)).isEqualTo("failed");
	}

	@Test
	void 기기_구독을_사람별로_찾고_만료된_것은_지운다() {
		jdbc.sql("insert into public.push_subscriptions values ('https://push/a', :u, 'k', 'a'), ('https://push/b', :u, 'k', 'a')")
				.param("u", minsu).update();

		assertThat(subscriptions.findByUserIds(List.of(minsu, jiwon))).hasSize(2);
		subscriptions.deleteByEndpoints(List.of("https://push/a"));
		assertThat(subscriptions.findByUserIds(List.of(minsu))).extracting(SubscriptionRepository.Subscription::endpoint)
				.containsExactly("https://push/b");
	}

}
