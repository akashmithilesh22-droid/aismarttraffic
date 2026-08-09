import type { RiskLevel } from "@/lib/types"

export type EventStatus = "Draft" | "Pending Review" | "Approved" | "Active" | "Resolved" | "Archived" | "PLANNED" | "IN_PROGRESS" | "CANCELLED"

export interface TrafficEvent {
  id: string
  title: string
  description?: string | null
  event_type: string // e.g. political_rally, festival, breakdown, accident
  priority: string // High, Medium, Low
  location: string
  corridor: string
  junction: string
  zone: string
  police_station: string
  expected_attendance: number
  event_date: string // YYYY-MM-DD
  event_time: string // HH:MM
  duration_minutes: number
  requires_closure: boolean
  status: EventStatus
  assigned_to?: string | null
  assigned_station?: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joined relation fields
  prediction?: EventPrediction | null
  creator_profile?: {
    full_name: string
    role: string
    badge_number?: string | null
    police_station: string
  } | null
}

export interface EventPrediction {
  id: string
  event_id: string
  impact_score: number // 0 - 100
  risk_level: RiskLevel
  confidence: number // 0 - 100
  estimated_clearance: number // minutes
  timeline_json: { hour: number; congestion: number }[]
  feature_importance_json: { feature: string; value: number }[]
  similar_events_json: {
    id: string
    cause: string
    corridor: string
    zone: string
    impact: number
    durationMin: number | null
    similarity: number
  }[]
  created_at: string
  // Joined relation fields
  resource_plan?: EventResourcePlan | null
}

export interface EventResourcePlan {
  id: string
  prediction_id: string
  officers: number
  marshals: number
  barricades: number
  diversions: number
  checkpoints: number
  ambulances: number
  rapid_response_units: number
  deployment_json: Record<string, unknown>
  created_at: string
}

export interface EventReport {
  id: string
  prediction_id: string
  pdf_url?: string | null
  generated_by: string
  generated_at: string
  // Joined relation fields
  creator_profile?: {
    full_name: string
    role: string
  } | null
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string 
  entity: string 
  entity_id?: string | null
  metadata_json?: Record<string, unknown> | null
  created_at: string
  // Joined relation fields
  user_profile?: {
    full_name: string
    role: string
    police_station: string
  } | null
}

export interface PoliceStation {
  id: string
  station_name: string
  station_code?: string | null
  zone: string
  district: string
  address?: string | null
  jurisdiction?: string | null
  latitude?: number | null
  longitude?: number | null
  contact_number?: string | null
  email?: string | null
  officer_count?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface LoginSession {
  id: string
  user_id: string | null
  login_time: string
  logout_time?: string | null
  ip_address?: string | null
  device?: string | null
  browser?: string | null
  city?: string | null
  login_success: boolean
}

export interface Notification {
  id: string
  title: string
  message: string
  type: string
  priority: string // Critical, High, Medium, Low
  recipient_role?: string | null
  recipient_station?: string | null
  recipient_user?: string | null
  event_id?: string | null
  prediction_id?: string | null
  read: boolean
  read_at?: string | null
  created_by?: string | null
  created_at: string
}

export interface CreateEventInput {
  title: string
  description?: string
  event_type: string
  priority: string
  location: string
  corridor: string
  junction: string
  zone: string
  police_station: string
  expected_attendance?: number
  event_date: string
  event_time: string
  duration_minutes: number
  requires_closure: boolean
}

export interface CreatePredictionInput {
  event_id: string
  impact_score: number
  risk_level: RiskLevel
  confidence: number
  estimated_clearance: number
  timeline_json: { hour: number; congestion: number }[]
  feature_importance_json: { feature: string; value: number }[]
  similar_events_json: unknown[]
  resource_plan: {
    officers: number
    marshals: number
    barricades: number
    diversions: number
    checkpoints: number
    ambulances: number
    rapid_response_units: number
    deployment_json?: Record<string, unknown>
  }
}
