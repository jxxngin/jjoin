package app.jjoin.backend.push;

import java.time.Instant;
import java.util.UUID;

/**
 * 보낼 알림 한 건과 문구를 만드는 데 필요한 정보. (notification_outbox + 약속·투표·그룹·댓글·받는 사람 설정)
 * 약속 알림이면 event 칸이, 투표 댓글 알림(언급·새 댓글)이면 poll 칸이 차 있다. (0036)
 * 약속·투표나 댓글이 그사이 지워졌으면 해당 칸이 null이다.
 */
public record OutboxItem(
		long id,
		UUID userId,
		String kind,
		int attempts,
		UUID eventId,
		String eventTitle,
		Instant startsAt,
		Instant endsAt,
		String placeName,
		UUID pollId,
		String pollTitle,
		String groupName,
		String commentBody,
		String commentAuthor,
		Preferences preferences) {

	/** 받는 사람의 종류별 알림 받기 설정. 프로필이 없으면 null. */
	public record Preferences(
			boolean newEvent,
			boolean promoted,
			boolean dayBefore,
			boolean mention,
			boolean hourBefore,
			boolean comment) {
	}

}
