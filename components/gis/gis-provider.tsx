"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { PoliceStation, TrafficEvent } from "@/types/database"
import { useRealtime } from "@/providers/realtime-provider"

export interface GisLayerState {
  stations: boolean
  events: boolean
  heatmap: boolean
  resources: boolean
  diversions: boolean
  cameras: boolean
  sensors: boolean
}

export interface GisSearchResult {
  id: string
  type: "station" | "event"
  label: string
  subtitle: string
  latitude?: number
  longitude?: number
}

interface GisContextValue {
  stations: PoliceStation[]
  events: TrafficEvent[]
  loading: boolean
  error: string | null
  layers: GisLayerState
  toggleLayer: (key: keyof GisLayerState) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchResults: GisSearchResult[]
  selectedResult: GisSearchResult | null
  setSelectedResult: (value: GisSearchResult | null) => void
  selectedEvent: string | null
  setSelectedEvent: (value: string | null) => void
  activePanel: "detail" | "report" | "assign"
  setActivePanel: (value: "detail" | "report" | "assign") => void
  isConnected: boolean
}

const GisContext = createContext<GisContextValue | null>(null)

const defaultLayers: GisLayerState = {
  stations: true,
  events: true,
  heatmap: false,
  resources: false,
  diversions: false,
  cameras: false,
  sensors: false,
}

function buildSearchResults(stations: PoliceStation[], events: TrafficEvent[]): GisSearchResult[] {
  const results: GisSearchResult[] = []

  stations.forEach((station) => {
    results.push({
      id: `station-${station.id}`,
      type: "station",
      label: station.station_name,
      subtitle: `${station.district} · ${station.zone}`,
      latitude: station.latitude ?? undefined,
      longitude: station.longitude ?? undefined,
    })
  })

  events.forEach((event) => {
    results.push({
      id: `event-${event.id}`,
      type: "event",
      label: event.title,
      subtitle: `${event.corridor} · ${event.junction}`,
      latitude: undefined,
      longitude: undefined,
    })
  })

  return results
}

export function GisProvider({ children }: { children: ReactNode }) {
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [events, setEvents] = useState<TrafficEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [layers, setLayers] = useState<GisLayerState>(defaultLayers)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedResult, setSelectedResult] = useState<GisSearchResult | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<"detail" | "report" | "assign">("detail")
  const { isConnected, realtimeTick } = useRealtime()
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let active = true

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [stationsRes, eventsRes] = await Promise.all([
          fetch("/api/admin/stations"),
          fetch("/api/events?limit=250"),
        ])

        if (!stationsRes.ok || !eventsRes.ok) {
          throw new Error("Unable to load GIS data from the backend")
        }

        const stationsJson = await stationsRes.json()
        const eventsJson = await eventsRes.json()

        if (active) {
          const stationRecords = (stationsJson.stations || []) as PoliceStation[]
          const eventRecords = (eventsJson.events || []) as TrafficEvent[]
          setStations(stationRecords)
          setEvents(eventRecords)
          if (!selectedEvent && eventRecords[0]) {
            setSelectedEvent(eventRecords[0].id)
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load GIS data")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadData()

    void loadData()

    return () => {
      active = false
    }
  }, [selectedEvent, realtimeTick, supabase])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return []

    const allResults = buildSearchResults(stations, events)
    return allResults.filter((item) => {
      const haystack = `${item.label} ${item.subtitle}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [events, searchQuery, stations])

  const toggleLayer = (key: keyof GisLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const value = useMemo<GisContextValue>(
    () => ({
      stations,
      events,
      loading,
      error,
      layers,
      toggleLayer,
      searchQuery,
      setSearchQuery,
      searchResults,
      selectedResult,
      setSelectedResult,
      selectedEvent,
      setSelectedEvent,
      activePanel,
      setActivePanel,
      isConnected,
    }),
    [stations, events, loading, error, layers, searchQuery, searchResults, selectedResult, selectedEvent, activePanel, isConnected],
  )

  return <GisContext.Provider value={value}>{children}</GisContext.Provider>
}

export function useGIS() {
  const context = useContext(GisContext)
  if (!context) {
    throw new Error("useGIS must be used within a GisProvider")
  }
  return context
}
