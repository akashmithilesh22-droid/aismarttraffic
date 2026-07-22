"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { PageHeader, RiskBadge } from "@/components/ui-kit"
import { useEngine, resolveJunctions } from "@/lib/data-provider"
import { predict, recommendResources } from "@/lib/model"
import type { ForecastInput } from "@/lib/types"
import { DigitalTwin } from "@/components/digital-twin"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Cone,
  ShieldCheck,
  Split,
  Ambulance,
  Siren,
  Route,
  CircleParking,
  ClipboardList,
  Check,
  MapPin,
} from "lucide-react"

export default function ResourcesPage() {
  const { loading, model, options, junctionLookup } = useEngine()
  const [input, setInput] = useState<ForecastInput | null>(null)

  const defaults = useMemo<ForecastInput | null>(() => {
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
      priority: options.priorities.includes("High") ? "High" : options.priorities[0] ?? "Medium",
      eventType: options.eventTypes[0] ?? "planned",
      requiresClosure: true,
      hour: 18,
      dayOfWeek: 5,
      durationMin: 120,
    }
  }, [options, junctionLookup])

  const active = input ?? defaults

  // Dynamic junction list: filtered by current cause + corridor + zone
  const filteredJunctions = useMemo(() => {
    if (!active) return options.junctions
    return resolveJunctions(junctionLookup, options.junctions, active.cause, active.corridor, active.zone)
  }, [active?.cause, active?.corridor, active?.zone, junctionLookup, options.junctions])

  const out = useMemo(() => {
    if (!model || !active) return null
    const r = predict(model, active)
    const plan = recommendResources(r.impact, active, model.bandStats, model.causeStats, model.corridorZoneStats)
    return { ...r, plan }
  }, [model, active])

  if (loading || !active || !out) {
    return (
      <AppShell>
        <PageHeader page="04" title="Resource Planning" subtitle="Loading…" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </AppShell>
    )
  }

  function update<K extends keyof ForecastInput>(key: K, value: ForecastInput[K]) {
    const newInput = { ...active!, [key]: value } as ForecastInput
    // Auto-reset junction when cause, corridor, or zone changes
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
    setInput(newInput)
  }

  const setStr =
    (k: "cause" | "corridor" | "zone" | "junction" | "priority") =>
    (v: unknown) =>
      update(k, String(v ?? ""))
  const setNum =
    (k: "hour" | "durationMin") => (v: number | readonly number[]) =>
      update(k, Array.isArray(v) ? v[0] : (v as number))

  const { plan } = out

  // estimated indicative cost model (derived, illustrative units)
  const personnel = plan.officers + plan.marshals + plan.rapidUnits
  const equipment = plan.barricades + plan.checkpoints * 2 + plan.diversions * 3

  const personnelGroups = [
    { label: "Police Officers", value: plan.officers, icon: <Users className="size-4" />, color: "var(--chart-1)" },
    { label: "Traffic Marshals", value: plan.marshals, icon: <Users className="size-4" />, color: "var(--chart-2)" },
    { label: "Rapid Response", value: plan.rapidUnits, icon: <Siren className="size-4" />, color: "var(--chart-3)" },
    { label: "Ambulances", value: plan.ambulances, icon: <Ambulance className="size-4" />, color: "var(--chart-4)" },
  ]
  const infraGroups = [
    { label: "Barricades", value: plan.barricades, icon: <Cone className="size-4" />, color: "var(--chart-1)" },
    { label: "Checkpoints", value: plan.checkpoints, icon: <ShieldCheck className="size-4" />, color: "var(--chart-2)" },
    { label: "Diversions", value: plan.diversions, icon: <Split className="size-4" />, color: "var(--chart-3)" },
    { label: "Lane Restrictions", value: plan.laneRestrictions, icon: <Route className="size-4" />, color: "var(--chart-4)" },
    { label: "Emergency Corridors", value: plan.emergencyCorridors, icon: <CircleParking className="size-4" />, color: "var(--chart-5)" },
  ]

  const maxInfra = Math.max(...infraGroups.map((g) => g.value), 1)

  return (
    <AppShell>
      <PageHeader
        page="04"
        title="Resource Planning"
        subtitle="AI-recommended manpower, barricading, and diversion deployment with a live digital twin of the corridor."
      >
        <RiskBadge risk={out.risk} large />
      </PageHeader>

      {/* controls */}
      <Card className="glass mb-5 p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Ctl label="Event Cause">
            <Select value={active.cause} onValueChange={setStr("cause")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.causes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Ctl>
          <Ctl label="Corridor">
            <Select value={active.corridor} onValueChange={setStr("corridor")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.corridors.map((c) => <SelectItem key={c} value={c}>{c.length > 36 ? c.slice(0, 36) + "…" : c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Ctl>
          <Ctl label="Zone">
            <Select value={active.zone} onValueChange={setStr("zone")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.zones.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Ctl>
          <Ctl label="Junction">
            <Select value={active.junction} onValueChange={setStr("junction")}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Junction…" /></SelectTrigger>
              <SelectContent>
                {filteredJunctions.map((j) => (
                  <SelectItem key={j} value={j}>{j.length > 32 ? j.slice(0, 32) + "…" : j}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Ctl>
          <Ctl label="Priority">
            <Select value={active.priority} onValueChange={setStr("priority")}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {options.priorities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Ctl>
          <Ctl label={`Hour — ${String(active.hour).padStart(2, "0")}:00`}>
            <Slider value={[active.hour]} min={0} max={23} step={1} onValueChange={setNum("hour")} />
          </Ctl>
          <Ctl label={`Duration — ${active.durationMin}m`}>
            <Slider value={[active.durationMin]} min={15} max={360} step={15} onValueChange={setNum("durationMin")} />
          </Ctl>
          <div className="flex items-end">
            <div className="flex w-full items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
              Closure
              <Switch checked={active.requiresClosure} onCheckedChange={(v) => update("requiresClosure", v)} />
            </div>
          </div>
        </div>
      </Card>

      {/* headline metrics */}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        <Headline label="Predicted Impact" value={out.impact} icon={<Siren className="size-4" />} accent />
        <Headline label="Responsible Station" value={out.policeStationRec.primary} icon={<MapPin className="size-4" />} />
        <Headline label="Total Personnel" value={personnel} icon={<Users className="size-4" />} />
        <Headline label="Equipment Units" value={equipment} icon={<Cone className="size-4" />} />
        <Headline label="Barricade Level" value={plan.barricadeIntensity} icon={<ShieldCheck className="size-4" />} />
      </div>

      {/* digital twin */}
      <Card className="glass mb-5 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Route className="size-4 text-primary" /> Digital Twin — Corridor Deployment
        </div>
        <DigitalTwin
          officers={plan.officers}
          barricades={plan.barricades}
          diversions={plan.diversions}
          checkpoints={plan.checkpoints}
          intensity={plan.barricadeIntensity}
          risk={out.risk}
        />
      </Card>

      {/* before vs after comparison */}
      <Card className="glass mb-5 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Siren className="size-4 text-primary" /> Without AI Planning vs With SmartTraffic AI
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-destructive">Without AI</p>
            {[
              { label: "Congestion level", value: model?.baselineStats ? `${model.baselineStats.avgImpact}/100 avg impact` : "Unmanaged / unpredicted" },
              { label: "Resource deployment", value: "Manual estimate" },
              { label: "Response time", value: model?.baselineStats ? `${model.baselineStats.avgResolutionMin} min avg duration` : "45–90 min reactive" },
              { label: "Officers deployed", value: model?.baselineStats ? `${Math.max(4, Math.round(model.baselineStats.avgImpact * 0.25))} (historical est)` : "Unknown / ad hoc" },
              { label: "Traffic efficiency", value: model?.baselineStats ? `~${Math.round(model.baselineStats.resolvedRate * 100)}% resolved` : "~35–40%" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-destructive">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">With SmartTraffic AI</p>
            {[
              { label: "Congestion level", value: `${out.impact}/100 impact score` },
              { label: "Resource deployment", value: `AI-optimised plan` },
              { label: "Response time", value: model?.baselineStats ? `< ${Math.max(5, Math.round(model.baselineStats.avgResolutionMin * 0.35))} min (pre-planned)` : "< 5 min pre-planned" },
              { label: "Officers deployed", value: `${plan.officers} optimal (AI calc)` },
              { label: "Traffic efficiency", value: model?.baselineStats ? `~${Math.min(99, Math.round(model.baselineStats.resolvedRate * 100 * 1.35))}% optimised` : "~75–85% optimised" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-accent">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* personnel */}
        <Card className="glass p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-accent" /> Personnel Deployment
          </div>
          <div className="grid grid-cols-2 gap-3">
            {personnelGroups.map((g, i) => (
              <motion.div
                key={g.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="rounded-lg border border-border bg-background/40 p-3"
              >
                <div className="mb-1 flex items-center gap-1.5" style={{ color: g.color }}>{g.icon}</div>
                <div className="font-mono text-2xl font-bold tabular-nums">{g.value}</div>
                <div className="text-xs text-muted-foreground">{g.label}</div>
              </motion.div>
            ))}
          </div>
        </Card>

        {/* infrastructure */}
        <Card className="glass p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Cone className="size-4 text-primary" /> Barricading &amp; Diversions
          </div>
          <div className="flex flex-col gap-3">
            {infraGroups.map((g, i) => (
              <motion.div
                key={g.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5" style={{ color: g.color }}>{g.icon}<span className="text-foreground">{g.label}</span></span>
                  <span className="font-mono font-semibold tabular-nums">{g.value}</span>
                </div>
                <Progress value={(g.value / maxInfra) * 100} className="h-1.5" />
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {/* deployment checklist */}
      <Card className="glass mt-5 p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ClipboardList className="size-4 text-accent" /> Recommended Deployment Sequence
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {buildChecklist(plan, out.risk, out.policeStationRec.primary).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2.5 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <Check className="size-3" />
              </span>
              <span className="text-muted-foreground">{step}</span>
            </motion.div>
          ))}
        </div>
      </Card>
    </AppShell>
  )
}

function Ctl({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Headline({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={`glass p-4 ${accent ? "ring-1 ring-primary/40" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <div className="mt-2 font-mono text-2xl font-bold tabular-nums">{value}</div>
    </Card>
  )
}

function buildChecklist(plan: ReturnType<typeof recommendResources>, risk: string, primaryStation: string): string[] {
  const steps = [
    `Coordinate deployment response and command hierarchy with ${primaryStation}`,
    `Deploy ${plan.officers} police officers across primary corridor and intersections`,
    `Install ${plan.barricades} barricades at ${plan.barricadeIntensity.toLowerCase()} intensity`,
    `Establish ${plan.checkpoints} inspection checkpoints with ${plan.marshals} traffic marshals`,
    `Activate ${plan.diversions} diversion routes and ${plan.laneRestrictions} lane restrictions`,
    `Stage ${plan.ambulances} ambulances and ${plan.emergencyCorridors} emergency corridors`,
    `Position ${plan.rapidUnits} rapid-response units for dynamic redeployment`,
  ]
  if (risk === "Critical" || risk === "High") {
    steps.push(`Establish real-time CCTV and communication sync with ${primaryStation} control center`)
  }
  return steps
}
