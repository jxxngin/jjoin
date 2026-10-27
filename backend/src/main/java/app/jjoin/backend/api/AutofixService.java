package app.jjoin.backend.api;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import app.jjoin.backend.push.DirectPushSender;
import app.jjoin.backend.push.PushMessage;

/**
 * 오류 신고 자동 수정(GitHub 작업)과 주고받는 일. 워커 계정 권한으로 돈다. (0035)
 * frontend/src/app/api/autofix/* 와 같은 규칙이다.
 */
@Service
public class AutofixService {

	private static final Logger log = LoggerFactory.getLogger(AutofixService.class);

	static final Set<String> RESULTS = Set.of("pr_opened", "failed", "skipped");
	static final String NOTICE = "말씀해 주신 내용을 반영한 업데이트가 배포됐어요. 앱을 새로 열면 바로 확인할 수 있어요. 알려 주셔서 고마워요! 🙏";

	private final JdbcClient jdbc;
	private final TransactionTemplate transaction;
	private final DirectPushSender push;
	private final Executor background;

	public AutofixService(JdbcClient jdbc, TransactionTemplate transaction, DirectPushSender push, Executor apiBackground) {
		this.jdbc = jdbc;
		this.transaction = transaction;
		this.push = push;
		this.background = apiBackground;
	}

	/** 오류 신고 내용. 작성자 정보는 넘기지 않는다. (코드 수정에 필요 없는 개인정보) 오류 신고가 아니면 빈 값. */
	public Optional<Map<String, Object>> bugReport(UUID id) {
		return jdbc.sql("""
				select id, category, title, body, page_path, user_agent, created_at
				from public.inquiries where id = :id and category = 'bug'
				""")
				.param("id", id)
				.query((rs, row) -> {
					var report = new LinkedHashMap<String, Object>();
					report.put("id", rs.getObject("id", UUID.class));
					report.put("category", rs.getString("category"));
					report.put("title", rs.getString("title"));
					report.put("body", rs.getString("body"));
					report.put("page_path", rs.getString("page_path"));
					report.put("user_agent", rs.getString("user_agent"));
					report.put("created_at", rs.getObject("created_at", OffsetDateTime.class));
					return (Map<String, Object>) report;
				})
				.optional();
	}

	/** 작업 결과: 수정안(PR) 주소, 실패, 대상 아님. 잘못된 값이면 false */
	public boolean report(String inquiryId, String status, String url) {
		var id = uuid(inquiryId);
		if (id.isEmpty() || !RESULTS.contains(String.valueOf(status))) {
			return false;
		}
		String link = url != null && url.startsWith("https://github.com/") ? url.substring(0, Math.min(url.length(), 300)) : null;
		jdbc.sql("update public.inquiries set auto_fix_status = :status, auto_fix_url = :url where id = :id")
				.param("status", status)
				.param("url", link)
				.param("id", id.get())
				.update();
		return true;
	}

	/**
	 * 운영 배포가 끝났을 때: 커밋에 적힌 문의(와 같은 문의로 묶인 문의)를 처리 완료로 바꾸고, 대화에 배포 안내를 남기고(알림 목록에도 남는다),
	 * 문의한 사람에게 푸시한다. 문의마다 한 번만. (deployed_at) 처리한 문의 수를 돌려준다.
	 */
	public int deployed(List<?> rawIds) {
		var ids = rawIds == null ? new UUID[0]
				: rawIds.stream().map(String::valueOf).map(AutofixService::uuid).flatMap(Optional::stream).distinct().limit(50).toArray(UUID[]::new);
		if (ids.length == 0) {
			return 0;
		}
		record Target(UUID id, String title, UUID userId) {
		}
		var targets = transaction.execute(status -> {
			var found = jdbc.sql("""
					select id, title, user_id from public.inquiries
					where (id = any(:ids) or duplicate_of = any(:ids)) and deployed_at is null
					for update
					""")
					.param("ids", ids)
					.query((rs, row) -> new Target(rs.getObject("id", UUID.class), rs.getString("title"), rs.getObject("user_id", UUID.class)))
					.list();
			for (var target : found) {
				jdbc.sql("update public.inquiries set status = 'done', deployed_at = now() where id = :id").param("id", target.id()).update();
				jdbc.sql("insert into public.inquiry_messages (inquiry_id, user_id, is_admin, body) values (:id, null, true, :body)")
						.param("id", target.id())
						.param("body", NOTICE)
						.update();
			}
			return found;
		});

		background.execute(() -> {
			for (var target : targets) {
				if (target.userId() == null) {
					continue;
				}
				try {
					push.sendToUser(target.userId(), new PushMessage("문의하신 내용이 반영됐어요", target.title(), "/support/" + target.id()));
				} catch (RuntimeException e) {
					log.warn("배포 안내 푸시를 보내지 못했어요: {}", e.toString());
				}
			}
		});
		return targets.size();
	}

	static Optional<UUID> uuid(String value) {
		try {
			return value != null && value.length() == 36 ? Optional.of(UUID.fromString(value)) : Optional.empty();
		} catch (IllegalArgumentException e) {
			return Optional.empty();
		}
	}

}
