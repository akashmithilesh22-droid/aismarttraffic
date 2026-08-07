"use client"

import { Circle, Polyline, Marker } from "react-leaflet"
import { useMemo, type ReactElement } from "react"
import { useGIS } from "./gis-provider"
import { getDeploymentPosition, getDiversionRoutePoints, getEventPosition, getHeatIntensity, getRiskRadius } from "./geo-utils"
import { Activity, Ambulance, ShieldAlert, TriangleAlert } from "lucide-react"
import L from "leaflet"

const deploymentIcons = {
  officer: L.divIcon({ html: `<div style="background:#2563eb;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
  vehicle: L.divIcon({ html: `<div style="background:#0f766e;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
  barricade: L.divIcon({ html: `<div style="background:#f59e0b;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
  diversion: L.divIcon({ html: `<div style="background:#7c3aed;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
  ambulance: L.divIcon({ html: `<div style="background:#dc2626;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
  rapid: L.divIcon({ html: `<div style="background:#0ea5e9;width:12px;height:12px;border-radius:999px;border:2px solid white"></div>`, className: "", iconSize: [12, 12], iconAnchor: [6, 6] }),
}

export function AiVisualizations() {
  const { events, layers, selectedEvent } = useGIS()

  const visualizations = useMemo(() => {
    return events.flatMap((event, index) => {
      const risk = event.prediction?.risk_level ?? "Moderate"
      const heatIntensity = getHeatIntensity(event)
      const position = getEventPosition(event)
      const radius = getRiskRadius(risk)
      const isActive = selectedEvent === event.id

      const overlays: ReactElement[] = []

      if (layers.heatmap) {
        overlays.push(
          <Circle
            key={`heat-${event.id}`}
            center={position}
            radius={radius / 2}
            pathOptions={{
              fillColor: risk === "Critical" ? "#dc2626" : risk === "High" ? "#f59e0b" : risk === "Moderate" ? "#3b82f6" : "#22c55e",
              fillOpacity: 0.15 + heatIntensity * 0.25,
              stroke: false,
            }}
          />,
        )
      }

      if (layers.resources) {
        const deploymentItems = [
          { type: "Traffic Officers", quantity: event.prediction?.resource_plan?.officers ?? 0, icon: deploymentIcons.officer },
          { type: "Patrol Vehicles", quantity: event.prediction?.resource_plan?.rapid_response_units ?? 0, icon: deploymentIcons.vehicle },
          { type: "Barricades", quantity: event.prediction?.resource_plan?.barricades ?? 0, icon: deploymentIcons.barricade },
          { type: "Diversions", quantity: event.prediction?.resource_plan?.diversions ?? 0, icon: deploymentIcons.diversion },
          { type: "Ambulances", quantity: event.prediction?.resource_plan?.ambulances ?? 0, icon: deploymentIcons.ambulance },
          { type: "Rapid Response", quantity: event.prediction?.resource_plan?.rapid_response_units ?? 0, icon: deploymentIcons.rapid },
        ]

        deploymentItems.forEach((item, itemIndex) => {
          const [lat, lng] = getDeploymentPosition(event, index + itemIndex)
          overlays.push(
            <Marker key={`${event.id}-${item.type}`} position={[lat, lng]} icon={item.icon}>
              <div />
            </Marker>,
          )
        })
      }

      if (layers.diversions) {
        const routePoints = getDiversionRoutePoints(event)
        overlays.push(
          <Polyline key={`route-${event.id}`} positions={routePoints} pathOptions={{ color: "#0f766e", weight: 3, dashArray: "8 6", opacity: 0.85 }} />,
        )
        overlays.push(
          <Polyline key={`route-2-${event.id}`} positions={[routePoints[0], routePoints[2]]} pathOptions={{ color: "#f97316", weight: 2, opacity: 0.85 }} />,
        )
      }

      if (layers.events) {
        overlays.push(
          <Circle
            key={`radius-${event.id}`}
            center={position}
            radius={radius}
            pathOptions={{
              color: isActive ? "#38bdf8" : "#64748b",
              weight: isActive ? 3 : 1.5,
              fillOpacity: isActive ? 0.08 : 0.03,
              dashArray: isActive ? "6 4" : undefined,
            }}
          />,
        )
      }

      return overlays
    })
  }, [events, layers, selectedEvent])

  return <>{visualizations}</>
}
