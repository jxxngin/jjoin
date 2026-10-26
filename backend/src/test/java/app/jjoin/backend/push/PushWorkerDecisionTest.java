package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

import app.jjoin.backend.push.PushWorker.Decision;
import app.jjoin.backend.push.WebPushClient.Outcome;
import app.jjoin.backend.push.WebPushClient.Result;

// 기기별 발송 결과 → 보냄 / 다시 시도 / 실패 / 건너뜀
class PushWorkerDecisionTest {

	private static final Duration FIRST = Duration.ofSeconds(30);

	private static Result r(Outcome outcome) {
		return new Result(outcome, outcome.name());
	}

	@Test
	void 한_기기라도_받으면_보냄_다시_보내지_않음() {
		assertThat(PushWorker.decide(List.of(r(Outcome.RETRY), r(Outcome.DELIVERED)), 1, 5, FIRST))
				.isInstanceOf(Decision.Sent.class);
	}

	@Test
	void 일시적_실패는_간격을_두_배씩_늘려_다시() {
		assertThat(PushWorker.decide(List.of(r(Outcome.RETRY)), 1, 5, FIRST))
				.isEqualTo(new Decision.Retry(Duration.ofSeconds(30), "RETRY"));
		assertThat(PushWorker.decide(List.of(r(Outcome.RETRY)), 3, 5, FIRST))
				.isEqualTo(new Decision.Retry(Duration.ofMinutes(2), "RETRY"));
	}

	@Test
	void 횟수를_다_쓰면_실패() {
		assertThat(PushWorker.decide(List.of(r(Outcome.RETRY)), 5, 5, FIRST)).isInstanceOf(Decision.Failed.class);
	}

	@Test
	void 재시도_간격은_최대_1시간() {
		assertThat(PushWorker.retryOrFail(20, 50, FIRST, "x")).isEqualTo(new Decision.Retry(Duration.ofHours(1), "x"));
	}

	@Test
	void 구독이_모두_만료되면_건너뜀() {
		assertThat(PushWorker.decide(List.of(r(Outcome.EXPIRED), r(Outcome.EXPIRED)), 1, 5, FIRST))
				.isInstanceOf(Decision.Skipped.class);
	}

	@Test
	void 거절은_다시_보내지_않고_실패() {
		assertThat(PushWorker.decide(List.of(r(Outcome.REJECTED), r(Outcome.EXPIRED)), 1, 5, FIRST))
				.isInstanceOf(Decision.Failed.class);
	}

	@Test
	void 푸시_서버_응답_코드_분류() {
		assertThat(WebPushClient.classify(201).outcome()).isEqualTo(Outcome.DELIVERED);
		assertThat(WebPushClient.classify(410).outcome()).isEqualTo(Outcome.EXPIRED);
		assertThat(WebPushClient.classify(429).outcome()).isEqualTo(Outcome.RETRY);
		assertThat(WebPushClient.classify(503).outcome()).isEqualTo(Outcome.RETRY);
		assertThat(WebPushClient.classify(400).outcome()).isEqualTo(Outcome.REJECTED);
	}

}
