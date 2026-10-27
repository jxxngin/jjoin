package app.jjoin.backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

// Supabase 토큰 중 로그인한 사용자 토큰만 받는지 (서명은 Nimbus가 JWKS로 확인한다)
class ApiSecurityTest {

	static final String ISSUER = new ApiProperties("https://abcd.supabase.co/").issuer();

	static Jwt.Builder token() {
		return Jwt.withTokenValue("t")
				.header("alg", "ES256")
				.issuer(ISSUER)
				.subject("11111111-1111-1111-1111-111111111111")
				.audience(List.of("authenticated"))
				.issuedAt(Instant.now().minusSeconds(10))
				.expiresAt(Instant.now().plusSeconds(3600));
	}

	static boolean accepted(Jwt jwt) {
		return !ApiSecurity.validator(ISSUER).validate(jwt).hasErrors();
	}

	@Test
	void 주소에서_발급처와_공개키_주소() {
		var properties = new ApiProperties("https://abcd.supabase.co/");
		assertThat(properties.issuer()).isEqualTo("https://abcd.supabase.co/auth/v1");
		assertThat(properties.jwksUri()).isEqualTo("https://abcd.supabase.co/auth/v1/.well-known/jwks.json");
		assertThat(new ApiProperties("").enabled()).isFalse();
	}

	@Test
	void 로그인한_사용자_토큰은_통과() {
		assertThat(accepted(token().build())).isTrue();
	}

	@Test
	void 만료_다른_발급처_익명_토큰은_거절() {
		assertThat(accepted(token().issuedAt(Instant.now().minusSeconds(7200)).expiresAt(Instant.now().minusSeconds(3600)).build())).isFalse();
		assertThat(accepted(token().issuer("https://other.supabase.co/auth/v1").build())).isFalse();
		assertThat(accepted(token().audience(List.of("anon")).build())).isFalse();
		assertThat(accepted(token().claims(claims -> claims.remove("sub")).build())).isFalse();
	}

}
