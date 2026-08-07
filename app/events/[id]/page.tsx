"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PageHeader, RiskBadge } from "@/components/ui-kit"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { RiskGauge, TimelineArea } from "@/components/charts"
import { DigitalTwin } from "@/components/digital-twin"
import {
  Radar,
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  User,
  ShieldAlert,
  Users,
  Cone,
  Activity,
  FileText,
  History,
  AlertTriangle,
  Download
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { TrafficEvent, AuditLog, EventReport } from "@/types/database"
import { generateReport } from "@/lib/report"
import { useEngine } from "@/lib/data-provider"

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { model, summary } = useEngine()

  const [event, setEvent] = useState<TrafficEvent | null>(null)
  const [reports, setReports] = useState<EventReport[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    async function loadEventData() {
      try {
        const res = await fetch(`/api/events/${id}`)
        const data = await res.json()

        if (data.event) {
          setEvent(data.event)
          setReports(data.reports || [])
          setAuditLogs(data.audit_logs || [])
        } else {
          toast.error("Event Not Found")
        }
      } catch (err) {
        console.error("Failed to load event details:", err)
      } finally {
        setLoading(false)
      }
    }

    loadEventData()
  }, [id])

  const handleExportPdf = async () => {
    if (!event || !event.prediction || !model || !summary) {
      toast.error("Forecast data or model context missing for export")
      return
    }

    setIsExporting(true)
    try {
      const forecastInput = {
        cause: event.event_type,
        corridor: event.corridor,
        junction: event.junction,
        zone: event.zone,
        policeStation: event.police_station,
        priority: event.priority,
        eventType: event.event_type,
        requiresClosure: event.requires_closure,
        hour: parseInt(event.event_time?.split(":")[0] || "18", 10),
        dayOfWeek: 5,
        durationMin: event.duration_minutes,
      }

      const plan = event.prediction.resource_plan || {
        officers: 12,
        marshals: 6,
        barricades: 20,
        diversions: 3,
        checkpoints: 4,
        ambulances: 1,
        rapid_response_units: 2,
        deployment_json: {},
      }

      const scenarioData = {
        input: forecastInput,
        result: {
          impact: event.prediction.impact_score,
          risk: event.prediction.risk_level,
          confidence: event.prediction.confidence,
          timeline: event.prediction.timeline_json || [],
          contributions: event.prediction.feature_importance_json || [],
          similar: event.prediction.similar_events_json || [],
          policeStationRec: { primary: event.police_station, supporting: [], confidence: 90 },
          driverPercentages: [],
          plan,
        },
      }

      generateReport({
        summary,
        model,
        scenarioA: scenarioData,
        scenarioB: scenarioData,
      })

      const repRes = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prediction_id: event.prediction.id,
        }),
      })

      const repData = await repRes.json()
      if (repRes.ok && repData.report) {
        setReports((prev) => [repData.report, ...prev])
      }

      toast.success("PDF Report Exported & Audit Recorded")
    } catch (err) {
      console.error("PDF generation failed:", err)
      toast.error("Export Failed")
    } finally {
      setIsExporting(false)
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-4 py-8">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted/40" />
        </div>
      </AppShell>
    )
  }

  if (!event) {
    return (
      <AppShell>
        <div className="p-12 text-center space-y-4">
          <AlertTriangle className="mx-auto size-12 text-destructive" />
          <h2 className="text-xl font-bold">Traffic Event Not Found</h2>
          <p className="text-xs text-muted-foreground">The requested event ID does not exist in Supabase.</p>
          <Link href="/forecast/history" className={cn(buttonVariants({ size: "sm" }))}>
            Back to Forecast History
          </Link>
        </div>
      </AppShell>
    )
  }

  const pred = event.prediction
  const plan = pred?.resource_plan

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href="/forecast/history"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Forecast Registry
        </Link>
      </div>

      <PageHeader
        page="07"
        title={event.title}
        subtitle={`Event Record ID: #${event.id} - Stored in Supabase PostgreSQL`}
      />

      <div className="space-y-6">
        {/* Event Header Banner */}
        <Card className="glass p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {pred && <RiskBadge level={pred.risk_level} large />}
                <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary uppercase tracking-wider">
                  {event.event_type.replace(/_/g, " ")}
                </span>
                <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  Status: {event.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-muted-foreground pt-2">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Corridor</p>
                  <p className="font-bold text-foreground truncate">{event.corridor}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Junction</p>
                  <p className="font-bold text-foreground truncate">{event.junction}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Police Station</p>
                  <p className="font-bold text-foreground truncate">{event.police_station}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">Date & Time</p>
                  <p className="font-bold text-foreground truncate">{event.event_date} at {event.event_time}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Button onClick={handleExportPdf} disabled={isExporting} className="gap-2 rounded-xl shadow-md">
                <Download className="size-4" /> {isExporting ? "Exporting PDF..." : "Export Action Report PDF"}
              </Button>
            </div>
          </div>
        </Card>

        {/* Prediction & Risk Score Section */}
        {pred && (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="glass p-5 flex flex-col justify-center text-center">
              <RiskGauge value={pred.impact_score} />
              <p className="mt-2 text-xs text-muted-foreground font-semibold">Predicted Impact Score (0-100)</p>
            </Card>

            <Card className="glass p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">24-Hour Congestion Timeline</h3>
                <span className="text-xs font-semibold text-primary">
                  Clearance Est: {pred.estimated_clearance} min
                </span>
              </div>
              <div className="h-52">
                <TimelineArea data={pred.timeline_json || []} />
              </div>
            </Card>
          </div>
        )}

        {/* Resource Plan Breakdown */}
        {plan && (
          <Card className="glass p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-foreground">AI Resource Deployment Plan</h3>
              <p className="text-xs text-muted-foreground">Officer counts, barricades, and diversions stored for this event</p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-center">
                <Users className="mx-auto size-6 text-primary" />
                <p className="mt-2 font-mono text-2xl font-bold">{plan.officers}</p>
                <p className="text-xs text-muted-foreground">Traffic Officers</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-center">
                <Cone className="mx-auto size-6 text-amber-500" />
                <p className="mt-2 font-mono text-2xl font-bold">{plan.barricades}</p>
                <p className="text-xs text-muted-foreground">Barricades</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-center">
                <ShieldAlert className="mx-auto size-6 text-sky-500" />
                <p className="mt-2 font-mono text-2xl font-bold">{plan.checkpoints}</p>
                <p className="text-xs text-muted-foreground">Checkpoints</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/50 p-4 text-center">
                <Activity className="mx-auto size-6 text-emerald-500" />
                <p className="mt-2 font-mono text-2xl font-bold">{plan.diversions}</p>
                <p className="text-xs text-muted-foreground">Diversion Routes</p>
              </div>
            </div>

            {/* Digital Twin City Simulation Grid */}
            <div className="pt-2">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3">Live City Grid Digital Twin Simulation</h4>
              <div className="h-72 overflow-hidden rounded-xl border border-border">
                <DigitalTwin
                  officers={plan.officers}
                  barricades={plan.barricades}
                  diversions={plan.diversions}
                  checkpoints={plan.checkpoints}
                  intensity="Moderate"
                  risk={pred?.risk_level || "Moderate"}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Audit Log Timeline */}
        <Card className="glass p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <History className="size-4 text-primary" /> Event Compliance & Audit History
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No audit entries logged for this event.</p>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3 text-xs">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary font-bold">
                    <User className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-foreground">
                        {log.user_profile?.full_name || "BTP Officer"} - <span className="text-primary">{log.action}</span>
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                    {log.metadata_json && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground bg-muted/50 p-1.5 rounded">
                        {JSON.stringify(log.metadata_json)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}
