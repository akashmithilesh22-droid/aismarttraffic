"use client"

import { useMemo, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader, StatCard } from "@/components/ui-kit"
import { useEngine } from "@/lib/data-provider"
import { BarViz, GradientBarViz, ScatterViz, GaugeViz, AreaViz, LineViz } from "@/components/charts"
import { Pipeline } from "@/components/pipeline"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Database,
  Layers,
  Hash,
  Tags,
  CircleSlash,
  HeartPulse,
  Search,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import {
  countBy,
  avgImpactBy,
  hourlyDistribution,
  durationBuckets,
  impactHistogram,
  correlationMatrix,
  scatterDurationImpact,
  weekdayDistribution,
  monthlyTrend,
} from "@/lib/analytics"


const TRAIN_STEPS = [
  "CSV Dataset",
  "Data Cleaning",
  "Feature Engineering",
  "Feature Selection",
  "Model Training",
  "Cross Validation",
  "Forecast Model",
]

export default function TrainingPage() {
  return (
    <AppShell>
      <TrainingInner />
    </AppShell>
  )
}

function TrainingInner() {
  const { records, summary, model, rawRows, headers } = useEngine()
  const [query, setQuery] = useState("")

  const causeCounts = useMemo(() => countBy(records, (r) => r.cause).sort((a, b) => b.value - a.value).slice(0, 8), [records])
  const causeImpact = useMemo(() => avgImpactBy(records, (r) => r.cause).sort((a, b) => b.value - a.value).slice(0, 8), [records])
  const hourly = useMemo(() => hourlyDistribution(records), [records])
  const durations = useMemo(() => durationBuckets(records), [records])
  const histogram = useMemo(() => impactHistogram(records), [records])
  const corridorImpact = useMemo(
    () => avgImpactBy(records, (r) => r.corridor).filter((c) => c.count > 2).sort((a, b) => b.value - a.value).slice(0, 12),
    [records],
  )
  const zoneImpact = useMemo(
    () => avgImpactBy(records, (r) => r.zone).filter((c) => c.count > 1).sort((a, b) => b.value - a.value).slice(0, 12),
    [records],
  )
  const weekday = useMemo(() => weekdayDistribution(records), [records])
  const monthly = useMemo(() => monthlyTrend(records), [records])
  const corr = useMemo(() => correlationMatrix(records), [records])
  const scatter = useMemo(() => scatterDurationImpact(records), [records])


  const displayHeaders = headers.slice(0, 9)
  const filteredRows = useMemo(() => {
    const base = rawRows.slice(0, 600)
    if (!query.trim()) return base.slice(0, 100)
    const q = query.toLowerCase()
    return base.filter((r) => displayHeaders.some((h) => String(r[h] ?? "").toLowerCase().includes(q))).slice(0, 100)
  }, [rawRows, query, displayHeaders])

  if (!summary || !model) return null

  return (
    <>
      <PageHeader
        eyebrow="Page 02"
        title="AI Training Center"
        description="How the model learns. Every metric, chart, and insight is computed live from the uploaded dataset."
      >
        <Badge variant="outline" className="gap-1.5 border-accent/40 text-accent">
          <HeartPulse className="size-3.5" /> Health {summary.healthScore}/100
        </Badge>
      </PageHeader>

      {/* Training Status Banner */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
            <HeartPulse className="size-5 text-primary animate-pulse-glow" />
          </div>
          <div>
            <p className="text-sm font-semibold">Model Trained on <span className="text-primary">dataset csv file.csv</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.totalRecords.toLocaleString()} records → {model.metrics.n.toLocaleString()} usable training samples · {summary.totalFeatures} features
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <TrendingUp className="size-3" /> R² = {model.metrics.r2.toFixed(3)}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            Accuracy {model.metrics.accuracy.toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            CV = {model.metrics.cvScore.toFixed(3)}
          </span>
        </div>
      </section>

      {/* dataset overview */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dataset Overview</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Records" value={summary.totalRecords.toLocaleString()} icon={<Database className="size-4" />} />
          <StatCard label="Features" value={summary.totalFeatures} icon={<Layers className="size-4" />} />
          <StatCard label="Numerical" value={summary.numericalFeatures} icon={<Hash className="size-4" />} />
          <StatCard label="Categorical" value={summary.categoricalFeatures} icon={<Tags className="size-4" />} />
          <StatCard label="Missing Cells" value={`${summary.missingPct.toFixed(1)}%`} icon={<CircleSlash className="size-4" />} />
          <StatCard label="Health Score" value={summary.healthScore} sub="data quality" accent icon={<HeartPulse className="size-4" />} />
        </div>
      </section>

      {/* dataset explorer */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dataset Explorer</h2>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search records…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
          </div>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b border-border">
                  {displayHeaders.map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 font-medium text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/40">
                    {displayHeaders.map((h) => (
                      <td key={h} className="max-w-[180px] truncate px-3 py-2 text-foreground/80" title={String(row[h] ?? "")}>
                        {String(row[h] ?? "—").slice(0, 40) || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
            Showing {filteredRows.length} of {summary.totalRecords.toLocaleString()} records · {displayHeaders.length} of{" "}
            {headers.length} columns
          </div>
        </Card>
      </section>

      {/* EDA */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Exploratory Data Analysis</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Incidents by Cause" subtitle="Frequency distribution">
            <BarViz data={causeCounts} color="var(--chart-1)" />
          </ChartCard>
          <ChartCard title="Avg Impact by Cause" subtitle="Learned severity per cause">
            <GradientBarViz data={causeImpact} />
          </ChartCard>
          <ChartCard title="Hourly Incident Pattern" subtitle="Count across hour-of-day">
            <BarViz data={hourly} dataKey="count" xKey="hour" color="var(--chart-2)" />
          </ChartCard>
          <ChartCard title="Impact Distribution" subtitle="Histogram of congestion impact">
            <GradientBarViz data={histogram} />
          </ChartCard>
          <ChartCard title="Resolution Duration" subtitle="How long incidents persist">
            <BarViz data={durations} color="var(--chart-4)" />
          </ChartCard>
          <ChartCard title="Duration vs Impact" subtitle="Scatter relationship">
            <ScatterViz data={scatter} />
          </ChartCard>
          <ChartCard title="Top Zones by Avg Impact" subtitle="Zones with highest average congestion impact">
            <BarViz data={zoneImpact.map((z) => ({ name: z.name.length > 18 ? z.name.slice(0, 18) + "…" : z.name, value: z.value }))} horizontal height={260} color="var(--chart-5)" />
          </ChartCard>
        </div>
        <ChartCard title="Top Corridors by Avg Impact" subtitle="Most sensitive corridors learned from data">
          <BarViz data={corridorImpact} horizontal height={300} color="var(--chart-3)" />
        </ChartCard>
        {monthly.length > 1 && (
          <ChartCard title="Monthly Incident Trend" subtitle="Seasonal patterns and volume over time">
            <LineViz
              data={monthly}
              xKey="name"
              lines={[
                { key: "count", color: "var(--chart-1)", name: "Incidents" },
                { key: "avgImpact", color: "var(--chart-2)", name: "Avg Impact" },
              ]}
              height={240}
            />
          </ChartCard>
        )}
        <ChartCard title="Incidents by Weekday" subtitle="Which days see the most incidents">
          <BarViz data={weekday.map((d) => ({ name: d.day, value: d.count }))} color="var(--chart-4)" />
        </ChartCard>
      </section>

      {/* correlation heatmap */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Correlation Dashboard</h2>
        <Card className="p-5">
          <p className="mb-4 text-sm text-muted-foreground">Pearson correlation between engineered features.</p>
          <CorrelationHeatmap keys={corr.keys} matrix={corr.matrix} />
        </Card>
      </section>

      {/* training pipeline */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">AI Training Pipeline</h2>
          <Pipeline steps={TRAIN_STEPS} />
        </Card>

        {/* model performance */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Model Performance</h2>
          <div className="grid grid-cols-3 gap-2">
            <GaugeViz value={Math.round(model.metrics.accuracy)} label="Accuracy" color="var(--chart-1)" />
            <GaugeViz value={Math.round(model.metrics.r2 * 100)} label="R² Score" color="var(--chart-2)" />
            <GaugeViz value={Math.round(model.metrics.cvScore * 100)} label="CV Score" color="var(--chart-4)" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard label="RMSE" value={model.metrics.rmse.toFixed(1)} sub="impact points" />
            <StatCard label="MAE" value={model.metrics.mae.toFixed(1)} sub="impact points" />
          </div>
        </Card>
      </section>

      {/* explainable AI */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Explainable AI · Feature Importance</h2>
        <Card className="p-5">
          <div className="space-y-3">
            {model.importance.map((f) => (
              <div key={f.feature} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    {f.direction === "increases" ? (
                      <TrendingUp className="size-3.5 text-destructive" />
                    ) : (
                      <TrendingDown className="size-3.5 text-accent" />
                    )}
                    {f.feature}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{(f.importance * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${f.importance * 100}%`,
                      background: f.direction === "increases" ? "var(--chart-3)" : "var(--chart-2)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Importance = |regression weight| × feature standard deviation. Red factors push congestion up; teal factors
            reduce it.
          </p>
        </Card>
      </section>
    </>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <h3 className="text-sm font-medium">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

function CorrelationHeatmap({ keys, matrix }: { keys: string[]; matrix: { x: string; y: string; value: number }[] }) {
  const cellColor = (v: number) => {
    // -1 (teal) .. 0 (muted) .. 1 (orange/red)
    if (v >= 0) return `color-mix(in oklch, var(--chart-3) ${Math.round(v * 100)}%, var(--muted))`
    return `color-mix(in oklch, var(--chart-2) ${Math.round(-v * 100)}%, var(--muted))`
  }
  return (
    <div className="overflow-x-auto">
      <div className="inline-block min-w-full">
        <div className="grid" style={{ gridTemplateColumns: `120px repeat(${keys.length}, minmax(56px, 1fr))` }}>
          <div />
          {keys.map((k) => (
            <div key={k} className="px-1 pb-2 text-center text-[10px] text-muted-foreground">
              {k}
            </div>
          ))}
          {keys.map((ky) => (
            <div key={ky} className="contents">
              <div className="flex items-center pr-2 text-right text-[11px] text-muted-foreground">{ky}</div>
              {keys.map((kx) => {
                const cell = matrix.find((m) => m.x === kx && m.y === ky)!
                return (
                  <div
                    key={kx + ky}
                    className="m-0.5 flex aspect-square items-center justify-center rounded font-mono text-[10px]"
                    style={{ background: cellColor(cell.value), color: Math.abs(cell.value) > 0.5 ? "var(--background)" : "var(--foreground)" }}
                    title={`${ky} vs ${kx}: ${cell.value}`}
                  >
                    {cell.value.toFixed(2)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
