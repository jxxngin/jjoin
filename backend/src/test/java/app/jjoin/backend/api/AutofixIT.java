package app.jjoin.backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import app.jjoin.backend.SupabaseIT;
import app.jjoin.backend.push.DirectPushSender;
import app.jjoin.backend.push.PushMessage;

// 워커 계정 권한(0035)만으로 자동 수정 연동이 되는지
class AutofixIT extends SupabaseIT {

	static AutofixService service;
	static final List<Map.Entry<UUID, PushMessage>> pushed = new ArrayList<>();

	UUID asker;
	UUID other;
	UUID bug;

	@BeforeAll
	static void wire() {
		var sender = new DirectPushSender(null, null) {
			@Override
			public int sendToUser(UUID userId, PushMessage message) {
				pushed.add(Map.entry(userId, message));
				return 1;
			}
		};
		service = new AutofixService(jdbc, transaction, sender, Runnable::run);
	}

	@BeforeEach
	void data() {
		owner.sql("truncate auth.users, public.inquiries cascade").update();
		pushed.clear();
		asker = signUp("지원");
		other = signUp("민수");
		bug = inquiry(asker, "bug", "저장이 안 돼요", null);
	}

	UUID inquiry(UUID user, String category, String title, UUID duplicateOf) {
		return owner.sql("""
				insert into public.inquiries (user_id, category, title, body, page_path, duplicate_of)
				values (:user, :category, :title, '버튼을 눌러도 그대로예요', '/events/1', :dup) returning id
				""").param("user", user).param("category", category).param("title", title).param("dup", duplicateOf)
				.query(UUID.class).single();
	}

	@Test
	void Next의_배포_처리_함수는_완료_안내_알림을_한_번에_처리한다() {
		var duplicate = inquiry(other, "bug", "저장 버튼 먹통", bug);

		var done = owner.sql("select id from public.mark_inquiries_deployed(:ids, '배포됐어요')")
				.param("ids", new UUID[] { bug }).query(UUID.class).list();

		assertThat(done).containsExactlyInAnyOrder(bug, duplicate);
		var states = owner.sql("select count(*) from public.inquiries where id in (:a, :b) and status = 'done' and deployed_at is not null")
				.param("a", bug).param("b", duplicate).query(Integer.class).single();
		var notices = owner.sql("select count(*) from public.inquiry_messages where inquiry_id in (:a, :b) and is_admin and body = '배포됐어요'")
				.param("a", bug).param("b", duplicate).query(Integer.class).single();
		var alerts = owner.sql("select count(*) from public.notifications where inquiry_id in (:a, :b) and kind = 'inquiry_reply'")
				.param("a", bug).param("b", duplicate).query(Integer.class).single();
		assertThat(states).isEqualTo(2);
		assertThat(notices).isEqualTo(2);
		assertThat(alerts).isEqualTo(2);

		// 다시 불러도 이미 처리된 문의는 건너뛰어 안내 글·알림이 겹치지 않는다.
		var again = owner.sql("select id from public.mark_inquiries_deployed(:ids, '배포됐어요')")
				.param("ids", new UUID[] { bug }).query(UUID.class).list();
		assertThat(again).isEmpty();
		var alertsAfter = owner.sql("select count(*) from public.notifications where inquiry_id in (:a, :b) and kind = 'inquiry_reply'")
				.param("a", bug).param("b", duplicate).query(Integer.class).single();
		assertThat(alertsAfter).isEqualTo(2);
	}

	@Test
	void 자동_수정_예약은_동시에_들어와도_하루_한도를_넘지_않는다() throws Exception {
		// 최근 24시간에 이미 2건 실행됐고, 한도는 3건
		for (int i = 0; i < 2; i++) {
			var used = inquiry(other, "bug", "이전 신고 " + i, null);
			owner.sql("update public.inquiries set auto_fix_at = now() - interval '1 hour' where id = :id").param("id", used).update();
		}
		var fresh = new java.util.ArrayList<UUID>();
		for (int i = 0; i < 4; i++) {
			fresh.add(inquiry(asker, "bug", "동시 신고 " + i, null));
		}

		// 네 건이 동시에 예약을 시도한다 (연결마다 따로)
		var pool = java.util.concurrent.Executors.newFixedThreadPool(4);
		var start = new java.util.concurrent.CountDownLatch(1);
		var results = new java.util.ArrayList<java.util.concurrent.Future<Boolean>>();
		for (var id : fresh) {
			results.add(pool.submit(() -> {
				start.await();
				return owner.sql("select public.reserve_autofix(:id, 3, false)").param("id", id).query(Boolean.class).single();
			}));
		}
		start.countDown();
		var passed = 0;
		for (var result : results) {
			if (result.get()) {
				passed++;
			}
		}
		pool.shutdown();

		assertThat(passed).isEqualTo(1);
		var capped = owner.sql("select count(*) from public.inquiries where auto_fix_status = 'capped'").query(Integer.class).single();
		assertThat(capped).isEqualTo(3);
		// 관리자가 직접 다시 실행하면 한도를 보지 않는다.
		var forced = owner.sql("select public.reserve_autofix(:id, 3, true)").param("id", fresh.getFirst()).query(Boolean.class).single();
		assertThat(forced).isTrue();
	}

	@Test
	void 이전_시도의_실패_기록은_다시_예약한_새_시도를_덮지_않는다() {
		var first = owner.sql("select public.reserve_autofix_at(:id, 3, true)").param("id", bug).query(java.time.OffsetDateTime.class).single();
		var stored = owner.sql("select auto_fix_at from public.inquiries where id = :id").param("id", bug).query(java.time.OffsetDateTime.class).single();
		assertThat(first).isNotNull().isEqualTo(stored);

		// 관리자가 같은 문의를 다시 실행했다. (예약은 각자 다른 트랜잭션이라 시각이 다르다)
		var second = owner.sql("select public.reserve_autofix_at(:id, 3, true)").param("id", bug).query(java.time.OffsetDateTime.class).single();
		assertThat(second).isAfter(first);

		// 앞 시도가 늦게 실패한다: Next와 같은 조건(내 예약 시각 + 아직 pending)으로만 바꾼다.
		var markFailed = "update public.inquiries set auto_fix_status = 'failed' where id = :id and auto_fix_status = 'pending' and auto_fix_at = :at";
		var stale = owner.sql(markFailed).param("id", bug).param("at", first).update();
		assertThat(stale).isZero();
		var status = owner.sql("select auto_fix_status from public.inquiries where id = :id").param("id", bug).query(String.class).single();
		assertThat(status).isEqualTo("pending");

		// 지금 시도가 실패하면 실패로 바뀐다.
		assertThat(owner.sql(markFailed).param("id", bug).param("at", second).update()).isEqualTo(1);
	}

	@Test
	void 오류_신고_내용만_넘기고_작성자는_빼다() {
		var report = service.bugReport(bug).orElseThrow();
		assertThat(report).containsOnlyKeys("id", "category", "title", "body", "page_path", "user_agent", "created_at");
		assertThat(report.get("page_path")).isEqualTo("/events/1");

		var feature = inquiry(asker, "feature", "다크 모드", null);
		assertThat(service.bugReport(feature)).isEmpty();
	}

	@Test
	void 결과를_받아_표시한다() {
		assertThat(service.report(bug.toString(), "pr_opened", "https://github.com/jxxngin/jjoin/pull/9")).isTrue();
		assertThat(service.report(bug.toString(), "merged", null)).isFalse();
		assertThat(service.report("not-a-uuid", "failed", null)).isFalse();
		// GitHub 주소가 아니면 저장하지 않는다
		assertThat(service.report(bug.toString(), "failed", "https://evil.example/x")).isTrue();

		var row = owner.sql("select auto_fix_status || ' ' || coalesce(auto_fix_url, '-') from public.inquiries where id = :id")
				.param("id", bug).query(String.class).single();
		assertThat(row).isEqualTo("failed -");
	}

	@Test
	void 배포되면_묶인_문의까지_처리_완료와_안내_한_번만() {
		var duplicate = inquiry(other, "bug", "저도 저장이 안 돼요", bug);

		assertThat(service.deployed(List.of(bug.toString(), "엉뚱한 값", 3))).isEqualTo(2);

		var rows = owner.sql("select status, deployed_at is not null from public.inquiries where id in (:a, :b)")
				.param("a", bug).param("b", duplicate)
				.query((rs, row) -> rs.getString(1) + " " + rs.getBoolean(2)).list();
		assertThat(rows).containsOnly("done true");
		var notices = owner.sql("select count(*) from public.inquiry_messages where is_admin and user_id is null and body = :body")
				.param("body", AutofixService.NOTICE).query(Integer.class).single();
		assertThat(notices).isEqualTo(2);
		// 관리자 글이라 문의한 사람의 알림 목록에도 남는다 (0028 트리거)
		assertThat(owner.sql("select count(*) from public.notifications where kind = 'inquiry_reply'").query(Integer.class).single()).isEqualTo(2);
		assertThat(pushed).extracting(Map.Entry::getKey).containsExactlyInAnyOrder(asker, other);

		pushed.clear();
		assertThat(service.deployed(List.of(bug.toString()))).isZero();
		assertThat(pushed).isEmpty();
	}

	@Test
	void 사용자_요청을_처리한_연결로도_배포_안내가_된다() {
		// 사용자 요청이 같은 연결에 request.jwt.claims를 남긴 뒤 (트랜잭션이 끝나면 ''로 남는다)
		new UserDb(jdbc, transaction).as(token(asker), db -> db.sql("select 1").query(Integer.class).single());

		assertThat(service.deployed(List.of(bug.toString()))).isEqualTo(1);
	}

	@Test
	void 비밀값이_맞아야_한다() {
		var properties = new AutofixProperties("s3cret");
		assertThat(properties.accepts("Bearer s3cret")).isTrue();
		assertThat(properties.accepts("Bearer wrong")).isFalse();
		assertThat(properties.accepts(null)).isFalse();
		assertThat(new AutofixProperties("").accepts("Bearer ")).isFalse();
	}

}
