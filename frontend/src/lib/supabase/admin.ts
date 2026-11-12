import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// 비밀 키(service_role)로 RLS를 우회하는 서버 전용 클라이언트.
// 알림 구독·발송처럼 사용자가 직접 읽으면 안 되는 데이터에만 쓴다.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !secretKey) {
    throw new Error("SUPABASE_SECRET_KEY가 설정되지 않았어요.");
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
