export interface RawRow {
  [key: string]: string
}

export interface TrafficRecord {
  id: string
  eventType: string // planned | unplanned
  cause: string // vehicle_breakdown, accident, etc.
  priority: string // High | Low | ...
  corridor: string
  junction: string // CSV junction column
  requiresClosure: boolean
  status: string
  zone: string
  policeStation: string
  vehType: string
  lat: number
  lng: number
  startDate: Date | null
  resolvedDate: Date | null
  durationMin: number | null // resolution time in minutes (impact proxy)
  hour: number | null
  dayOfWeek: number | null
  month: number | null
  // engineered
  impact: number // 0-100 congestion impact score (target)
}

export interface FieldStat {
  name: string
  type: "numerical" | "categorical"
  missing: number
  unique: number
  top?: { value: string; count: number }[]
  min?: number
  max?: number
  mean?: number
}

export interface DatasetSummary {
  totalRecords: number
  totalFeatures: number
  numericalFeatures: number
  categoricalFeatures: number
  missingValues: number
  missingPct: number
  healthScore: number
  fields: FieldStat[]
  headers: string[]
}

export interface ModelMetrics {
  r2: number
  rmse: number
  mae: number
  accuracy: number // band accuracy %
  cvScore: number
  n: number
}

export interface FeatureImportance {
  feature: string
  importance: number // 0-1 normalized
  direction: "increases" | "decreases"
  weight: number
}

export interface HourlyStat {
  hour: number
  weight: number
  avgImpact: number
}

export interface CategoryStat {
  avgImpact: number
  closureRate: number
  avgDuration: number
  peakRate: number
}

export interface TrainedModel {
  trees: unknown[] // Decision tree ensemble (TreeNode | number)[]
  featureOrder: string[]
  featureMeans: number[] // mean of each feature column (for contribution analysis)
  metrics: ModelMetrics
  importance: FeatureImportance[]
  // Encoders learned from data
  causeImpact: Record<string, number>
  corridorImpact: Record<string, number>
  zoneImpact: Record<string, number>
  junctionImpact: Record<string, number>
  baseImpact: number
  // Data-derived statistics
  baselineStats: BaselineStats
  bandStats: Record<string, BandInfo>
  hourlyProfile: HourlyStat[]
  // Per-cause and per-corridor/zone statistics for dynamic prediction
  causeHourlyProfiles: Record<string, HourlyStat[]>
  corridorZoneStats: Record<string, CategoryStat>
  causeStats: Record<string, CategoryStat>
  records: TrafficRecord[]
}

export type RiskLevel = "Low" | "Moderate" | "High" | "Critical"

export interface ForecastInput {
  cause: string
  corridor: string
  junction: string
  zone: string
  policeStation: string
  priority: string
  eventType: string
  requiresClosure: boolean
  hour: number
  dayOfWeek: number
  durationMin: number
}

export interface PoliceStationRecommendation {
  primary: string
  supporting: string[]
  confidence: number
}

export interface ForecastResult {
  impact: number
  risk: RiskLevel
  confidence: number
  timeline: { hour: number; congestion: number }[]
  contributions: { feature: string; value: number }[]
  similar: SimilarEvent[]
  policeStationRec: PoliceStationRecommendation
  driverPercentages: { name: string; value: number }[]
}

export interface SimilarEvent {
  id: string
  cause: string
  corridor: string
  zone: string
  impact: number
  durationMin: number | null
  similarity: number
}

export interface ResourcePlan {
  officers: number
  marshals: number
  checkpoints: number
  barricades: number
  barricadeIntensity: string
  diversions: number
  laneRestrictions: number
  ambulances: number
  emergencyCorridors: number
  rapidUnits: number
}

// ---- Data-derived statistics ----

export interface BaselineStats {
  avgResolutionMin: number
  medianResolutionMin: number
  p90ResolutionMin: number
  closureRate: number
  highPriorityRate: number
  corridorIncidentRate: number
  avgImpact: number
  peakHourIncidentRate: number
  resolvedRate: number
  totalIncidents: number
  totalUsable: number
}

export interface BandInfo {
  count: number
  avgDuration: number
  closureRate: number
  avgImpact: number
  peakRate: number
}

// Location hierarchy derived from dataset
export interface LocationHierarchy {
  // corridor → list of junctions
  corridorToJunctions: Record<string, string[]>
  // junction → zone (dominant zone for that junction)
  junctionToZone: Record<string, string>
  // junction → police station (dominant station for that junction)
  junctionToPoliceStation: Record<string, string>
}
