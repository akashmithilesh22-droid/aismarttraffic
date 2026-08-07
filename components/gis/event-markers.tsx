"use client"

import { Marker, Popup } from "react-leaflet"
import L from "leaflet"
import { useMemo } from "react"
import { useGIS } from "./gis-provider"
import { AlertTriangle, ExternalLink, FileText, ShieldAlert } from "lucide-react"

function makeIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:16px;height:16px;border-radius:999px;border:2px solid white;box-shadow:0 0 0 2px rgba(0,0,0,0.15);"></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

const EVENT_ICON = makeIcon("#1d4ed8")

function riskColor(risk: string) {
  switch (risk) {
    case "Critical": return "text-destructive"
    case "High": return "text-amber-500"
    case "Moderate": return "text-sky-500"
    default: return "text-emerald-500"
  }
}

export function EventMarkers() {
  const { events, setSelectedEvent } = useGIS()

  const markers = useMemo(() => {
    return events.map((event) => {
      const risk = event.prediction?.risk_level || "Moderate"
      const position: [number, number] = [12.98 + Math.random() * 0.04, 77.58 + Math.random() * 0.04]

      return (
        <Marker key={event.id} position={position} icon={EVENT_ICON} eventHandlers={{ click: () => setSelectedEvent(event.id) }}>
          <Popup>
            <div className="min-w-[240px] space-y-2 rounded-lg p-1 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.event_type}</p>
                </div>
                <span className={`rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold ${riskColor(risk)}`}>{risk}</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2"><ShieldAlert className="size-3.5 text-primary" /> Assigned: {event.assigned_to ? "Officer assigned" : "Pending"}</div>
                <div className="flex items-center gap-2"><AlertTriangle className="size-3.5 text-primary" /> Station: {event.police_station}</div>
                <div className="flex items-center gap-2"><ExternalLink className="size-3.5 text-primary" /> Status: {event.status}</div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`/events/${event.id}`} className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">View Details</a>
                <a href={`/events/${event.id}`} className="rounded-md bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent">Open Event</a>
                <a href={`/events/${event.id}`} className="rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">Generate Report</a>
              </div>
            </div>
          </Popup>
        </Marker>
      )
    })
  }, [events, setSelectedEvent])

  return <>{markers}</>
}
