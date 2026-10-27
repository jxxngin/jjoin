package app.jjoin.backend.push;

import java.nio.charset.StandardCharsets;
import java.security.Security;

import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Component;

import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;

/**
 * 브라우저 푸시 서버(FCM·Apple·Mozilla 등)에 알림 한 장을 보낸다. 키는 Next와 같은 VAPID 키를 쓴다.
 */
@Component
public class WebPushClient {

	/** 한 기기에 보낸 결과 */
	public enum Outcome {
		/** 받음 */
		DELIVERED,
		/** 구독이 없어짐 (404·410) → 그 기기는 지운다 */
		EXPIRED,
		/** 잠시 뒤 다시 보내면 될 수 있음 (429·5xx·네트워크) */
		RETRY,
		/** 다시 보내도 안 됨 (그 밖의 4xx) */
		REJECTED
	}

	public record Result(Outcome outcome, String detail) {
	}

	private static final int TTL_SECONDS = 60 * 60 * 24;

	private final PushService pushService;

	public WebPushClient(PushProperties properties) throws Exception {
		if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
			Security.addProvider(new BouncyCastleProvider());
		}
		this.pushService = properties.enabled()
				? new PushService(properties.vapidPublicKey(), properties.vapidPrivateKey(), properties.vapidSubject())
				: null;
	}

	public Result send(SubscriptionRepository.Subscription subscription, PushMessage message) {
		if (pushService == null) {
			return new Result(Outcome.REJECTED, "발송이 꺼져 있음 (jjoin.push.enabled=false)");
		}
		Notification notification;
		try {
			notification = new Notification(
					subscription.endpoint(),
					subscription.p256dh(),
					subscription.auth(),
					message.toJson().getBytes(StandardCharsets.UTF_8),
					TTL_SECONDS);
		} catch (Exception e) {
			// 기기 키가 망가졌으면 다시 보내도 안 된다
			return new Result(Outcome.REJECTED, "기기 키 오류 " + e.getClass().getSimpleName() + ": " + e.getMessage());
		}
		try {
			HttpResponse response = pushService.send(notification);
			return classify(response.getStatusLine().getStatusCode());
		} catch (Exception e) {
			return new Result(Outcome.RETRY, e.getClass().getSimpleName() + ": " + e.getMessage());
		}
	}

	static Result classify(int status) {
		if (status >= 200 && status < 300) {
			return new Result(Outcome.DELIVERED, null);
		}
		if (status == 404 || status == 410) {
			return new Result(Outcome.EXPIRED, "HTTP " + status);
		}
		if (status == 429 || status >= 500) {
			return new Result(Outcome.RETRY, "HTTP " + status);
		}
		return new Result(Outcome.REJECTED, "HTTP " + status);
	}

}
