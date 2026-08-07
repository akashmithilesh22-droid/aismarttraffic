"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PageHeader, RiskBadge } from "@/components/ui-kit"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Radar,
  Search,
  Calendar,
  Building2,
  User,
  ArrowRight,
  ExternalLink
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { TrafficEvent } from "@/types/database"

export default function ForecastHistoryPage() {
  const [events, setEvents] = useState<TrafficEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [riskFilter, setRiskFilter] = useState("ALL")

  useEffect(() => {
    async function fetchForecastHistory() {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("events")
          .select(`
            *,
            creator_profile:profiles!events_created_by_fkey(full_name, role, police_station, badge_number),
            prediction:predictions(
              id,
              impact_score,
              risk_level,
              confidence,
              estimated_clearance,
              resource_plan:resource_plans(*)
            )
          `)
          .order("created_at", { ascending: false })

        if (error) {
          console.error("Error fetching forecast history:", error.message)
        } else if (data) {
          setEvents(data as TrafficEvent[])
        }
      } catch (err) {
        console.error("Error:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchForecastHistory()
  }, [])

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.corridor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.junction.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.police_station.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesRisk =
      riskFilter === "ALL" || evt.prediction?.risk_level === riskFilter

    return matchesSearch && matchesRisk
  })

  return (
    <AppShell>
      <PageHeader
        page="06"
        title="Forecast History & Event Registry"
        subtitle="Review all stored traffic forecasts, predictions, resource plans, and officer audit logs in Supabase PostgreSQL."
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by event title, corridor, junction, or station..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select value={riskFilter} onValueChange={(val) => setRiskFilter(val || "ALL")}>
              <SelectTrigger className="text-xs bg-card">
                <SelectValue placeholder="Filter Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Risk Levels</SelectItem>
                <SelectItem value="Critical" className="text-xs">Critical Risk</SelectItem>
                <SelectItem value="High" className="text-xs">High Risk</SelectItem>
                <SelectItem value="Moderate" className="text-xs">Moderate Risk</SelectItem>
                <SelectItem value="Low" className="text-xs">Low Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Link href="/forecast" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 rounded-xl")}>
            <Radar className="size-3.5" /> New Forecast
          </Link>
        </div>
      </div>

      {/* Forecast History List / Grid */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/40" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <Card className="glass p-12 text-center space-y-3">
          <Radar className="mx-auto size-10 text-muted-foreground opacity-50" />
          <h3 className="text-base font-bold">No Forecast Records Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {searchQuery || riskFilter !== "ALL"
              ? "No events match your search query or risk filter."
              : "Generate and save a prediction in the Forecast Command Center to create your first stored database record."}
          </p>
          <Link href="/forecast" className={cn(buttonVariants({ size: "sm" }), "mt-2 gap-1.5")}>
            Go to Forecast Command Center <ArrowRight className="size-3.5" />
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((evt) => (
            <Card
              key={evt.id}
              className="glass p-5 transition-all hover:border-primary/50 shadow-sm relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Event Basic Info */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {evt.prediction && <RiskBadge level={evt.prediction.risk_level} small />}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {evt.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] font-mono font-medium text-muted-foreground">
                      #{evt.id.substring(0, 8)}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground truncate">{evt.title}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Building2 className="size-3.5 text-primary" /> {evt.police_station}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5 text-accent" /> {evt.event_date} at {evt.event_time}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="size-3.5 text-muted-foreground" /> Officer: {evt.creator_profile?.full_name || "BTP Officer"}
                    </span>
                  </div>
                </div>

                {/* Score & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-border">
                  {evt.prediction && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">Impact Score</p>
                      <p className="font-mono text-2xl font-extrabold text-primary">
                        {evt.prediction.impact_score}<span className="text-xs font-normal text-muted-foreground">/100</span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events/${evt.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5 text-xs")}
                    >
                      View Details <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  )
}
