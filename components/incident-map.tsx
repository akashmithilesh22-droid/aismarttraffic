"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import type { TrafficRecord } from "@/lib/types"

/* ------------------------------------------------------------------ */
/*  Public API — unchanged                                             */
/* ------------------------------------------------------------------ */
interface Props {
  records: TrafficRecord[]
}

type ViewMode = "heatmap" | "markers"
type FilterMode = "all" | "high" | "critical"

/* ------------------------------------------------------------------ */
/*  Risk helpers                                                       */
/* ------------------------------------------------------------------ */
function riskColor(impact: number, alpha = 1) {
  if (impact >= 80) return `rgba(220,38,38,${alpha})`
  if (impact >= 62) return `rgba(234,88,12,${alpha})`
  if (impact >= 42) return `rgba(202,138,4,${alpha})`
  return `rgba(22,163,74,${alpha})`
}

function riskLabel(impact: number) {
  if (impact >= 80) return "Critical"
  if (impact >= 62) return "High"
  if (impact >= 42) return "Moderate"
  return "Low"
}

function riskHex(impact: number) {
  if (impact >= 80) return "#dc2626"
  if (impact >= 62) return "#ea580c"
  if (impact >= 42) return "#ca8a04"
  return "#16a34a"
}

/* ------------------------------------------------------------------ */
/*  Zone approximate centres (for flyTo)                               */
/* ------------------------------------------------------------------ */
const ZONE_CENTRES: Record<string, [number, number]> = {
  "Central": [12.975, 77.585],
  "North": [13.060, 77.596],
  "South": [12.895, 77.580],
  "East": [12.960, 77.682],
  "West": [12.970, 77.510],
}

function guessZoneCentre(zone: string): [number, number] | null {
  for (const [key, centre] of Object.entries(ZONE_CENTRES)) {
    if (zone.toLowerCase().includes(key.toLowerCase())) return centre
  }
  return null
}

/* ------------------------------------------------------------------ */
/*  Dynamically-imported inner map (SSR-safe)                          */
/* ------------------------------------------------------------------ */
const LeafletMapInner = dynamic(() => import("./incident-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-[16/9] min-h-[360px] max-h-[600px] w-full items-center justify-center rounded-xl border border-border bg-muted/20">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-xs">Loading map…</span>
      </div>
    </div>
  ),
})

/* ------------------------------------------------------------------ */
/*  Main exported component                                            */
/* ------------------------------------------------------------------ */
export function IncidentMap({ records }: Props) {
  const [view, setView] = useState<ViewMode>("heatmap")
  const [filter, setFilter] = useState<FilterMode>("all")

  const filtered = useMemo(() => {
    const valid = records.filter(
      (r) => r.lat > 12.5 && r.lat < 13.5 && r.lng > 77.0 && r.lng < 78.2
    )
    if (filter === "critical") return valid.filter((r) => r.impact >= 80)
    if (filter === "high") return valid.filter((r) => r.impact >= 62)
    return valid
  }, [records, filter])

  const zoneCounts = useMemo(() => {
    const m = new Map<string, { count: number; sumImpact: number }>()
    for (const r of filtered) {
      if (!r.zone || r.zone === "Unknown") continue
      const e = m.get(r.zone) ?? { count: 0, sumImpact: 0 }
      e.count++
      e.sumImpact += r.impact
      m.set(r.zone, e)
    }
    return [...m.entries()]
      .map(([zone, { count, sumImpact }]) => ({ zone, count, avgImpact: Math.round(sumImpact / count) }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  const btnBase = "rounded-md px-3 py-1 text-xs font-medium transition-colors"
  const btnActive = "bg-primary text-primary-foreground"
  const btnInactive = "bg-muted text-muted-foreground hover:bg-muted/70"

  return (
    <div className="flex flex-col gap-4">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
          <button onClick={() => setView("heatmap")} className={`${btnBase} ${view === "heatmap" ? btnActive : btnInactive}`}>
            Heatmap
          </button>
          <button onClick={() => setView("markers")} className={`${btnBase} ${view === "markers" ? btnActive : btnInactive}`}>
            Markers
          </button>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 p-1">
          <button onClick={() => setFilter("all")} className={`${btnBase} ${filter === "all" ? btnActive : btnInactive}`}>
            All
          </button>
          <button onClick={() => setFilter("high")} className={`${btnBase} ${filter === "high" ? btnActive : btnInactive}`}>
            High+
          </button>
          <button onClick={() => setFilter("critical")} className={`${btnBase} ${filter === "critical" ? btnActive : btnInactive}`}>
            Critical
          </button>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">{filtered.length.toLocaleString()} incidents</span>
      </div>

      {/* Map + legend */}
      <LeafletMapInner
        records={filtered}
        view={view}
        riskHex={riskHex}
        riskLabel={riskLabel}
        riskColor={riskColor}
      />

      {/* Zone breakdown */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {zoneCounts.slice(0, 10).map((z) => (
          <div key={z.zone} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/30 cursor-default">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-foreground">{z.zone}</div>
              <div className="text-[10px] text-muted-foreground">avg impact {z.avgImpact}</div>
            </div>
            <div
              className="ml-2 shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-bold"
              style={{ background: riskColor(z.avgImpact, 0.12), color: riskColor(z.avgImpact) }}
            >
              {z.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
