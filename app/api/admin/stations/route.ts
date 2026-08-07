import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/rbac"
import { logAuditAction } from "@/lib/services/audit"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: stations, error } = await supabase
      .from("police_stations")
      .select("*")
      .order("station_name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ stations: stations || [] })
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
    const { station_name, station_code, zone, district, address, jurisdiction, latitude, longitude, contact_number, email, is_active } = body

    if (!station_name || !zone || !district) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: newStation, error } = await supabase
      .from("police_stations")
      .insert({
        station_name,
        station_code: station_code || null,
        zone,
        district,
        address: address || null,
        jurisdiction: jurisdiction || null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        contact_number: contact_number || null,
        email: email || null,
        is_active: is_active ?? true,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditAction(
      supabase,
      adminUser.id,
      "Station Created",
      "station",
      newStation.id,
      { station_name: newStation.station_name, zone: newStation.zone }
    )

    return NextResponse.json({ station: newStation }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
