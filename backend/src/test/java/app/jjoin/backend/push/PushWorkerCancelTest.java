package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * 보내는 도중 받는 사람이 그룹을 나가면 남은 기기로는 보내지 않는다. (0037, #22 리뷰)
 * DB 없이 저장소·발송기를 테스트용으로 바꿔 끼워, 첫 기기에 보내는 순간 사용자가 나간 상황을 만든다.
 */
class PushWorkerCancelTest {

	static final PushProperties PROPERTIES = new PushProperties(null, null, null, true, 50, 5, Duration.ofSeconds(30),
			Duration.ofMinutes(5));
	static final OutboxItem.Preferences ALL_ON = new OutboxItem.Preferences(true, true, true, true, true, true);

	final UUID user = UUID.randomUUID();
	final OutboxItem item = new OutboxItem(7, user, "comment", 1, UUID.randomUUID(), "송년회", java.time.Instant.parse("2026-12-20T10:00:00Z"), null, null,
			null, null, "대학 동기", "몇 시까지 가능해?", "민수", true, ALL_ON);

	/** 대기열: 처음엔 보내는 중이다가, left가 true가 되면 행이 지워진 것처럼 false. 기록 호출을 남긴다. */
	class FakeOutbox extends OutboxRepository {
		boolean left;
		final List<String> recorded = new ArrayList<>();

		FakeOutbox() {
			super(null);
		}

		@Override
		public List<OutboxItem> claim(int limit) {
			return List.of(item);
		}

		@Override
		public boolean stillSending(long id) {
			return !left;
		}

		@Override
		public void markSent(long id) {
			recorded.add("sent");
		}

		@Override
		public void markSkipped(long id, String reason) {
			recorded.add("skipped");
		}

		@Override
		public void retryLater(long id, Duration delay, String error) {
			recorded.add("retry");
		}

		@Override
		public void markFailed(long id, String error) {
			recorded.add("failed");
		}
	}

	class FakeSubscriptions extends SubscriptionRepository {
		FakeSubscriptions() {
			super(null);
		}

		@Override
		public List<Subscription> findByUserIds(Collection<UUID> userIds) {
			return List.of(new Subscription("https://push/phone", user, "k", "a"), new Subscription("https://push/laptop", user, "k", "a"));
		}

		@Override
		public void deleteByEndpoints(Collection<String> endpoints) {
		}
	}

	/** 첫 기기로 보내는 동안(응답 대기 중) 사용자가 그룹을 나간다. */
	class LeavingDuringFirstSend extends WebPushClient {
		final FakeOutbox outbox;
		final List<String> sentTo = new ArrayList<>();

		LeavingDuringFirstSend(FakeOutbox outbox) throws Exception {
			super(new PushProperties(null, null, null, false, 50, 5, Duration.ofSeconds(30), Duration.ofMinutes(5)));
			this.outbox = outbox;
		}

		@Override
		public Result send(SubscriptionRepository.Subscription subscription, PushMessage message) {
			sentTo.add(subscription.endpoint());
			outbox.left = true;
			return new Result(Outcome.DELIVERED, null);
		}
	}

	@Test
	void 첫_기기로_보내는_동안_그룹을_나가면_두_번째_기기로는_보내지_않는다() throws Exception {
		var outbox = new FakeOutbox();
		var client = new LeavingDuringFirstSend(outbox);
		var worker = new PushWorker(outbox, new FakeSubscriptions(), client, PROPERTIES, new SimpleMeterRegistry());

		worker.processBatch();

		assertThat(client.sentTo).containsExactly("https://push/phone");
		// 행이 지워졌으므로 결과를 기록하지 않는다.
		assertThat(outbox.recorded).isEmpty();
	}

	@Test
	void 나가지_않았으면_모든_기기로_보내고_보냄으로_기록한다() throws Exception {
		var outbox = new FakeOutbox();
		var sentTo = new ArrayList<String>();
		var client = new WebPushClient(new PushProperties(null, null, null, false, 50, 5, Duration.ofSeconds(30), Duration.ofMinutes(5))) {
			@Override
			public Result send(SubscriptionRepository.Subscription subscription, PushMessage message) {
				sentTo.add(subscription.endpoint());
				return new Result(Outcome.DELIVERED, null);
			}
		};
		var worker = new PushWorker(outbox, new FakeSubscriptions(), client, PROPERTIES, new SimpleMeterRegistry());

		worker.processBatch();

		assertThat(sentTo).containsExactly("https://push/phone", "https://push/laptop");
		assertThat(outbox.recorded).containsExactly("sent");
	}

}
