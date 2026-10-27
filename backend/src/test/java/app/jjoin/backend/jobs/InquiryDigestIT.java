package app.jjoin.backend.jobs;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import app.jjoin.backend.PostgresIT;
import app.jjoin.backend.push.DirectPushSender;
import app.jjoin.backend.push.PushMessage;

// 문의 요약: 관리자가 받았을 때만 "알렸음" 표시, 오래된 기록 정리
class InquiryDigestIT extends PostgresIT {

	final UUID admin = UUID.randomUUID();
	final List<PushMessage> sent = new ArrayList<>();
	int devices;
	InquiryDigestJob job;

	/** 실제 푸시 대신 보낸 문구를 모으고, 받은 기기 수를 돌려준다. */
	class FakeSender extends DirectPushSender {
		FakeSender() {
			super(null, null);
		}

		@Override
		public int sendToUser(UUID userId, PushMessage message) {
			sent.add(message);
			return devices;
		}
	}

	@BeforeEach
	void data() {
		truncateAll();
		devices = 1;
		jdbc.sql("insert into public.profiles (id, nickname) values (:id, '관리자')").param("id", admin).update();
		jdbc.sql("insert into public.app_admins values (:id)").param("id", admin).update();
		job = new InquiryDigestJob(new InquiryRepository(jdbc), new FakeSender(), new JobLock(jdbc, transaction),
				new JobsProperties(true, "-", "-", "-"));
	}

	void inquiry(String category, String title) {
		jdbc.sql("insert into public.inquiries (category, title) values (:c, :t)").param("c", category).param("t", title).update();
	}

	int unnotified() {
		return jdbc.sql("select count(*) from public.inquiries where notified_at is null").query(Integer.class).single();
	}

	@Test
	void 새_문의를_요약해_보내고_알렸다고_표시한다() {
		inquiry("bug", "시간 칸이 하얘요");
		inquiry("feature", "공휴일 보여 주세요");
		jdbc.sql("insert into public.inquiries (category, title, auto_fix_status, notified_at) values ('bug', '이미 알린 문의', 'pr_opened', now())").update();
		jdbc.sql("insert into public.client_errors (message) values ('TypeError')").update();

		var result = job.run();

		assertThat(result.delivered()).isEqualTo(1);
		assertThat(sent).hasSize(1);
		assertThat(sent.getFirst().title()).isEqualTo("📮 jjoin 새 문의 2건");
		assertThat(sent.getFirst().body()).contains("🐞 오류 1 · 💡 제안 1", "🤖 수정안 준비 1건", "🧯 화면 오류 1건", "· 시간 칸이 하얘요");
		assertThat(unnotified()).isZero();

		// 바로 다시 돌면 이미 알린 문의·수정안은 빠지고, 지난 1시간 화면 오류만 남는다. (매시 정각에 돌아 오류는 한 번씩 세진다)
		job.run();
		assertThat(sent).hasSize(2);
		assertThat(sent.get(1).title()).isEqualTo("📮 jjoin 문의 소식");
		assertThat(sent.get(1).body()).isEqualTo("🧯 화면 오류 1건");
	}

	@Test
	void 아무도_못_받았으면_다음_시간에_다시_보낸다() {
		inquiry("usage", "어떻게 써요?");
		devices = 0;

		job.run();
		assertThat(unnotified()).isEqualTo(1);

		devices = 1;
		job.run();
		assertThat(unnotified()).isZero();
		assertThat(sent).hasSize(2);
	}

	@Test
	void 알릴_게_없으면_보내지_않는다() {
		assertThat(job.run().delivered()).isZero();
		assertThat(sent).isEmpty();
	}

	@Test
	void 오래된_기기_정보와_화면_오류를_정리한다() {
		jdbc.sql("""
				insert into public.inquiries (category, title, status, done_at, user_agent, notified_at) values
				  ('bug', '오래전 처리', 'done', now() - interval '100 days', 'iPhone', now()),
				  ('bug', '최근 처리', 'done', now() - interval '10 days', 'Galaxy', now())
				""").update();
		jdbc.sql("insert into public.client_errors (message, created_at) values ('old', now() - interval '40 days'), ('new', now())").update();

		job.run();

		assertThat(jdbc.sql("select title from public.inquiries where user_agent is null").query(String.class).list())
				.containsExactly("오래전 처리");
		assertThat(jdbc.sql("select message from public.client_errors").query(String.class).list()).containsExactly("new");
	}

}
