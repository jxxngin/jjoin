package app.jjoin.backend.jobs;

import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 문의 요약·정리에 쓰는 조회와 표시. (inquiries, client_errors, app_admins) */
@Repository
public class InquiryRepository {

	public record NewInquiry(UUID id, String category, String title) {
	}

	public record FixResult(UUID id, String autoFixStatus) {
	}

	private final JdbcClient jdbc;

	public InquiryRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** 아직 관리자에게 알리지 않은 문의 (오래된 순) */
	public List<NewInquiry> unnotified() {
		return jdbc.sql("select id, category, title from public.inquiries where notified_at is null order by created_at")
				.query((rs, row) -> new NewInquiry(rs.getObject("id", UUID.class), rs.getString("category"), rs.getString("title")))
				.list();
	}

	/** 아직 알리지 않은 자동 수정 결과 (수정안 준비·실패) */
	public List<FixResult> unnotifiedFixes() {
		return jdbc.sql("""
				select id, auto_fix_status from public.inquiries
				where auto_fix_status in ('pr_opened', 'failed') and autofix_notified_at is null
				""")
				.query((rs, row) -> new FixResult(rs.getObject("id", UUID.class), rs.getString("auto_fix_status")))
				.list();
	}

	public List<UUID> adminIds() {
		return jdbc.sql("select user_id from public.app_admins").query(UUID.class).list();
	}

	public int clientErrorsSince(Duration window) {
		return jdbc.sql("select count(*) from public.client_errors where created_at > now() - make_interval(secs => :seconds)")
				.param("seconds", (double) window.toSeconds())
				.query(Integer.class)
				.single();
	}

	public void markNotified(Collection<UUID> ids) {
		if (!ids.isEmpty()) {
			jdbc.sql("update public.inquiries set notified_at = now() where id = any(:ids)")
					.param("ids", ids.toArray(UUID[]::new)).update();
		}
	}

	public void markFixesNotified(Collection<UUID> ids) {
		if (!ids.isEmpty()) {
			jdbc.sql("update public.inquiries set autofix_notified_at = now() where id = any(:ids)")
					.param("ids", ids.toArray(UUID[]::new)).update();
		}
	}

	/** 처리 완료 후 오래 지난 문의의 기기 정보를 지운다. (개인정보) */
	public int forgetUserAgents(Duration after) {
		return jdbc.sql("""
				update public.inquiries set user_agent = null
				where status = 'done' and user_agent is not null and done_at < now() - make_interval(secs => :seconds)
				""")
				.param("seconds", (double) after.toSeconds())
				.update();
	}

	public int purgeClientErrors(Duration olderThan) {
		return jdbc.sql("delete from public.client_errors where created_at < now() - make_interval(secs => :seconds)")
				.param("seconds", (double) olderThan.toSeconds())
				.update();
	}

}
