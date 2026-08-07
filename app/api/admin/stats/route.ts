import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireSuperAdmin } from "@/lib/rbac"

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireSuperAdmin()
    if (authResult instanceof NextResponse) return authResult

    const supabase = await createClient()

    // 1. Officers Stats
    const { count: totalOfficers, error: officersError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      
    const { count: activeOfficers, error: activeError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // 2. Police Stations
    const { count: totalStations, error: stationsError } = await supabase
      .from("police_stations")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)

    // 3. Today's Activity
    const today = new Date().toISOString().split("T")[0]
    
    const { count: forecastsToday, error: forecastsError } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00.000Z`)

    const { count: reportsToday, error: reportsError } = await supabase
      .from("reports")
      .select("*", { count: "exact", head: true })
      .gte("generated_at", `${today}T00:00:00.000Z`)

    const { count: loginsToday, error: loginsError } = await supabase
      .from("login_sessions")
      .select("*", { count: "exact", head: true })
      .gte("login_time", `${today}T00:00:00.000Z`)

    if (officersError || activeError || stationsError || forecastsError || reportsError || loginsError) {
      console.error("Error fetching admin stats", { officersError, activeError, stationsError, forecastsError, reportsError, loginsError })
      return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 })
    }

    return NextResponse.json({
      totalOfficers: totalOfficers || 0,
      activeOfficers: activeOfficers || 0,
      disabledOfficers: (totalOfficers || 0) - (activeOfficers || 0),
      totalStations: totalStations || 0,
      forecastsToday: forecastsToday || 0,
      reportsToday: reportsToday || 0,
      loginsToday: loginsToday || 0,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
