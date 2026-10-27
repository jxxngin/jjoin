package app.jjoin.backend.api;

import static org.springframework.security.config.Customizer.withDefaults;

import java.util.List;

import jakarta.servlet.DispatcherType;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;

/**
 * /api/** 는 Supabase 로그인 토큰이 있어야 한다. 서명(ES256, 공개 JWKS)·만료·발급처·대상(authenticated)을 확인한다.
 * 상태 확인(/actuator)은 서버 안에서만 열려 있고(Caddy가 막는다), 그 밖의 주소는 모두 막는다.
 */
@Configuration
public class ApiSecurity {

	@Bean
	SecurityFilterChain apiChain(HttpSecurity http, ObjectProvider<JwtDecoder> decoder) throws Exception {
		http.csrf(csrf -> csrf.disable())
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.authorizeHttpRequests(requests -> requests
						.requestMatchers("/actuator/**").permitAll()
						// 잘못된 요청(400 등)이 오류 응답으로 넘어갈 때 403으로 바뀌지 않게
						.dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
						.requestMatchers("/api/**").authenticated()
						.anyRequest().denyAll());
		if (decoder.getIfAvailable() != null) {
			http.oauth2ResourceServer(server -> server.jwt(withDefaults()));
		}
		return http.build();
	}

	@Bean
	@ConditionalOnExpression("'${jjoin.api.supabase-url:}' != ''")
	JwtDecoder jwtDecoder(ApiProperties properties) {
		var decoder = NimbusJwtDecoder.withJwkSetUri(properties.jwksUri()).jwsAlgorithm(SignatureAlgorithm.ES256).build();
		decoder.setJwtValidator(validator(properties.issuer()));
		return decoder;
	}

	/** 만료·발급처에 더해, 로그인한 사용자 토큰(aud = authenticated)만 받는다. (anon 키 같은 토큰은 거절) */
	static OAuth2TokenValidator<Jwt> validator(String issuer) {
		OAuth2TokenValidator<Jwt> audience = jwt -> {
			List<String> aud = jwt.getAudience();
			return aud != null && aud.contains("authenticated") && jwt.getSubject() != null
					? OAuth2TokenValidatorResult.success()
					: OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "로그인한 사용자 토큰이 아니에요", null));
		};
		return new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefaultWithIssuer(issuer), audience);
	}

}
