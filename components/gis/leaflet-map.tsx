"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, ScaleControl, TileLayer, ZoomControl, useMap } from "react-leaflet"
import { useGIS } from "./gis-provider"
import { StationMarkers } from "./station-markers"
import { EventMarkers } from "./event-markers"
import { AiVisualizations } from "./ai-visualizations"
import { cn } from "@/lib/utils"
import { Maximize2, Minimize2 } from "lucide-react"
import type { LatLngTuple } from "leaflet"

const BENGALURU_CENTER: LatLngTuple = [12.9716, 77.5946]

function MapController({ target }: { target: { latitude?: number; longitude?: number } | null }) {
  const map = useMap()

  useEffect(() => {
    if (!target?.latitude || !target?.longitude) return
    map.flyTo([target.latitude, target.longitude], 14, { duration: 1.2 })
  }, [map, target])

  return null
}

export function LeafletMap() {
  const { selectedResult, layers, selectedEvent, setSelectedEvent } = useGIS()
  const [isFullscreen, setIsFullscreen] = useState(false)

  const target = useMemo(() => {
    if (!selectedResult?.latitude || !selectedResult?.longitude) return null
    return {
      latitude: selectedResult.latitude,
      longitude: selectedResult.longitude,
    }
  }, [selectedResult])

  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }

    document.addEventListener("fullscreenchange", handleChange)
    return () => document.removeEventListener("fullscreenchange", handleChange)
  }, [])

  const toggleFullscreen = async () => {
    const targetElement = document.querySelector(".gis-map-shell") as HTMLElement | null
    if (!targetElement) return

    if (!document.fullscreenElement) {
      await targetElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  return (
    <div className={cn("gis-map-shell relative h-[72vh] min-h-[560px] overflow-hidden rounded-xl border border-border bg-background/60", isFullscreen && "h-screen rounded-none") }>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-3 top-3 z-[1000] flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-2 text-xs font-semibold text-foreground shadow-sm"
      >
        {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />} {isFullscreen ? "Exit" : "Fullscreen"}
      </button>

      <MapContainer center={BENGALURU_CENTER} zoom={11} zoomControl={false} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ScaleControl position="bottomleft" />
        <ZoomControl position="bottomright" />
        {layers.stations && <StationMarkers />}
        {layers.events && <EventMarkers />}
        <AiVisualizations />
        <MapController target={target} />
      </MapContainer>
    </div>
  )
}
