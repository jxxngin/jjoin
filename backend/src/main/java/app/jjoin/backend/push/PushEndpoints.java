package app.jjoin.backend.push;

import java.net.URI;
import java.util.Locale;
import java.util.Set;

/**
 * 웹 푸시 구독 주소(endpoint)가 실제 브라우저 푸시 서버인지. (frontend/src/lib/push-endpoint.ts와 같은 목록)
 * 워커는 이 주소로 직접 요청을 보내므로, 아무 HTTPS 주소나 보내면 서버가 사설망 등 원하는 곳으로 요청을 보내게 된다(SSRF).
 */
final class PushEndpoints {

	// Chrome·Android(FCM, 예전 GCM), Firefox, Safari(Apple), Edge(WNS)
	private static final Set<String> EXACT_HOSTS = Set.of(
			"fcm.googleapis.com",
			"android.googleapis.com",
			"updates.push.services.mozilla.com",
			"web.push.apple.com");
	private static final String WNS_SUFFIX = ".notify.windows.com";

	private PushEndpoints() {
	}

	static boolean isAllowed(String endpoint) {
		if (endpoint == null || endpoint.length() > 2000) {
			return false;
		}
		URI uri;
		try {
			uri = new URI(endpoint);
		} catch (Exception e) {
			return false;
		}
		// https만, 사용자 정보(user:pass@)나 다른 포트는 받지 않는다.
		if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getRawUserInfo() != null
				|| (uri.getPort() != -1 && uri.getPort() != 443) || uri.getHost() == null) {
			return false;
		}
		var host = uri.getHost().toLowerCase(Locale.ROOT);
		return EXACT_HOSTS.contains(host) || (host.endsWith(WNS_SUFFIX) && host.length() > WNS_SUFFIX.length());
	}

}
