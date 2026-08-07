import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/rbac"
import { logAuditAction } from "@/lib/services/audit"
import crypto from "crypto"

function generateTempPassword() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((x) => chars[x % chars.length])
    .join("")
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { user: adminUser } = authResult
    const { id } = await params

    const tempPassword = generateTempPassword()

    const adminSupabase = createAdminClient()
    
    // Update user password and set must_change_password to true
    const { error: authError } = await adminSupabase.auth.admin.updateUserById(id, {
      password: tempPassword,
      user_metadata: {
        must_change_password: true
      }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Also update profile must_change_password field
    const supabase = await createClient()
    await supabase.from("profiles").update({ must_change_password: true }).eq("id", id)

    await logAuditAction(
      supabase,
      adminUser.id,
      "Password Reset",
      "officer",
      id,
      { method: "temporary_password" }
    )

    return NextResponse.json({ tempPassword })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
