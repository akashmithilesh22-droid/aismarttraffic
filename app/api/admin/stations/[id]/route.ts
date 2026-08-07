import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/rbac"
import { logAuditAction } from "@/lib/services/audit"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { user: adminUser } = authResult
    const { id } = await params

    const body = await request.json()
    const { station_name, station_code, zone, district, address, jurisdiction, latitude, longitude, contact_number, email, is_active } = body

    const updateData: any = {}
    if (station_name !== undefined) updateData.station_name = station_name
    if (station_code !== undefined) updateData.station_code = station_code
    if (zone !== undefined) updateData.zone = zone
    if (district !== undefined) updateData.district = district
    if (address !== undefined) updateData.address = address
    if (jurisdiction !== undefined) updateData.jurisdiction = jurisdiction
    if (latitude !== undefined) updateData.latitude = latitude ? parseFloat(latitude) : null
    if (longitude !== undefined) updateData.longitude = longitude ? parseFloat(longitude) : null
    if (contact_number !== undefined) updateData.contact_number = contact_number
    if (email !== undefined) updateData.email = email
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: updatedStation, error } = await supabase
      .from("police_stations")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const actionText = is_active === false ? "Station Disabled" : "Station Updated"
    await logAuditAction(
      supabase,
      adminUser.id,
      actionText,
      "station",
      id,
      { updated_fields: Object.keys(updateData) }
    )

    return NextResponse.json({ station: updatedStation })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult
    const { user: adminUser } = authResult
    const { id } = await params

    const supabase = await createClient()
    
    // Check if the station exists first
    const { data: station, error: checkError } = await supabase.from("police_stations").select("*").eq("id", id).single()
    if (checkError || !station) {
       return NextResponse.json({ error: "Station not found" }, { status: 404 })
    }
    
    // Proceed with deletion
    const { error } = await supabase
      .from("police_stations")
      .delete()
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditAction(
      supabase,
      adminUser.id,
      "Station Deleted",
      "station",
      id,
      { station_name: station.station_name }
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
