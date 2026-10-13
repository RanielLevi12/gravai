import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/** Service role: ignora RLS. Só no servidor; nunca importar em código de cliente. */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
