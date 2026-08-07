import type { TrafficEvent } from "@/types/database"

export function getEventPosition(event: TrafficEvent): [number, number] {
  const seed = `${event.corridor}-${event.junction}-${event.zone}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash)
  }

  const normalized = Math.abs(hash) % 1000
  const latOffset = (normalized % 17) * 0.0025 - 0.02
  const lngOffset = (Math.floor(normalized / 17) % 19) * 0.003 - 0.028

  return [12.97 + latOffset, 77.59 + lngOffset]
}

export function getRiskRadius(riskLevel?: string | null): number {
  switch (riskLevel) {
    case "Critical":
      return 2000
    case "High":
      return 1000
    case "Moderate":
      return 500
    default:
      return 200
  }
}

export function getHeatIntensity(event: TrafficEvent): number {
  const impactScore = event.prediction?.impact_score ?? 0
  const attendance = Math.min(event.expected_attendance ?? 0, 20000) / 200
  const duration = Math.min(event.duration_minutes ?? 0, 240) / 240
  const similarEvents = Math.min((event.prediction?.similar_events_json?.length ?? 0) * 8, 80)

  const riskBoost = {
    Low: 0.2,
    Moderate: 0.45,
    High: 0.7,
    Critical: 1,
  }[event.prediction?.risk_level ?? "Moderate"] ?? 0.45

  return Math.min(1, (impactScore / 100) * 0.6 + riskBoost * 0.3 + attendance * 0.05 + duration * 0.05 + similarEvents / 100)
}

export function getDeploymentPosition(event: TrafficEvent, index: number): [number, number] {
  const [lat, lng] = getEventPosition(event)
  const magnitude = 0.0025 + (index % 4) * 0.001
  const angle = (index % 6) * (Math.PI / 3)

  return [lat + Math.sin(angle) * magnitude, lng + Math.cos(angle) * magnitude]
}

export function getDiversionRoutePoints(event: TrafficEvent): Array<[number, number]> {
  const [lat, lng] = getEventPosition(event)
  const base = [lat, lng]
  return [
    base as [number, number],
    [lat + 0.0045, lng - 0.004] as [number, number],
    [lat + 0.007, lng + 0.006] as [number, number],
    [lat + 0.01, lng + 0.012] as [number, number],
  ]
}
