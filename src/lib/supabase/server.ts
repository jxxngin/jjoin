import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseKey, supabaseUrl } from "./env";

// 서버 컴포넌트, 서버 함수, 라우트 핸들러에서 사용하는 Supabase 클라이언트.
// 요청마다 새로 만들어야 한다.
export async function createClient() {
  // Supabase가 토큰 만료 확인에 Date.now()를 쓰므로 요청 시점에만 실행한다.
  await connection();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
          // 세션 갱신은 proxy.ts가 담당하므로 무시해도 된다.
        }
      },
    },
  });
}
