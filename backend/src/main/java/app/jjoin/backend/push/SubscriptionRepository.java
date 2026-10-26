package app.jjoin.backend.push;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 사람마다 알림을 켠 기기(브라우저) 목록. (public.push_subscriptions) */
@Repository
public class SubscriptionRepository {

	public record Subscription(String endpoint, UUID userId, String p256dh, String auth) {
	}

	private final JdbcClient jdbc;

	public SubscriptionRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	public List<Subscription> findByUserIds(Collection<UUID> userIds) {
		if (userIds.isEmpty()) {
			return List.of();
		}
		return jdbc.sql("select endpoint, user_id, p256dh, auth from public.push_subscriptions where user_id = any(:ids)")
				.param("ids", userIds.toArray(UUID[]::new))
				.query((rs, row) -> new Subscription(
						rs.getString("endpoint"),
						rs.getObject("user_id", UUID.class),
						rs.getString("p256dh"),
						rs.getString("auth")))
				.list();
	}

	/** 브라우저가 "이 구독은 없어졌다"(404·410)고 답한 기기를 지운다. */
	public void deleteByEndpoints(Collection<String> endpoints) {
		if (endpoints.isEmpty()) {
			return;
		}
		jdbc.sql("delete from public.push_subscriptions where endpoint = any(:endpoints)")
				.param("endpoints", endpoints.toArray(String[]::new))
				.update();
	}

}
