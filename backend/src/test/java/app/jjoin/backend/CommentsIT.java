package app.jjoin.backend;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * 약속·투표 댓글을 합친 comments 표의 DB 규칙 (0036). 실제 마이그레이션을 모두 올린 DB에서 확인한다.
 * 준비와 댓글 쓰기는 관리자 계정(owner)으로 한다. RLS는 건너뛰지만 트리거는 그대로 돈다.
 */
class CommentsIT extends SupabaseIT {

	UUID host;
	UUID voter;
	UUID group;
	UUID poll;
	UUID option;

	@BeforeEach
	void data() {
		host = signUp("방장");
		voter = signUp("투표한 친구");
		group = UUID.randomUUID();
		owner.sql("insert into public.groups (id, name, invite_code, owner_id) values (:id, '대학 동기', :code, :owner)")
				.param("id", group).param("code", "c" + group.toString().substring(0, 8)).param("owner", host).update();
		owner.sql("insert into public.group_members (group_id, user_id) values (:g, :a), (:g, :b) on conflict do nothing")
				.param("g", group).param("a", host).param("b", voter).update();
		poll = UUID.randomUUID();
		owner.sql("insert into public.date_polls (id, group_id, title, created_by) values (:id, :g, '다음 모임 날짜', :by)")
				.param("id", poll).param("g", group).param("by", host).update();
		option = UUID.randomUUID();
		owner.sql("insert into public.date_poll_options (id, poll_id, starts_at) values (:id, :p, :at)")
				.param("id", option).param("p", poll).param("at", Timestamp.from(Instant.parse("2026-12-05T10:00:00Z"))).update();
		owner.sql("insert into public.date_poll_votes (option_id, user_id) values (:o, :u)").param("o", option).param("u", voter).update();
	}

	UUID comment(UUID author, String column, UUID target) {
		var id = UUID.randomUUID();
		owner.sql("insert into public.comments (id, " + column + ", user_id, body) values (:id, :t, :u, '토요일 어때?')")
				.param("id", id).param("t", target).param("u", author).update();
		return id;
	}

	int notifications(UUID user, UUID commentId) {
		return owner.sql("select count(*) from public.notification_outbox where user_id = :u and comment_id = :c")
				.param("u", user).param("c", commentId).query(Integer.class).single();
	}

	@Test
	void 투표_댓글은_투표한_사람에게_새_댓글_알림이_간다() {
		var id = comment(host, "poll_id", poll);

		assertThat(notifications(voter, id)).isEqualTo(1);
		assertThat(notifications(host, id)).isZero();
	}

	@Test
	void 그룹을_나간_사람은_투표_기록이_남아_있어도_알림을_받지_않는다() {
		owner.sql("delete from public.group_members where group_id = :g and user_id = :u").param("g", group).param("u", voter).update();

		var id = comment(host, "poll_id", poll);

		assertThat(notifications(voter, id)).isZero();
	}

	@Test
	void 예전_댓글_표에는_열_단위까지_쓰기_권한이_남아_있지_않다() {
		var left = owner.sql("""
				select count(*) from information_schema.column_privileges
				where grantee = 'authenticated' and table_schema = 'public'
				  and table_name in ('event_comments', 'poll_comments') and privilege_type in ('INSERT', 'UPDATE')
				""").query(Integer.class).single();
		var tableLevel = owner.sql("""
				select count(*) from information_schema.role_table_grants
				where grantee = 'authenticated' and table_schema = 'public'
				  and table_name in ('event_comments', 'poll_comments') and privilege_type in ('INSERT', 'UPDATE', 'DELETE')
				""").query(Integer.class).single();

		assertThat(left).isZero();
		assertThat(tableLevel).isZero();
	}

	@Test
	void 투표를_확정하면_보내기_전_알림도_약속으로_옮겨_간다() {
		var id = comment(host, "poll_id", poll);
		var event = UUID.randomUUID();
		owner.sql("insert into public.events (id, group_id, title, starts_at, created_by) values (:id, :g, '다음 모임 날짜', :at, :by)")
				.param("id", event).param("g", group).param("at", Timestamp.from(Instant.parse("2026-12-05T10:00:00Z"))).param("by", host)
				.update();

		owner.sql("update public.date_polls set event_id = :e where id = :p").param("e", event).param("p", poll).update();

		var row = owner.sql("select event_id, poll_id from public.notification_outbox where user_id = :u and comment_id = :c")
				.param("u", voter).param("c", id).query().singleRow();
		assertThat(row.get("event_id")).isEqualTo(event);
		assertThat(row.get("poll_id")).isNull();
	}

	@Test
	void 투표로_만든_약속을_지우면_투표도_함께_지워진다() {
		var event = UUID.randomUUID();
		owner.sql("insert into public.events (id, group_id, title, starts_at, created_by) values (:id, :g, '다음 모임 날짜', :at, :by)")
				.param("id", event).param("g", group).param("at", Timestamp.from(Instant.parse("2026-12-05T10:00:00Z"))).param("by", host)
				.update();
		owner.sql("update public.date_polls set event_id = :e, closed_at = now() where id = :p").param("e", event).param("p", poll).update();

		owner.sql("delete from public.events where id = :e").param("e", event).update();

		var left = owner.sql("select count(*) from public.date_polls where id = :p").param("p", poll).query(Integer.class).single();
		assertThat(left).isZero();
	}

	@Test
	void 확정된_투표에_늦게_쓴_댓글은_약속_댓글로_저장된다() {
		var event = UUID.randomUUID();
		owner.sql("insert into public.events (id, group_id, title, starts_at, created_by) values (:id, :g, '다음 모임 날짜', :at, :by)")
				.param("id", event).param("g", group).param("at", Timestamp.from(Instant.parse("2026-12-05T10:00:00Z"))).param("by", host)
				.update();
		var early = comment(voter, "poll_id", poll);
		owner.sql("update public.date_polls set event_id = :e where id = :p").param("e", event).param("p", poll).update();

		var late = comment(voter, "poll_id", poll);

		for (var id : new UUID[] { early, late }) {
			var row = owner.sql("select event_id, poll_id from public.comments where id = :id").param("id", id).query().singleRow();
			assertThat(row.get("event_id")).isEqualTo(event);
			assertThat(row.get("poll_id")).isNull();
		}
	}

}
