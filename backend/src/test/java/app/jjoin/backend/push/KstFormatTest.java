package app.jjoin.backend.push;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

// 화면(frontend/src/lib/datetime.ts)과 같은 문구가 나오는지
class KstFormatTest {

	@Test
	void 하루_약속은_한국_시간으로_날짜와_시각() {
		// UTC 10시 = 한국 오후 7시
		assertThat(KstFormat.eventDate(Instant.parse("2026-10-18T10:00:00Z"))).isEqualTo("10월 18일 (일) 오후 7:00");
		assertThat(KstFormat.eventDate(Instant.parse("2026-10-18T00:05:00Z"))).isEqualTo("10월 18일 (일) 오전 9:05");
	}

	@Test
	void 한국_날짜가_바뀌는_시각도_맞게() {
		// UTC 15시 = 한국 다음 날 0시
		assertThat(KstFormat.eventDate(Instant.parse("2026-10-17T15:00:00Z"))).isEqualTo("10월 18일 (일) 오전 12:00");
	}

	@Test
	void 여러_날_약속은_마지막_날과_박수() {
		// 10/24(토) 10시 ~ 끝 시각 10/27 0시(한국) → 마지막 날 10/26, 2박 3일
		var starts = Instant.parse("2026-10-24T01:00:00Z");
		var ends = Instant.parse("2026-10-26T15:00:00Z");
		assertThat(KstFormat.eventPeriod(starts, ends)).isEqualTo("10월 24일 (토) 오전 10:00 ~ 10월 26일 (월) · 2박 3일");
	}

	@Test
	void 박수() {
		assertThat(KstFormat.nights(LocalDate.of(2026, 10, 24), LocalDate.of(2026, 10, 24))).isEqualTo("당일");
		assertThat(KstFormat.nights(LocalDate.of(2026, 10, 24), LocalDate.of(2026, 10, 25))).isEqualTo("1박 2일");
	}

}
