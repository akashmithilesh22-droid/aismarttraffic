import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// GET /api/notifications
// Fetch notifications visible to the current user.
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("role, police_station")
      .eq("id", user.id)
      .maybeSingle()

    if (profileErr) {
      throw profileErr
    }

    const userRole = (profileData as any)?.role ?? null
    const userStation = (profileData as any)?.police_station ?? null

    let query = supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (userRole !== "Super Admin") {
      query = query.or(
        `recipient_user.eq.${user.id},recipient_role.eq.${userRole},recipient_station.eq.${userStation},and(recipient_user.is.null,recipient_role.is.null,recipient_station.is.null)`
      )
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({ notifications: data || [] })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unable to load notifications." },
      { status: 500 }
    )
  }
}

// POST /api/notifications
// Marks notifications as read or deletes notifications.
// Uses authorization checks so users can only modify notifications
// that belong to them/their role/station/global notifications.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, notification_ids } = body

    if (!Array.isArray(notification_ids) || notification_ids.length === 0) {
      return NextResponse.json(
        { error: "No notification IDs provided" },
        { status: 400 }
      )
    }

    const { data: profileData, error: profileErr } = await supabase
      .from("profiles")
      .select("role, police_station")
      .eq("id", user.id)
      .maybeSingle()

    if (profileErr) {
      throw profileErr
    }

    const userRole = (profileData as any)?.role ?? null
    const userStation = (profileData as any)?.police_station ?? null

    const adminSupabase = createAdminClient()

    for (const id of notification_ids) {
      const { data: notif, error: notifErr } = await adminSupabase
        .from("notifications")
        .select("recipient_user, recipient_role, recipient_station")
        .eq("id", id)
        .maybeSingle()

      if (notifErr) {
        throw notifErr
      }

      if (!notif) continue

      const isGlobal =
        !notif.recipient_user &&
        !notif.recipient_role &&
        !notif.recipient_station

      const isSuperAdmin = userRole === "Super Admin"

      const belongsToUser =
        isSuperAdmin ||
        isGlobal ||
        notif.recipient_user === user.id ||
        (userRole && notif.recipient_role === userRole) ||
        (userStation && notif.recipient_station === userStation)

      if (!belongsToUser) {
        continue
      }

      if (action === "mark_read") {
        const { error } = await adminSupabase
          .from("notifications")
          .update({
            read: true,
            read_at: new Date().toISOString(),
          })
          .eq("id", id)

        if (error) {
          throw error
        }
      } else if (action === "delete") {
        const { error } = await adminSupabase
          .from("notifications")
          .delete()
          .eq("id", id)

        if (error) {
          throw error
        }
      }
    }

    if (action !== "mark_read" && action !== "delete") {
      return NextResponse.json(
        { error: "Unsupported action" },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal Error" },
      { status: 500 }
    )
  }
}