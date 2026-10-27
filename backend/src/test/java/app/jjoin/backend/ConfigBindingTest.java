package app.jjoin.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.BindException;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.ClassPathResource;

import app.jjoin.backend.jobs.JobsProperties;
import app.jjoin.backend.push.PushProperties;

// 실제 application.yaml이 설정 클래스에 제대로 묶이는지 (키가 다른 블록으로 밀려나면 여기서 잡힌다)
class ConfigBindingTest {

	@Test
	void 알림_발송_설정() throws IOException {
		var push = binder(Map.of()).bind("jjoin.push", PushProperties.class).get();

		assertThat(push.enabled()).isTrue();
		assertThat(push.batchSize()).isEqualTo(50);
		assertThat(push.maxAttempts()).isEqualTo(5);
		assertThat(push.firstRetryDelay()).isEqualTo(Duration.ofSeconds(30));
		assertThat(push.staleAfter()).isEqualTo(Duration.ofMinutes(5));
	}

	@Test
	void 예약_작업_설정() throws IOException {
		var jobs = binder(Map.of()).bind("jjoin.jobs", JobsProperties.class).get();

		assertThat(jobs.enabled()).isTrue();
		assertThat(jobs.dayBeforeCron()).isEqualTo("0 0 10 * * *");
		assertThat(jobs.hourBeforeCron()).isEqualTo("0 */5 * * * *");
		assertThat(jobs.inquiryDigestCron()).isEqualTo("0 0 * * * *");
	}

	@Test
	void 환경_변수로_끄기() throws IOException {
		var binder = binder(Map.of("PUSH_ENABLED", "false", "JOBS_ENABLED", "false"));

		assertThat(binder.bind("jjoin.push", PushProperties.class).get().enabled()).isFalse();
		assertThat(binder.bind("jjoin.jobs", JobsProperties.class).get().enabled()).isFalse();
	}

	@Test
	void 발송_설정이_빠지면_시작하지_않는다() throws IOException {
		var binder = binder(Map.of("jjoin.push.batch-size", "0"));

		assertThatThrownBy(() -> binder.bind("jjoin.push", PushProperties.class)).isInstanceOf(BindException.class);
	}

	private static Binder binder(Map<String, Object> overrides) throws IOException {
		var environment = new StandardEnvironment();
		var sources = environment.getPropertySources();
		sources.addFirst(new MapPropertySource("overrides", overrides));
		for (var source : new YamlPropertySourceLoader().load("application", new ClassPathResource("application.yaml"))) {
			sources.addLast(source);
		}
		return Binder.get(environment);
	}
}
