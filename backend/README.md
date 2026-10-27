# jjoin 백엔드 (Java Spring)

jjoin의 "뒤에서 도는 일"을 Next.js에서 떼어 내는 Java Spring 백엔드예요. 화면과 가벼운 서버 처리는 지금처럼 Next.js(Vercel 서울)가, 핵심 규칙은 Supabase Postgres(RLS·SQL 함수)가 맡아요. 전체 계획은 [PLAN.md 10장](../PLAN.md#10-백엔드-분리-계획-java-spring)에 있어요.

| 단계 | 내용 | 상태 |
|---|---|---|
| **B1** | 알림 발송 워커 | ✅ 서버 운영 중 (Oracle Cloud 오사카) |
| **B2** | 예약 작업 (하루 전·1시간 전 알림, 문의 요약·기록 정리) | ✅ 서버 운영 중 (Oracle Cloud 오사카) |
| B3 | 문의·관리자 API, 자동 수정 연동 | 예정 |

서버 배포 방법은 [DEPLOY.md](DEPLOY.md)에 있어요. (Oracle Cloud 서울 VM + Docker + GitHub Actions 자동 배포)

## B1 알림 발송 워커

```
약속·댓글·참여 변경 ──(DB 트리거)──▶ notification_outbox ──▶ Spring 워커 ──▶ 브라우저 푸시 서버 ──▶ 휴대폰
                                       pending → sending → sent / skipped / failed
```

- **대기열에서 꺼내기**: 3초마다 `FOR UPDATE SKIP LOCKED`로 보낼 차례인 행을 잡아 `sending`으로 바꿔요. 워커를 여러 개 띄우거나 Next와 같이 돌아도 같은 알림을 두 번 잡지 않아요. ([OutboxRepository](src/main/java/app/jjoin/backend/push/OutboxRepository.java))
- **다시 보내기**: 모든 기기가 일시적으로 실패(429·5xx·네트워크)하면 30초 → 1분 → 2분 … 간격으로 5번까지 다시 보내요. 한 기기라도 받았으면 다시 보내지 않아요. (이미 받은 기기에 또 가지 않게) ([PushWorker](src/main/java/app/jjoin/backend/push/PushWorker.java))
- **정리**: 만료된 기기 구독(404·410)은 지우고, 5분 넘게 `sending`에 멈춘 행은 다시 대기로 돌리고, 끝난 기록은 7일(실패는 30일) 뒤 지워요.
- **문구**: Next(`frontend/src/lib/push.ts`)와 같은 문구를 한국 시간으로 만들어요. ([PushMessage](src/main/java/app/jjoin/backend/push/PushMessage.java), [KstFormat](src/main/java/app/jjoin/backend/push/KstFormat.java))
- **권한**: 관리자 키 대신 워커 전용 DB 계정 `jjoin_worker`로 접속해요. 알림 발송에 필요한 표·열만 읽고 쓸 수 있어요. ([0032](../supabase/migrations/0032_push_worker_queue.sql))
- **지표**: `/actuator/health`, `/actuator/metrics/jjoin.push.notifications` (결과별 건수)

## B2 예약 작업

| 작업 | 언제 (한국 시간) | 하는 일 |
|---|---|---|
| 하루 전 알림 | 매일 오전 10시 | 내일 시작하는 약속의 참여자를 대기열에 넣어요 |
| 1시간 전 알림 | 5분마다 | 1시간 안에 시작하는 약속의 참여자를 대기열에 넣어요 |
| 문의 요약 | 매시 정각 | 새 문의·자동 수정 결과·지난 1시간 화면 오류를 관리자 기기로 푸시, 처리 완료 90일 지난 문의의 기기 정보와 30일 지난 화면 오류를 지워요 |

- **한 번만**: 대기열에 넣는 SQL 함수가 약속마다 "보냈음"을 남겨서, 여러 번 돌거나 Next의 Cron과 같이 돌아도 한 번만 쌓여요. 실제 발송은 B1 워커가 몇 초 안에 해요. ([ReminderJobs](src/main/java/app/jjoin/backend/jobs/ReminderJobs.java))
- **동시에 하나만**: 워커를 여러 대 띄워도 같은 작업은 한 곳에서만 돌도록 Postgres advisory lock(`pg_try_advisory_xact_lock`)을 잡아요. 잠금 표가 따로 필요 없고, 워커가 죽으면 잠금도 저절로 풀려요. ([JobLock](src/main/java/app/jjoin/backend/jobs/JobLock.java))
- **못 보냈으면 다음에**: 문의 요약은 관리자가 한 명이라도 받았을 때만 "알렸음"을 표시해요. ([InquiryDigestJob](src/main/java/app/jjoin/backend/jobs/InquiryDigestJob.java))
- **권한**: 워커 계정에 예약 함수 실행과 문의 요약에 필요한 열만 더 줬어요. ([0033](../supabase/migrations/0033_worker_scheduled_jobs.sql))

### 기술

Java 21 · Spring Boot 4.1 · JdbcClient(SQL 직접) · PostgreSQL JDBC · web-push(VAPID) · JUnit 5 · Testcontainers · Docker

## 실행

Git Bash 기준이에요.

```bash
cd backend
cp .env.example .env      # 값 채우기 (아래 "처음 한 번")
set -a; . ./.env; set +a
./gradlew bootRun
```

상태 확인: `curl localhost:8080/actuator/health`

### 처음 한 번

1. Supabase SQL Editor에서 `supabase/migrations/0032_push_worker_queue.sql`, `0033_worker_scheduled_jobs.sql` 실행
2. 같은 곳에서 워커 계정 비밀번호를 정해요. (이 값은 어디에도 커밋하지 않아요)
   ```sql
   alter role jjoin_worker password '긴 임의 문자열';
   ```
3. `.env`의 `DATABASE_URL`·`DATABASE_USERNAME`(`jjoin_worker.<프로젝트 ref>`)·`DATABASE_PASSWORD`와 VAPID 키 3개를 채워요.

### 테스트

```bash
./gradlew test
```

- 단위 테스트: 날짜 표기, 알림 문구, 재시도 규칙, 문의 요약 문구
- 통합 테스트(`*IT`): Docker로 Postgres를 띄워 실제 SQL로 확인해요. Docker가 없으면 건너뛰고, GitHub Actions에서는 항상 돌아요.
  - 대기열: 워커 4개 동시 200건 중복 없음, 재시도 시각, 멈춘 행 복구, 기록 정리
  - 예약 작업: 하루 전·1시간 전 알림이 참여자에게만 약속마다 한 번, 같은 작업이 다른 워커에서 돌면 건너뜀
  - 문의 요약: 받은 사람이 있을 때만 "알렸음", 못 받았으면 다음에 다시, 오래된 기록 정리

## Next에서 넘겨받기

1. 워커를 서버에 띄워요. ([DEPLOY.md](DEPLOY.md))
2. Vercel 환경 변수에 `PUSH_WORKER=spring`(알림 발송), `CRON_WORKER=spring`(예약 작업)을 넣고 다시 배포하면 Next는 쉬고 워커가 맡아요.
3. 문제가 생기면 두 값을 지우고 다시 배포하면 바로 Next가 다시 맡아요. (둘이 같이 돌아도 중복 발송은 없어요)
