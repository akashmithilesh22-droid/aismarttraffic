"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/ui-kit"
import { AdminGuard } from "@/components/admin/admin-guard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { PoliceStation } from "@/types/database"

export default function StationsPage() {
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchStations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/stations")
      if (res.ok) {
        const data = await res.json()
        setStations(data.stations || [])
      } else {
        toast.error("Failed to load police stations")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStations()
  }, [])

  const filteredStations = stations.filter(s => 
    s.station_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.station_code && s.station_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
    s.zone.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/stations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus })
      })
      if (res.ok) {
        toast.success(`Station ${currentStatus ? "disabled" : "enabled"} successfully`)
        fetchStations()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update status")
      }
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  return (
    <AdminGuard>
      <AppShell>
        <PageHeader
          page="Admin"
          title="Police Stations"
          subtitle="Manage Bengaluru Traffic Police stations and jurisdictions."
        >
          {/* We would typically have a modal here for creating stations, keeping it simple for now */}
          <Button variant="default" className="gap-2" onClick={() => toast.info("Create Station form coming soon")}>
            <Plus className="size-4" /> Add Station
          </Button>
        </PageHeader>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, code, or zone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>
        </div>

        {/* Stations List */}
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Station</th>
                  <th className="px-4 py-3 font-semibold">Zone & District</th>
                  <th className="px-4 py-3 font-semibold">Contact</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading stations...
                    </td>
                  </tr>
                ) : filteredStations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No stations found.
                    </td>
                  </tr>
                ) : (
                  filteredStations.map((station) => (
                    <tr key={station.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{station.station_name}</span>
                          {station.station_code && (
                            <span className="text-[10px] font-mono mt-0.5 text-primary">{station.station_code}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold">{station.zone} Zone</span>
                          <span className="text-[10px] text-muted-foreground mt-0.5">{station.district}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs">{station.contact_number || "-"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {station.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <Ban className="size-3" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            title={station.is_active ? "Disable Station" : "Enable Station"}
                            onClick={() => handleToggleStatus(station.id, station.is_active)}
                          >
                            {station.is_active ? (
                              <Ban className="size-3.5 text-destructive" />
                            ) : (
                              <CheckCircle2 className="size-3.5 text-emerald-500" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </AppShell>
    </AdminGuard>
  )
}
