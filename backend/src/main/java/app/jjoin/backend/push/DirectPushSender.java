package app.jjoin.backend.push;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;

/**
 * 대기열을 거치지 않고 한 사람의 기기들에 바로 보낸다. (관리자용 문의 요약처럼 앱 안 알림 목록에 남기지 않는 알림)
 * 만료된 구독은 지운다.
 */
@Component
public class DirectPushSender {

	private final SubscriptionRepository subscriptions;
	private final WebPushClient client;

	public DirectPushSender(SubscriptionRepository subscriptions, WebPushClient client) {
		this.subscriptions = subscriptions;
		this.client = client;
	}

	/** 받은 기기 수 */
	public int sendToUser(UUID userId, PushMessage message) {
		int delivered = 0;
		var expired = new ArrayList<String>();
		for (var device : subscriptions.findByUserIds(List.of(userId))) {
			var result = client.send(device, message);
			if (result.outcome() == WebPushClient.Outcome.DELIVERED) {
				delivered++;
			} else if (result.outcome() == WebPushClient.Outcome.EXPIRED) {
				expired.add(device.endpoint());
			}
		}
		subscriptions.deleteByEndpoints(expired);
		return delivered;
	}

}
