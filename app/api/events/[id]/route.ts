import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAuditAction } from "@/lib/services/audit"

function normalizeEventPayload<T extends Record<string, unknown>>(eventData: T | null | undefined) {
  if (!eventData) return eventData

  const normalized = { ...eventData } as Record<string, unknown>

  if (Array.isArray(normalized.prediction)) {
    normalized.prediction = (normalized.prediction as Array<Record<string, unknown>>)[0] ?? null
  }

  if (normalized.prediction && typeof normalized.prediction === "object") {
    const prediction = normalized.prediction as Record<string, unknown>

    if (Array.isArray(prediction.resource_plan)) {
      prediction.resource_plan = (prediction.resource_plan as Array<Record<string, unknown>>)[0] ?? null
    }
  }

  return normalized as T
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: event, error } = await supabase
      .from("events")
      .select(`
        *,
        creator_profile:profiles!events_created_by_fkey(full_name, role, police_station, badge_number, email),
        assignee_profile:profiles!events_assigned_to_fkey(full_name, role, police_station),
        prediction:predictions(
          *,
          resource_plan:resource_plans(*)
        )
      `)
      .eq("id", id)
      .single()

    if (error || !event) {
      // If the foreign key relation name is different, we'll try without explicit fkeys
      const { data: fallbackEvent, error: fallbackError } = await supabase
        .from("events")
        .select(`
          *,
          prediction:predictions(*, resource_plan:resource_plans(*))
        `)
        .eq("id", id)
        .single()
        
      if (fallbackError || !fallbackEvent) {
         return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }
      
      // Fetch related reports and audit logs for this specific event
      const { data: reports } = await supabase
        .from("reports")
        .select("*, creator_profile:profiles!reports_generated_by_fkey(full_name, role)")
        .eq("prediction_id", fallbackEvent.prediction?.id || "00000000-0000-0000-0000-000000000000")

      const { data: auditLogs } = await supabase
        .from("audit_logs")
        .select("*, user_profile:profiles!audit_logs_user_id_fkey(full_name, role)")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })

      return NextResponse.json({
        event: normalizeEventPayload(fallbackEvent),
        reports: reports || [],
        audit_logs: auditLogs || [],
      })
    }

    // Fetch related reports and audit logs for this specific event
    const { data: reports } = await supabase
      .from("reports")
      .select("*, creator_profile:profiles!reports_generated_by_fkey(full_name, role)")
      .eq("prediction_id", event.prediction?.id || "00000000-0000-0000-0000-000000000000")

    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("*, user_profile:profiles!audit_logs_user_id_fkey(full_name, role)")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })

    return NextResponse.json({
      event: normalizeEventPayload(event),
      reports: reports || [],
      audit_logs: auditLogs || [],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const updates = await request.json()
    delete updates.id
    delete updates.created_at
    delete updates.created_by

    updates.updated_at = new Date().toISOString()

    const { data: updatedEvent, error } = await supabase
      .from("events")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Determine if assignment changed to create a specific notification
    if (updates.assigned_to || updates.assigned_station) {
      await supabase.from("notifications").insert({
        title: "New Event Assignment",
        message: `You have been assigned to event: ${updatedEvent.title}`,
        type: "Officer Assignment",
        priority: "High",
        recipient_user: updates.assigned_to || null,
        recipient_station: updates.assigned_station || null,
        created_by: user.id
      })
    }

    await logAuditAction(
      supabase,
      user.id,
      "Updated Event",
      "event",
      id,
      { status: updatedEvent.status, priority: updatedEvent.priority, assigned_to: updatedEvent.assigned_to }
    )

    return NextResponse.json({ event: updatedEvent })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { error } = await supabase.from("events").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAuditAction(
      supabase,
      user.id,
      "Deleted Event",
      "event",
      id,
      { deleted_at: new Date().toISOString() }
    )

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
