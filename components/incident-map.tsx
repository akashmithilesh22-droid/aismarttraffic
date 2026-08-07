"use client"

import { useEffect, useRef, useMemo, useState } from "react"
import type { TrafficRecord } from "@/lib/types"

interface Props {
  records: TrafficRecord[]
}

type ViewMode = "heatmap" | "markers"
type FilterMode = "all" | "high" | "critical"

const BOUNDS = { minLat: 12.83, maxLat: 13.14, minLng: 77.45, maxLng: 77.78 }

function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * w
  const y = h - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h
  return { x, y }
}

function riskColor(impact: number, alpha = 1) {
  if (impact >= 80) return `rgba(220,38,38,${alpha})`
  if (impact >= 62) return `rgba(234,88,12,${alpha})`
  if (impact >= 42) return `rgba(202,138,4,${alpha})`
  return `rgba(22,163,74,${alpha})`
}

const ZONE_LABELS = [
  { name: "Central Z1", lat: 12.975, lng: 77.585 },
  { name: "Central Z2", lat: 12.958, lng: 77.572 },
  { name: "North Z1",   lat: 13.072, lng: 77.596 },
  { name: "North Z2",   lat: 13.050, lng: 77.642 },
  { name: "South Z1",   lat: 12.895, lng: 77.580 },
  { name: "South Z2",   lat: 12.878, lng: 77.622 },
  { name: "East Z1",    lat: 12.960, lng: 77.682 },
  { name: "East Z2",    lat: 12.928, lng: 77.652 },
  { name: "West Z1",    lat: 12.970, lng: 77.510 },
  { name: "West Z2",    lat: 12.940, lng: 77.488 },
]

export function IncidentMap({ records }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<ViewMode>("heatmap")
  const [filter, setFilter] = useState<FilterMode>("all")
  const [tooltip, setTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Background
    ctx.fillStyle = "#f1f5f9"
    ctx.fillRect(-pan.x / zoom, -pan.y / zoom, W / zoom, H / zoom)

    // Grid
    ctx.strokeStyle = "rgba(0,0,0,0.07)"
    ctx.lineWidth = 0.5 / zoom
    for (let i = 0; i <= 8; i++) {
      const x = (W / 8) * i
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      const y = (H / 8) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
    }

    if (view === "heatmap") {
      for (const r of filtered) {
        const { x, y } = project(r.lat, r.lng, W, H)
        const radius = Math.max(16, (r.impact / 100) * 36)
        const alpha = Math.min(0.5, 0.12 + (r.impact / 100) * 0.38)
        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius)
        grad.addColorStop(0, riskColor(r.impact, alpha))
        grad.addColorStop(1, riskColor(r.impact, 0))
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }
    } else {
      for (const r of filtered) {
        const { x, y } = project(r.lat, r.lng, W, H)
        ctx.beginPath()
        ctx.arc(x, y, 4 / zoom, 0, Math.PI * 2)
        ctx.fillStyle = riskColor(r.impact, 0.85)
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.7)"
        ctx.lineWidth = 0.8 / zoom
        ctx.stroke()
      }
    }

    // Zone labels
    ctx.font = `bold ${11 / zoom}px sans-serif`
    ctx.textAlign = "center"
    for (const z of ZONE_LABELS) {
      const { x, y } = project(z.lat, z.lng, W, H)
      ctx.fillStyle = "rgba(30,41,59,0.55)"
      ctx.fillText(z.name, x, y)
    }

    ctx.restore()
  }, [filtered, view, zoom, pan])

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    const mx = ((e.clientX - rect.left) * scaleX - pan.x) / zoom
    const my = ((e.clientY - rect.top) * scaleY - pan.y) / zoom
    const W = canvasRef.current!.width
    const H = canvasRef.current!.height

    if (dragging.current) {
      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
      lastPos.current = { x: e.clientX, y: e.clientY }
      setTooltip(null)
      return
    }

    let best: TrafficRecord | null = null
    let bestDist = 14
    for (const r of filtered) {
      const { x, y } = project(r.lat, r.lng, W, H)
      const d = Math.hypot(x - mx, y - my)
      if (d < bestDist) { bestDist = d; best = r }
    }
    if (best) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        lines: [
          `${best.cause.replace(/_/g, " ")}`,
          `Zone: ${best.zone}`,
          `Impact: ${best.impact}/100 · ${best.priority} priority`,
          best.corridor !== "Non-corridor" ? `Corridor: ${best.corridor}` : "",
        ].filter(Boolean),
      })
    } else {
      setTooltip(null)
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    setZoom((z) => Math.min(5, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 0.9))))
  }

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

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => Math.min(5, z * 1.25))} className="flex size-7 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground hover:bg-muted/70">+</button>
          <button onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))} className="flex size-7 items-center justify-center rounded-md bg-muted text-sm font-bold text-muted-foreground hover:bg-muted/70">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} className={`${btnBase} bg-muted text-muted-foreground hover:bg-muted/70`}>Reset</button>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">{filtered.length.toLocaleString()} incidents</span>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted/20">
        <canvas
          ref={canvasRef}
          width={800}
          height={460}
          className="w-full cursor-grab active:cursor-grabbing select-none"
          style={{ display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => { setTooltip(null); dragging.current = false }}
          onMouseDown={(e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }}
          onMouseUp={() => { dragging.current = false }}
          onWheel={handleWheel}
        />

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(tooltip.x + 14, 600), top: Math.max(tooltip.y - 60, 4) }}
          >
            {tooltip.lines.map((line, i) => (
              <div key={i} className={i === 0 ? "font-semibold capitalize text-foreground" : "text-muted-foreground"}>
                {line}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border bg-card/95 px-2.5 py-2 text-[10px] shadow-sm">
          {[
            { label: "Critical (80+)", color: "rgb(220,38,38)" },
            { label: "High (62–79)",   color: "rgb(234,88,12)" },
            { label: "Moderate (42–61)", color: "rgb(202,138,4)" },
            { label: "Low (<42)",      color: "rgb(22,163,74)" },
          ].map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="text-muted-foreground">{l.label}</span>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div className="absolute bottom-3 left-3 rounded-md border border-border bg-card/90 px-2 py-1 text-[10px] text-muted-foreground">
          Scroll to zoom · Drag to pan · Hover for details
        </div>
      </div>

      {/* Zone breakdown */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {zoneCounts.slice(0, 10).map((z) => (
          <div key={z.zone} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2">
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
