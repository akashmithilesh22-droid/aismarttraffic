"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/ui-kit"
import { AdminGuard } from "@/components/admin/admin-guard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Save, Loader2, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { PoliceStation } from "@/types/database"
import type { UserRole } from "@/types/auth"

export default function CreateOfficerPage() {
  const router = useRouter()
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingStations, setFetchingStations] = useState(true)

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "Traffic Officer" as UserRole,
    police_station: "",
    district: "Bengaluru City",
    phone: "",
    badge_number: ""
  })

  useEffect(() => {
    async function loadStations() {
      try {
        const res = await fetch("/api/admin/stations")
        if (res.ok) {
          const data = await res.json()
          setStations(data.stations || [])
          if (data.stations && data.stations.length > 0) {
            setFormData(prev => ({ ...prev, police_station: data.stations[0].station_name }))
          }
        }
      } catch (err) {
        toast.error("Failed to load police stations")
      } finally {
        setFetchingStations(false)
      }
    }
    loadStations()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSelectChange = (name: string, value: string | null) => {
    if (value) setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/admin/officers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Officer Created Successfully", {
          description: "Auth user created and profile seeded. They must reset password on first login."
        })
        router.push("/admin/officers")
      } else {
        toast.error(data.error || "Failed to create officer")
      }
    } catch (err) {
      toast.error("An error occurred while creating officer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminGuard>
      <AppShell>
        <div className="mb-4">
          <Link
            href="/admin/officers"
            className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" /> Back to Officer Directory
          </Link>
        </div>

        <PageHeader
          page="Admin"
          title="Create New Officer"
          subtitle="Provision a new account for a Bengaluru Traffic Police officer."
        />

        <Card className="glass max-w-2xl p-6">
          <div className="mb-6 rounded-lg bg-primary/10 border border-primary/20 p-4 flex items-start gap-3">
            <ShieldAlert className="size-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-primary">
              <p className="font-bold">Security Notice</p>
              <p className="mt-1 opacity-90">
                You are creating a privileged account. The officer will be required to change their password immediately upon their first login.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                <Input
                  id="full_name"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ramesh.k@ksp.gov.in"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password <span className="text-destructive">*</span></Label>
                <Input
                  id="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Provide a strong initial password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="badge_number">Badge Number</Label>
                <Input
                  id="badge_number"
                  name="badge_number"
                  value={formData.badge_number}
                  onChange={handleChange}
                  placeholder="e.g. BTP-4592"
                />
              </div>

              <div className="space-y-2">
                <Label>Role <span className="text-destructive">*</span></Label>
                <Select value={formData.role} onValueChange={(v) => handleSelectChange("role", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                    <SelectItem value="Commissioner">Commissioner</SelectItem>
                    <SelectItem value="ACP">ACP</SelectItem>
                    <SelectItem value="Inspector">Inspector</SelectItem>
                    <SelectItem value="Sub Inspector">Sub Inspector</SelectItem>
                    <SelectItem value="Traffic Officer">Traffic Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Police Station <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.police_station}
                  onValueChange={(v) => handleSelectChange("police_station", v)}
                  disabled={fetchingStations}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={fetchingStations ? "Loading stations..." : "Select Station"} />
                  </SelectTrigger>
                  <SelectContent>
                    {stations.map(st => (
                      <SelectItem key={st.id} value={st.station_name}>{st.station_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
              <Link href="/admin/officers" className={cn(buttonVariants({ variant: "outline" }))}>
                Cancel
              </Link>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {loading ? "Creating..." : "Create Officer Account"}
              </Button>
            </div>
          </form>
        </Card>
      </AppShell>
    </AdminGuard>
  )
}
