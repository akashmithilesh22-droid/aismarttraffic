"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { useAuth } from "@/providers/auth-provider"
import { useRealtime } from "@/providers/realtime-provider"
import { createClient } from "@/lib/supabase/client"
import {
  Radar,
  ShieldAlert,
  FlaskConical,
  Building2,
  CheckCircle2,
  FileText,
  AlertTriangle,
  History,
  Activity,
  UserCheck,
  Clock,
  Wifi,
  Shield,
  Gauge,
  CalendarDays,
  ArrowRight
} from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TrafficEvent, AuditLog } from "@/types/database"
import { formatDistanceToNow } from "date-fns"

export default function DashboardPage() {
  const { profile, role } = useAuth()
  const { isConnected, onlineOfficers, notifications } = useRealtime()
  
  const [todaysEventsCount, setTodaysEventsCount] = useState<number>(0)
  const [predictionsCount, setPredictionsCount] = useState<number>(0)
  const [highRiskCount, setHighRiskCount] = useState<number>(0)
  const [reportsCount, setReportsCount] = useState<number>(0)

  const [recentEvents, setRecentEvents] = useState<TrafficEvent[]>([])
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  const officerName = profile?.full_name || "Officer"
  const stationName = profile?.police_station || "Indiranagar Traffic PS"
  const badgeNum = profile?.badge_number || "BTP-OFFICER"
  const officerRole = role || "Inspector"

  const loadLiveStats = useCallback(async () => {
    try {
      const supabase = createClient()
      const todayStr = new Date().toISOString().split("T")[0]

      // 1. Fetch Today's Events Count
      const { count: eventsCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${todayStr}T00:00:00.000Z`)

      setTodaysEventsCount(eventsCount || 0)

      // 2. Fetch Predictions Count Today
      const { count: predCount } = await supabase
        .from("predictions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", `${todayStr}T00:00:00.000Z`)

      setPredictionsCount(predCount || 0)

      // 3. Fetch High / Critical Risk Predictions Count
      const { count: riskCount } = await supabase
        .from("predictions")
        .select("*", { count: "exact", head: true })
        .in("risk_level", ["High", "Critical"])

      setHighRiskCount(riskCount || 0)

      // 4. Fetch Total Reports Count
      const { count: repCount } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true })

      setReportsCount(repCount || 0)

      // 5. Fetch Recent Live Events
      const { data: eventsData } = await supabase
        .from("events")
        .select(`
          *,
          creator_profile:profiles!events_created_by_fkey(full_name, role),
          prediction:predictions(impact_score, risk_level)
        `)
        .order("created_at", { ascending: false })
        .limit(5)

      if (eventsData) setRecentEvents(eventsData as TrafficEvent[])

      // 6. Fetch Recent Audit Activity
      const { data: auditData } = await supabase
        .from("audit_logs")
        .select(`
          *,
          user_profile:profiles!audit_logs_user_id_fkey(full_name, role, police_station)
        `)
        .order("created_at", { ascending: false })
        .limit(6)

      if (auditData) setRecentAuditLogs(auditData as AuditLog[])
    } catch (err) {
      console.error("Error loading live dashboard statistics:", err)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadLiveStats()
  }, [loadLiveStats])

  // Live Subscription to updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel("dashboard-metrics")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadLiveStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => loadLiveStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => loadLiveStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => loadLiveStats())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadLiveStats])

  const quickStats = [
    { icon: CalendarDays, value: loadingStats ? "..." : todaysEventsCount.toString(), label: "Today's Events" },
    { icon: Gauge, value: loadingStats ? "..." : predictionsCount.toString(), label: "Predictions Generated" },
    { icon: AlertTriangle, value: loadingStats ? "..." : highRiskCount.toString(), label: "High Risk Corridors" },
    { icon: FileText, value: loadingStats ? "..." : reportsCount.toString(), label: "Reports Generated" },
  ]

  const MODULES = [
    {
      title: "Forecast Command",
      href: "/forecast",
      desc: "Generate and save real-time congestion predictions.",
      icon: Radar,
      color: "text-sky-500 bg-sky-500/10",
    },
    {
      title: "Resource Planning",
      href: "/resources",
      desc: "View AI-calculated officer deployments.",
      icon: ShieldAlert,
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "History & Logs",
      href: "/forecast/history",
      desc: "Review past traffic events and saved records.",
      icon: History,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Simulator",
      href: "/simulator",
      desc: "Run What-If scenarios and export PDF reports.",
      icon: FlaskConical,
      color: "text-purple-500 bg-purple-500/10",
    },
  ]

  const hasCriticalAlert = notifications.some(n => !n.read && n.priority === "Critical")

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Offline / Reconnecting Banner */}
        {!isConnected && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/15 p-3 text-sm font-semibold text-destructive animate-pulse">
            <Wifi className="size-4" /> Connection lost. Reconnecting to live command center...
          </div>
        )}

        {/* Critical Alert Banner */}
        {hasCriticalAlert && (
          <div className="flex items-center justify-between rounded-xl bg-destructive p-4 text-destructive-foreground shadow-lg animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="size-6 animate-pulse" />
              <div>
                <h3 className="font-bold">CRITICAL ALERT ACTIVE</h3>
                <p className="text-sm opacity-90">Please check your notifications drawer immediately.</p>
              </div>
            </div>
          </div>
        )}

        {/* Welcome Officer Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Shield className="size-3.5" /> Official Command Portal
                {isConnected && <span className="flex size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />}
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Welcome back, <span className="text-primary">{officerName}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Building2 className="size-3.5 text-primary" /> {stationName}</span>
                <span>·</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="size-3.5 text-emerald-500" /> Rank: <strong className="text-foreground">{officerRole}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <Link href="/forecast" className={cn(buttonVariants({ size: "lg" }), "gap-2 rounded-xl shadow-md")}>
                <Radar className="size-4" /> New Forecast
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {quickStats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border/70 bg-card p-4 text-center shadow-sm">
              <span className="mx-auto flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </span>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Feed (Events & Audit) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Audit Activity Stream */}
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Activity className="size-4 text-emerald-500" /> Live Activity Feed
                </h3>
              </div>

              {loadingStats ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/40" />
                  ))}
                </div>
              ) : recentAuditLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl">No activity logs recorded yet.</div>
              ) : (
                <div className="space-y-2.5">
                  {recentAuditLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-background/30 p-2.5 text-xs animate-in slide-in-from-top-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                        <UserCheck className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">
                          {log.user_profile?.full_name || "System"} — <span className="text-primary">{log.action}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Modules */}
            <div className="grid grid-cols-2 gap-4">
              {MODULES.map((mod) => (
                <Link key={mod.href} href={mod.href} className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 hover:border-primary/50 transition-all">
                  <span className={cn("flex size-10 items-center justify-center rounded-lg font-bold shrink-0", mod.color)}>
                    <mod.icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{mod.title}</h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{mod.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar Widgets */}
          <div className="space-y-6">
            {/* Online Officers Presence */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Wifi className="size-4 text-primary" /> Active Personnel
                <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  {onlineOfficers.length} Online
                </span>
              </h3>
              
              <div className="space-y-2">
                {onlineOfficers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No other officers online.</p>
                ) : (
                  onlineOfficers.map(off => (
                    <div key={off.id} className="flex items-center gap-3 rounded-lg border border-border/40 p-2 text-xs">
                      <div className="relative">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground">
                          {off.full_name.charAt(0)}
                        </div>
                        <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground truncate">{off.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{off.role} · {off.police_station}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Live Events */}
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Radar className="size-4 text-primary" /> Active Incidents
                </h3>
              </div>

              {recentEvents.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-xl">
                  No active incidents.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentEvents.slice(0, 4).map((evt) => (
                    <Link key={evt.id} href={`/events/${evt.id}`} className="block rounded-lg border border-border/60 p-2.5 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-bold text-foreground">{evt.title}</p>
                        {evt.prediction && (
                          <span className={cn(
                            "rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
                            evt.prediction.risk_level === "Critical" && "bg-destructive/15 text-destructive",
                            evt.prediction.risk_level === "High" && "bg-amber-500/15 text-amber-500",
                            evt.prediction.risk_level === "Moderate" && "bg-sky-500/15 text-sky-500",
                            evt.prediction.risk_level === "Low" && "bg-emerald-500/15 text-emerald-500"
                          )}>
                            {evt.prediction.risk_level}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-1">
                        {evt.status} · {evt.police_station}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
