import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAuditAction } from "@/lib/services/audit"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "50", 10)

    const { data: events, error } = await supabase
      .from("events")
      .select(`
        *,
        creator_profile:profiles!events_created_by_fkey(full_name, role, police_station, badge_number),
        prediction:predictions(
          id,
          impact_score,
          risk_level,
          confidence,
          estimated_clearance,
          resource_plan:resource_plans(*)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ events: events || [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized officer access required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      event_type,
      priority,
      location,
      corridor,
      junction,
      zone,
      police_station,
      expected_attendance,
      event_date,
      event_time,
      duration_minutes,
      requires_closure,
    } = body

    if (!title || !event_type || !corridor || !junction) {
      return NextResponse.json({ error: "Missing required event fields" }, { status: 400 })
    }

    const { data: newEvent, error } = await supabase
      .from("events")
      .insert({
        title,
        description: description || null,
        event_type,
        priority: priority || "Medium",
        location: location || junction,
        corridor,
        junction,
        zone: zone || "Central",
        police_station: police_station || "Indiranagar Traffic PS",
        expected_attendance: expected_attendance || 0,
        event_date: event_date || new Date().toISOString().split("T")[0],
        event_time: event_time || "12:00",
        duration_minutes: duration_minutes || 60,
        requires_closure: !!requires_closure,
        status: "PLANNED",
        created_by: user.id,
      })
      .select(`
        *,
        creator_profile:profiles!events_created_by_fkey(full_name, role, police_station, badge_number)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto audit log
    await logAuditAction(
      supabase,
      user.id,
      "Created Event",
      "event",
      newEvent.id,
      { title: newEvent.title, corridor: newEvent.corridor }
    )

    return NextResponse.json({ event: newEvent }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
