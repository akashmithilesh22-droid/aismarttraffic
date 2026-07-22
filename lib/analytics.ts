import type { TrafficRecord } from "./types"

export function countBy<T extends string | number>(records: TrafficRecord[], key: (r: TrafficRecord) => T) {
  const m = new Map<T, number>()
  for (const r of records) {
    const k = key(r)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([name, value]) => ({ name: String(name), value }))
}

export function avgImpactBy(records: TrafficRecord[], key: (r: TrafficRecord) => string) {
  const m = new Map<string, { sum: number; n: number }>()
  for (const r of records) {
    const k = key(r)
    const e = m.get(k) ?? { sum: 0, n: 0 }
    e.sum += r.impact
    e.n += 1
    m.set(k, e)
  }
  return [...m.entries()].map(([name, { sum, n }]) => ({ name, value: Math.round(sum / n), count: n }))
}

// hour-of-day distribution
export function hourlyDistribution(records: TrafficRecord[]) {
  const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, impact: 0, n: 0 }))
  for (const r of records) {
    if (r.hour === null) continue
    arr[r.hour].count++
    arr[r.hour].impact += r.impact
    arr[r.hour].n++
  }
  return arr.map((a) => ({ hour: a.hour, count: a.count, avgImpact: a.n ? Math.round(a.impact / a.n) : 0 }))
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export function weekdayDistribution(records: TrafficRecord[]) {
  const arr = Array.from({ length: 7 }, (_, d) => ({ day: DOW[d], count: 0 }))
  for (const r of records) {
    if (r.dayOfWeek === null) continue
    arr[r.dayOfWeek].count++
  }
  return arr
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
export function monthlyTrend(records: TrafficRecord[]) {
  const m = new Map<string, { count: number; impact: number }>()
  for (const r of records) {
    if (!r.startDate) continue
    const key = `${MONTHS[r.startDate.getMonth()]} ${r.startDate.getFullYear()}`
    const e = m.get(key) ?? { count: 0, impact: 0 }
    e.count++
    e.impact += r.impact
    m.set(key, e)
  }
  return [...m.entries()]
    .map(([name, { count, impact }]) => ({ name, count, avgImpact: Math.round(impact / count) }))
    .slice(-12)
}

// duration distribution buckets (minutes)
export function durationBuckets(records: TrafficRecord[]) {
  const buckets = [
    { name: "<30m", max: 30 },
    { name: "30-60m", max: 60 },
    { name: "1-2h", max: 120 },
    { name: "2-4h", max: 240 },
    { name: "4h+", max: Number.POSITIVE_INFINITY },
  ]
  const counts = buckets.map((b) => ({ name: b.name, value: 0 }))
  for (const r of records) {
    if (r.durationMin === null) continue
    const idx = buckets.findIndex((b) => r.durationMin! < b.max)
    if (idx >= 0) counts[idx].value++
  }
  return counts
}

// impact histogram
export function impactHistogram(records: TrafficRecord[]) {
  const bins = Array.from({ length: 10 }, (_, i) => ({ name: `${i * 10}-${i * 10 + 10}`, value: 0 }))
  for (const r of records) {
    const idx = Math.min(9, Math.floor(r.impact / 10))
    bins[idx].value++
  }
  return bins
}

// correlation matrix on engineered numeric features
export function correlationMatrix(records: TrafficRecord[]) {
  const feats = {
    Impact: (r: TrafficRecord) => r.impact,
    Priority: (r: TrafficRecord) => (r.priority === "High" ? 1 : r.priority === "Medium" ? 0.5 : 0),
    Closure: (r: TrafficRecord) => (r.requiresClosure ? 1 : 0),
    Duration: (r: TrafficRecord) => r.durationMin ?? 0,
    Corridor: (r: TrafficRecord) => (r.corridor !== "Non-corridor" ? 1 : 0),
    Planned: (r: TrafficRecord) => (r.eventType === "planned" ? 1 : 0),
    PeakHour: (r: TrafficRecord) =>
      r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20)) ? 1 : 0,
  }
  const keys = Object.keys(feats)
  const cols: Record<string, number[]> = {}
  for (const k of keys) cols[k] = records.map((r) => (feats as any)[k](r))
  function corr(a: number[], b: number[]) {
    const n = a.length
    const ma = a.reduce((x, y) => x + y, 0) / n
    const mb = b.reduce((x, y) => x + y, 0) / n
    let num = 0
    let da = 0
    let db = 0
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb)
      da += (a[i] - ma) ** 2
      db += (b[i] - mb) ** 2
    }
    const den = Math.sqrt(da * db)
    return den ? num / den : 0
  }
  const matrix: { x: string; y: string; value: number }[] = []
  for (const ky of keys) for (const kx of keys) matrix.push({ x: kx, y: ky, value: Number(corr(cols[ky], cols[kx]).toFixed(2)) })
  return { keys, matrix }
}

// scatter: duration vs impact (sampled)
export function scatterDurationImpact(records: TrafficRecord[], limit = 400) {
  return records
    .filter((r) => r.durationMin !== null)
    .slice(0, limit)
    .map((r) => ({ duration: r.durationMin, impact: r.impact, cause: r.cause }))
}

function getRiskLevel(impact: number): string {
  if (impact >= 80) return "Critical"
  if (impact >= 62) return "High"
  if (impact >= 42) return "Moderate"
  return "Low"
}

export function computeBaselineStats(records: TrafficRecord[]): any {
  const totalIncidents = records.length
  const usable = records.filter((r) => r.durationMin !== null && r.durationMin > 0)
  const totalUsable = usable.length

  const durations = usable.map((r) => r.durationMin as number).sort((a, b) => a - b)
  const avgResolutionMin = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
  const medianResolutionMin = durations.length ? durations[Math.floor(durations.length / 2)] : 0
  const p90ResolutionMin = durations.length ? durations[Math.floor(durations.length * 0.9)] : 0

  const closureRate = totalIncidents ? records.filter((r) => r.requiresClosure).length / totalIncidents : 0
  const highPriorityRate = totalIncidents ? records.filter((r) => r.priority === "High").length / totalIncidents : 0
  const corridorIncidentRate = totalIncidents ? records.filter((r) => r.corridor !== "Non-corridor").length / totalIncidents : 0
  const avgImpact = totalIncidents ? records.reduce((acc, r) => acc + r.impact, 0) / totalIncidents : 0

  const peakHourIncidentRate = totalIncidents
    ? records.filter(
        (r) => r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20))
      ).length / totalIncidents
    : 0

  const resolvedRate = totalIncidents ? records.filter((r) => r.resolvedDate !== null).length / totalIncidents : 0

  return {
    avgResolutionMin: Math.round(avgResolutionMin),
    medianResolutionMin: Math.round(medianResolutionMin),
    p90ResolutionMin: Math.round(p90ResolutionMin),
    closureRate,
    highPriorityRate,
    corridorIncidentRate,
    avgImpact: Math.round(avgImpact),
    peakHourIncidentRate,
    resolvedRate,
    totalIncidents,
    totalUsable,
  }
}

export function computeBandStats(records: TrafficRecord[]): any {
  const groups: Record<string, TrafficRecord[]> = {
    Low: [],
    Moderate: [],
    High: [],
    Critical: [],
  }

  for (const r of records) {
    const risk = getRiskLevel(r.impact)
    groups[risk].push(r)
  }

  const out: Record<string, any> = {}
  for (const risk of ["Low", "Moderate", "High", "Critical"]) {
    const recs = groups[risk]
    const count = recs.length
    const avgImpact = count ? recs.reduce((a, b) => a + b.impact, 0) / count : 0
    
    const durations = recs.filter((r) => r.durationMin !== null).map((r) => r.durationMin as number)
    const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
    
    const closureRate = count ? recs.filter((r) => r.requiresClosure).length / count : 0
    const peakRate = count
      ? recs.filter(
          (r) => r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20))
        ).length / count
      : 0

    out[risk] = {
      count,
      avgDuration: Math.round(avgDuration),
      closureRate,
      avgImpact: Math.round(avgImpact),
      peakRate,
    }
  }
  return out
}

export function computeHourlyProfile(records: TrafficRecord[]): { hour: number; weight: number; avgImpact: number }[] {
  const hourlyStats = Array.from({ length: 24 }, (_, h) => ({ hour: h, sumImpact: 0, count: 0 }))
  let totalImpact = 0
  let totalCount = 0

  for (const r of records) {
    if (r.hour === null) continue
    hourlyStats[r.hour].sumImpact += r.impact
    hourlyStats[r.hour].count++
    totalImpact += r.impact
    totalCount++
  }

  const globalAvg = totalCount ? totalImpact / totalCount : 1

  return hourlyStats.map((stat) => {
    const avgImpact = stat.count ? stat.sumImpact / stat.count : globalAvg
    const weight = globalAvg ? avgImpact / globalAvg : 1
    return {
      hour: stat.hour,
      weight,
      avgImpact: Math.round(avgImpact),
    }
  })
}

// Per-cause hourly profile: for each cause, compute how impact distributes across 24h
export function computeCauseHourlyProfiles(
  records: TrafficRecord[]
): Record<string, { hour: number; weight: number; avgImpact: number }[]> {
  // Collect causes
  const causes = Array.from(new Set(records.map((r) => r.cause).filter(Boolean)))

  const globalProfile = computeHourlyProfile(records)

  const out: Record<string, { hour: number; weight: number; avgImpact: number }[]> = {}

  for (const cause of causes) {
    const subset = records.filter((r) => r.cause === cause && r.hour !== null)
    if (subset.length < 5) {
      // Fall back to global profile for sparse causes
      out[cause] = globalProfile
      continue
    }
    out[cause] = computeHourlyProfile(subset)
  }

  return out
}

// Per-corridor and per-zone resource multipliers derived from data
export function computeCorridorZoneStats(
  records: TrafficRecord[]
): Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }> {
  const m = new Map<
    string,
    { sumImpact: number; closures: number; sumDuration: number; peakCount: number; n: number }
  >()

  for (const r of records) {
    const keys = [r.corridor, r.zone].filter(Boolean)
    for (const k of keys) {
      const e = m.get(k) ?? { sumImpact: 0, closures: 0, sumDuration: 0, peakCount: 0, n: 0 }
      e.sumImpact += r.impact
      e.closures += r.requiresClosure ? 1 : 0
      e.sumDuration += r.durationMin ?? 60
      e.peakCount +=
        r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20)) ? 1 : 0
      e.n += 1
      m.set(k, e)
    }
  }

  const out: Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }> = {}
  for (const [k, e] of m.entries()) {
    out[k] = {
      avgImpact: Math.round(e.sumImpact / e.n),
      closureRate: e.closures / e.n,
      avgDuration: Math.round(e.sumDuration / e.n),
      peakRate: e.peakCount / e.n,
    }
  }
  return out
}

// Per-cause resource multipliers derived from data
export function computeCauseStats(
  records: TrafficRecord[]
): Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }> {
  const m = new Map<
    string,
    { sumImpact: number; closures: number; sumDuration: number; peakCount: number; n: number }
  >()

  for (const r of records) {
    const k = r.cause
    if (!k) continue
    const e = m.get(k) ?? { sumImpact: 0, closures: 0, sumDuration: 0, peakCount: 0, n: 0 }
    e.sumImpact += r.impact
    e.closures += r.requiresClosure ? 1 : 0
    e.sumDuration += r.durationMin ?? 60
    e.peakCount +=
      r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20)) ? 1 : 0
    e.n += 1
    m.set(k, e)
  }

  const out: Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }> = {}
  for (const [k, e] of m.entries()) {
    out[k] = {
      avgImpact: Math.round(e.sumImpact / e.n),
      closureRate: e.closures / e.n,
      avgDuration: Math.round(e.sumDuration / e.n),
      peakRate: e.peakCount / e.n,
    }
  }
  return out
}

// ---------- Location Hierarchy ----------
// Builds cascading selection maps: corridor → junctions, junction → zone, junction → policeStation
// Only keeps combinations that appear ≥ 2 times in the dataset (noise filter)
import type { LocationHierarchy } from "./types"

export function buildLocationHierarchy(records: TrafficRecord[]): LocationHierarchy {
  // Count (corridor, junction) occurrences
  const cjCount = new Map<string, number>()
  // Count (junction, zone) occurrences to pick dominant zone
  const jzCount = new Map<string, Map<string, number>>()
  // Count (junction, policeStation) occurrences to pick dominant station
  const jpCount = new Map<string, Map<string, number>>()

  for (const r of records) {
    const corridor = r.corridor || "Non-corridor"
    const junction = r.junction || "Unknown Junction"
    const zone = r.zone || "Unknown"
    const ps = r.policeStation || "Unknown"

    if (!junction || junction === "Unknown Junction") continue

    const cjKey = `${corridor}|||${junction}`
    cjCount.set(cjKey, (cjCount.get(cjKey) ?? 0) + 1)

    if (!jzCount.has(junction)) jzCount.set(junction, new Map())
    const jzm = jzCount.get(junction)!
    jzm.set(zone, (jzm.get(zone) ?? 0) + 1)

    if (!jpCount.has(junction)) jpCount.set(junction, new Map())
    const jpm = jpCount.get(junction)!
    jpm.set(ps, (jpm.get(ps) ?? 0) + 1)
  }

  const corridorToJunctions: Record<string, string[]> = {}
  for (const [key, count] of cjCount.entries()) {
    if (count < 1) continue
    const [corridor, junction] = key.split("|||")
    if (!corridorToJunctions[corridor]) corridorToJunctions[corridor] = []
    if (!corridorToJunctions[corridor].includes(junction)) {
      corridorToJunctions[corridor].push(junction)
    }
  }
  // Sort each junction list alphabetically
  for (const corridor of Object.keys(corridorToJunctions)) {
    corridorToJunctions[corridor].sort()
  }

  const junctionToZone: Record<string, string> = {}
  for (const [junction, zoneMap] of jzCount.entries()) {
    let bestZone = "Unknown"
    let bestCount = 0
    for (const [zone, count] of zoneMap.entries()) {
      if (count > bestCount && zone !== "Unknown") {
        bestCount = count
        bestZone = zone
      }
    }
    junctionToZone[junction] = bestZone
  }

  const junctionToPoliceStation: Record<string, string> = {}
  for (const [junction, psMap] of jpCount.entries()) {
    let bestPs = "Unknown"
    let bestCount = 0
    for (const [ps, count] of psMap.entries()) {
      if (count > bestCount && ps !== "Unknown") {
        bestCount = count
        bestPs = ps
      }
    }
    junctionToPoliceStation[junction] = bestPs
  }

  return { corridorToJunctions, junctionToZone, junctionToPoliceStation }
}
