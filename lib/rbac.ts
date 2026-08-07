import { createClient } from "./supabase/server"
import type { UserRole, Profile } from "@/types/auth"
import type { User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export enum Permission {
  MANAGE_OFFICERS = "MANAGE_OFFICERS",
  MANAGE_STATIONS = "MANAGE_STATIONS",
  DELETE_RECORDS = "DELETE_RECORDS",
  VIEW_ALL = "VIEW_ALL",
  CREATE_EVENTS = "CREATE_EVENTS",
  VIEW_FORECASTS = "VIEW_FORECASTS",
  GENERATE_REPORTS = "GENERATE_REPORTS",
  READ_ONLY = "READ_ONLY",
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  "Super Admin": [
    Permission.MANAGE_OFFICERS,
    Permission.MANAGE_STATIONS,
    Permission.DELETE_RECORDS,
    Permission.VIEW_ALL,
    Permission.CREATE_EVENTS,
    Permission.VIEW_FORECASTS,
    Permission.GENERATE_REPORTS,
    Permission.READ_ONLY,
  ],
  "Commissioner": [
    Permission.VIEW_ALL,
    Permission.VIEW_FORECASTS,
    Permission.READ_ONLY,
  ],
  "ACP": [
    Permission.VIEW_ALL,
    Permission.VIEW_FORECASTS,
    Permission.READ_ONLY,
  ],
  "Inspector": [
    Permission.CREATE_EVENTS,
    Permission.VIEW_FORECASTS,
    Permission.GENERATE_REPORTS,
    Permission.READ_ONLY,
  ],
  "Sub Inspector": [
    Permission.CREATE_EVENTS,
    Permission.VIEW_FORECASTS,
    Permission.GENERATE_REPORTS,
    Permission.READ_ONLY,
  ],
  "Traffic Officer": [
    Permission.READ_ONLY,
  ],
}

export function hasPermission(role: UserRole | null | undefined, permission: Permission): boolean {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  return permissions.includes(permission)
}

/**
 * Server-side guard to require Super Admin access for API routes.
 * Returns { user, profile } if authorized, otherwise throws an error or returns null.
 */
export async function requireSuperAdmin() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 401 })
  }

  if (profile.role !== "Super Admin") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 })
  }

  if (!profile.is_active) {
    return NextResponse.json({ error: "Forbidden: Account is inactive" }, { status: 403 })
  }

  return { user, profile }
}
