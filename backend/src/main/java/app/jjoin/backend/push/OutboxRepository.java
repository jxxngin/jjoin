package app.jjoin.backend.push;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 알림 대기열(public.notification_outbox). 상태: pending → sending → sent / skipped / failed (0032)
 * 여러 워커가 함께 돌아도 같은 행을 두 번 잡지 않도록 FOR UPDATE SKIP LOCKED로 꺼낸다.
 */
@Repository
public class OutboxRepository {

	private final JdbcClient jdbc;

	public OutboxRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/**
	 * 보낼 차례인 행을 최대 limit개 잡아 'sending'으로 바꾸고, 문구에 필요한 정보와 함께 돌려준다.
	 * 한 문장 안에서 잠그고 바꾸므로 트랜잭션 없이도 다른 워커와 겹치지 않는다.
	 */
	public List<OutboxItem> claim(int limit) {
		return jdbc.sql("""
				with picked as (
				  select id from public.notification_outbox
				  where status = 'pending' and next_attempt_at <= now()
				  order by id
				  limit :limit
				  for update skip locked
				), claimed as (
				  update public.notification_outbox o
				  set status = 'sending', attempts = o.attempts + 1, locked_at = now()
				  from picked
				  where o.id = picked.id
				  returning o.id, o.user_id, o.event_id, o.poll_id, o.comment_id, o.kind, o.attempts
				)
				select c.id, c.user_id, c.kind, c.attempts,
				       e.id as event_id, e.title, e.starts_at, e.ends_at, e.place_name,
				       d.id as poll_id, d.title as poll_title,
				       g.name as group_name,
				       cm.body as comment_body, author.nickname as comment_author,
				       p.id as profile_id, p.notify_new_event, p.notify_promoted, p.notify_day_before,
				       p.notify_mention, p.notify_hour_before, p.notify_comment,
				       -- 보내는 순간의 멤버 여부. 쌓인 뒤에 그룹을 나갔으면 false (0037)
				       exists (
				         select 1 from public.group_members gm
				         where gm.user_id = c.user_id and gm.group_id = coalesce(e.group_id, d.group_id)
				       ) as recipient_in_group
				from claimed c
				left join public.events e on e.id = c.event_id
				left join public.date_polls d on d.id = c.poll_id
				left join public.groups g on g.id = coalesce(e.group_id, d.group_id)
				left join public.comments cm on cm.id = c.comment_id
				left join public.profiles author on author.id = cm.user_id
				left join public.profiles p on p.id = c.user_id
				order by c.id
				""")
				.param("limit", limit)
				.query(OutboxRepository::toItem)
				.list();
	}

	/** 보냄 (한 기기라도 받았다) */
	public void markSent(long id) {
		finish(id, "sent", null);
	}

	/** 건너뜀 (알림을 꺼 두었거나, 알림을 켠 기기가 없거나, 약속이 지워졌다) */
	public void markSkipped(long id, String reason) {
		finish(id, "skipped", reason);
	}

	/** 끝내 실패 (시도 횟수를 다 썼거나 다시 보내도 안 되는 오류) */
	public void markFailed(long id, String error) {
		finish(id, "failed", error);
	}

	/** 잠시 뒤 다시 보낸다. */
	public void retryLater(long id, Duration delay, String error) {
		jdbc.sql("""
				update public.notification_outbox
				set status = 'pending', locked_at = null, last_error = :error,
				    next_attempt_at = now() + make_interval(secs => :seconds)
				where id = :id and status = 'sending'
				""")
				.param("id", id)
				.param("seconds", (double) delay.toSeconds())
				.param("error", trim(error))
				.update();
	}

	/** 'sending'에 너무 오래 머문 행(워커가 보내다 죽음)을 다시 대기로 돌린다. 돌린 수를 돌려준다. */
	public int releaseStale(Duration staleAfter) {
		return jdbc.sql("""
				update public.notification_outbox
				set status = 'pending', locked_at = null, last_error = '보내는 중 멈춤 (워커 재시작)'
				where status = 'sending' and locked_at < now() - make_interval(secs => :seconds)
				""")
				.param("seconds", (double) staleAfter.toSeconds())
				.update();
	}

	/** 다 끝난 기록을 지운다. 보냄·건너뜀은 keepDone, 실패는 keepFailed만큼 남긴다. */
	public int purge(Duration keepDone, Duration keepFailed) {
		return jdbc.sql("""
				delete from public.notification_outbox
				where (status in ('sent', 'skipped') and coalesce(sent_at, created_at) < now() - make_interval(secs => :done))
				   or (status = 'failed' and created_at < now() - make_interval(secs => :failed))
				""")
				.param("done", (double) keepDone.toSeconds())
				.param("failed", (double) keepFailed.toSeconds())
				.update();
	}

	private void finish(long id, String status, String note) {
		jdbc.sql("""
				update public.notification_outbox
				set status = :status, locked_at = null, sent_at = now(), last_error = :note
				where id = :id and status = 'sending'
				""")
				.param("id", id)
				.param("status", status)
				.param("note", trim(note))
				.update();
	}

	private static String trim(String text) {
		return text == null || text.length() <= 500 ? text : text.substring(0, 500);
	}

	private static OutboxItem toItem(ResultSet rs, int row) throws SQLException {
		var preferences = rs.getObject("profile_id") == null ? null : new OutboxItem.Preferences(
				rs.getBoolean("notify_new_event"),
				rs.getBoolean("notify_promoted"),
				rs.getBoolean("notify_day_before"),
				rs.getBoolean("notify_mention"),
				rs.getBoolean("notify_hour_before"),
				rs.getBoolean("notify_comment"));
		return new OutboxItem(
				rs.getLong("id"),
				rs.getObject("user_id", UUID.class),
				rs.getString("kind"),
				rs.getInt("attempts"),
				rs.getObject("event_id", UUID.class),
				rs.getString("title"),
				instant(rs.getTimestamp("starts_at")),
				instant(rs.getTimestamp("ends_at")),
				rs.getString("place_name"),
				rs.getObject("poll_id", UUID.class),
				rs.getString("poll_title"),
				rs.getString("group_name"),
				rs.getString("comment_body"),
				rs.getString("comment_author"),
				rs.getBoolean("recipient_in_group"),
				preferences);
	}

	private static Instant instant(Timestamp timestamp) {
		return timestamp == null ? null : timestamp.toInstant();
	}

}
