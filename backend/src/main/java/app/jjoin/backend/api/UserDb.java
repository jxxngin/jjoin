package app.jjoin.backend.api;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.function.Function;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 사용자 요청을 그 사용자의 권한으로 DB에서 처리한다. Supabase API(PostgREST)와 같은 방식이라
 * auth.uid()와 RLS 정책이 그대로 적용된다. 트랜잭션이 끝나면 다시 워커 계정 권한으로 돌아온다. (0034)
 */
@Component
public class UserDb {

	private final JdbcClient jdbc;
	private final TransactionTemplate transaction;

	public UserDb(JdbcClient jdbc, TransactionTemplate transaction) {
		this.jdbc = jdbc;
		this.transaction = transaction;
	}

	public <T> T as(Jwt user, Function<JdbcClient, T> work) {
		return transaction.execute(status -> {
			jdbc.sql("select set_config('request.jwt.claims', :claims, true)").param("claims", claims(user)).query(String.class).single();
			jdbc.sql("set local role authenticated").update();
			return work.apply(jdbc);
		});
	}

	/** 토큰에 적힌 내용 그대로 (PostgREST가 넣는 값과 같다) */
	static String claims(Jwt user) {
		String[] parts = user.getTokenValue().split("\\.");
		return new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
	}

}
