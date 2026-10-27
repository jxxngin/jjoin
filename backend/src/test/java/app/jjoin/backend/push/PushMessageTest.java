package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

// 알림 문구가 Next(frontend/src/lib/push.ts)와 같은지, 꺼 둔 알림은 만들지 않는지
class PushMessageTest {

	private static final UUID EVENT = UUID.fromString("11111111-1111-1111-1111-111111111111");
	private static final OutboxItem.Preferences ALL_ON = new OutboxItem.Preferences(true, true, true, true, true, true);

	private static OutboxItem item(String kind, OutboxItem.Preferences preferences, String comment) {
		return new OutboxItem(1, UUID.randomUUID(), kind, 1, EVENT, "연말 송년회",
				Instant.parse("2026-10-30T10:00:00Z"), null, "을지로", "대학 동기",
				comment, comment == null ? null : "민수", preferences);
	}

	@Test
	void 새_약속() {
		var message = PushMessage.from(item("new_event", ALL_ON, null)).orElseThrow();
		assertThat(message.title()).isEqualTo("대학 동기에 새 약속");
		assertThat(message.body()).isEqualTo("연말 송년회 · 10월 30일 (금) 오후 7:00");
		assertThat(message.url()).isEqualTo("/events/" + EVENT);
	}

	@Test
	void 하루_전과_1시간_전에는_장소도() {
		assertThat(PushMessage.from(item("day_before", ALL_ON, null)).orElseThrow().body())
				.isEqualTo("연말 송년회 · 10월 30일 (금) 오후 7:00 · 을지로");
		assertThat(PushMessage.from(item("hour_before", ALL_ON, null)).orElseThrow().title())
				.isEqualTo("1시간 뒤 약속이 있어요");
	}

	@Test
	void 댓글과_언급() {
		assertThat(PushMessage.from(item("comment", ALL_ON, "몇 시까지 가능해?")).orElseThrow())
				.isEqualTo(new PushMessage("연말 송년회에 새 댓글", "민수: 몇 시까지 가능해?", "/events/" + EVENT));
		assertThat(PushMessage.from(item("mention", ALL_ON, "@지원 같이 가자")).orElseThrow().title())
				.isEqualTo("민수님이 회원님을 언급했어요");
	}

	@Test
	void 꺼_둔_종류는_보내지_않는다() {
		var commentOff = new OutboxItem.Preferences(true, true, true, true, true, false);
		assertThat(PushMessage.from(item("comment", commentOff, "안녕"))).isEmpty();
		assertThat(PushMessage.from(item("new_event", commentOff, null))).isPresent();
	}

	@Test
	void 약속이_지워졌거나_프로필이_없으면_보내지_않는다() {
		var deleted = new OutboxItem(1, UUID.randomUUID(), "new_event", 1, null, null, null, null, null, null, null, null, ALL_ON);
		assertThat(PushMessage.from(deleted)).isEmpty();
		assertThat(PushMessage.from(item("new_event", null, null))).isEmpty();
	}

	@Test
	void 긴_댓글은_80글자에서_이모지를_깨지_않고_자른다() {
		var body = "😀".repeat(100);
		var message = PushMessage.from(item("comment", ALL_ON, body)).orElseThrow();
		assertThat(message.body()).isEqualTo("민수: " + "😀".repeat(80));
	}

	@Test
	void JSON_따옴표와_줄바꿈을_이스케이프() {
		var json = new PushMessage("a\"b", "줄\n바꿈\\", "/x").toJson();
		assertThat(json).isEqualTo("{\"title\":\"a\\\"b\",\"body\":\"줄\\n바꿈\\\\\",\"url\":\"/x\"}");
	}

}
