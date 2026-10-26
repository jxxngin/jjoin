package app.jjoin.backend.push;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import io.micrometer.core.instrument.MeterRegistry;

/**
 * 알림 발송 워커. 몇 초마다 대기열을 보고, 보낼 차례인 알림을 사람마다 켠 기기들로 보낸다.
 * - 한 기기라도 받으면 '보냄'. (이미 받은 기기에 또 가지 않도록 다시 보내지 않는다)
 * - 모든 기기가 일시적으로 실패하면 30초·1분·2분…으로 늘려 가며 다시 보낸다. maxAttempts번 실패하면 '실패'.
 * - 받을 기기가 없거나 그 알림을 꺼 두었으면 '건너뜀'. (앱 안 알림 목록에는 DB 트리거가 이미 남겼다)
 */
@Component
public class PushWorker {

	private static final Logger log = LoggerFactory.getLogger(PushWorker.class);
	// 한 번 깨어났을 때 최대 몇 묶음까지 연달아 처리할지 (밀린 알림이 많을 때)
	private static final int MAX_BATCHES_PER_TICK = 20;

	/** 한 건을 처리한 뒤 대기열에 남길 결과 */
	sealed interface Decision {
		record Sent() implements Decision {
		}

		record Skipped(String reason) implements Decision {
		}

		record Retry(Duration delay, String error) implements Decision {
		}

		record Failed(String error) implements Decision {
		}
	}

	private final OutboxRepository outbox;
	private final SubscriptionRepository subscriptions;
	private final WebPushClient client;
	private final PushProperties properties;
	private final MeterRegistry meters;

	public PushWorker(OutboxRepository outbox, SubscriptionRepository subscriptions, WebPushClient client,
			PushProperties properties, MeterRegistry meters) {
		this.outbox = outbox;
		this.subscriptions = subscriptions;
		this.client = client;
		this.properties = properties;
		this.meters = meters;
	}

	@Scheduled(fixedDelayString = "${jjoin.push.poll-interval:3s}")
	public void poll() {
		if (!properties.enabled()) {
			return;
		}
		for (int i = 0; i < MAX_BATCHES_PER_TICK; i++) {
			if (processBatch() < properties.batchSize()) {
				return;
			}
		}
	}

	/** 한 묶음을 잡아 보내고, 잡은 수를 돌려준다. */
	int processBatch() {
		var items = outbox.claim(properties.batchSize());
		if (items.isEmpty()) {
			return 0;
		}
		var userIds = items.stream().map(OutboxItem::userId).collect(Collectors.toSet());
		var devicesByUser = subscriptions.findByUserIds(userIds).stream()
				.collect(Collectors.groupingBy(SubscriptionRepository.Subscription::userId));
		var expired = new ArrayList<String>();

		for (var item : items) {
			Decision decision;
			try {
				var message = PushMessage.from(item);
				var devices = devicesByUser.getOrDefault(item.userId(), List.of());
				if (message.isEmpty()) {
					decision = new Decision.Skipped("알림을 꺼 두었거나 약속이 없어짐");
				} else if (devices.isEmpty()) {
					decision = new Decision.Skipped("알림을 켠 기기 없음");
				} else {
					var results = devices.stream().map(device -> {
						var result = client.send(device, message.get());
						if (result.outcome() == WebPushClient.Outcome.EXPIRED) {
							expired.add(device.endpoint());
						}
						return result;
					}).toList();
					decision = decide(results, item.attempts(), properties.maxAttempts(), properties.firstRetryDelay());
				}
			} catch (RuntimeException e) {
				log.warn("알림 {} 처리 중 오류", item.id(), e);
				decision = retryOrFail(item.attempts(), properties.maxAttempts(), properties.firstRetryDelay(),
						e.getClass().getSimpleName() + ": " + e.getMessage());
			}
			record(item, decision);
		}
		subscriptions.deleteByEndpoints(expired);
		return items.size();
	}

	/**
	 * 기기별 결과로 이 알림을 어떻게 끝낼지 정한다.
	 * attempts는 이번 시도를 포함한 횟수다.
	 */
	static Decision decide(List<WebPushClient.Result> results, int attempts, int maxAttempts, Duration firstDelay) {
		if (results.stream().anyMatch(r -> r.outcome() == WebPushClient.Outcome.DELIVERED)) {
			return new Decision.Sent();
		}
		var retryable = results.stream().filter(r -> r.outcome() == WebPushClient.Outcome.RETRY).findFirst();
		if (retryable.isPresent()) {
			return retryOrFail(attempts, maxAttempts, firstDelay, retryable.get().detail());
		}
		if (results.stream().allMatch(r -> r.outcome() == WebPushClient.Outcome.EXPIRED)) {
			return new Decision.Skipped("기기 구독이 모두 만료됨");
		}
		var detail = results.stream().map(WebPushClient.Result::detail).distinct().collect(Collectors.joining(", "));
		return new Decision.Failed("푸시 서버가 거절함: " + detail);
	}

	// 30초 → 1분 → 2분 → 4분 … (최대 1시간)
	static Decision retryOrFail(int attempts, int maxAttempts, Duration firstDelay, String error) {
		if (attempts >= maxAttempts) {
			return new Decision.Failed(attempts + "번 실패: " + error);
		}
		var delay = firstDelay.multipliedBy(1L << Math.min(attempts - 1, 10));
		var cap = Duration.ofHours(1);
		return new Decision.Retry(delay.compareTo(cap) > 0 ? cap : delay, error);
	}

	private void record(OutboxItem item, Decision decision) {
		switch (decision) {
			case Decision.Sent sent -> outbox.markSent(item.id());
			case Decision.Skipped skipped -> outbox.markSkipped(item.id(), skipped.reason());
			case Decision.Retry retry -> outbox.retryLater(item.id(), retry.delay(), retry.error());
			case Decision.Failed failed -> {
				log.warn("알림 {} 발송 실패: {}", item.id(), failed.error());
				outbox.markFailed(item.id(), failed.error());
			}
		}
		meters.counter("jjoin.push.notifications", "result", decision.getClass().getSimpleName().toLowerCase()).increment();
	}

	/** 보내다 멈춘 행을 1분마다 되살린다. */
	@Scheduled(fixedDelay = 60_000, initialDelay = 10_000)
	public void releaseStale() {
		int released = outbox.releaseStale(properties.staleAfter());
		if (released > 0) {
			log.warn("보내는 중에 멈춘 알림 {}건을 다시 대기열에 넣었어요", released);
		}
	}

	/** 다 끝난 기록은 1시간마다 정리한다. (보냄·건너뜀 7일, 실패 30일 보관) */
	@Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
	public void purge() {
		int removed = outbox.purge(Duration.ofDays(7), Duration.ofDays(30));
		if (removed > 0) {
			log.info("지난 알림 기록 {}건을 지웠어요", removed);
		}
	}

}
