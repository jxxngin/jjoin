package app.jjoin.backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import app.jjoin.backend.SupabaseIT;
import app.jjoin.backend.jobs.InquiryRepository;
import app.jjoin.backend.push.DirectPushSender;
import app.jjoin.backend.push.PushMessage;

// 실제 마이그레이션의 RLS가 워커 계정 + 사용자 권한 전환(0034)으로 그대로 적용되는지
class InquiryApiIT extends SupabaseIT {

	static InquiryService service;
	static final List<Map.Entry<UUID, PushMessage>> pushed = new ArrayList<>();

	UUID asker;
	UUID other;
	UUID admin;
	UUID inquiry;

	@BeforeAll
	static void wire() {
		var sender = new DirectPushSender(null, null) {
			@Override
			public int sendToUser(UUID userId, PushMessage message) {
				pushed.add(Map.entry(userId, message));
				return 1;
			}
		};
		service = new InquiryService(new UserDb(jdbc, transaction), new InquiryRepository(jdbc), sender, Runnable::run);
	}

	@BeforeEach
	void data() {
		owner.sql("truncate auth.users, public.app_admins, public.inquiries cascade").update();
		pushed.clear();
		asker = signUp("지원");
		other = signUp("민수");
		admin = signUp("관리자");
		owner.sql("insert into public.app_admins (user_id) values (:id)").param("id", admin).update();
		inquiry = owner.sql("""
				insert into public.inquiries (user_id, category, title, body, images)
				values (:user, 'bug', '저장이 안 돼요', '버튼을 눌러도 그대로예요', '{a/1.jpg}') returning id
				""").param("user", asker).query(UUID.class).single();
	}

	@Test
	void 내_문의만_보이고_남의_문의는_안_보인다() {
		var mine = service.list(token(asker), true, null);
		assertThat(mine).extracting(InquiryService.Inquiry::title).containsExactly("저장이 안 돼요");
		assertThat(mine.getFirst().author().nickname()).isEqualTo("지원");
		assertThat(mine.getFirst().images()).containsExactly("a/1.jpg");

		assertThat(service.list(token(other), true, null)).isEmpty();
		assertThat(service.list(token(other), false, null)).isEmpty();
		assertThat(service.get(token(other), inquiry)).isEmpty();
	}

	@Test
	void 관리자는_전체를_상태별로_본다() {
		assertThat(service.list(token(admin), false, null)).hasSize(1);
		assertThat(service.list(token(admin), false, "received")).hasSize(1);
		assertThat(service.list(token(admin), false, "done")).isEmpty();
		assertThatThrownBy(() -> service.list(token(admin), false, "엉뚱함"))
				.isInstanceOf(InquiryService.ApiError.class);
	}

	@Test
	void 대화_글은_관리자_여부를_DB가_정하고_상대에게_푸시() {
		service.postMessage(token(asker), inquiry, "  언제 고쳐지나요  ");
		assertThat(pushed).extracting(Map.Entry::getKey).containsExactly(admin);
		assertThat(pushed.getFirst().getValue().title()).isEqualTo("💬 문의에 새 글");

		pushed.clear();
		service.postMessage(token(admin), inquiry, "확인하고 있어요");
		assertThat(pushed).extracting(Map.Entry::getKey).containsExactly(asker);
		assertThat(pushed.getFirst().getValue().url()).isEqualTo("/support/" + inquiry);

		var messages = service.get(token(asker), inquiry).orElseThrow().messages();
		assertThat(messages).extracting(InquiryService.Message::body).containsExactly("언제 고쳐지나요", "확인하고 있어요");
		assertThat(messages).extracting(InquiryService.Message::isAdmin).containsExactly(false, true);
		// 관리자 답변은 문의한 사람의 알림 목록에도 남는다 (0028 트리거)
		assertThat(owner.sql("select count(*) from public.notifications where user_id = :id and kind = 'inquiry_reply'")
				.param("id", asker).query(Integer.class).single()).isEqualTo(1);
	}

	@Test
	void 남의_문의에는_글을_못_남긴다() {
		assertThatThrownBy(() -> service.postMessage(token(other), inquiry, "끼어들기"))
				.isInstanceOfSatisfying(InquiryService.ApiError.class, e -> assertThat(e.status()).isEqualTo(404));
		assertThatThrownBy(() -> service.postMessage(token(asker), inquiry, "   "))
				.isInstanceOfSatisfying(InquiryService.ApiError.class, e -> assertThat(e.status()).isEqualTo(400));
		assertThat(pushed).isEmpty();
	}

	@Test
	void 하루_20개가_넘으면_429() {
		for (int i = 0; i < 20; i++) {
			service.postMessage(token(asker), inquiry, "글 " + i);
		}
		assertThatThrownBy(() -> service.postMessage(token(asker), inquiry, "한 번 더"))
				.isInstanceOfSatisfying(InquiryService.ApiError.class, e -> assertThat(e.status()).isEqualTo(429));
	}

	@Test
	void 상태_변경은_관리자만_묶인_문의도_함께() {
		var duplicate = owner.sql("""
				insert into public.inquiries (user_id, category, title, body, duplicate_of)
				values (:user, 'bug', '저도 저장이 안 돼요', '같은 문제', :root) returning id
				""").param("user", other).param("root", inquiry).query(UUID.class).single();

		assertThatThrownBy(() -> service.update(token(asker), inquiry, "done", "normal"))
				.isInstanceOfSatisfying(InquiryService.ApiError.class, e -> assertThat(e.status()).isEqualTo(403));

		service.update(token(admin), inquiry, "done", "urgent");
		var statuses = owner.sql("select id, status, priority, done_at is not null as done from public.inquiries")
				.query((rs, row) -> rs.getObject("id", UUID.class) + " " + rs.getString("status") + " " + rs.getString("priority") + " " + rs.getBoolean("done"))
				.list();
		assertThat(statuses).containsExactlyInAnyOrder(inquiry + " done urgent true", duplicate + " done normal true");
	}

	@Test
	void 관리자_답변은_묶인_문의에도_남고_각자에게_푸시() {
		var duplicate = owner.sql("""
				insert into public.inquiries (user_id, category, title, body, duplicate_of)
				values (:user, 'bug', '저도 저장이 안 돼요', '같은 문제', :root) returning id
				""").param("user", other).param("root", inquiry).query(UUID.class).single();

		service.postMessage(token(admin), inquiry, "고쳤어요");

		assertThat(service.get(token(other), duplicate).orElseThrow().messages())
				.extracting(InquiryService.Message::body).containsExactly("고쳤어요");
		assertThat(pushed).extracting(Map.Entry::getKey).containsExactlyInAnyOrder(asker, other);
	}

	@Test
	void 요청이_끝나면_워커_권한으로_돌아온다() {
		service.list(token(asker), true, null);
		assertThat(jdbc.sql("select current_user").query(String.class).single()).isEqualTo("jjoin_worker");
	}

}
