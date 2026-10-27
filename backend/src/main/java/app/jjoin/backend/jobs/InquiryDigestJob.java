package app.jjoin.backend.jobs;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import app.jjoin.backend.push.DirectPushSender;

/**
 * 문의 1시간 요약. 새 문의·자동 수정 결과·지난 1시간 화면 오류가 있을 때만 관리자 기기로 푸시를 보낸다.
 * 한 명이라도 받았을 때만 "알렸음"을 표시해서, 못 보냈으면 다음 시간에 다시 보낸다.
 * 함께 오래된 기록을 정리한다: 처리 완료 90일 지난 문의의 기기 정보, 30일 지난 화면 오류.
 * (예전에는 Supabase pg_cron이 Next의 /api/cron/inquiry-digest를 불렀다)
 */
@Component
public class InquiryDigestJob {

	/** 한 번 돌린 결과 */
	public record Result(boolean ran, int admins, int delivered, int inquiries, int fixes, int clientErrors) {
	}

	private static final Logger log = LoggerFactory.getLogger(InquiryDigestJob.class);

	private final InquiryRepository inquiries;
	private final DirectPushSender sender;
	private final JobLock lock;
	private final JobsProperties properties;

	public InquiryDigestJob(InquiryRepository inquiries, DirectPushSender sender, JobLock lock, JobsProperties properties) {
		this.inquiries = inquiries;
		this.sender = sender;
		this.lock = lock;
		this.properties = properties;
	}

	@Scheduled(cron = "${jjoin.jobs.inquiry-digest-cron}", zone = "Asia/Seoul")
	public void scheduled() {
		if (properties.enabled()) {
			run();
		}
	}

	public Result run() {
		Result[] result = { new Result(false, 0, 0, 0, 0, 0) };
		lock.runExclusive("inquiry-digest", () -> result[0] = digest());
		return result[0];
	}

	private Result digest() {
		inquiries.forgetUserAgents(Duration.ofDays(90));
		inquiries.purgeClientErrors(Duration.ofDays(30));

		var fresh = inquiries.unnotified();
		var fixes = inquiries.unnotifiedFixes();
		int errors = inquiries.clientErrorsSince(Duration.ofHours(1));
		var message = InquiryDigestMessage.build(fresh, fixes, errors);
		if (message.isEmpty()) {
			return new Result(true, 0, 0, 0, 0, 0);
		}

		var admins = inquiries.adminIds();
		int delivered = 0;
		for (var admin : admins) {
			try {
				if (sender.sendToUser(admin, message.get()) > 0) {
					delivered++;
				}
			} catch (RuntimeException e) {
				log.warn("문의 요약을 관리자 {}에게 보내지 못했어요", admin, e);
			}
		}
		if (delivered > 0) {
			inquiries.markNotified(fresh.stream().map(InquiryRepository.NewInquiry::id).toList());
			inquiries.markFixesNotified(fixes.stream().map(InquiryRepository.FixResult::id).toList());
			log.info("문의 요약을 보냈어요: 새 문의 {}건, 자동 수정 결과 {}건, 화면 오류 {}건", fresh.size(), fixes.size(), errors);
		}
		return new Result(true, admins.size(), delivered, fresh.size(), fixes.size(), errors);
	}

}
