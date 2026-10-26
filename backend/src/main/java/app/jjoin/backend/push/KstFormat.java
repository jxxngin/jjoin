package app.jjoin.backend.push;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/**
 * 알림 문구에 쓰는 한국 시간 표기. 화면(src/lib/datetime.ts)과 같은 모양으로 만든다.
 * 예) "10월 18일 (일) 오후 7:00", 여러 날 약속은 "10월 24일 (금) 오전 10:00 ~ 10월 26일 (일) · 2박 3일"
 */
public final class KstFormat {

	public static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN);
	private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("a h:mm", Locale.KOREAN);

	private KstFormat() {
	}

	// "10월 18일 (일) 오후 7:00"
	public static String eventDate(Instant at) {
		var local = at.atZone(KST);
		return DAY.format(local) + " " + TIME.format(local);
	}

	// "10월 24일 (금)"
	public static String day(LocalDate date) {
		return DAY.format(date);
	}

	// "2박 3일", 하루면 "당일"
	public static String nights(LocalDate first, LocalDate last) {
		long nights = ChronoUnit.DAYS.between(first, last);
		return nights <= 0 ? "당일" : nights + "박 " + (nights + 1) + "일";
	}

	// 여러 날 약속의 끝(ends_at)은 마지막 날 다음 날 0시(한국 시간)라서 하루 빼야 마지막 날이다.
	public static LocalDate lastDay(Instant endsAt) {
		return endsAt.atZone(KST).toLocalDate().minusDays(1);
	}

	// 약속 날짜. 하루 약속은 시작 시각만, 여러 날 약속은 마지막 날과 "N박 N+1일"을 붙인다.
	public static String eventPeriod(Instant startsAt, Instant endsAt) {
		if (endsAt == null) {
			return eventDate(startsAt);
		}
		var last = lastDay(endsAt);
		return eventDate(startsAt) + " ~ " + day(last) + " · " + nights(startsAt.atZone(KST).toLocalDate(), last);
	}

}
