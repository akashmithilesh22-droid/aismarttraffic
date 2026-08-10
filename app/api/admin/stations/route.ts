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

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }
    const { station_name, station_code, zone, district, address, jurisdiction, latitude, longitude, contact_number, email, is_active } = body

    const stationName = typeof station_name === "string" ? station_name.trim() : ""
    const stationCode = typeof station_code === "string" ? station_code.trim() : ""
    const stationZone = typeof zone === "string" ? zone.trim() : ""
    const stationDistrict = typeof district === "string" ? district.trim() : ""
    const contactNumber = typeof contact_number === "string" ? contact_number.trim() : ""
    const stationEmail = typeof email === "string" ? email.trim() : ""
    const latitudeValue = latitude === "" || latitude === null || latitude === undefined ? null : Number(latitude)
    const longitudeValue = longitude === "" || longitude === null || longitude === undefined ? null : Number(longitude)

    if (!stationName || !stationZone || !stationDistrict) {
      return NextResponse.json({ error: "Station name, zone, and district are required" }, { status: 400 })
    }
    if (stationName.length < 2 || stationName.length > 120) {
      return NextResponse.json({ error: "Station name must be between 2 and 120 characters" }, { status: 400 })
    }
    if (stationCode && !/^[A-Za-z0-9][A-Za-z0-9-]{1,24}$/.test(stationCode)) {
      return NextResponse.json({ error: "Station code must use 2-25 letters, numbers, or hyphens" }, { status: 400 })
    }
    if (contactNumber && !/^\+?[0-9][0-9\s().-]{6,19}$/.test(contactNumber)) {
      return NextResponse.json({ error: "Contact number is invalid" }, { status: 400 })
    }
    if (stationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stationEmail)) {
      return NextResponse.json({ error: "Station email is invalid" }, { status: 400 })
    }
    if ((latitudeValue !== null && (!Number.isFinite(latitudeValue) || latitudeValue < -90 || latitudeValue > 90)) ||
      (longitudeValue !== null && (!Number.isFinite(longitudeValue) || longitudeValue < -180 || longitudeValue > 180))) {
      return NextResponse.json({ error: "Station coordinates are invalid" }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: newStation, error } = await supabase
      .from("police_stations")
      .insert({
        station_name: stationName,
        station_code: stationCode || null,
        zone: stationZone,
        district: stationDistrict,
        address: typeof address === "string" && address.trim() ? address.trim() : null,
        jurisdiction: typeof jurisdiction === "string" && jurisdiction.trim() ? jurisdiction.trim() : null,
        latitude: latitudeValue,
        longitude: longitudeValue,
        contact_number: contactNumber || null,
        email: stationEmail || null,
        is_active: typeof is_active === "boolean" ? is_active : true,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Station code already exists" }, { status: 409 })
      }
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
