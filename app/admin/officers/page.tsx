"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/ui-kit"
import { AdminGuard } from "@/components/admin/admin-guard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Search,
  Plus,
  Building2,
  ShieldAlert,
  MoreVertical,
  Edit2,
  KeyRound,
  Ban,
  CheckCircle2,
  Trash2,
  UserPlus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { Profile } from "@/types/auth"

export default function OfficersPage() {
  const [officers, setOfficers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  
  // Modal states
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const fetchOfficers = async () => {
    setLoading(true)
    try {
      let url = "/api/admin/officers?"
      if (roleFilter !== "ALL") url += `role=${encodeURIComponent(roleFilter)}&`
      if (statusFilter !== "ALL") url += `status=${statusFilter}`

      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setOfficers(data.officers || [])
      } else {
        toast.error("Failed to load officers")
      }
    } catch (err) {
      console.error(err)
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOfficers()
  }, [roleFilter, statusFilter])

  const filteredOfficers = officers.filter(o => 
    o.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (o.badge_number && o.badge_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
    o.police_station.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/officers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus })
      })
      if (res.ok) {
        toast.success(`Officer ${currentStatus ? "disabled" : "enabled"} successfully`)
        fetchOfficers()
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to update status")
      }
    } catch (err) {
      toast.error("An error occurred")
    }
  }

  const handleResetPassword = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to reset the password for ${name}?`)) return
    
    setResettingId(id)
    try {
      const res = await fetch(`/api/admin/officers/${id}/reset-password`, {
        method: "POST"
      })
      if (res.ok) {
        const data = await res.json()
        setTempPassword(data.tempPassword)
        // In a real app you might show this in a modal, using an alert for simplicity here
        alert(`Password reset successfully!\n\nTemporary Password: ${data.tempPassword}\n\nPlease copy this and provide it securely to the officer. They will be forced to change it upon login.`)
      } else {
        const data = await res.json()
        toast.error(data.error || "Failed to reset password")
      }
    } catch (err) {
      toast.error("An error occurred")
    } finally {
      setResettingId(null)
    }
  }

  return (
    <AdminGuard>
      <AppShell>
        <PageHeader
          page="Admin"
          title="Officer Directory"
          subtitle="Manage Bengaluru Traffic Police personnel accounts and access."
        >
          <Link href="/admin/officers/create" className={cn(buttonVariants({ variant: "default" }), "gap-2")}>
            <UserPlus className="size-4" /> Create Officer
          </Link>
        </PageHeader>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, badge, station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card"
            />
          </div>

          <div className="flex items-center gap-3">
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || "ALL")}>
              <SelectTrigger className="w-40 text-xs bg-card">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Roles</SelectItem>
                <SelectItem value="Super Admin" className="text-xs">Super Admin</SelectItem>
                <SelectItem value="Commissioner" className="text-xs">Commissioner</SelectItem>
                <SelectItem value="Inspector" className="text-xs">Inspector</SelectItem>
                <SelectItem value="Traffic Officer" className="text-xs">Traffic Officer</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "ALL")}>
              <SelectTrigger className="w-32 text-xs bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Status</SelectItem>
                <SelectItem value="active" className="text-xs">Active</SelectItem>
                <SelectItem value="inactive" className="text-xs">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Officer List */}
        <Card className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Officer</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Station</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Last Login</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Loading officers...
                    </td>
                  </tr>
                ) : filteredOfficers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No officers found.
                    </td>
                  </tr>
                ) : (
                  filteredOfficers.map((officer) => (
                    <tr key={officer.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{officer.full_name}</span>
                          <span className="text-xs text-muted-foreground">{officer.email}</span>
                          {officer.badge_number && (
                            <span className="text-[10px] font-mono mt-0.5 text-primary">{officer.badge_number}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold uppercase tracking-wider">{officer.role}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <Building2 className="size-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[150px]">{officer.police_station}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {officer.is_active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500">
                            <CheckCircle2 className="size-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            <Ban className="size-3" /> Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {/* We would typically join with login_sessions here, showing placeholder for now */}
                        -
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/officers/${officer.id}/edit`}
                            className={cn(buttonVariants({ variant: "outline", size: "icon" }), "size-7")}
                            title="Edit Officer"
                          >
                            <Edit2 className="size-3.5 text-muted-foreground" />
                          </Link>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            title="Reset Password"
                            disabled={resettingId === officer.id}
                            onClick={() => handleResetPassword(officer.id, officer.full_name)}
                          >
                            <KeyRound className="size-3.5 text-amber-500" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            title={officer.is_active ? "Disable Officer" : "Enable Officer"}
                            onClick={() => handleToggleStatus(officer.id, officer.is_active)}
                          >
                            {officer.is_active ? (
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
