package app.jjoin.backend.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 자동 수정 연동 설정. (application.yaml의 jjoin.autofix.*)
 *
 * @param secret GitHub 작업과 나눠 가진 값 (AUTOFIX_SECRET). 비어 있으면 /api/autofix는 모두 401.
 */
@ConfigurationProperties("jjoin.autofix")
public record AutofixProperties(String secret) {

	/** Authorization: Bearer <secret> 인지 (걸린 시간으로 값을 짐작할 수 없게 비교) */
	public boolean accepts(String authorization) {
		if (secret == null || secret.isBlank() || authorization == null) {
			return false;
		}
		return MessageDigest.isEqual(("Bearer " + secret).getBytes(StandardCharsets.UTF_8),
				authorization.getBytes(StandardCharsets.UTF_8));
	}

}
