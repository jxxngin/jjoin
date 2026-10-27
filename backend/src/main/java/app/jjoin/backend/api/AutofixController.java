package app.jjoin.backend.api;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GitHub 자동 수정 작업(.github/workflows/inquiry-autofix.yml, inquiry-deployed.yml)이 부르는 주소. AUTOFIX_SECRET이 있어야 한다.
 * Next의 /api/autofix/* 와 주소·요청·응답이 같아서, 작업의 APP_URL만 바꾸면 된다.
 */
@RestController
@RequestMapping("/api/autofix")
public class AutofixController {

	public record ReportRequest(String inquiry_id, String status, String url) {
	}

	public record DeployedRequest(List<?> inquiry_ids) {
	}

	private final AutofixService service;
	private final AutofixProperties properties;

	public AutofixController(AutofixService service, AutofixProperties properties) {
		this.service = service;
		this.properties = properties;
	}

	@GetMapping("/inquiry/{id}")
	public ResponseEntity<?> inquiry(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@PathVariable String id) {
		if (!properties.accepts(authorization)) {
			return ResponseEntity.status(401).body("Unauthorized");
		}
		var report = AutofixService.uuid(id).flatMap(service::bugReport);
		return report.<ResponseEntity<?>>map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.status(404).body("Not found"));
	}

	@PostMapping("/report")
	public ResponseEntity<?> report(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@RequestBody(required = false) ReportRequest request) {
		if (!properties.accepts(authorization)) {
			return ResponseEntity.status(401).body("Unauthorized");
		}
		if (request == null || !service.report(request.inquiry_id(), request.status(), request.url())) {
			return ResponseEntity.badRequest().body("Bad request");
		}
		return ResponseEntity.ok(Map.of("ok", true));
	}

	@PostMapping("/deployed")
	public ResponseEntity<?> deployed(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
			@RequestBody(required = false) DeployedRequest request) {
		if (!properties.accepts(authorization)) {
			return ResponseEntity.status(401).body("Unauthorized");
		}
		int resolved = service.deployed(request == null ? List.of() : request.inquiry_ids());
		return ResponseEntity.ok(Map.of("ok", true, "resolved", resolved));
	}

}
