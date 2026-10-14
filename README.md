# jjoin

친구들과의 약속을 그룹별로 만들고, 참여 여부와 인원 현황을 확인하는 웹앱입니다.
기획은 [PLAN.md](PLAN.md)를 참고하세요.

## 기술 스택
- Next.js 16 (App Router, Cache Components) + TypeScript
- Supabase (Postgres, Auth)
- Tailwind CSS 4
- Vercel 배포

## 로컬 실행
1. `.env.example`을 복사해 `.env.local`을 만들고 Supabase 값을 채웁니다.
2. 의존성 설치 후 개발 서버를 실행합니다.

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인할 수 있습니다.
