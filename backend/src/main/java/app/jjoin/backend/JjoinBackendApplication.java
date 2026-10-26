package app.jjoin.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.scheduling.annotation.EnableScheduling;

// jjoin 백엔드. 지금은 알림 발송 워커(B1)만 돈다. (PLAN.md §10)
@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan
public class JjoinBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(JjoinBackendApplication.class, args);
	}

}
