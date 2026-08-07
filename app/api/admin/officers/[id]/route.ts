import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperAdmin } from "@/lib/rbac"
import { logAuditAction } from "@/lib/services/audit"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { id } = await params

    const supabase = await createClient()
    const { data: officer, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!officer) {
      return NextResponse.json({ error: "Officer not found" }, { status: 404 })
    }

    return NextResponse.json({ officer })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { user: adminUser } = authResult
    const { id } = await params

    const body = await request.json()
    const { phone, role, district, police_station, badge_number, is_active } = body
    
    const updateData: any = {}
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (district !== undefined) updateData.district = district
    if (police_station !== undefined) updateData.police_station = police_station
    if (badge_number !== undefined) updateData.badge_number = badge_number
    
    // Handle soft delete / disable
    if (is_active !== undefined) {
      updateData.is_active = is_active
      if (!is_active) {
        updateData.archived_at = new Date().toISOString()
        updateData.archived_by = adminUser.id
      } else {
        updateData.archived_at = null
        updateData.archived_by = null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: updatedOfficer, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Also update auth.users metadata to keep it in sync, and if is_active changed, 
    // we might want to update user metadata (optional, but good for consistency)
    const adminSupabase = createAdminClient()
    const metadataUpdate: any = {}
    if (role !== undefined) metadataUpdate.role = role
    if (police_station !== undefined) metadataUpdate.police_station = police_station
    if (district !== undefined) metadataUpdate.district = district
    if (phone !== undefined) metadataUpdate.phone = phone
    if (badge_number !== undefined) metadataUpdate.badge_number = badge_number
    
    if (Object.keys(metadataUpdate).length > 0) {
       await adminSupabase.auth.admin.updateUserById(id, {
         user_metadata: metadataUpdate
       })
    }

    const actionText = is_active === false ? "Officer Disabled" : "Officer Updated"
    await logAuditAction(
      supabase,
      adminUser.id,
      actionText,
      "officer",
      id,
      { updated_fields: Object.keys(updateData) }
    )

    return NextResponse.json({ officer: updatedOfficer })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
