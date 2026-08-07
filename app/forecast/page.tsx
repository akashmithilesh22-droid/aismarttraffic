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
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
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
import { IncidentMap } from "@/components/incident-map"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Activity,
  MapPin,
  Clock,
  ShieldAlert,
  Sparkles,
  Users,
  Cone,
  ArrowRight,
  AlertTriangle,
  AlertCircle,
  Info,
  Save,
  CheckCircle2,
  Loader2,
  Map,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ForecastPage() {
  const { loading, model, options, junctionLookup, records } = useEngine()
  const [input, setInput] = useState<ForecastInput | null>(null)
  const [eventTitle, setEventTitle] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [savedEventId, setSavedEventId] = useState<string | null>(null)

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
    if (key === "cause" || key === "corridor" || key === "zone") {
      const available = resolveJunctions(junctionLookup, options.junctions, newInput.cause, newInput.corridor, newInput.zone)
      newInput.junction = available[0] ?? ""
    }
    setInput(newInput)
    setSavedEventId(null)
  }

  const setStr = (key: "cause" | "corridor" | "zone" | "junction" | "priority" | "eventType") =>
    (v: unknown) => update(key, String(v ?? ""))
  const setNum = (key: "hour" | "durationMin") => (v: number | readonly number[]) =>
    update(key, Array.isArray(v) ? v[0] : (v as number))

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
      color: "text-warning",
      bg: "bg-warning/10",
      border: "border-warning/30",
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

  const handleSaveAndForecast = async () => {
    setIsSaving(true)
    setSavedEventId(null)

    try {
      const titleToUse = eventTitle.trim() || `${active.cause.toUpperCase()} at ${active.junction || active.corridor}`

      const eventRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleToUse,
          event_type: active.cause,
          priority: active.priority,
          location: active.junction || active.corridor,
          corridor: active.corridor,
          junction: active.junction,
          zone: active.zone,
          police_station: result.policeStationRec.primary || "Bengaluru Central",
          event_date: new Date().toISOString().split("T")[0],
          event_time: `${String(active.hour).padStart(2, "0")}:00`,
          duration_minutes: active.durationMin,
          requires_closure: active.requiresClosure,
        }),
      })

      const eventData = await eventRes.json()
      if (!eventRes.ok || !eventData.event) {
        throw new Error(eventData.error || "Failed to create event in Supabase")
      }

      const eventId = eventData.event.id

      const predRes = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          impact_score: result.impact,
          risk_level: result.risk,
          confidence: result.confidence,
          estimated_clearance: active.durationMin,
          timeline_json: result.timeline,
          feature_importance_json: result.contributions,
          similar_events_json: result.similar,
          resource_plan: result.plan,
        }),
      })

      const predData = await predRes.json()
      if (!predRes.ok) {
        throw new Error(predData.error || "Failed to save prediction to Supabase")
      }

      setSavedEventId(eventId)
      toast.success("Forecast & Event Saved", {
        description: `Event persistent ID #${eventId.substring(0, 8)} stored in Supabase PostgreSQL.`,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving forecast"
      toast.error("Save Error", { description: msg })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell>
      <PageHeader
        page="03"
        title="Forecast Command Center"
        subtitle="Configure an upcoming event and generate a live AI congestion forecast, risk score, and timeline."
      />

      <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
        <Card className="glass h-fit p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary shrink-0" /> Event Parameters
          </div>

          <div className="flex flex-col gap-2.5">
            <div>
              <Label className="text-xs">Event Name / Label</Label>
              <Input
                placeholder="e.g. Political Rally at Freedom Park"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="mt-1 bg-background/60"
              />
            </div>

            <Field label="Event Cause" icon={<Activity className="size-3.5" />}>
              <Select value={active.cause} onValueChange={setStr("cause")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.causes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Corridor / Road" icon={<MapPin className="size-3.5" />}>
              <Select value={active.corridor} onValueChange={setStr("corridor")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.corridors.map((c) => (
                    <SelectItem key={c} value={c}>{c.length > 36 ? c.slice(0, 36) + "…" : c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Zone" icon={<MapPin className="size-3.5" />}>
              <Select value={active.zone} onValueChange={setStr("zone")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.zones.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Junction" icon={<MapPin className="size-3.5" />}>
              <Select value={active.junction} onValueChange={setStr("junction")}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select junction…" /></SelectTrigger>
                <SelectContent>
                  {filteredJunctions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground">No junctions found for this combination</div>
                  ) : (
                    filteredJunctions.map((j) => (
                      <SelectItem key={j} value={j}>{j.length > 36 ? j.slice(0, 36) + "…" : j}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Priority">
                <Select value={active.priority} onValueChange={setStr("priority")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.priorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Event Type">
                <Select value={active.eventType} onValueChange={setStr("eventType")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.eventTypes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={`Time of day — ${String(active.hour).padStart(2, "0")}:00`} icon={<Clock className="size-3.5" />}>
              <Slider value={[active.hour]} min={0} max={23} step={1} onValueChange={setNum("hour")} />
            </Field>

            <Field label={`Expected duration — ${active.durationMin} min`}>
              <Slider value={[active.durationMin]} min={15} max={360} step={15} onValueChange={setNum("durationMin")} />
            </Field>

            <div className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="size-4 text-accent shrink-0" />
                <span>Requires road closure</span>
              </div>
              <Switch checked={active.requiresClosure} onCheckedChange={(v) => update("requiresClosure", v)} />
            </div>

            <div className="pt-3 space-y-2">
              <Button
                onClick={handleSaveAndForecast}
                disabled={isSaving}
                className="w-full gap-2 font-semibold shadow-md"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving to Supabase...
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> Save Event & Persist Forecast
                  </>
                )}
              </Button>

              {savedEventId && (
                <Link
                  href={`/events/${savedEventId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full gap-2 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10")}
                >
                  <CheckCircle2 className="size-3.5" /> View Saved Event Details (#{savedEventId.substring(0, 8)})
                </Link>
              )}
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          {alerts.length > 0 && (
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
                  <div className="min-w-0">
                    <span className="font-semibold">{a.title}: </span>
                    <span className="text-foreground/80">{a.msg}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            <Card className="glass flex flex-col items-center justify-center p-5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Predicted Impact</span>
              <RiskGauge value={result.impact} />
              <RiskBadge risk={result.risk} />
              <div className="mt-3 w-full">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Model Confidence</span>
                  <span className="font-semibold text-foreground">{result.confidence}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
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

              <div className="mt-5 border-t border-border/50 pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
                  <Sparkles className="size-3 text-primary animate-pulse" /> Forecast Drivers
                </div>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  Percentage contribution of key event factors to the predicted traffic impact.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {result.driverPercentages.map((driver) => (
                    <div key={driver.name} className="rounded-lg border border-border/50 bg-background/20 p-2 text-center">
                      <span className="block max-w-full truncate text-[10px] text-muted-foreground" title={driver.name}>
                        {driver.name}
                      </span>
                      <span className="mt-0.5 block font-mono text-sm font-bold text-foreground">{driver.value}%</span>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
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
              <p className="text-[11px] text-muted-foreground mt-2">
                Assigned station in charge
              </p>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="glass flex flex-col justify-center p-4 text-center">
              <RiskGauge value={result.impact} />
              <p className="mt-1 text-xs text-muted-foreground">Impact Score (0-100)</p>
            </Card>

            <Card className="glass flex flex-col justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Risk Level</p>
                <div className="mt-2">
                  <RiskBadge level={result.risk} large />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Based on historical impact analysis
              </p>
            </Card>

            <Card className="glass flex flex-col justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Confidence Score</p>
                <p className="mt-1 font-mono text-3xl font-extrabold text-foreground">
                  {Math.round(result.confidence)}%
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Derived from ensemble variance
              </p>
            </Card>

            <Card className="glass flex flex-col justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Primary Police Station</p>
                <p className="mt-1 text-sm font-bold text-primary truncate">
                  {result.policeStationRec.primary || "Indiranagar Traffic PS"}
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Assigned station in charge
              </p>
            </Card>
          </div>

          <Card className="glass p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">24-Hour Congestion Timeline</h3>
                <p className="text-xs text-muted-foreground">
                  Hourly predicted congestion percentage across peak window
                </p>
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Clock className="size-3.5" /> Peak at {active.hour}:00
              </span>
            </div>
            <div className="h-56">
              <TimelineArea data={result.timeline} />
            </div>
          </Card>

          <Card className="glass p-5">
            <div className="mb-3">
              <h3 className="text-sm font-bold">SHAP-Style Feature Contributions</h3>
              <p className="text-xs text-muted-foreground">
                How each input parameter contributed to increasing or decreasing the impact score
              </p>
            </div>
            <ContributionBars data={result.contributions} />
          </Card>

          <Card className="glass p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Recommended Resource Deployment</h3>
                <p className="text-xs text-muted-foreground">
                  AI-computed manpower, barricading, and emergency units
                </p>
              </div>
              <Link href="/resources" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}>
                Full Resource View <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-center">
                <Users className="mx-auto size-5 text-primary" />
                <p className="mt-1 font-mono text-xl font-bold">{result.plan.officers}</p>
                <p className="text-[11px] text-muted-foreground">Traffic Officers</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-center">
                <Cone className="mx-auto size-5 text-amber-500" />
                <p className="mt-1 font-mono text-xl font-bold">{result.plan.barricades}</p>
                <p className="text-[11px] text-muted-foreground">Barricades</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-center">
                <ShieldAlert className="mx-auto size-5 text-sky-500" />
                <p className="mt-1 font-mono text-xl font-bold">{result.plan.checkpoints}</p>
                <p className="text-[11px] text-muted-foreground">Checkpoints</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-center">
                <Activity className="mx-auto size-5 text-emerald-500" />
                <p className="mt-1 font-mono text-xl font-bold">{result.plan.diversions}</p>
                <p className="text-[11px] text-muted-foreground">Diversion Routes</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Card className="glass flex flex-col p-6">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="size-4 text-primary" /> Why this prediction
              </div>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Each factor's contribution to the risk score (explainable AI).
              </p>
              <div className="flex-1" style={{ minHeight: 300 }}>
                <ContributionBars data={result.contributions} />
              </div>
            </Card>

            <Card className="glass flex flex-col p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-primary" /> Responsible Police Station
              </div>
              <p className="mb-5 text-xs leading-relaxed text-muted-foreground">
                Recommended primary responding unit based on historical incident patterns.
              </p>
              <div className="flex flex-1 flex-col gap-4">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Primary Response Station
                  </span>
                  <span className="block break-words text-lg font-bold leading-snug text-primary">
                    {result.policeStationRec.primary}
                  </span>
                </div>
                {result.policeStationRec.supporting.length > 0 && (
                  <div>
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Supporting Station(s)
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {result.policeStationRec.supporting.map((s) => (
                        <span key={s} className="block break-words rounded-lg border border-border/50 bg-muted/60 px-3 py-2 text-xs font-medium text-foreground/80">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-5 border-t border-border/50 pt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium text-muted-foreground">Assignment Confidence</span>
                  <span className="font-bold text-foreground">{result.policeStationRec.confidence}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${result.policeStationRec.confidence}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
            </Card>

            <Card className="glass flex flex-col p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Users className="size-4 text-accent" /> Quick Resource Snapshot
                </div>
                <Link href="/resources" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-xs")}>
                  Full plan <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3" style={{ alignContent: "start" }}>
                <SnapStat label="Police Officers" value={result.plan.officers} icon={<Users className="size-5" />} />
                <SnapStat label="Barricades" value={result.plan.barricades} icon={<Cone className="size-5" />} />
                <SnapStat label="Traffic Marshals" value={result.plan.marshals} icon={<Users className="size-5" />} />
                <SnapStat label="Diversions" value={result.plan.diversions} icon={<MapPin className="size-5" />} />
              </div>
              <div className="mt-4 rounded-xl border border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                Barricade intensity: <span className="font-semibold text-foreground">{result.plan.barricadeIntensity}</span>
              </div>
            </Card>
          </div>

          <Card className="glass p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Activity className="size-4 text-primary" /> Most Similar Historical Incidents
            </div>
            <div className="flex flex-col gap-2">
              {result.similar.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">No similar incidents found for this combination.</p>
              ) : (
                result.similar.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/40 px-3 py-2.5"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                      {s.similarity}%
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{s.cause} — {s.corridor || "Unknown corridor"}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.zone || "—"} · {s.durationMin !== null ? `${s.durationMin} min` : "duration n/a"}
                      </div>
                    </div>
                    <RiskBadge risk={riskOf(s.impact)} small />
                  </motion.div>
                ))
              )}
            </div>
          </Card>

          <Card className="glass p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Map className="size-4 text-primary" /> Area-Wide Incident Heatmap
            </div>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              Geographic distribution of all historical incidents across Bengaluru. Heat intensity reflects incident density and severity. Scroll to zoom, drag to pan, hover a point for details.
            </p>
            <IncidentMap records={records} />
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}{label}
      </Label>
      {children}
    </div>
  )
}

function SnapStat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-background/40 p-4">
      <div className="text-muted-foreground">{icon}</div>
      <div className="font-mono text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="break-words text-xs font-medium leading-snug text-muted-foreground">{label}</div>
    </div>
  )
}
