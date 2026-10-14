# 낄래? — 약속 공유 웹앱 기획서

## 1. 배경
친구가 많아지면서 서로 약속이 있어도 존재를 모르거나, 알리기 어렵다.
그룹 단위로 약속을 올리고, 참여 여부와 인원 현황을 한눈에 보는 웹앱을 만든다.

## 2. 핵심 결정 사항
| 항목 | 결정 |
|---|---|
| 로그인 | 카카오 로그인 (Supabase Auth) |
| 그룹 | 여러 그룹 지원, 초대 링크로 참여 |
| 인원 | 최소 인원(확정 기준) + 최대 인원(정원), 둘 다 선택 입력 |
| 정원 초과 | 대기열 — 참여자가 빠지면 대기 1순위 자동 승격 |
| 날짜 | 약속을 만든 사람이 지정 |
| 장소 | 카카오맵 장소 검색, 상세에서 지도 + 카카오맵 링크 |
| 수정/삭제 권한 | 약속 만든 사람 + 그룹 방장 |
| 기기 | 모바일 우선, PWA (홈 화면 추가) |
| 배포 | Vercel |

## 3. 기술 스택
- Next.js (App Router) + TypeScript
- Supabase (Postgres, Auth, RLS)
- Tailwind CSS
- Kakao Maps JavaScript SDK (장소 검색 + 지도)
- Vercel 배포

## 4. 약속 상태
| 상태 | 조건 |
|---|---|
| 모집중 | 참여 인원 < 최소 인원 |
| 확정 | 참여 인원 ≥ 최소 인원 (최소 인원이 없으면 1명 이상) |
| 마감 | 참여 인원 = 최대 인원 (이후 참여 신청은 대기열로) |
| 지난 약속 | 시작 시각이 지남 |

상태는 저장하지 않고, 참여 인원과 시각으로 계산한다.

## 5. 화면
1. **로그인**: 카카오 로그인 버튼
2. **내 그룹 목록**: 그룹 만들기, 초대 링크로 참여
3. **그룹 홈**: 다가오는 약속 (리스트 / 캘린더 전환), 상태 배지, `3/6명` 인원 표시, 멤버 목록, 초대 링크 복사
4. **약속 상세**: 날짜·시간, 장소(지도), 메모, 참여/미정/불참 버튼, 참여자·대기자 목록
5. **약속 만들기/수정**: 제목, 날짜·시간, 장소 검색, 최소·최대 인원, 메모
6. **내 약속**: 모든 그룹에서 내가 참여·대기 중인 약속 모아보기
7. **초대 수락** (`/invite/[code]`): 그룹 이름 확인 후 참여
8. **마이페이지**: 닉네임·프로필 사진 수정, 로그아웃

## 6. 데이터 모델
```
profiles            id(=auth.users.id), nickname, avatar_url, created_at
groups              id, name, invite_code(unique), owner_id, created_at
group_members       group_id, user_id, role('owner'|'member'), joined_at   PK(group_id, user_id)
events              id, group_id, title, starts_at,
                    place_name, place_address, place_lat, place_lng, place_url,
                    min_people(null 허용), max_people(null 허용), memo,
                    created_by, created_at, updated_at
event_participants  event_id, user_id, status('going'|'maybe'|'not_going'|'waitlisted'),
                    updated_at   PK(event_id, user_id)
```

### 대기열 규칙
- `going` 신청 시 `going` 인원이 `max_people`에 도달했으면 `waitlisted`로 저장
- 대기 순서는 `waitlisted`가 된 시각(`updated_at`) 순
- `going`인 사람이 다른 상태로 바꾸거나 빠지면, 가장 먼저 대기한 사람을 `going`으로 승격
- 동시에 신청할 때 정원이 초과되지 않도록 참여 처리는 Postgres 함수(RPC) 안에서 행 잠금으로 처리
- 최대 인원을 줄이면 기존 참여자는 유지하고, 새 참여만 막는다

### 권한 (RLS)
- 그룹·약속·참여 정보는 해당 그룹 멤버만 조회
- 약속 생성: 그룹 멤버
- 약속 수정/삭제: 만든 사람 또는 그룹 방장
- 참여 상태 변경: 본인만 (RPC 경유)
- 그룹 참여: 유효한 초대 코드를 가진 로그인 사용자 (RPC 경유)

## 7. 개발 단계
1. **세팅**: Next.js 프로젝트, Tailwind, Supabase 연결, Vercel 첫 배포
2. **인증**: 카카오 로그인, 프로필 자동 생성
3. **그룹**: 그룹 생성, 초대 링크, 멤버 목록
4. **약속**: 생성/수정/삭제, 그룹 홈 리스트
5. **참여**: 참여/미정/불참, 대기열 RPC, 상태 배지
6. **장소**: 카카오맵 검색, 상세 지도
7. **보기 개선**: 캘린더 보기, 내 약속 화면, 마이페이지(프로필 수정)
8. **PWA**: manifest, 아이콘, 홈 화면 추가
9. **마무리**: RLS 점검, 모바일 UI 다듬기, 친구들 테스트

## 8. 이후 고려 (MVP 제외)
- 후보 날짜 투표
- 카카오톡 공유하기 (약속 링크 공유)
- 알림 (새 약속, 대기 승격, 약속 하루 전)
- 약속 댓글

## 9. 개발 전 준비물
- GitHub 계정 (Vercel 연동용)
- Supabase 프로젝트
- Kakao Developers 앱
  - 카카오 로그인 활성화, Redirect URI에 Supabase 콜백 등록
  - 동의 항목: 닉네임, 프로필 사진, 이메일 (이메일은 비즈 앱 전환 필요, 개인 개발자도 무료)
  - JavaScript 키 (지도/장소 검색용), 플랫폼에 도메인 등록 (localhost, Vercel 도메인)
- Vercel 계정
