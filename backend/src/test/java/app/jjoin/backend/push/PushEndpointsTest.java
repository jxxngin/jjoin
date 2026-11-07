package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class PushEndpointsTest {

	@ParameterizedTest
	@ValueSource(strings = {
			"https://web.push.apple.com/QGuQ2x1",
			"https://fcm.googleapis.com/fcm/send/abc:def",
			"https://updates.push.services.mozilla.com/wpush/v2/gAAA",
			"https://wns2-par02p.notify.windows.com/w/?token=abc",
			"https://WEB.PUSH.APPLE.COM/upper",
			"https://web.push.apple.com:443/default-port" })
	void 브라우저_푸시_서버는_받는다(String endpoint) {
		assertThat(PushEndpoints.isAllowed(endpoint)).isTrue();
	}

	@ParameterizedTest
	@ValueSource(strings = {
			"http://web.push.apple.com/plain-http",
			"https://example.com/push",
			"https://localhost/push",
			"https://169.254.169.254/latest/meta-data",
			"https://web.push.apple.com.evil.com/x",
			"https://evilweb.push.apple.com/x",
			"https://notify.windows.com/no-subdomain",
			"https://user:pass@web.push.apple.com/x",
			"https://web.push.apple.com:8443/other-port",
			"not a url" })
	void 그_밖의_주소는_막는다(String endpoint) {
		assertThat(PushEndpoints.isAllowed(endpoint)).isFalse();
	}

}
