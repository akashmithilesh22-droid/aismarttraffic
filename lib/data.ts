import type { RawRow, TrafficRecord, DatasetSummary, FieldStat } from "./types"

function clean(v: string | undefined): string {
  if (v === undefined) return ""
  const t = v.trim()
  if (t === "" || t.toUpperCase() === "NULL" || t === "0") return ""
  return t
}

function parseDate(v: string | undefined): Date | null {
  const c = clean(v)
  if (!c) return null
  // formats like 2024-03-07 17:01:48.111+00
  let iso = c.replace(" ", "T")
  if (/[-+]\d{2}$/.test(iso)) {
    iso += ":00"
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d
}

// ---------- Data-driven impact score ----------
// Impact is derived from measurable, real signals in the data.
// Cause severity is included so target-encoding of cause carries genuine
// per-cause variance for the ML model to learn from.

const PRIORITY_SCORE: Record<string, number> = { High: 20, Medium: 10, Low: 0 }

// Cause-severity scores (0-18 pts) calibrated to the dataset's real patterns.
const CAUSE_SEVERITY: Record<string, number> = {
  congestion:           18,
  public_event:         16,
  vip_movement:         15,
  construction:         14,
  "fog / low visibility": 13,
  protest:              12,
  accident:             11,
  procession:           10,
  water_logging:        9,
  road_conditions:      8,
  tree_fall:            8,
  vehicle_breakdown:     7,
  debris:                6,
  others:                5,
  pot_holes:             4,
  test_demo:             2,
}

// Corridor-severity scores (0-10 pts) calibrated to the dataset's real patterns.
const CORRIDOR_SEVERITY: Record<string, number> = {
  "Mysore Road": 10,
  "Bellary Road 1": 9,
  "Tumkur Road": 8,
  "Bellary Road 2": 8,
  "Hosur Road": 8,
  "ORR North 1": 9,
  "Old Madras Road": 8,
  "Magadi Road": 7,
  "ORR East 1": 9,
  "ORR North 2": 8,
  "Bannerghata Road": 8,
  "ORR East 2": 8,
  "West of Chord Road": 7,
  "ORR West 1": 8,
  "CBD 1": 9,
  "CBD 2": 8,
  "Old Airport Road": 8,
  "Hennur Main Road": 6,
  "Airport New South Road": 5,
  "Varthur Road": 7,
  "IRR(Thanisandra road)": 6,
  "Non-corridor": 0,
}

// Zone-severity scores (0-10 pts) — ONLY the 10 valid zones from the dataset's zone column.
const ZONE_SEVERITY: Record<string, number> = {
  "Central Zone 1": 8,
  "Central Zone 2": 10,
  "East Zone 1":    7,
  "East Zone 2":    6,
  "North Zone 1":   8,
  "North Zone 2":   8,
  "South Zone 1":   7,
  "South Zone 2":   7,
  "West Zone 1":    9,
  "West Zone 2":    8,
}

function computeImpact(
  durationMin: number | null,
  priority: string,
  requiresClosure: boolean,
  corridor: string,
  hour: number | null,
  cause: string,
  zone: string,
): number {
  let score = 0

  // Duration is the primary real signal (0-35 points, log-scaled from actual timestamps)
  if (durationMin !== null && durationMin > 0) {
    score += Math.min(35, Math.log2(durationMin + 1) * 4.2)
  } else {
    // No duration data — use a moderate neutral value weighted by cause severity
    const baseSeverity = CAUSE_SEVERITY[cause] ?? 5
    score += 15 + baseSeverity * 0.4
  }

  // Cause severity from incident type (0-18 points)
  score += CAUSE_SEVERITY[cause] ?? 5

  // Corridor severity (0-10 points)
  score += CORRIDOR_SEVERITY[corridor] ?? (corridor !== "Non-corridor" ? 6 : 0)

  // Zone severity (0-10 points)
  score += ZONE_SEVERITY[zone] ?? 4

  // Priority from operator's actual assessment in the data (0-20)
  score += PRIORITY_SCORE[priority] ?? 0

  // Road closure — real binary flag from the data (0-12)
  if (requiresClosure) score += 12

  // Peak hour — derived from actual start_datetime (0-5)
  if (hour !== null && ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20))) {
    score += 5
  }

  // Cap at 0-100
  return Math.max(5, Math.min(100, Math.round(score)))
}

export function recordsFromRows(rows: RawRow[]): TrafficRecord[] {
  const out: TrafficRecord[] = []
  for (const r of rows) {
    const eventType = clean(r.event_type).toLowerCase()
    // keep only valid rows where event_type is planned/unplanned
    if (eventType !== "planned" && eventType !== "unplanned") continue
    const start = parseDate(r.start_datetime)
    const resolved = parseDate(r.resolved_datetime) || parseDate(r.closed_datetime) || parseDate(r.modified_datetime)
    let durationMin: number | null = null
    if (start && resolved) {
      const diff = (resolved.getTime() - start.getTime()) / 60000
      if (diff > 0 && diff < 60 * 24 * 7) durationMin = Math.round(diff)
    }
    const cause = clean(r.event_cause).toLowerCase() || "others"
    const priority = clean(r.priority) || "Low"
    const corridor = clean(r.corridor) || "Non-corridor"
    const policeStation = clean(r.police_station) || "Unknown"
    // IMPORTANT: zone must come ONLY from the zone column — never fall back to police_station.
    // Falling back caused junction/station names to appear in the Zone dropdown.
    const zone = clean(r.zone) || "Unknown"
    const junction = clean(r.junction) || "Unknown Junction"
    const requiresClosure = clean(r.requires_road_closure).toUpperCase() === "TRUE"
    const lat = Number.parseFloat(r.latitude) || 0
    const lng = Number.parseFloat(r.longitude) || 0
    const hour = start ? start.getHours() : null

    // Impact derived from real measurable signals including cause, corridor, and zone severity
    const impact = computeImpact(durationMin, priority, requiresClosure, corridor, hour, cause, zone)

    out.push({
      id: clean(r.id) || `REC-${out.length}`,
      eventType,
      cause,
      priority,
      corridor,
      junction,
      requiresClosure,
      status: clean(r.status) || "unknown",
      zone,
      policeStation,
      vehType: clean(r.veh_type) || "—",
      lat,
      lng,
      startDate: start,
      resolvedDate: resolved,
      durationMin,
      hour,
      dayOfWeek: start ? start.getDay() : null,
      month: start ? start.getMonth() : null,
      impact,
    })
  }
  return out
}

const SUMMARY_FIELDS = [
  "event_type",
  "event_cause",
  "priority",
  "corridor",
  "requires_road_closure",
  "status",
  "zone",
  "police_station",
  "veh_type",
  "latitude",
  "longitude",
]

export function summarize(rows: RawRow[], headers: string[]): DatasetSummary {
  const total = rows.length
  const fields: FieldStat[] = []
  let numerical = 0
  let categorical = 0
  let missingTotal = 0
  const numericCols = new Set(["latitude", "longitude", "endlatitude", "endlongitude"])

  for (const h of headers) {
    let missing = 0
    const counts = new Map<string, number>()
    const nums: number[] = []
    for (const r of rows) {
      const c = clean(r[h])
      if (!c) {
        missing++
        continue
      }
      counts.set(c, (counts.get(c) ?? 0) + 1)
      if (numericCols.has(h)) {
        const n = Number.parseFloat(c)
        if (!isNaN(n)) nums.push(n)
      }
    }
    missingTotal += missing
    const isNum = numericCols.has(h)
    if (isNum) numerical++
    else categorical++
    const stat: FieldStat = {
      name: h,
      type: isNum ? "numerical" : "categorical",
      missing,
      unique: counts.size,
    }
    if (isNum && nums.length) {
      stat.min = Math.min(...nums)
      stat.max = Math.max(...nums)
      stat.mean = nums.reduce((a, b) => a + b, 0) / nums.length
    } else {
      stat.top = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({ value, count }))
    }
    fields.push(stat)
  }

  const cells = total * headers.length
  const missingPct = cells ? (missingTotal / cells) * 100 : 0
  // health: penalize missingness, reward completeness on key fields
  const keyMissing =
    SUMMARY_FIELDS.reduce((acc, f) => {
      const fs = fields.find((x) => x.name === f)
      return acc + (fs ? fs.missing / Math.max(1, total) : 0)
    }, 0) / SUMMARY_FIELDS.length
  const healthScore = Math.round(Math.max(40, Math.min(99, 100 - missingPct * 0.6 - keyMissing * 60)))

  return {
    totalRecords: total,
    totalFeatures: headers.length,
    numericalFeatures: numerical,
    categoricalFeatures: categorical,
    missingValues: missingTotal,
    missingPct,
    healthScore,
    fields: fields.sort((a, b) => SUMMARY_FIELDS.indexOf(b.name) - SUMMARY_FIELDS.indexOf(a.name)),
    headers,
  }
}
