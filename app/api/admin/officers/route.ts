import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/rbac"
import { logAuditAction } from "@/lib/services/audit"

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    let query = supabase.from("profiles").select("*").order("created_at", { ascending: false })
    
    const role = searchParams.get("role")
    if (role) query = query.eq("role", role)
      
    const status = searchParams.get("status")
    if (status) query = query.eq("is_active", status === "active")

    const { data: officers, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ officers: officers || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { user: adminUser } = authResult

    const body = await request.json()
    const { email, password, full_name, role, police_station, district, phone, badge_number } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Create auth user using Admin API
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for internal apps
      user_metadata: {
        full_name,
        role,
        police_station,
        district,
        phone,
        badge_number,
        must_change_password: true // Force password change on first login
      }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const newUserId = authData.user.id

    // The handle_new_user trigger in the database automatically creates the profile row.
    // We can fetch it to return it.
    const supabase = await createClient()
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", newUserId)
      .single()
      
    if (profileError) {
       console.error("Failed to fetch newly created profile:", profileError)
    }

    await logAuditAction(
      supabase,
      adminUser.id,
      "Officer Created",
      "officer",
      newUserId,
      { email, role, full_name }
    )

    return NextResponse.json({ officer: newProfile }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
