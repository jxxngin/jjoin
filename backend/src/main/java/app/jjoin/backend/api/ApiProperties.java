package app.jjoin.backend.api;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 사용자 API 설정. (application.yaml의 jjoin.api.*)
 *
 * @param supabaseUrl Supabase 프로젝트 주소 (예: https://abcd.supabase.co). 비어 있으면 API를 열지 않는다.
 */
@ConfigurationProperties("jjoin.api")
public record ApiProperties(String supabaseUrl) {

	public boolean enabled() {
		return supabaseUrl != null && !supabaseUrl.isBlank();
	}

	/** 토큰의 iss와 같아야 한다. */
	public String issuer() {
		return supabaseUrl.replaceAll("/+$", "") + "/auth/v1";
	}

	/** 서명 검증용 공개 키 목록 (비밀값 없음) */
	public String jwksUri() {
		return issuer() + "/.well-known/jwks.json";
	}

}
