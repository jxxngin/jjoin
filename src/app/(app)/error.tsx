"use client";

import { ErrorScreen } from "@/components/error-screen";

// 로그인한 화면(머리글 아래)에서 오류가 나면 이 화면으로 바꿔 보여 준다. 머리글은 그대로 남는다.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}
