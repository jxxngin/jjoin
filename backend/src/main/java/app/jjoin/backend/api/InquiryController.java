package app.jjoin.backend.api;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

import org.springframework.context.annotation.Bean;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

/**
 * 문의 API. Next 서버가 사용자의 Supabase 토큰을 붙여 부른다. 실패하면 {"error": "화면에 보여 줄 문장"}.
 *
 * <pre>
 * GET   /api/inquiries?mine=true&status=received   목록
 * GET   /api/inquiries/{id}                         하나 (대화 포함)
 * POST  /api/inquiries/{id}/messages {"body"}       대화에 글 남기기
 * PATCH /api/inquiries/{id} {"status","priority"}   관리자: 상태·우선순위
 * </pre>
 */
@RestController
@RequestMapping("/api/inquiries")
public class InquiryController {

	public record MessageRequest(String body) {
	}

	public record UpdateRequest(String status, String priority) {
	}

	private final InquiryService service;

	public InquiryController(InquiryService service) {
		this.service = service;
	}

	@GetMapping
	public List<InquiryService.Inquiry> list(@AuthenticationPrincipal Jwt user,
			@RequestParam(defaultValue = "true") boolean mine, @RequestParam(required = false) String status) {
		return service.list(user, mine, status);
	}

	@GetMapping("/{id}")
	public ResponseEntity<InquiryService.Inquiry> get(@AuthenticationPrincipal Jwt user, @PathVariable UUID id) {
		return ResponseEntity.of(service.get(user, id));
	}

	@PostMapping("/{id}/messages")
	public ResponseEntity<Void> postMessage(@AuthenticationPrincipal Jwt user, @PathVariable UUID id, @RequestBody MessageRequest request) {
		service.postMessage(user, id, request.body());
		return ResponseEntity.noContent().build();
	}

	@PatchMapping("/{id}")
	public ResponseEntity<Void> update(@AuthenticationPrincipal Jwt user, @PathVariable UUID id, @RequestBody UpdateRequest request) {
		service.update(user, id, request.status(), request.priority());
		return ResponseEntity.noContent().build();
	}

	@ExceptionHandler
	ResponseEntity<Map<String, String>> apiError(InquiryService.ApiError error) {
		return ResponseEntity.status(error.status()).body(Map.of("error", error.getMessage()));
	}

	@ExceptionHandler
	ResponseEntity<Map<String, String>> badId(MethodArgumentTypeMismatchException error) {
		return ResponseEntity.status(404).body(Map.of("error", "문의를 찾지 못했어요."));
	}

	/** 응답을 보낸 뒤 푸시를 보내는 데 쓴다. */
	@Bean
	static Executor apiBackground() {
		return Executors.newVirtualThreadPerTaskExecutor();
	}

}
