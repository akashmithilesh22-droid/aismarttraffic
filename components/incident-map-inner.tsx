"use client"

import { useEffect, useRef, useMemo, useCallback } from "react"
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  ZoomControl,
} from "react-leaflet"
import MarkerClusterGroup from "react-leaflet-cluster"
import L from "leaflet"
import type { TrafficRecord } from "@/lib/types"

/* ── Leaflet CSS (self-contained) ─────────────────────────────────── */
import "leaflet/dist/leaflet.css"

/* ── Fix Leaflet default marker icon paths for bundlers ───────────── */
// eslint-disable-next-line @typescript-eslint/no-require-imports
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

/* ── Constants ────────────────────────────────────────────────────── */
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946]
const MAX_BOUNDS: L.LatLngBoundsExpression = [
  [12.75, 77.35],
  [13.20, 77.85],
]

const TILE_LIGHT = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'

/* ── Props ────────────────────────────────────────────────────────── */
interface InnerProps {
  records: TrafficRecord[]
  view: "heatmap" | "markers"
  riskHex: (impact: number) => string
  riskLabel: (impact: number) => string
  riskColor: (impact: number, alpha?: number) => string
}

/* ── Heatmap layer (leaflet.heat) ─────────────────────────────────── */
function HeatmapLayer({ records }: { records: TrafficRecord[] }) {
  const map = useMap()
  const heatRef = useRef<any>(null)

  const heatData = useMemo(() => {
    return records.map((r) => {
      // Lower intensity so dense clusters don't max out the entire area
      const intensity = 0.05 + (r.impact / 100) * 0.45
      return [r.lat, r.lng, intensity] as [number, number, number]
    })
  }, [records])

  useEffect(() => {
    if (!map) return

    // Import leaflet.heat side-effect (attaches L.heatLayer)
    require("leaflet.heat")

    if (heatRef.current) {
      map.removeLayer(heatRef.current)
    }

    const heat = (L as any).heatLayer(heatData, {
      radius: 8,
      blur: 10,
      maxZoom: 15,
      max: 1.0,
      minOpacity: 0.12,
      gradient: {
        0.0: "#16a34a",
        0.15: "#65a30d",
        0.35: "#ca8a04",
        0.55: "#ea580c",
        0.75: "#dc2626",
        1.0: "#991b1b",
      },
    })

    heat.addTo(map)
    heatRef.current = heat

    return () => {
      if (heatRef.current) {
        map.removeLayer(heatRef.current)
        heatRef.current = null
      }
    }
  }, [map, heatData])

  return null
}

/* ── Cluster icon factory ─────────────────────────────────────────── */
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount()
  let color = "#16a34a"
  let bg = "rgba(22,163,74,0.15)"
  if (count > 200) {
    color = "#dc2626"; bg = "rgba(220,38,38,0.15)"
  } else if (count > 80) {
    color = "#ea580c"; bg = "rgba(234,88,12,0.15)"
  } else if (count > 30) {
    color = "#ca8a04"; bg = "rgba(202,138,4,0.15)"
  }

  return L.divIcon({
    html: `<div style="
      background:${bg};
      border:2px solid ${color};
      color:${color};
      width:40px;height:40px;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;
      box-shadow:0 2px 8px rgba(0,0,0,0.12);
    ">${count}</div>`,
    className: "",
    iconSize: L.point(40, 40),
  })
}

/* ── Reset view control ───────────────────────────────────────────── */
function ResetControl() {
  const map = useMap()
  const handleReset = useCallback(() => {
    map.flyTo(BENGALURU_CENTER, 11, { duration: 0.8 })
  }, [map])

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: "auto", marginTop: 10, marginRight: 10 }}>
      <div className="leaflet-control">
        <button
          onClick={handleReset}
          className="flex items-center gap-1 rounded-md border border-border bg-card/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm hover:bg-muted/80 transition-colors"
          title="Reset view"
        >
          ↺ Reset
        </button>
      </div>
    </div>
  )
}

/* ── Marker layer ─────────────────────────────────────────────────── */
function MarkersLayer({
  records,
  riskHex,
  riskLabel,
  riskColor,
}: {
  records: TrafficRecord[]
  riskHex: (impact: number) => string
  riskLabel: (impact: number) => string
  riskColor: (impact: number, alpha?: number) => string
}) {
  const markers = useMemo(() => {
    return records.map((r, i) => (
      <CircleMarker
        key={r.id || i}
        center={[r.lat, r.lng]}
        radius={5}
        pathOptions={{
          fillColor: riskHex(r.impact),
          fillOpacity: 0.85,
          color: "#fff",
          weight: 1.2,
          opacity: 0.9,
        }}
      >
        <Popup>
          <div className="min-w-[200px] space-y-1.5 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold capitalize text-slate-900">
                {r.cause.replace(/_/g, " ")}
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{ background: riskHex(r.impact) }}
              >
                {riskLabel(r.impact)}
              </span>
            </div>
            <div className="space-y-0.5 text-xs text-slate-600">
              <div><strong>Zone:</strong> {r.zone}</div>
              <div><strong>Impact:</strong> {r.impact}/100</div>
              <div><strong>Priority:</strong> {r.priority}</div>
              {r.corridor && r.corridor !== "Non-corridor" && (
                <div><strong>Corridor:</strong> {r.corridor}</div>
              )}
              {r.junction && r.junction !== "Unknown" && (
                <div><strong>Junction:</strong> {r.junction}</div>
              )}
            </div>
          </div>
        </Popup>
      </CircleMarker>
    ))
  }, [records, riskHex, riskLabel, riskColor])

  return (
    <MarkerClusterGroup
      chunkedLoading
      maxClusterRadius={60}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      iconCreateFunction={createClusterIcon}
      animate
    >
      {markers}
    </MarkerClusterGroup>
  )
}

/* ── Main inner component ─────────────────────────────────────────── */
export default function IncidentMapInner({
  records,
  view,
  riskHex,
  riskLabel,
  riskColor,
}: InnerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
      <div className="aspect-[16/9] min-h-[360px] max-h-[600px] w-full">
        <MapContainer
          center={BENGALURU_CENTER}
          zoom={11}
          minZoom={10}
          maxZoom={18}
          maxBounds={MAX_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          scrollWheelZoom
          className="h-full w-full"
          style={{ background: "#f1f5f9" }}
        >
          <TileLayer attribution={TILE_ATTR} url={TILE_LIGHT} />
          <ZoomControl position="bottomleft" />
          <ResetControl />

          {view === "heatmap" && <HeatmapLayer records={records} />}
          {view === "markers" && (
            <MarkersLayer
              records={records}
              riskHex={riskHex}
              riskLabel={riskLabel}
              riskColor={riskColor}
            />
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-[1000] flex flex-col gap-1 rounded-lg border border-border bg-card/95 px-2.5 py-2 text-[10px] shadow-sm backdrop-blur-sm">
        {[
          { label: "Critical (80+)", color: "rgb(220,38,38)" },
          { label: "High (62–79)", color: "rgb(234,88,12)" },
          { label: "Moderate (42–61)", color: "rgb(202,138,4)" },
          { label: "Low (<42)", color: "rgb(22,163,74)" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
            <span className="text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-14 z-[1000] rounded-md border border-border bg-card/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
        Scroll to zoom · Drag to pan · Click markers for details
      </div>
    </div>
  )
}
