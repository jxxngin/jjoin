import { createBrowserClient } from "@supabase/ssr";
import { supabaseKey, supabaseUrl } from "./env";

// 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
