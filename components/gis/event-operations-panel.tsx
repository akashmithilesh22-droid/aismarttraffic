"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useMemo } from "react"
import { Activity, AlertTriangle, BarChart3, FileText, ShieldCheck, Users, Workflow } from "lucide-react"
import { useGIS } from "./gis-provider"

export function EventOperationsPanel() {
  const { selectedEvent, setSelectedEvent, events, setActivePanel } = useGIS()

  const event = useMemo(() => {
    return events.find((item) => item.id === selectedEvent) ?? null
  }, [events, selectedEvent])

  if (!event) {
    return (
      <Card className="glass h-full p-4">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select an event on the map to inspect operational intelligence.
        </div>
      </Card>
    )
  }

  const prediction = event.prediction
  const plan = prediction?.resource_plan
  const risk = prediction?.risk_level ?? "Moderate"

  return (
    <Card className="glass h-full overflow-hidden p-0">
      <div className="border-b border-border/60 bg-background/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Operations Panel</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{event.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{event.corridor} · {event.junction}</p>
          </div>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            {risk}
          </Badge>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-auto p-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Impact Score</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{prediction?.impact_score ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Confidence</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{prediction?.confidence ?? 0}%</p>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-primary" /> Prediction Summary
          </div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Risk</span><span className="font-medium text-foreground">{risk}</span></div>
            <div className="flex justify-between"><span>Attendance</span><span className="font-medium text-foreground">{event.expected_attendance}</span></div>
            <div className="flex justify-between"><span>Duration</span><span className="font-medium text-foreground">{event.duration_minutes} min</span></div>
            <div className="flex justify-between"><span>Status</span><span className="font-medium text-foreground">{event.status}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <BarChart3 className="size-4 text-primary" /> Timeline
          </div>
          <div className="mt-3 space-y-2">
            {(prediction?.timeline_json ?? []).slice(0, 5).map((point) => (
              <div key={point.hour} className="flex items-center justify-between rounded-md bg-background/70 px-2 py-2 text-sm">
                <span className="text-muted-foreground">Hour {point.hour}</span>
                <span className="font-medium text-foreground">{point.congestion}% congestion</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Workflow className="size-4 text-primary" /> Resource Plan
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Traffic Officers", plan?.officers ?? 0],
              ["Patrol Vehicles", plan?.rapid_response_units ?? 0],
              ["Barricades", plan?.barricades ?? 0],
              ["Diversion Points", plan?.diversions ?? 0],
              ["Ambulances", plan?.ambulances ?? 0],
              ["R.R.U.", plan?.rapid_response_units ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-background/70 px-2 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                <p className="mt-1 text-base font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary" /> Assigned Officers
          </div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div className="flex justify-between"><span>Assigned</span><span className="font-medium text-foreground">{event.assigned_to ?? "Pending"}</span></div>
            <div className="flex justify-between"><span>Station</span><span className="font-medium text-foreground">{event.police_station}</span></div>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileText className="size-4 text-primary" /> Generated Reports
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            {event.prediction ? "Reports are generated from the existing AI prediction workflow." : "No prediction-linked reports yet."}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setActivePanel("detail")}>Open Event</Button>
          <Button size="sm" variant="outline" onClick={() => setActivePanel("report")}>Generate Report</Button>
          <Button size="sm" variant="outline" onClick={() => setActivePanel("assign")}>Assign Officer</Button>
        </div>
      </div>
    </Card>
  )
}
