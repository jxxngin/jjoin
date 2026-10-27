package app.jjoin.backend.jobs;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import app.jjoin.backend.push.PushMessage;

/**
 * 관리자 휴대폰에 가는 문의 1시간 요약 문구. (frontend/src/app/api/cron/inquiry-digest/route.ts와 같은 문구)
 * 첫 줄은 알림 제목, 나머지는 " · "로 이어 본문 140자까지.
 */
public final class InquiryDigestMessage {

	private static final Map<String, String> LABELS = Map.of(
			"bug", "🐞 오류", "feature", "💡 제안", "usage", "❓ 이용", "account", "👤 계정", "other", "💬 기타");
	private static final int BODY_LIMIT = 140;

	private InquiryDigestMessage() {
	}

	/** 알릴 것이 하나도 없으면 비어 있다. */
	public static Optional<PushMessage> build(List<InquiryRepository.NewInquiry> fresh,
			List<InquiryRepository.FixResult> fixes, int clientErrors) {
		if (fresh.isEmpty() && fixes.isEmpty() && clientErrors == 0) {
			return Optional.empty();
		}
		var counts = new LinkedHashMap<String, Integer>();
		fresh.forEach(inquiry -> counts.merge(inquiry.category(), 1, Integer::sum));
		long opened = fixes.stream().filter(fix -> "pr_opened".equals(fix.autoFixStatus())).count();
		long failed = fixes.size() - opened;

		var lines = new ArrayList<String>();
		lines.add(fresh.isEmpty() ? "📮 jjoin 문의 소식" : "📮 jjoin 새 문의 " + fresh.size() + "건");
		if (!fresh.isEmpty()) {
			lines.add(counts.entrySet().stream()
					.map(entry -> LABELS.getOrDefault(entry.getKey(), entry.getKey()) + " " + entry.getValue())
					.collect(Collectors.joining(" · ")));
		}
		if (opened > 0) {
			lines.add("🤖 수정안 준비 " + opened + "건 (확인 후 Merge)");
		}
		if (failed > 0) {
			lines.add("⚠️ 자동 수정 실패 " + failed + "건");
		}
		if (clientErrors > 0) {
			lines.add("🧯 화면 오류 " + clientErrors + "건");
		}
		fresh.stream().limit(3).forEach(inquiry -> lines.add("· " + inquiry.title()));

		var body = String.join(" · ", lines.subList(1, lines.size()));
		if (body.codePointCount(0, body.length()) > BODY_LIMIT) {
			body = body.substring(0, body.offsetByCodePoints(0, BODY_LIMIT));
		}
		return Optional.of(new PushMessage(lines.getFirst(), body.isEmpty() ? "관리자 화면에서 확인해 주세요." : body, "/support/admin"));
	}

}
