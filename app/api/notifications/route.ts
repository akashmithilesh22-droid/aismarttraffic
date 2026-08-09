import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

// POST /api/notifications
// Marks notifications as read
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action, notification_ids } = body

    if (action === "mark_read") {
      if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
        // Mark specific notifications as read
        // Use an admin client to perform the update but only for rows
        // that actually belong to this user (by recipient_user, recipient_role, or recipient_station).
        const adminSupabase = createAdminClient()

        // Fetch user profile to determine role/station
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("role, police_station")
          .eq("id", user.id)
          .maybeSingle()

        if (profileErr) throw profileErr

        const userRole = (profileData as any)?.role ?? null
        const userStation = (profileData as any)?.police_station ?? null

        // Update each notification only if it belongs to this user/role/station
        for (const id of notification_ids) {
          const { data: notif } = await adminSupabase
            .from("notifications")
            .select("recipient_user, recipient_role, recipient_station")
            .eq("id", id)
            .maybeSingle()

          if (!notif) continue

          const isGlobal = !notif.recipient_user && !notif.recipient_role && !notif.recipient_station
          const isSuperAdmin = userRole === "Super Admin"

          const belongsToUser =
            isSuperAdmin ||
            isGlobal ||
            notif.recipient_user === user.id ||
            (userRole && notif.recipient_role === userRole) ||
            (userStation && notif.recipient_station === userStation)

          if (belongsToUser) {
            const { error } = await adminSupabase
              .from("notifications")
              .update({ read: true })
              .eq("id", id)

            if (error) throw error
          }
        }
      } else {
        // Mark all notifications as read for this user
        // (This is tricky since they might be targeted by role/station, so we'll just update where we can)
        // Usually, we pass the IDs to mark read
        return NextResponse.json({ error: "No notification IDs provided" }, { status: 400 })
      }
    } else if (action === "delete") {
      if (notification_ids && Array.isArray(notification_ids) && notification_ids.length > 0) {
        const { error } = await supabase
          .from("notifications")
          .delete()
          .in("id", notification_ids)
          
        if (error) throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 })
  }
}
