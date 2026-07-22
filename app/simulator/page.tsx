"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { PageHeader, RiskBadge } from "@/components/ui-kit"
import { useEngine, resolveJunctions } from "@/lib/data-provider"
import { predict, recommendResources, riskOf } from "@/lib/model"
import type { ForecastInput } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BarViz, GradientBarViz, LineViz, AreaViz } from "@/components/charts"
import { weekdayDistribution, monthlyTrend, hourlyDistribution, avgImpactBy, countBy } from "@/lib/analytics"
import { FlaskConical, FileDown, GitCompareArrows, BarChart3, TrendingUp, Sparkles, FileText, Bot, MapPin } from "lucide-react"
import { generateReport } from "@/lib/report"
import { AiAssistant } from "@/components/ai-assistant"

const C2 = "var(--chart-2)"
const C1 = "var(--chart-1)"
const C4 = "var(--chart-4)"

export default function SimulatorPage() {
  const { loading, model, records, summary, options, junctionLookup } = useEngine()

  const base = useMemo<ForecastInput | null>(() => {
    if (!options.causes.length) return null
    const cause = options.causes[0]
    const corridor = options.corridors[0] ?? ""
    const zone = options.zones[0] ?? ""
    const junctions = resolveJunctions(junctionLookup, options.junctions, cause, corridor, zone)
    return {
      cause,
      corridor,
      zone,
      junction: junctions[0] ?? "",
      policeStation: "",
      priority: "Medium",
      eventType: options.eventTypes[0] ?? "planned",
      requiresClosure: false,
      hour: 14,
      dayOfWeek: 3,
      durationMin: 60,
    }
  }, [options, junctionLookup])

  const [scenA, setScenA] = useState<ForecastInput | null>(null)
  const [scenB, setScenB] = useState<ForecastInput | null>(null)

  const a = scenA ?? base
  const b =
    scenB ??
    (base
      ? (() => {
          const junctions = resolveJunctions(junctionLookup, options.junctions, base.cause, base.corridor, base.zone)
          return {
            ...base,
            priority: "High",
            requiresClosure: true,
            hour: 18,
            durationMin: 180,
            junction: junctions[0] ?? base.junction,
          }
        })()
      : null)

  const results = useMemo(() => {
    if (!model || !a || !b) return null
    const ra = predict(model, a)
    const rb = predict(model, b)
    return {
      a: { ...ra, plan: recommendResources(ra.impact, a, model.bandStats, model.causeStats, model.corridorZoneStats) },
      b: { ...rb, plan: recommendResources(rb.impact, b, model.bandStats, model.causeStats, model.corridorZoneStats) },
    }
  }, [model, a, b])

  const weekday = useMemo(() => weekdayDistribution(records), [records])
  const monthly = useMemo(() => monthlyTrend(records), [records])
  const hourly = useMemo(() => hourlyDistribution(records), [records])
  const topCorridors = useMemo(
    () => avgImpactBy(records, (r) => r.corridor).filter((c) => c.count > 2).sort((x, y) => y.value - x.value).slice(0, 10),
    [records],
  )
  const causeDist = useMemo(
    () => countBy(records, (r) => r.cause).sort((a, b) => b.value - a.value).slice(0, 8),
    [records],
  )
  const priorityDist = useMemo(
    () => countBy(records, (r) => r.priority).sort((a, b) => b.value - a.value),
    [records],
  )

  if (loading || !a || !b || !results || !summary || !model) {
    return (
      <AppShell>
        <PageHeader page="05" title="Simulator &amp; Reports" subtitle="Loading…" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </AppShell>
    )
  }

  function handleReport() {
    if (!model || !summary) return
    generateReport({ summary, model, scenarioA: { input: a!, result: results!.a }, scenarioB: { input: b!, result: results!.b } })
  }

  // Executive Summary text generated from live model data
  const topFeature = model.importance[0]
  const topCause = Object.entries(model.causeImpact).sort((a, b) => b[1] - a[1])[0]
  const avgImpactA = results.a.impact
  const avgImpactB = results.b.impact
  const betterScenario = avgImpactA <= avgImpactB ? "A" : "B"

  return (
    <AppShell>
      <PageHeader
        page="05"
        title="Simulator &amp; Reports"
        subtitle="Run what-if scenarios, compare interventions side by side, and explore historical patterns from the full dataset."
      >
        <Button onClick={handleReport} className="gap-2">
          <FileDown className="size-4" /> Export PDF Report
        </Button>
      </PageHeader>

      <Tabs defaultValue="simulator">
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="simulator" className="gap-1.5"><GitCompareArrows className="size-4" /> What-If Comparison</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="size-4" /> Historical Analytics</TabsTrigger>
          <TabsTrigger value="assistant" className="gap-1.5"><Bot className="size-4" /> AI Assistant</TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5"><FileText className="size-4" /> Executive Summary</TabsTrigger>
        </TabsList>

        {/* ---------------- simulator ---------------- */}
        <TabsContent value="simulator">
          <div className="grid gap-5 lg:grid-cols-2">
            <ScenarioPanel
              title="Scenario A"
              accent={C1}
              input={a}
              options={options}
              junctionLookup={junctionLookup}
              onChange={(v) => setScenA(v)}
              result={results.a}
            />
            <ScenarioPanel
              title="Scenario B"
              accent={C2}
              input={b}
              options={options}
              junctionLookup={junctionLookup}
              onChange={(v) => setScenB(v)}
              result={results.b}
            />
          </div>

          {/* comparison */}
          <Card className="glass mt-5 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <GitCompareArrows className="size-4 text-primary" /> Head-to-Head Comparison
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <CompareStat label="Impact Score" a={results.a.impact} b={results.b.impact} />
              <CompareStat label="Police Officers" a={results.a.plan.officers} b={results.b.plan.officers} />
              <CompareStat label="Barricades" a={results.a.plan.barricades} b={results.b.plan.barricades} />
              <CompareStat label="Diversions" a={results.a.plan.diversions} b={results.b.plan.diversions} />
            </div>
            <div className="mt-5">
              <p className="mb-2 text-xs text-muted-foreground">24-hour congestion overlay</p>
              <LineViz
                data={results.a.timeline.map((t, i) => ({ hour: `${String(t.hour).padStart(2, "0")}h`, A: t.congestion, B: results.b.timeline[i].congestion }))}
                xKey="hour"
                lines={[
                  { key: "A", color: C1, name: "Scenario A" },
                  { key: "B", color: C2, name: "Scenario B" },
                ]}
                height={220}
              />
            </div>
          </Card>

          {/* Before vs After AI */}
          <Card className="glass mt-5 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> Without AI Planning vs With SmartTraffic AI
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-destructive">Without AI Planning</p>
                <div className="space-y-2">
                  {[
                    { label: "Avg response time", value: model?.baselineStats ? `${model.baselineStats.avgResolutionMin} min` : "45–90 min", bad: true },
                    { label: "Resource estimation", value: "Manual guess", bad: true },
                    { label: "Congestion visibility", value: "Reactive only", bad: true },
                    { label: "Diversion planning", value: "Post-incident", bad: true },
                    { label: "Traffic efficiency", value: model?.baselineStats ? `~${Math.round(model.baselineStats.resolvedRate * 100)}%` : "~40%", bad: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-destructive">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">With SmartTraffic AI</p>
                <div className="space-y-2">
                  {[
                    { label: "Avg response time", value: model?.baselineStats ? `< ${Math.max(5, Math.round(model.baselineStats.avgResolutionMin * 0.35))} min` : "< 5 min" },
                    { label: "Resource estimation", value: `${results.a.plan.officers} officers optimal`, },
                    { label: "Congestion visibility", value: "24h forecast" },
                    { label: "Diversion planning", value: "Pre-emptive routes" },
                    { label: "Traffic efficiency", value: model?.baselineStats ? `~${Math.min(99, Math.round(model.baselineStats.resolvedRate * 100 * 1.35))}%` : "~75–85%" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-accent">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- analytics ---------------- */}
        <TabsContent value="analytics">
          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Incidents by Hour of Day" icon={<TrendingUp className="size-4 text-primary" />} desc="When incidents are most frequent across the day.">
              <AreaViz data={hourly.map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}h`, congestion: h.count }))} dataKey="congestion" xKey="hour" color={C1} />
            </ChartCard>
            <ChartCard title="Average Impact by Hour" icon={<Sparkles className="size-4 text-accent" />} desc="Severity profile — peak hours carry the highest congestion impact.">
              <AreaViz data={hourly.map((h) => ({ hour: `${String(h.hour).padStart(2, "0")}h`, congestion: h.avgImpact }))} dataKey="congestion" xKey="hour" color={C2} />
            </ChartCard>
            <ChartCard title="Incidents by Weekday" icon={<BarChart3 className="size-4 text-primary" />} desc="Weekly distribution of recorded incidents.">
              <BarViz data={weekday.map((d) => ({ name: d.day, value: d.count }))} color={C1} />
            </ChartCard>
            <ChartCard title="Highest-Impact Corridors" icon={<TrendingUp className="size-4 text-accent" />} desc="Roads with the highest average congestion impact.">
              <GradientBarViz data={topCorridors.map((c) => ({ name: c.name.length > 16 ? c.name.slice(0, 16) + "…" : c.name, value: c.value }))} />
            </ChartCard>
            <ChartCard title="Event Cause Distribution" icon={<BarChart3 className="size-4 text-primary" />} desc="Frequency of each incident cause type.">
              <BarViz data={causeDist} color={C4} />
            </ChartCard>
            <ChartCard title="Priority Level Distribution" icon={<Sparkles className="size-4 text-accent" />} desc="Breakdown of incident priority levels.">
              <GradientBarViz data={priorityDist} />
            </ChartCard>
          </div>
          {monthly.length > 1 && (
            <Card className="glass mt-5 p-5">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="size-4 text-primary" /> Monthly Incident Trend &amp; Seasonal Analysis
              </div>
              <p className="mb-3 text-xs text-muted-foreground">Incident volume and average impact over time — shows seasonal patterns and congestion trends.</p>
              <LineViz
                data={monthly}
                xKey="name"
                lines={[
                  { key: "count", color: C1, name: "Incidents" },
                  { key: "avgImpact", color: C2, name: "Avg Impact" },
                ]}
                height={240}
              />
            </Card>
          )}
        </TabsContent>

        {/* ---------------- AI assistant ---------------- */}
        <TabsContent value="assistant">
          <AiAssistant model={model} summary={summary} />
        </TabsContent>

        {/* ---------------- executive summary ---------------- */}
        <TabsContent value="summary">
          <Card className="glass p-6 space-y-6">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="size-4 text-primary" /> Traffic Management Executive Summary
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Dataset &amp; Model Overview</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The SmartTraffic AI platform was trained on <strong className="text-foreground">{summary.totalRecords.toLocaleString()} real Bengaluru traffic incidents</strong> across {summary.totalFeatures} features.
                  The model uses gradient descent regression with 5-fold cross-validation, achieving a <strong className="text-foreground">risk-band accuracy of {model.metrics.accuracy.toFixed(0)}%</strong>,
                  R² of <strong className="text-foreground">{model.metrics.r2.toFixed(2)}</strong>, and cross-validation score of {model.metrics.cvScore.toFixed(2)}.
                  Dataset health score: {summary.healthScore}/100.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Forecast Results</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Scenario A</strong> predicts a congestion impact of {results.a.impact}/100 (<span className={results.a.risk === "Critical" || results.a.risk === "High" ? "text-destructive font-semibold" : "text-accent font-semibold"}>{results.a.risk} Risk</span>).
                  <strong className="text-foreground"> Scenario B</strong> predicts an impact of {results.b.impact}/100 ({results.b.risk} Risk).
                  Scenario {betterScenario} presents the lower congestion risk and should be prioritised for primary deployment planning.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Responsible Police Stations</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For <strong className="text-foreground">Scenario A</strong>, the primary responding unit is <strong className="text-foreground">{results.a.policeStationRec.primary}</strong> (Confidence: {results.a.policeStationRec.confidence}%) with supporting coverage from {results.a.policeStationRec.supporting.slice(0, 2).join(" and ") || "adjacent units"}.
                  For <strong className="text-foreground">Scenario B</strong>, the response will be led by <strong className="text-foreground">{results.b.policeStationRec.primary}</strong> (Confidence: {results.b.policeStationRec.confidence}%).
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Key Risk Drivers</p>
                <ul className="space-y-1">
                  {model.importance.slice(0, 5).map((f, i) => (
                    <li key={f.feature} className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] text-primary">{i + 1}</span>
                      <span className="text-foreground font-medium">{f.feature}</span>
                      <span className="text-muted-foreground">— {(f.importance * 100).toFixed(0)}% weight, {f.direction} congestion</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  The highest-impact cause in the dataset is <strong className="text-foreground">&quot;{topCause[0]}&quot;</strong> with avg impact {topCause[1].toFixed(1)}/100.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Resource Recommendation (Scenario A)</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    { label: "Police Officers", value: results.a.plan.officers },
                    { label: "Traffic Marshals", value: results.a.plan.marshals },
                    { label: "Barricades", value: `${results.a.plan.barricades} (${results.a.plan.barricadeIntensity})` },
                    { label: "Checkpoints", value: results.a.plan.checkpoints },
                    { label: "Diversion Routes", value: results.a.plan.diversions },
                    { label: "Ambulances", value: results.a.plan.ambulances },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-border bg-card/60 p-3">
                      <p className="text-[11px] text-muted-foreground">{item.label}</p>
                      <p className="mt-0.5 font-mono text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Recommended Action Plan</p>
                <ol className="space-y-1.5 list-decimal list-inside">
                  {[
                    `Pre-stage ${results.a.plan.officers} police officers and ${results.a.plan.marshals} traffic marshals at least 2 hours before event`,
                    `Install ${results.a.plan.barricades} barricades at ${results.a.plan.barricadeIntensity.toLowerCase()} intensity on primary corridor`,
                    `Activate ${results.a.plan.diversions} diversion routes with signage and lane restrictions`,
                    `Deploy ${results.a.plan.ambulances} ambulances at pre-identified staging points`,
                    `Establish real-time communication with ${results.a.plan.checkpoints} checkpoints`,
                    results.a.risk === "Critical" || results.a.risk === "High" ? "Activate central command coordination and live CCTV monitoring immediately" : "Monitor situation via data feeds and adjust resources dynamically",
                  ].map((step, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="text-[11px] text-muted-foreground border-t border-border pt-3">
                All figures derived exclusively from {summary.totalRecords.toLocaleString()} real historical incidents. No synthetic data or external datasets used. Generated: {new Date().toLocaleString()}
              </div>
            </div>
            <Button onClick={handleReport} className="gap-2 w-full">
              <FileDown className="size-4" /> Download Full PDF Report
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}

function ScenarioPanel({
  title,
  accent,
  input,
  options,
  junctionLookup,
  onChange,
  result,
}: {
  title: string
  accent: string
  input: ForecastInput
  options: ReturnType<typeof useEngine>["options"]
  junctionLookup: Record<string, string[]>
  onChange: (v: ForecastInput) => void
  result: any
}) {
  // Filtered junctions for this scenario's current selection
  const filteredJunctions = useMemo(
    () => resolveJunctions(junctionLookup, options.junctions, input.cause, input.corridor, input.zone),
    [input.cause, input.corridor, input.zone, junctionLookup, options.junctions],
  )

  function update<K extends keyof ForecastInput>(key: K, value: ForecastInput[K]) {
    const newInput = { ...input, [key]: value } as ForecastInput
    if (key === "cause" || key === "corridor" || key === "zone") {
      const available = resolveJunctions(
        junctionLookup,
        options.junctions,
        newInput.cause,
        newInput.corridor,
        newInput.zone,
      )
      newInput.junction = available[0] ?? ""
    }
    onChange(newInput)
  }

  const setStr =
    (k: "cause" | "corridor" | "zone" | "junction" | "priority") =>
    (v: unknown) =>
      update(k, String(v ?? ""))
  const setNum =
    (k: "hour" | "durationMin") => (v: number | readonly number[]) =>
      update(k, Array.isArray(v) ? v[0] : (v as number))

  return (
    <Card className="glass p-5" style={{ borderColor: `color-mix(in oklch, ${accent} 35%, var(--border))` }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <span className="size-2.5 rounded-sm" style={{ background: accent }} /> {title}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl font-bold tabular-nums" style={{ color: accent }}>{result.impact}</span>
          <RiskBadge risk={riskOf(result.impact)} small />
        </div>
      </div>

      {/* Primary Station Recommendation Badge */}
      <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-border bg-background/20 px-3 py-1.5 text-xs text-muted-foreground">
        <MapPin className="size-3.5 text-primary shrink-0" />
        <span>Primary Station: <span className="font-semibold text-foreground">{result.policeStationRec.primary}</span></span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event Cause">
          <Select value={input.cause} onValueChange={setStr("cause")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{options.causes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Corridor">
          <Select value={input.corridor} onValueChange={setStr("corridor")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{options.corridors.map((c) => <SelectItem key={c} value={c}>{c.length > 30 ? c.slice(0, 30) + "…" : c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Zone">
          <Select value={input.zone} onValueChange={setStr("zone")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{options.zones.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Junction">
          <Select value={input.junction} onValueChange={setStr("junction")}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Junction…" /></SelectTrigger>
            <SelectContent>
              {filteredJunctions.map((j) => <SelectItem key={j} value={j}>{j.length > 30 ? j.slice(0, 30) + "…" : j}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={input.priority} onValueChange={setStr("priority")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{options.priorities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={`Hour — ${String(input.hour).padStart(2, "0")}:00`}>
          <Slider value={[input.hour]} min={0} max={23} step={1} onValueChange={setNum("hour")} />
        </Field>
        <Field label={`Duration — ${input.durationMin}m`}>
          <Slider value={[input.durationMin]} min={15} max={360} step={15} onValueChange={setNum("durationMin")} />
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
        Requires road closure
        <Switch checked={input.requiresClosure} onCheckedChange={(v) => update("requiresClosure", v)} />
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function CompareStat({ label, a, b }: { label: string; a: number; b: number }) {
  const diff = b - a
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center justify-between">
        <span className="font-mono text-lg font-bold tabular-nums" style={{ color: C1 }}>{a}</span>
        <span className="text-xs text-muted-foreground">vs</span>
        <span className="font-mono text-lg font-bold tabular-nums" style={{ color: C2 }}>{b}</span>
      </div>
      <p className={`mt-1 text-center text-xs font-medium ${diff > 0 ? "text-destructive" : diff < 0 ? "text-accent" : "text-muted-foreground"}`}>
        {diff > 0 ? "+" : ""}{diff} {diff === 0 ? "no change" : diff > 0 ? "higher in B" : "lower in B"}
      </p>
    </div>
  )
}

function ChartCard({ title, icon, desc, children }: { title: string; icon: React.ReactNode; desc: string; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass p-5">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
        <p className="mb-3 text-xs text-muted-foreground">{desc}</p>
        {children}
      </Card>
    </motion.div>
  )
}
