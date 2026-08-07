import type { SupabaseClient } from "@supabase/supabase-js"
import type { AuditLog } from "@/types/database"

export async function logAuditAction(
  supabase: SupabaseClient,
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  metadataJson?: Record<string, unknown> | null
) {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      entity,
      entity_id: entityId || null,
      metadata_json: metadataJson || null,
    })

    if (error) {
      console.error("Failed to insert audit log:", error.message)
    }
  } catch (err) {
    console.error("Audit logging exception:", err)
  }
}

export async function getAuditLogs(
  supabase: SupabaseClient,
  limit = 20
): Promise<AuditLog[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(`
        *,
        user_profile:profiles!audit_logs_user_id_fkey(full_name, role, police_station)
      `)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("Failed to fetch audit logs:", error.message)
      return []
    }

    return (data || []) as AuditLog[]
  } catch (err) {
    console.error("Error fetching audit logs:", err)
    return []
  }
}
