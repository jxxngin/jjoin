package app.jjoin.backend.jobs;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 예약 작업 설정. (application.yaml의 jjoin.jobs.*) 시각은 모두 한국 시간이다.
 *
 * @param enabled         false면 예약 작업을 돌리지 않는다 (Next의 Cron이 맡고 있을 때)
 * @param dayBeforeCron   하루 전 알림을 쌓는 시각 (기본: 매일 오전 10시)
 * @param hourBeforeCron  1시간 전 알림을 확인하는 주기 (기본: 5분마다)
 * @param inquiryDigestCron 문의 요약을 보내는 주기 (기본: 매시 정각)
 */
@ConfigurationProperties("jjoin.jobs")
public record JobsProperties(
		boolean enabled,
		String dayBeforeCron,
		String hourBeforeCron,
		String inquiryDigestCron) {
}
