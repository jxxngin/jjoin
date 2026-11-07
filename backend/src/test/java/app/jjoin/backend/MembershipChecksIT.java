package app.jjoin.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 그룹을 나가거나 내보내진 뒤 권한·알림이 남지 않는지 (0037, DB 리뷰 #14).
 * 사용자 요청은 앱과 같이 워커 연결에서 JWT claims + set local role authenticated로 부른다.
 */
class MembershipChecksIT extends SupabaseIT {

	UUID host;
	UUID friend;
	UUID group;

	@BeforeEach
	void data() {
		host = signUp("방장");
		friend = signUp("친구");
		group = UUID.randomUUID();
		owner.sql("insert into public.groups (id, name, invite_code, owner_id) values (:id, '대학 동기', :code, :owner)")
				.param("id", group).param("code", "m" + group.toString().substring(0, 8)).param("owner", host).update();
		owner.sql("insert into public.group_members (group_id, user_id, role) values (:g, :a, 'owner'), (:g, :b, 'member') on conflict do nothing")
				.param("g", group).param("a", host).param("b", friend).update();
	}

	/** user로 로그인한 요청처럼 sql을 실행한다. */
	void asUser(UUID user, String sql, Object... params) {
		transaction.executeWithoutResult(status -> {
			jdbc.sql("select set_config('request.jwt.claims', :claims, true)")
					.param("claims", "{\"sub\":\"" + user + "\",\"role\":\"authenticated\"}").query().singleRow();
			jdbc.sql("set local role authenticated").update();
			var statement = jdbc.sql(sql);
			for (int i = 0; i < params.length; i++) {
				statement = statement.param(i + 1, params[i]);
			}
			statement.query().singleRow();
		});
	}

	void kick(UUID user) {
		owner.sql("delete from public.group_members where group_id = :g and user_id = :u").param("g", group).param("u", user).update();
	}

	UUID event(UUID createdBy, Instant startsAt) {
		var id = UUID.randomUUID();
		owner.sql("insert into public.events (id, group_id, title, starts_at, created_by) values (:id, :g, '송년회', :at, :by)")
				.param("id", id).param("g", group).param("at", Timestamp.from(startsAt)).param("by", createdBy).update();
		return id;
	}

	@Test
	void 내보내진_만든_사람은_투표를_확정할_수_없다() {
		var poll = UUID.randomUUID();
		var option = UUID.randomUUID();
		owner.sql("insert into public.date_polls (id, group_id, title, created_by) values (:id, :g, '다음 모임', :by)")
				.param("id", poll).param("g", group).param("by", friend).update();
		owner.sql("insert into public.date_poll_options (id, poll_id, starts_at) values (:id, :p, now() + interval '7 days')")
				.param("id", option).param("p", poll).update();
		kick(friend);

		assertThatThrownBy(() -> asUser(friend, "select public.confirm_date_poll(?, ?)", poll, option))
				.hasStackTraceContaining("not allowed");
		var eventId = owner.sql("select event_id from public.date_polls where id = :id").param("id", poll).query().singleRow().get("event_id");
		assertThat(eventId).isNull();
	}

	@Test
	void 나간_사람에게는_하루_전_알림을_쌓지_않는다() {
		var tomorrow = Instant.now().plus(1, ChronoUnit.DAYS);
		var id = event(host, tomorrow);
		owner.sql("insert into public.event_participants (event_id, user_id, status) values (:e, :u, 'going')").param("e", id).param("u", friend).update();
		kick(friend);

		owner.sql("select public.queue_day_before_notifications()").query().singleRow();

		var count = owner.sql("select count(*) from public.notification_outbox where event_id = :e and user_id = :u and kind = 'day_before'")
				.param("e", id).param("u", friend).query(Integer.class).single();
		assertThat(count).isZero();
	}

	@Test
	void 그룹을_나가면_그_그룹의_끝나지_않은_알림이_지워진다() {
		var id = event(host, Instant.now().plus(10, ChronoUnit.DAYS));
		owner.sql("insert into public.notification_outbox (user_id, event_id, kind) values (:u, :e, 'promoted')").param("u", friend).param("e", id).update();
		// 워커가 꺼내 보내는 중인 알림 (일시 실패하면 다시 pending으로 돌아와 재시도된다)
		var sending = owner.sql("""
				insert into public.notification_outbox (user_id, event_id, kind, status, attempts, locked_at)
				values (:u, :e, 'hour_before', 'sending', 1, now()) returning id
				""").param("u", friend).param("e", id).query(Long.class).single();

		kick(friend);

		var left = owner.sql("select count(*) from public.notification_outbox where user_id = :u and status in ('pending', 'sending')")
				.param("u", friend).query(Integer.class).single();
		assertThat(left).isZero();
		// 그 뒤 워커가 재시도로 돌리려 해도 되살아나지 않는다.
		new app.jjoin.backend.push.OutboxRepository(owner).retryLater(sending, java.time.Duration.ofSeconds(30), "일시 실패");
		var revived = owner.sql("select count(*) from public.notification_outbox where id = :id").param("id", sending).query(Integer.class).single();
		assertThat(revived).isZero();
	}

	@Test
	void 탈퇴_준비를_하면_방장_역할도_내려간다() {
		asUser(host, "select public.prepare_account_deletion()");

		var roles = owner.sql("select user_id, role from public.group_members where group_id = :g").param("g", group).query().listOfRows();
		assertThat(roles).anySatisfy(row -> {
			assertThat(row.get("user_id")).isEqualTo(host);
			assertThat(row.get("role")).isEqualTo("member");
		});
		assertThat(roles).anySatisfy(row -> {
			assertThat(row.get("user_id")).isEqualTo(friend);
			assertThat(row.get("role")).isEqualTo("owner");
		});
		var newOwner = owner.sql("select owner_id from public.groups where id = :g").param("g", group).query().singleRow().get("owner_id");
		assertThat(newOwner).isEqualTo(friend);
	}

}
