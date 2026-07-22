"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { AppShell } from "@/components/app-shell"
import { PageHeader, RiskBadge } from "@/components/ui-kit"
import { useEngine } from "@/lib/data-provider"
import { resolveJunctions } from "@/lib/data-provider"
import { predict, recommendResources, riskOf } from "@/lib/model"
import type { ForecastInput } from "@/lib/types"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RiskGauge, TimelineArea, ContributionBars } from "@/components/charts"
import { Activity, MapPin, Clock, ShieldAlert, Sparkles, Users, Cone, ArrowRight, AlertTriangle, AlertCircle, Info } from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function ForecastPage() {
  const { loading, model, options, junctionLookup } = useEngine()

  const [input, setInput] = useState<ForecastInput | null>(null)

  // Initialise defaults once options load — junction is picked from first filtered result
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
      requiresClosure: false,
      hour: 18,
      dayOfWeek: 5,
      durationMin: 60,
    }
  }, [options, junctionLookup])

  const active = input ?? defaults

  // Dynamic junction list: filtered by current cause + corridor + zone
  const filteredJunctions = useMemo(() => {
    if (!active) return options.junctions
    return resolveJunctions(junctionLookup, options.junctions, active.cause, active.corridor, active.zone)
  }, [active?.cause, active?.corridor, active?.zone, junctionLookup, options.junctions])

  const result = useMemo(() => {
    if (!model || !active) return null
    const r = predict(model, active)
    const plan = recommendResources(r.impact, active, model.bandStats, model.causeStats, model.corridorZoneStats)
    return { ...r, plan }
  }, [model, active])

  if (loading || !active || !result) {
    return (
      <AppShell>
        <PageHeader page="03" title="Forecast Command Center" subtitle="Loading model…" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted/40" />
          ))}
        </div>
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
    (key: "cause" | "corridor" | "zone" | "junction" | "priority" | "eventType") =>
    (v: unknown) =>
      update(key, String(v ?? ""))
  const setNum =
    (key: "hour" | "durationMin") => (v: number | readonly number[]) =>
      update(key, Array.isArray(v) ? v[0] : (v as number))

  return (
    <AppShell>
      <PageHeader
        page="03"
        title="Forecast Command Center"
        subtitle="Configure an upcoming event and generate a live AI congestion forecast, risk score, and timeline."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* ---------- input panel ---------- */}
        <Card className="glass h-fit p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Event Parameters
          </div>
          <div className="flex flex-col gap-4">
            {/* Event Cause */}
            <Field label="Event Cause" icon={<Activity className="size-3.5" />}>
              <Select value={active.cause} onValueChange={setStr("cause")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.causes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Corridor */}
            <Field label="Corridor / Road" icon={<MapPin className="size-3.5" />}>
              <Select value={active.corridor} onValueChange={setStr("corridor")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.corridors.map((c) => (
                    <SelectItem key={c} value={c}>{c.length > 42 ? c.slice(0, 42) + "…" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Zone */}
            <Field label="Zone" icon={<MapPin className="size-3.5" />}>
              <Select value={active.zone} onValueChange={setStr("zone")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.zones.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Junction — filtered by cause + corridor + zone */}
            <Field label="Junction" icon={<MapPin className="size-3.5" />}>
              <Select value={active.junction} onValueChange={setStr("junction")}>
                <SelectTrigger><SelectValue placeholder="Select junction…" /></SelectTrigger>
                <SelectContent>
                  {filteredJunctions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No junctions found for this combination
                    </div>
                  ) : (
                    filteredJunctions.map((j) => (
                      <SelectItem key={j} value={j}>{j.length > 42 ? j.slice(0, 42) + "…" : j}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <Select value={active.priority} onValueChange={setStr("priority")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.priorities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Event Type">
                <Select value={active.eventType} onValueChange={setStr("eventType")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.eventTypes.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={`Time of day — ${String(active.hour).padStart(2, "0")}:00`} icon={<Clock className="size-3.5" />}>
              <Slider
                value={[active.hour]}
                min={0}
                max={23}
                step={1}
                onValueChange={setNum("hour")}
              />
            </Field>

            <Field label={`Expected duration — ${active.durationMin} min`}>
              <Slider
                value={[active.durationMin]}
                min={15}
                max={360}
                step={15}
                onValueChange={setNum("durationMin")}
              />
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="size-4 text-accent" /> Requires road closure
              </div>
              <Switch
                checked={active.requiresClosure}
                onCheckedChange={(v) => update("requiresClosure", v)}
              />
            </div>
          </div>
        </Card>

        {/* ---------- right column container ---------- */}
        <div className="flex flex-col gap-5">
          {/* ---------- smart alerts ---------- */}
          {(() => {
            const alerts: { icon: React.ReactNode; color: string; bg: string; border: string; title: string; msg: string }[] = []
            if (result.risk === "Critical" || result.risk === "High") {
              alerts.push({
                icon: <AlertTriangle className="size-4 shrink-0" />,
                color: "text-destructive",
                bg: "bg-destructive/10",
                border: "border-destructive/30",
                title: `${result.risk} Risk Alert`,
                msg: `Predicted impact ${result.impact}/100 — severe congestion expected. Immediate resource staging recommended.`,
              })
            }
            if (result.plan.officers > 16) {
              alerts.push({
                icon: <AlertCircle className="size-4 shrink-0" />,
                color: "text-orange-400",
                bg: "bg-orange-500/10",
                border: "border-orange-500/30",
                title: "Resource Intensity Warning",
                msg: `${result.plan.officers} officers and ${result.plan.barricades} barricades required — ensure advance procurement and staging.`,
              })
            }
            if (result.plan.diversions > 0) {
              alerts.push({
                icon: <Info className="size-4 shrink-0" />,
                color: "text-accent",
                bg: "bg-accent/10",
                border: "border-accent/30",
                title: "Diversion Recommended",
                msg: `${result.plan.diversions} alternate diversion route(s) suggested — coordinate with neighbouring zones for smooth traffic flow.`,
              })
            }
            if (alerts.length === 0) return null
            return (
              <div className="flex flex-col gap-2">
                {alerts.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${a.bg} ${a.border} ${a.color}`}
                  >
                    {a.icon}
                    <div>
                      <span className="font-semibold">{a.title}: </span>
                      <span className="text-foreground/80">{a.msg}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )
          })()}

          {/* ---------- results ---------- */}
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 md:grid-cols-[260px_1fr]">
              <Card className="glass flex flex-col items-center justify-center p-5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Predicted Impact</span>
                <RiskGauge value={result.impact} />
                <RiskBadge risk={result.risk} />
                <div className="mt-3 w-full">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Model Confidence</span>
                    <span className="font-semibold text-foreground">{result.confidence}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </Card>

              <Card className="glass p-5">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Clock className="size-4 text-accent" /> 24-Hour Congestion Forecast
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Projected congestion intensity across the day — recalculated for every input change.
                </p>
                <TimelineArea data={result.timeline} />

                {/* Forecast Drivers */}
                <div className="mt-5 border-t border-border/50 pt-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                    <Sparkles className="size-3 text-primary animate-pulse" /> Forecast Drivers
                  </div>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    Percentage contribution of key event factors to the predicted traffic impact.
                  </p>
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
                    {result.driverPercentages.map((driver) => (
                      <div key={driver.name} className="rounded-lg border border-border/50 bg-background/20 p-2 text-center">
                        <span className="text-[10px] text-muted-foreground block truncate" title={driver.name}>{driver.name}</span>
                        <span className="font-mono text-sm font-bold text-foreground block mt-0.5">{driver.value}%</span>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden mt-1.5">
                          <motion.div
                            className="h-full rounded-full bg-accent"
                            initial={{ width: 0 }}
                            animate={{ width: `${driver.value}%` }}
                            transition={{ duration: 0.8 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Three equal-height cards: Why / Station / Resources */}
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" style={{ alignItems: 'stretch' }}>

              {/* Why This Prediction */}
              <Card
                className="glass flex flex-col"
                style={{ padding: '28px', minHeight: '460px', overflow: 'visible' }}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="size-4 text-primary" /> Why this prediction
                </div>
                <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                  Each factor&apos;s contribution to the risk score (explainable AI).
                </p>
                <div style={{ flex: 1, minHeight: '340px' }}>
                  <ContributionBars data={result.contributions} />
                </div>
              </Card>

              {/* Responsible Police Station */}
              <Card
                className="glass flex flex-col"
                style={{ padding: '28px', minHeight: '460px', overflow: 'visible' }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldAlert className="size-4 text-primary" /> Responsible Police Station
                </div>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Recommended primary responding unit based on historical incident patterns.
                </p>

                <div className="flex flex-col gap-5" style={{ flex: 1 }}>
                  <div className="rounded-xl border border-primary/20 bg-primary/5" style={{ padding: '20px' }}>
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest block mb-2">Primary Response Station</span>
                    <span className="text-xl font-bold text-primary leading-snug block">{result.policeStationRec.primary}</span>
                  </div>

                  {result.policeStationRec.supporting && result.policeStationRec.supporting.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest block mb-3">Supporting Station(s)</span>
                      <div className="flex flex-col gap-2">
                        {result.policeStationRec.supporting.map((station) => (
                          <span
                            key={station}
                            className="text-xs bg-muted/60 border border-border/50 rounded-lg text-foreground/80 font-medium block"
                            style={{ padding: '10px 16px' }}
                          >
                            {station}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid color-mix(in oklch, var(--border) 50%, transparent)' }}>
                  <div className="flex items-center justify-between text-xs" style={{ marginBottom: '10px' }}>
                    <span className="text-muted-foreground font-medium">Assignment Confidence</span>
                    <span className="font-bold text-foreground text-sm">{result.policeStationRec.confidence}%</span>
                  </div>
                  <div className="rounded-full bg-muted overflow-hidden" style={{ height: '10px' }}>
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${result.policeStationRec.confidence}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </Card>

              {/* Quick Resource Snapshot */}
              <Card
                className="glass flex flex-col"
                style={{ padding: '28px', minHeight: '460px', overflow: 'visible' }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users className="size-4 text-accent" /> Quick Resource Snapshot
                  </div>
                  <Link
                    href="/resources"
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-xs")}
                  >
                    Full plan <ArrowRight className="size-3" />
                  </Link>
                </div>

                <div
                  className="grid grid-cols-2"
                  style={{ flex: 1, gap: '16px', alignContent: 'start' }}
                >
                  <SnapStat label="Police Officers" value={result.plan.officers} icon={<Users className="size-5" />} />
                  <SnapStat label="Barricades" value={result.plan.barricades} icon={<Cone className="size-5" />} />
                  <SnapStat label="Traffic Marshals" value={result.plan.marshals} icon={<Users className="size-5" />} />
                  <SnapStat label="Diversions" value={result.plan.diversions} icon={<MapPin className="size-5" />} />
                </div>

                <div
                  className="rounded-xl border border-border bg-background/40 text-sm text-muted-foreground"
                  style={{ marginTop: '20px', padding: '14px 20px' }}
                >
                  Barricade intensity:{" "}
                  <span className="font-semibold text-foreground">{result.plan.barricadeIntensity}</span>
                </div>
              </Card>
            </div>

            {/* similar historical events */}
            <Card className="glass p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Activity className="size-4 text-primary" /> Most Similar Historical Incidents
              </div>
              <div className="flex flex-col gap-2">
                {result.similar.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No similar incidents found for this combination.</p>
                ) : (
                  result.similar.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                        {s.similarity}%
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{s.cause} — {s.corridor || "Unknown corridor"}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.zone || "—"} · {s.durationMin !== null ? `${s.durationMin} min` : "duration n/a"}
                        </div>
                      </div>
                      <RiskBadge risk={riskOf(s.impact)} small />
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  )
}

function SnapStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-border bg-background/40 flex flex-col"
      style={{ padding: '20px', gap: '12px', minHeight: '110px' }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">{icon}</div>
      <div className="font-mono font-bold tabular-nums leading-none" style={{ fontSize: '2.25rem' }}>{value}</div>
      <div className="text-xs text-muted-foreground font-medium leading-snug">{label}</div>
    </div>
  )
}
