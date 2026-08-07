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
  FileText,
  History
} from "lucide-react"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ForecastPage() {
  const { loading, model, options, junctionLookup } = useEngine()

  const [input, setInput] = useState<ForecastInput | null>(null)
  const [eventTitle, setEventTitle] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [savedEventId, setSavedEventId] = useState<string | null>(null)

  // Initialise defaults once options load
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

  // Dynamic junction list
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
    setSavedEventId(null)
  }

  const setStr =
    (key: "cause" | "corridor" | "zone" | "junction" | "priority" | "eventType") =>
    (v: unknown) =>
      update(key, String(v ?? ""))
  const setNum =
    (key: "hour" | "durationMin") => (v: number | readonly number[]) =>
      update(key, Array.isArray(v) ? v[0] : (v as number))

  // Persist Event & Prediction to Supabase PostgreSQL
  const handleSaveAndForecast = async () => {
    setIsSaving(true)
    setSavedEventId(null)

    try {
      const titleToUse = eventTitle.trim() || `${active.cause.toUpperCase()} at ${active.junction || active.corridor}`

      // 1. Create Event via POST /api/events
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

      // 2. Save Prediction via POST /api/predictions
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

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        {/* ---------- input panel ---------- */}
        <Card className="glass h-fit p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Event Parameters
          </div>

          <div className="space-y-4 text-xs">
            {/* Event Name Input */}
            <div>
              <Label className="text-xs">Event Name / Label</Label>
              <Input
                placeholder="e.g. Political Rally at Freedom Park"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="mt-1 bg-background/60"
              />
            </div>

            {/* Cause / Event Type */}
            <div>
              <Label className="text-xs">Event Cause / Type</Label>
              <Select value={active.cause} onValueChange={setStr("cause")}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.causes.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Corridor */}
            <div>
              <Label className="text-xs">Traffic Corridor</Label>
              <Select value={active.corridor} onValueChange={setStr("corridor")}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.corridors.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Zone */}
            <div>
              <Label className="text-xs">Zone</Label>
              <Select value={active.zone} onValueChange={setStr("zone")}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.zones.map((z) => (
                    <SelectItem key={z} value={z} className="text-xs">
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Junction */}
            <div>
              <Label className="text-xs">Key Junction</Label>
              <Select value={active.junction} onValueChange={setStr("junction")}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredJunctions.map((j) => (
                    <SelectItem key={j} value={j} className="text-xs">
                      {j}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div>
              <Label className="text-xs">Event Priority</Label>
              <Select value={active.priority} onValueChange={setStr("priority")}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.priorities.map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {p} Priority
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Hour of Day */}
            <div>
              <div className="flex justify-between">
                <Label className="text-xs">Peak Hour of Day</Label>
                <span className="font-mono text-xs text-primary">{active.hour}:00 hrs</span>
              </div>
              <Slider
                value={[active.hour]}
                min={0}
                max={23}
                step={1}
                onValueChange={setNum("hour")}
                className="mt-2"
              />
            </div>

            {/* Expected Duration */}
            <div>
              <div className="flex justify-between">
                <Label className="text-xs">Duration (minutes)</Label>
                <span className="font-mono text-xs text-primary">{active.durationMin} min</span>
              </div>
              <Slider
                value={[active.durationMin]}
                min={15}
                max={360}
                step={15}
                onValueChange={setNum("durationMin")}
                className="mt-2"
              />
            </div>

            {/* Requires Road Closure */}
            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="closure" className="text-xs font-medium cursor-pointer">
                Requires Road Closure
              </Label>
              <Switch
                id="closure"
                checked={active.requiresClosure}
                onCheckedChange={(c) => update("requiresClosure", c)}
              />
            </div>

            {/* Action Buttons */}
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

        {/* ---------- results dashboard ---------- */}
        <div className="space-y-5">
          {/* Top Banner: Risk Gauge + Key Metrics */}
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

          {/* 24-Hour Timeline */}
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

          {/* Explainable AI: Feature Contributions */}
          <Card className="glass p-5">
            <div className="mb-3">
              <h3 className="text-sm font-bold">SHAP-Style Feature Contributions</h3>
              <p className="text-xs text-muted-foreground">
                How each input parameter contributed to increasing or decreasing the impact score
              </p>
            </div>
            <ContributionBars data={result.contributions} />
          </Card>

          {/* Recommended Resource Plan Summary */}
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
        </div>
      </div>
    </AppShell>
  )
}
