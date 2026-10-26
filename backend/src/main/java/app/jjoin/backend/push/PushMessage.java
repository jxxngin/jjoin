package app.jjoin.backend.push;

import java.util.Optional;

/**
 * 휴대폰에 뜨는 알림 한 장. 서비스 워커(public/sw.js)가 title·body를 보여 주고, 누르면 url로 간다.
 */
public record PushMessage(String title, String body, String url) {

	private static final int SNIPPET = 80;

	/**
	 * 대기열 한 건을 알림 문구로 바꾼다. (src/lib/push.ts의 payloadFor와 같은 문구)
	 * 받는 사람이 그 종류의 알림을 꺼 두었거나 약속이 지워졌으면 비어 있다.
	 */
	public static Optional<PushMessage> from(OutboxItem item) {
		if (item.eventId() == null || item.preferences() == null || !wants(item)) {
			return Optional.empty();
		}
		var when = KstFormat.eventPeriod(item.startsAt(), item.endsAt());
		var where = item.placeName() == null ? "" : " · " + item.placeName();
		var url = "/events/" + item.eventId();
		var title = item.eventTitle();
		var author = item.commentAuthor() == null ? "누군가" : item.commentAuthor();
		var comment = snippet(item.commentBody());

		return Optional.of(switch (item.kind()) {
			case "new_event" -> new PushMessage(item.groupName() + "에 새 약속", title + " · " + when, url);
			case "promoted" -> new PushMessage("대기에서 참여로 바뀌었어요", title + " · " + when, url);
			case "mention" -> new PushMessage(author + "님이 회원님을 언급했어요", title + " · " + comment, url);
			case "comment" -> new PushMessage(title + "에 새 댓글", author + ": " + comment, url);
			case "hour_before" -> new PushMessage("1시간 뒤 약속이 있어요", title + " · " + when + where, url);
			default -> new PushMessage("내일 약속이 있어요", title + " · " + when + where, url);
		});
	}

	private static boolean wants(OutboxItem item) {
		var p = item.preferences();
		return switch (item.kind()) {
			case "new_event" -> p.newEvent();
			case "promoted" -> p.promoted();
			case "mention" -> p.mention();
			case "hour_before" -> p.hourBefore();
			case "comment" -> p.comment();
			default -> p.dayBefore();
		};
	}

	// 댓글은 앞 80자만 (이모지가 반으로 잘리지 않게 글자 단위로 자른다)
	private static String snippet(String body) {
		if (body == null) {
			return "";
		}
		return body.codePointCount(0, body.length()) <= SNIPPET ? body : body.substring(0, body.offsetByCodePoints(0, SNIPPET));
	}

	/** 서비스 워커가 읽는 JSON. */
	public String toJson() {
		return "{\"title\":" + quote(title) + ",\"body\":" + quote(body) + ",\"url\":" + quote(url) + "}";
	}

	private static String quote(String value) {
		var out = new StringBuilder("\"");
		for (char c : value.toCharArray()) {
			switch (c) {
				case '"' -> out.append("\\\"");
				case '\\' -> out.append("\\\\");
				case '\n' -> out.append("\\n");
				case '\r' -> out.append("\\r");
				case '\t' -> out.append("\\t");
				default -> {
					if (c < 0x20) {
						out.append(String.format("\\u%04x", (int) c));
					} else {
						out.append(c);
					}
				}
			}
		}
		return out.append('"').toString();
	}

}
