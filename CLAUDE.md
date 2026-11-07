# jjoin 작업 규칙 (Claude Code)

친구 그룹 약속 앱. 1인 개발이고, 구현은 Claude Code와 함께 한다. 이 파일은 새 채팅마다 읽는 공통 규칙이다.

## 구조
- `frontend/` Next.js 16 웹앱 (Vercel 서울). Next 16은 학습 데이터와 다르다 → `frontend/AGENTS.md`
- `backend/` Java 21 · Spring Boot 4 (알림 발송 워커, 예약 작업, 문의 API). 배포·되돌리기 → `backend/DEPLOY.md`
- `supabase/migrations/` DB 스키마·RLS·SQL 함수. 번호 순서대로 운영에 적용한다
- 기획과 진행 단계 → `PLAN.md`, 할 일 → [GitHub 프로젝트](https://github.com/users/jxxngin/projects/1)

## 한 채팅 = 이슈 하나
- 첫 메시지에 이슈 번호를 받는다. 그 이슈와 연결된 PR·리뷰만 읽고, 다른 이슈나 문서 전체는 필요할 때만 본다.
- 시작할 때 새 문의(`inquiries`)·화면 오류(`client_errors`)·베타 테스트 결과(`test_reports`)를 확인하고, 새로 생긴 것만 짧게 보고한다.
- 끝날 때 이슈를 닫거나 결과를 댓글로 남기고, 다음에 할 이슈를 한 줄로 알려 준다.

## 변경은 모두 PR로
- main에서 브랜치(`feat/`·`fix/`·`refactor/`·`docs/`·`chore/`·`ci/`)를 만들어 작업한다. main은 Ruleset으로 보호돼 직접 푸시할 수 없다.
- PR 본문에 `Closes #번호`(끝까지 해결) 또는 `Part of #번호`(일부)를 넣는다.
- `gh pr create --assignee @me`, 라벨은 종류 1개(`feat` `fix` `refactor` `perf` `docs` `chore` `ci` `test`) + 영역(`area: frontend|backend|db`) + 출처(`from: 문의|화면 오류|베타`, 해당할 때만).
- 이슈·PR 카드는 보드에 넣고 단계(백로그 → 할 일 → 진행 중 → 머지 대기 → 완료)를 옮긴다.
- **머지는 사용자가 한다.** 사용자가 특정 PR을 "머지해"라고 할 때만 `gh pr merge --squash`.

## 리뷰 (Codex)
- 리뷰는 세 곳을 모두 본다: 리뷰 요약, 인라인 코멘트, PR 일반 댓글.
- P1과 정당한 P2는 바로 고친다. 방향을 골라야 하는 경우(기능을 지울지 고칠지 등)만 선택지를 보여 준다.
- 고친 리뷰에는 무엇을·어떤 커밋으로·어떻게 확인했는지 답글을 달고 resolve한다. 고치지 않은 리뷰는 이유를 답글로 남기고 resolve하지 않은 채 알린다.
- 전체 코드 리뷰는 검토용 PR로 한다: `review/base-<영역>`(main에서 범위 파일만 지움) ← `review/<영역>`(다시 넣음). 머지하지 않고, 다시 리뷰받기 전에는 최신 main 전체 기준으로 다시 만든다.

## PR 밖 변경은 승인 먼저
- 저장소 설정, Ruleset, GitHub Secret·변수, Vercel 환경 변수, 운영 DB 직접 변경은 설정안(값, 이유, 되돌리기)을 보여 주고 승인받은 뒤 적용한다.
- DB 마이그레이션: 이미 운영에 적용된 파일은 고치지 않고 새 번호로 고친다. PR 리뷰가 끝난 뒤 운영에 적용하고, 적용 결과(함수·트리거·권한·데이터 수)를 확인한 다음 머지한다.
  - 짧은 마이그레이션은 Supabase 도구로 적용된다. 긴 것·삭제가 있는 것은 도구가 막히므로 클립보드에 복사해 사용자에게 SQL Editor 실행을 부탁한다.

## 확인
- 프론트: `cd frontend && npx tsc --noEmit -p . && npx eslint src && npx next build`
- 백엔드: `cd backend && ./gradlew test` (로컬에 Docker가 없으면 DB 통합 테스트는 건너뛴다 → CI 결과의 `testsuite` 수로 실제 실행을 확인)
- 마이그레이션은 CI의 `SupabaseIT`가 0001부터 모두 올려 본다.

## 글쓰기
- 사용자에게는 한국어로, 쉬운 말로 짧게 보고한다. 결과·확인한 것·사용자가 할 일 순서.
- 코드 주석·커밋 메시지도 한국어, 커밋 끝에 `Co-Authored-By: Claude …` 줄.
