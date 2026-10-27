package app.jjoin.backend.api;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import app.jjoin.backend.jobs.InquiryRepository;
import app.jjoin.backend.push.DirectPushSender;
import app.jjoin.backend.push.PushMessage;

/**
 * 문의 조회·대화·상태 변경. 모든 SQL은 요청한 사용자의 권한(RLS)으로 돈다. (frontend/src/lib/inquiries.ts, support/actions.ts와 같은 규칙)
 * 알림 푸시만 워커 권한으로 보낸다.
 */
@Service
public class InquiryService {

	private static final Logger log = LoggerFactory.getLogger(InquiryService.class);

	public record Person(UUID id, String nickname) {
	}

	public record Message(UUID id, String body, boolean isAdmin, OffsetDateTime createdAt, Person author) {
	}

	public record Inquiry(
			UUID id,
			String category,
			String title,
			String body,
			String pagePath,
			String userAgent,
			String status,
			String priority,
			OffsetDateTime createdAt,
			String autoFixStatus,
			String autoFixUrl,
			UUID duplicateOf,
			List<String> images,
			Person author,
			List<Message> messages) {
	}

	/** 사용자에게 그대로 보여 줄 수 있는 실패 */
	public static class ApiError extends RuntimeException {

		private final int status;

		public ApiError(int status, String message) {
			super(message);
			this.status = status;
		}

		public int status() {
			return status;
		}

	}

	public static final Set<String> STATUSES = Set.of("received", "in_progress", "on_hold", "done");
	public static final Set<String> PRIORITIES = Set.of("urgent", "normal");

	private static final String COLUMNS = """
			select i.id, i.category, i.title, i.body, i.page_path, i.user_agent, i.status, i.priority, i.created_at,
			  i.auto_fix_status, i.auto_fix_url, i.duplicate_of, i.images, i.user_id, p.nickname
			from public.inquiries i
			left join public.profiles p on p.id = i.user_id
			""";

	private final UserDb db;
	private final InquiryRepository inquiries;
	private final DirectPushSender push;
	private final Executor background;

	public InquiryService(UserDb db, InquiryRepository inquiries, DirectPushSender push, Executor apiBackground) {
		this.db = db;
		this.inquiries = inquiries;
		this.push = push;
		this.background = apiBackground;
	}

	/** mine이면 내 문의만, 아니면 볼 수 있는 문의 전체 (관리자). 최신 순 200건. */
	public List<Inquiry> list(Jwt user, boolean mine, String status) {
		if (status != null && !STATUSES.contains(status)) {
			throw new ApiError(400, "상태를 다시 골라 주세요.");
		}
		return db.as(user, jdbc -> withMessages(jdbc, jdbc.sql(COLUMNS + """
				where (not :mine or i.user_id = (select auth.uid()))
				  and (cast(:status as text) is null or i.status = :status)
				order by i.created_at desc
				limit 200
				""")
				.param("mine", mine)
				.param("status", status)
				.query(InquiryService::inquiry)
				.list()));
	}

	/** 본인이나 관리자가 아니면 RLS 때문에 빈 값 */
	public Optional<Inquiry> get(Jwt user, UUID id) {
		return db.as(user, jdbc -> withMessages(jdbc, jdbc.sql(COLUMNS + "where i.id = :id")
				.param("id", id)
				.query(InquiryService::inquiry)
				.list()))
				.stream()
				.findFirst();
	}

	/**
	 * 문의 대화에 글을 남긴다. 관리자 글은 같은 문의로 묶인 문의들에도 똑같이 남기고 문의한 사람들에게, 문의한 사람의 글은 관리자들에게 푸시한다.
	 */
	public void postMessage(Jwt user, UUID inquiryId, String rawBody) {
		String text = rawBody == null ? "" : rawBody.strip();
		if (text.isEmpty()) {
			throw new ApiError(400, "내용을 입력해 주세요.");
		}
		if (text.codePointCount(0, text.length()) > 2000) {
			throw new ApiError(400, "2000자까지 쓸 수 있어요.");
		}
		record Target(UUID id, String title, UUID userId) {
		}
		record Posted(boolean admin, UUID me, List<Target> targets) {
		}
		Posted posted;
		try {
			posted = db.as(user, jdbc -> {
				boolean admin = Boolean.TRUE.equals(jdbc.sql("select public.is_app_admin()").query(Boolean.class).single());
				var targets = new ArrayList<Target>();
				jdbc.sql("select id, title, user_id from public.inquiries where id = :id")
						.param("id", inquiryId)
						.query((rs, row) -> new Target(rs.getObject("id", UUID.class), rs.getString("title"), rs.getObject("user_id", UUID.class)))
						.optional()
						.ifPresent(targets::add);
				if (targets.isEmpty()) {
					throw new ApiError(404, "문의를 찾지 못했어요.");
				}
				if (admin) {
					targets.addAll(jdbc.sql("select id, title, user_id from public.inquiries where duplicate_of = :id")
							.param("id", inquiryId)
							.query((rs, row) -> new Target(rs.getObject("id", UUID.class), rs.getString("title"), rs.getObject("user_id", UUID.class)))
							.list());
				}
				for (var target : targets) {
					jdbc.sql("insert into public.inquiry_messages (inquiry_id, body) values (:id, :body)")
							.param("id", target.id())
							.param("body", text)
							.update();
				}
				return new Posted(admin, UUID.fromString(user.getSubject()), targets);
			});
		} catch (DataAccessException e) {
			if (String.valueOf(e.getMessage()).contains("too many messages")) {
				throw new ApiError(429, "하루에 20개까지 남길 수 있어요.");
			}
			throw e;
		}

		background.execute(() -> {
			try {
				if (posted.admin()) {
					for (var target : posted.targets()) {
						if (target.userId() != null && !target.userId().equals(posted.me())) {
							push.sendToUser(target.userId(), new PushMessage("문의에 답변이 왔어요", target.title(), "/support/" + target.id()));
						}
					}
				} else {
					var inquiry = posted.targets().getFirst();
					for (var admin : inquiries.adminIds()) {
						push.sendToUser(admin, new PushMessage("💬 문의에 새 글", inquiry.title(), "/support/" + inquiry.id()));
					}
				}
			} catch (RuntimeException e) {
				log.warn("문의 대화 알림을 보내지 못했어요: {}", e.toString());
			}
		});
	}

	/** 관리자: 상태와 우선순위를 바꾼다. 같은 문의로 묶인 문의들도 같은 상태로. */
	public void update(Jwt user, UUID id, String status, String priority) {
		if (!STATUSES.contains(String.valueOf(status)) || !PRIORITIES.contains(String.valueOf(priority))) {
			throw new ApiError(400, "상태를 다시 골라 주세요.");
		}
		db.as(user, jdbc -> {
			int changed = jdbc.sql("update public.inquiries set status = :status, priority = :priority where id = :id")
					.param("status", status)
					.param("priority", priority)
					.param("id", id)
					.update();
			// 관리자가 아니면 RLS 때문에 바뀐 행이 없다.
			if (changed == 0) {
				throw new ApiError(403, "저장하지 못했어요.");
			}
			jdbc.sql("update public.inquiries set status = :status where duplicate_of = :id")
					.param("status", status)
					.param("id", id)
					.update();
			return null;
		});
	}

	private static List<Inquiry> withMessages(JdbcClient jdbc, List<Inquiry> found) {
		if (found.isEmpty()) {
			return found;
		}
		var byId = new LinkedHashMap<UUID, List<Message>>();
		found.forEach(inquiry -> byId.put(inquiry.id(), new ArrayList<>()));
		jdbc.sql("""
				select m.id, m.inquiry_id, m.body, m.is_admin, m.created_at, m.user_id, p.nickname
				from public.inquiry_messages m
				left join public.profiles p on p.id = m.user_id
				where m.inquiry_id = any(:ids)
				order by m.created_at, m.id
				""")
				.param("ids", byId.keySet().toArray(UUID[]::new))
				.query((rs, row) -> Map.entry(rs.getObject("inquiry_id", UUID.class), new Message(
						rs.getObject("id", UUID.class),
						rs.getString("body"),
						rs.getBoolean("is_admin"),
						rs.getObject("created_at", OffsetDateTime.class),
						person(rs))))
				.list()
				.forEach(entry -> byId.get(entry.getKey()).add(entry.getValue()));
		return found.stream()
				.map(i -> new Inquiry(i.id(), i.category(), i.title(), i.body(), i.pagePath(), i.userAgent(), i.status(),
						i.priority(), i.createdAt(), i.autoFixStatus(), i.autoFixUrl(), i.duplicateOf(), i.images(), i.author(),
						List.copyOf(byId.get(i.id()))))
				.toList();
	}

	private static Inquiry inquiry(ResultSet rs, int row) throws SQLException {
		var images = rs.getArray("images");
		return new Inquiry(
				rs.getObject("id", UUID.class),
				rs.getString("category"),
				rs.getString("title"),
				rs.getString("body"),
				rs.getString("page_path"),
				rs.getString("user_agent"),
				rs.getString("status"),
				rs.getString("priority"),
				rs.getObject("created_at", OffsetDateTime.class),
				rs.getString("auto_fix_status"),
				rs.getString("auto_fix_url"),
				rs.getObject("duplicate_of", UUID.class),
				images == null ? List.of() : Arrays.asList((String[]) images.getArray()),
				person(rs),
				List.of());
	}

	/** 탈퇴했거나 RLS로 프로필을 볼 수 없으면 null (Supabase API와 같다) */
	private static Person person(ResultSet rs) throws SQLException {
		var id = rs.getObject("user_id", UUID.class);
		var nickname = rs.getString("nickname");
		return id == null || nickname == null ? null : new Person(id, nickname);
	}

}
