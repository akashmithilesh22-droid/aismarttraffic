import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    const [{ data: stations, error: stationsError }, { data: profiles, error: profilesError }] = await Promise.all([
      supabase.from("police_stations").select("*").order("station_name", { ascending: true }),
      adminSupabase.from("profiles").select("id, police_station, role, is_active").eq("is_active", true),
    ])

    if (stationsError || profilesError) {
      return NextResponse.json({ error: "Failed to load GIS station data" }, { status: 500 })
    }

    const officerCountByStation = new Map<string, number>()
    ;(profiles || []).forEach((profile: { police_station?: string | null }) => {
      const stationName = profile.police_station ?? ""
      if (!stationName) return
      officerCountByStation.set(stationName, (officerCountByStation.get(stationName) || 0) + 1)
    })

    const stationPayload = (stations || []).map((station: any) => ({
      ...station,
      officer_count: officerCountByStation.get(station.station_name) || 0,
    }))

    return NextResponse.json({ stations: stationPayload })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
