import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase Admin client using the service_role key.
 * This bypasses RLS and can perform privileged operations:
 * - Create/delete auth users
 * - Reset passwords
 * - Manage all rows regardless of RLS
 *
 * NEVER import this on the client side.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local from Supabase Dashboard > Settings > API."
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
