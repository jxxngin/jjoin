package app.jjoin.backend.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import app.jjoin.backend.jobs.InquiryRepository.FixResult;
import app.jjoin.backend.jobs.InquiryRepository.NewInquiry;

// 문의 요약 문구 (Next의 inquiry-digest와 같은 모양)
class InquiryDigestMessageTest {

	static NewInquiry inquiry(String category, String title) {
		return new NewInquiry(UUID.randomUUID(), category, title);
	}

	@Test
	void 알릴_게_없으면_비어_있다() {
		assertThat(InquiryDigestMessage.build(List.of(), List.of(), 0)).isEmpty();
	}

	@Test
	void 새_문의는_유형별_건수와_제목_세_개() {
		var message = InquiryDigestMessage.build(List.of(
				inquiry("bug", "가"), inquiry("bug", "나"), inquiry("other", "다"), inquiry("feature", "라")), List.of(), 0).orElseThrow();

		assertThat(message.title()).isEqualTo("📮 jjoin 새 문의 4건");
		assertThat(message.body()).isEqualTo("🐞 오류 2 · 💬 기타 1 · 💡 제안 1 · · 가 · · 나 · · 다");
		assertThat(message.url()).isEqualTo("/support/admin");
	}

	@Test
	void 문의_없이_자동_수정_결과와_화면_오류만() {
		var message = InquiryDigestMessage.build(List.of(),
				List.of(new FixResult(UUID.randomUUID(), "pr_opened"), new FixResult(UUID.randomUUID(), "failed")), 3).orElseThrow();

		assertThat(message.title()).isEqualTo("📮 jjoin 문의 소식");
		assertThat(message.body()).isEqualTo("🤖 수정안 준비 1건 (확인 후 Merge) · ⚠️ 자동 수정 실패 1건 · 🧯 화면 오류 3건");
	}

	@Test
	void 본문은_140글자까지() {
		var message = InquiryDigestMessage.build(List.of(inquiry("bug", "가".repeat(300))), List.of(), 0).orElseThrow();
		assertThat(message.body().codePointCount(0, message.body().length())).isEqualTo(140);
	}

}
