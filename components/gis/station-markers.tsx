"use client"

import { Marker, Popup } from "react-leaflet"
import L from "leaflet"
import { useMemo } from "react"
import { useGIS } from "./gis-provider"
import { Phone, ShieldCheck } from "lucide-react"

function makeIcon(color: string) {
  return L.divIcon({
    html: `<div style="background:${color};width:18px;height:18px;border-radius:999px;border:2px solid white;box-shadow:0 0 0 3px rgba(0,0,0,0.15);"></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

const STATUS_ICON = {
  green: makeIcon("#16a34a"),
  yellow: makeIcon("#ca8a04"),
  red: makeIcon("#dc2626"),
}

function getStationStatus(station: any) {
  const officerCount = station.officer_count || 0
  if (officerCount >= 6) return "green"
  if (officerCount >= 3) return "yellow"
  return "red"
}

export function StationMarkers() {
  const { stations } = useGIS()

  const markers = useMemo(() => {
    return stations
      .filter((station) => station.latitude && station.longitude)
      .map((station) => {
        const status = getStationStatus(station)
        const position: [number, number] = [station.latitude!, station.longitude!]

        return (
          <Marker key={station.id} position={position} icon={STATUS_ICON[status as keyof typeof STATUS_ICON]}>
            <Popup>
              <div className="min-w-[220px] space-y-2 rounded-lg p-1 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{station.station_name}</p>
                    <p className="text-xs text-muted-foreground">{station.district} · {station.zone}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{station.is_active ? "Active" : "Inactive"}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2"><Phone className="size-3.5 text-primary" /> {station.contact_number || "Contact pending"}</div>
                  <div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-primary" /> Officers: {station.officer_count || 0}</div>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })
  }, [stations])

  return <>{markers}</>
}
