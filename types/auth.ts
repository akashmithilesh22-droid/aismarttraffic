export type UserRole =
  | 'Super Admin'
  | 'Commissioner'
  | 'ACP'
  | 'Inspector'
  | 'Sub Inspector'
  | 'Traffic Officer'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  police_station: string
  district: string
  phone: string | null
  badge_number: string | null
  is_active: boolean
  photo_url: string | null
  must_change_password: boolean
  archived_at: string | null
  archived_by: string | null
  created_at: string
  updated_at: string
}

export interface UserSession {
  userId: string
  email: string
  profile: Profile | null
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  'Super Admin': 100,
  'Commissioner': 90,
  'ACP': 80,
  'Inspector': 70,
  'Sub Inspector': 60,
  'Traffic Officer': 50,
}

export function isRoleAtLeast(userRole: UserRole | undefined | null, requiredRole: UserRole): boolean {
  if (!userRole) return false
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
}

export function getRoleBadgeVariant(role?: UserRole): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case 'Super Admin':
    case 'Commissioner':
      return 'destructive'
    case 'ACP':
    case 'Inspector':
      return 'default'
    default:
      return 'secondary'
  }
}
