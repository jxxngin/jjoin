package app.jjoin.backend.push;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 알림 발송 설정. (application.yaml의 jjoin.push.*)
 *
 * @param vapidPublicKey  웹 푸시 공개 키 (Next의 NEXT_PUBLIC_VAPID_PUBLIC_KEY와 같은 값)
 * @param vapidPrivateKey 웹 푸시 비밀 키 (VAPID_PRIVATE_KEY)
 * @param vapidSubject    연락처 (VAPID_SUBJECT, mailto: 또는 https:)
 * @param enabled         false면 발송하지 않는다 (키 없이 띄워 볼 때)
 * @param batchSize       한 번에 잡는 대기열 행 수
 * @param maxAttempts     이만큼 실패하면 'failed'로 끝낸다
 * @param firstRetryDelay 첫 재시도까지 기다리는 시간 (이후 두 배씩)
 * @param staleAfter      'sending'에 이보다 오래 머문 행은 워커가 죽은 것으로 보고 다시 대기로 돌린다
 */
@ConfigurationProperties("jjoin.push")
public record PushProperties(
		String vapidPublicKey,
		String vapidPrivateKey,
		String vapidSubject,
		boolean enabled,
		int batchSize,
		int maxAttempts,
		Duration firstRetryDelay,
		Duration staleAfter) {
}
