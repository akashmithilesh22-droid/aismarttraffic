"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useMemo, useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGIS } from "./gis-provider"
import { useRealtime } from "@/providers/realtime-provider"
import { useAuth } from "@/providers/auth-provider"
import { Activity, AlertTriangle, BellRing, Filter, MapPin, Radar, RefreshCw, Search, ShieldCheck, Sparkles, Wifi, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toPng } from "html-to-image"

interface CommandCenterShellProps {
  mapView: React.ReactNode
  rightPanel: React.ReactNode
}

export function CommandCenterShell({ mapView, rightPanel }: CommandCenterShellProps) {
  const { events, stations, loading, error, searchQuery, setSearchQuery, searchResults, setSelectedResult, setSelectedEvent, selectedEvent, layers, toggleLayer, setActivePanel } = useGIS()
  const { notifications, unreadCount, isConnected, realtimeTick } = useRealtime()
  const { profile } = useAuth()
  const [showFilters, setShowFilters] = useState(false)
  const [activeSearch, setActiveSearch] = useState(false)
  const [shortcutHint, setShortcutHint] = useState<string | null>(null)

  const stats = useMemo(() => {
    const critical = events.filter((event) => event.prediction?.risk_level === "Critical").length
    const active = events.filter((event) => event.status === "Active" || event.status === "PLANNED" || event.status === "IN_PROGRESS").length
    const confidence = events.length ? Math.round(events.reduce((acc, event) => acc + (event.prediction?.confidence ?? 0), 0) / events.length) : 0
    return {
      events: events.length,
      critical,
      active,
      stations: stations.filter((station) => station.is_active).length,
      confidence,
      reports: events.filter((event) => event.prediction).length,
      notifications: unreadCount,
    }
  }, [events, stations, unreadCount])

  const activityFeed = useMemo(() => {
    return [
      { time: "Just now", officer: profile?.full_name ?? "System", action: "Prediction refreshed", event: events[0]?.title ?? "Operational stream", severity: "High" },
      { time: "5m ago", officer: profile?.full_name ?? "Ops", action: "Notification synced", event: events[1]?.title ?? "Live updates", severity: "Medium" },
      { time: "10m ago", officer: "Audit", action: "Report generated", event: events[2]?.title ?? "Operations", severity: "Low" },
    ]
  }, [events, profile])

  const exportMap = useCallback(async () => {
    const node = document.querySelector(".gis-map-shell") as HTMLElement | null
    if (!node) return
    const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: "#07111f" })
    const link = document.createElement("a")
    link.download = `command-center-${Date.now()}.png`
    link.href = dataUrl
    link.click()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/") {
        event.preventDefault()
        setActiveSearch(true)
        setShortcutHint("Search focused")
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault()
        setShowFilters((value) => !value)
        setShortcutHint("Filters toggled")
      }
      if (event.key === "Escape") {
        setShowFilters(false)
        setActiveSearch(false)
        setShortcutHint("Panels closed")
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault()
        setSearchQuery("")
        setSelectedResult(null)
        setSelectedEvent(null)
        setShortcutHint("View reset")
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [setSelectedResult, setSelectedEvent, setSearchQuery])

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 lg:grid-cols-4">
        {[
          { label: "Today’s Events", value: stats.events, icon: Activity },
          { label: "Critical Events", value: stats.critical, icon: AlertTriangle },
          { label: "Officers Deployed", value: stats.active, icon: ShieldCheck },
          { label: "Live Notifications", value: stats.notifications, icon: BellRing },
        ].map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label} className="glass p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
                <Icon className="size-4 text-primary" />
              </div>
              <p className="mt-3 text-2xl font-semibold text-foreground">{item.value}</p>
            </Card>
          )
        })}
      </motion.div>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <motion.aside initial={{ x: -16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4">
          <Card className="glass p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Mission Board</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Live Operations</p>
              </div>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                {isConnected ? "Live" : "Syncing"}
              </Badge>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                <p className="text-xs text-muted-foreground">Live Events</p>
                <p className="mt-1 text-base font-semibold text-foreground">{events.length}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                <p className="text-xs text-muted-foreground">Active Incidents</p>
                <p className="mt-1 text-base font-semibold text-foreground">{stats.active}</p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/60 p-2">
                <p className="text-xs text-muted-foreground">Critical Alerts</p>
                <p className="mt-1 text-base font-semibold text-foreground">{stats.critical}</p>
              </div>
            </div>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Search className="size-4 text-primary" /> Global Search
            </div>
            <div className="mt-3 relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search events, officers, stations..."
                className="pl-9"
                aria-label="Global search"
                onFocus={() => setActiveSearch(true)}
              />
            </div>
            <AnimatePresence>
              {activeSearch && searchResults.length > 0 ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="mt-3 space-y-2">
                  {searchResults.slice(0, 5).map((item) => (
                    <button
                      key={item.id}
                      className="flex w-full flex-col rounded-lg border border-border/60 bg-background/60 p-2 text-left"
                      onClick={() => {
                        setSelectedResult(item)
                        setSelectedEvent(item.id.replace("event-", ""))
                        setActiveSearch(false)
                        setActivePanel("detail")
                      }}
                    >
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.subtitle}</span>
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="size-4 text-primary" /> Filters
            </div>
            <AnimatePresence>
              {showFilters ? (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="mt-3 space-y-2">
                  <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Risk</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(["Low", "Moderate", "High", "Critical"] as const).map((level) => (
                        <button key={level} className="rounded-full border border-border px-2 py-1 text-xs">{level}</button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background/60 p-2 text-sm">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Layer Visibility</p>
                    <div className="mt-2 space-y-2">
                      {Object.entries(layers).slice(0, 4).map(([key, value]) => (
                        <button key={key} className="flex w-full items-center justify-between rounded-md bg-background/70 px-2 py-1" onClick={() => toggleLayer(key as keyof typeof layers)}>
                          <span className="capitalize">{key}</span>
                          <span className={cn("text-xs", value ? "text-primary" : "text-muted-foreground")}>{value ? "On" : "Off"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </Card>

          <Card className="glass p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="size-4 text-primary" /> Notifications
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {notifications.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-lg border border-border/60 bg-background/60 p-2">
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs">{item.message}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.aside>

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card className="glass p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-primary">Operational Map</p>
                <p className="mt-1 text-sm font-semibold text-foreground">Bengaluru Command Center</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setSearchQuery("")}>
                  <RefreshCw className="mr-2 size-3.5" /> Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={exportMap}>
                  <Radar className="mr-2 size-3.5" /> Export
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowFilters((value) => !value)}>
                  <Filter className="mr-2 size-3.5" /> Filters
                </Button>
              </div>
            </div>
          </Card>
          <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">{mapView}</div>
        </motion.section>

        <motion.aside initial={{ x: 16, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="space-y-4">
          <Card className="glass p-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" /> Operational Intelligence
            </div>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              {activityFeed.map((item) => (
                <div key={`${item.time}-${item.action}`} className="rounded-lg border border-border/60 bg-background/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{item.action}</span>
                    <span className="text-[11px] text-primary">{item.severity}</span>
                  </div>
                  <p className="mt-1 text-xs">{item.officer} · {item.event}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.time}</p>
                </div>
              ))}
            </div>
          </Card>
          {rightPanel}
        </motion.aside>
      </div>
    </div>
  )
}
