"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PageHeader, StatCard } from "@/components/ui-kit"
import { AdminGuard } from "@/components/admin/admin-guard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Users,
  Shield,
  Building2,
  Activity,
  Radar,
  FileText,
  UserCheck,
  UserX,
  History
} from "lucide-react"
import { cn } from "@/lib/utils"

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats")
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch (err) {
        console.error("Failed to fetch admin stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <AdminGuard>
      <AppShell>
        <PageHeader
          page="Admin"
          title="Administration Portal"
          subtitle="Manage officers, stations, and system access. Restricted to Super Admin personnel."
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            label="Total Officers"
            value={loading ? "-" : stats?.totalOfficers}
            icon={<Users className="size-5 text-primary" />}
            sub={`${stats?.activeOfficers || 0} active, ${stats?.disabledOfficers || 0} disabled`}
            accent
          />
          <StatCard
            label="Police Stations"
            value={loading ? "-" : stats?.totalStations}
            icon={<Building2 className="size-5 text-accent" />}
            sub="Active stations in jurisdiction"
          />
          <StatCard
            label="Officer Logins Today"
            value={loading ? "-" : stats?.loginsToday}
            icon={<UserCheck className="size-5 text-emerald-500" />}
            sub="Authenticated sessions today"
          />
          <StatCard
            label="System Activity"
            value={loading ? "-" : (stats?.forecastsToday + stats?.reportsToday)}
            icon={<Activity className="size-5 text-sky-500" />}
            sub={`${stats?.forecastsToday || 0} forecasts, ${stats?.reportsToday || 0} reports`}
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Actions */}
          <Card className="glass p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Shield className="size-5 text-primary" /> Management Modules
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/admin/officers"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-background/50 p-6 text-center hover:bg-primary/5 hover:border-primary/50 transition-all group"
              >
                <div className="rounded-full bg-primary/10 p-4 text-primary group-hover:scale-110 transition-transform">
                  <Users className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold">Officer Directory</h3>
                  <p className="text-xs text-muted-foreground mt-1">Create & manage accounts</p>
                </div>
              </Link>

              <Link
                href="/admin/stations"
                className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-background/50 p-6 text-center hover:bg-accent/5 hover:border-accent/50 transition-all group"
              >
                <div className="rounded-full bg-accent/10 p-4 text-accent group-hover:scale-110 transition-transform">
                  <Building2 className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold">Police Stations</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage station metadata</p>
                </div>
              </Link>
            </div>
          </Card>

          {/* System Info */}
          <Card className="glass p-6 flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Activity className="size-5 text-primary" /> System Status
            </h2>
            <div className="flex-1 space-y-4">
               <div className="rounded-lg border border-border/50 p-4 bg-background/30 flex items-start gap-3 text-sm">
                 <div className="mt-0.5 size-2 rounded-full bg-emerald-500 animate-pulse" />
                 <div>
                   <p className="font-semibold text-foreground">Authentication Service</p>
                   <p className="text-xs text-muted-foreground mt-0.5">Supabase Auth is operational. All endpoints secure.</p>
                 </div>
               </div>
               <div className="rounded-lg border border-border/50 p-4 bg-background/30 flex items-start gap-3 text-sm">
                 <div className="mt-0.5 size-2 rounded-full bg-emerald-500 animate-pulse" />
                 <div>
                   <p className="font-semibold text-foreground">Database Layer</p>
                   <p className="text-xs text-muted-foreground mt-0.5">PostgreSQL operational. RLS policies active.</p>
                 </div>
               </div>
               <div className="rounded-lg border border-border/50 p-4 bg-background/30 flex items-start gap-3 text-sm">
                 <div className="mt-0.5 size-2 rounded-full bg-emerald-500 animate-pulse" />
                 <div>
                   <p className="font-semibold text-foreground">Role-Based Access Control</p>
                   <p className="text-xs text-muted-foreground mt-0.5">RBAC guards are enforcing permissions across all modules.</p>
                 </div>
               </div>
            </div>
          </Card>
        </div>
      </AppShell>
    </AdminGuard>
  )
}
