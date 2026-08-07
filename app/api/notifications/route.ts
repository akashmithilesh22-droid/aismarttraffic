import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

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
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .in("id", notification_ids)
          
        if (error) throw error
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
