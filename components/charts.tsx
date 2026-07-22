"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
  Area,
  AreaChart,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  ZAxis,
} from "recharts"

const C = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
  grid: "color-mix(in oklch, var(--border) 80%, transparent)",
  text: "var(--muted-foreground)",
}

function tooltipStyle() {
  return {
    contentStyle: {
      background: "var(--popover)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      fontSize: 12,
      color: "var(--popover-foreground)",
    },
    labelStyle: { color: "var(--popover-foreground)", fontWeight: 600 },
    itemStyle: { color: "var(--popover-foreground)" },
  }
}

export function BarViz({
  data,
  dataKey = "value",
  xKey = "name",
  color = C.c1,
  height = 240,
  horizontal = false,
}: {
  data: any[]
  dataKey?: string
  xKey?: string
  color?: string
  height?: number
  horizontal?: boolean
}) {
  const t = tooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ left: horizontal ? 10 : 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={!horizontal} horizontal={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={110} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={32} />
          </>
        )}
        <Tooltip cursor={{ fill: "color-mix(in oklch, var(--muted) 40%, transparent)" }} {...t} />
        <Bar dataKey={dataKey} fill={color} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function GradientBarViz({
  data,
  dataKey = "value",
  xKey = "name",
  height = 240,
}: {
  data: any[]
  dataKey?: string
  xKey?: string
  height?: number
}) {
  const t = tooltipStyle()
  const max = Math.max(...data.map((d) => d[dataKey] ?? 0), 1)
  const colorFor = (v: number) => {
    const r = v / max
    if (r > 0.75) return C.c3
    if (r > 0.5) return C.c1
    if (r > 0.25) return C.c2
    return C.c4
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={32} />
        <Tooltip cursor={{ fill: "color-mix(in oklch, var(--muted) 40%, transparent)" }} {...t} />
        <Bar dataKey={dataKey} radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor(d[dataKey] ?? 0)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function AreaViz({
  data,
  dataKey = "congestion",
  xKey = "hour",
  color = C.c1,
  height = 240,
}: {
  data: any[]
  dataKey?: string
  xKey?: string
  color?: string
  height?: number
}) {
  const t = tooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} />
        <YAxis tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={32} domain={[0, 100]} />
        <Tooltip {...t} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#grad-${dataKey})`} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function LineViz({
  data,
  lines,
  xKey = "name",
  height = 240,
}: {
  data: any[]
  lines: { key: string; color: string; name?: string }[]
  xKey?: string
  height?: number
}) {
  const t = tooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={32} />
        <Tooltip {...t} />
        {lines.map((l) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.name ?? l.key} stroke={l.color} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ScatterViz({ data, height = 260 }: { data: any[]; height?: number }) {
  const t = tooltipStyle()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
        <XAxis type="number" dataKey="duration" name="Duration (min)" tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} />
        <YAxis type="number" dataKey="impact" name="Impact" tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} width={32} domain={[0, 100]} />
        <ZAxis range={[30, 30]} />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} {...t} />
        <Scatter data={data} fill={C.c2} fillOpacity={0.55} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function GaugeViz({ value, label, color = C.c1, max = 100 }: { value: number; label: string; color?: string; max?: number }) {
  // hand-built SVG arc gauge (270° sweep) — reliable across recharts versions
  const pct = Math.max(0, Math.min(1, value / max))
  const start = 135 // degrees
  const sweep = 270
  const r = 70
  const cx = 90
  const cy = 90
  const polar = (deg: number) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  const arcPath = (fromDeg: number, toDeg: number) => {
    const p1 = polar(fromDeg)
    const p2 = polar(toDeg)
    const large = toDeg - fromDeg > 180 ? 1 : 0
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`
  }
  return (
    <div className="relative">
      <svg viewBox="0 0 180 180" className="mx-auto w-40" role="img" aria-label={`${label}: ${value}`}>
        <path d={arcPath(start, start + sweep)} fill="none" stroke="color-mix(in oklch, var(--muted) 70%, transparent)" strokeWidth="14" strokeLinecap="round" />
        <path d={arcPath(start, start + sweep * pct)} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold tabular-nums" style={{ color }}>{value}</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

// risk-coloured gauge used on the forecast page
export function RiskGauge({ value }: { value: number }) {
  const color = value >= 80 ? C.c3 : value >= 62 ? C.c1 : value >= 42 ? C.c2 : C.c4
  return <GaugeViz value={value} label="Impact Score" color={color} />
}

// 24h congestion timeline
export function TimelineArea({ data }: { data: { hour: number; congestion: number }[] }) {
  const fmt = data.map((d) => ({ ...d, hour: `${String(d.hour).padStart(2, "0")}h` }))
  return <AreaViz data={fmt} dataKey="congestion" xKey="hour" color={C.c2} height={220} />
}

// explainable-AI feature contribution bars (diverging)
export function ContributionBars({ data }: { data: { feature: string; value: number }[] }) {
  const t = tooltipStyle()
  const sorted = [...data].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8)
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.grid} horizontal />
        <XAxis type="number" tick={{ fontSize: 11, fill: C.text }} stroke={C.grid} />
        <YAxis type="category" dataKey="feature" tick={{ fontSize: 10, fill: C.text }} stroke={C.grid} width={120} />
        <Tooltip cursor={{ fill: "color-mix(in oklch, var(--muted) 40%, transparent)" }} {...t} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {sorted.map((d, i) => (
            <Cell key={i} fill={d.value >= 0 ? C.c3 : C.c4} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
