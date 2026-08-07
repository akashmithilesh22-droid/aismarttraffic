"use client"

import { useState, useEffect, use } from "react"
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
import { ArrowLeft, Save, Loader2, UserX, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { PoliceStation } from "@/types/database"
import type { Profile } from "@/types/auth"

export default function EditOfficerPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const [formData, setFormData] = useState<Partial<Profile>>({})

  useEffect(() => {
    async function loadData() {
      try {
        const [officerRes, stationsRes] = await Promise.all([
          fetch(`/api/admin/officers/${id}`),
          fetch("/api/admin/stations")
        ])

        if (officerRes.ok) {
          const officerData = await officerRes.json()
          setFormData(officerData.officer)
        } else {
          toast.error("Failed to load officer details")
          router.push("/admin/officers")
        }

        if (stationsRes.ok) {
          const stationsData = await stationsRes.json()
          setStations(stationsData.stations || [])
        }
      } catch (err) {
        toast.error("An error occurred")
      } finally {
        setFetching(false)
      }
    }
    loadData()
  }, [id, router])

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
      // Only send editable fields
      const { phone, role, district, police_station, badge_number, is_active } = formData
      
      const res = await fetch(`/api/admin/officers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, role, district, police_station, badge_number, is_active })
      })

      const data = await res.json()

      if (res.ok) {
        toast.success("Officer Updated Successfully")
        router.push("/admin/officers")
      } else {
        toast.error(data.error || "Failed to update officer")
      }
    } catch (err) {
      toast.error("An error occurred while updating officer")
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = () => {
    setFormData({ ...formData, is_active: !formData.is_active })
  }

  if (fetching) {
    return (
      <AdminGuard>
        <AppShell>
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="size-8 animate-spin text-primary" />
          </div>
        </AppShell>
      </AdminGuard>
    )
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
          title={`Edit Officer: ${formData.full_name}`}
          subtitle="Modify officer details and permissions."
        >
          <Button
            type="button"
            variant={formData.is_active ? "destructive" : "default"}
            className="gap-2"
            onClick={handleToggleStatus}
          >
            {formData.is_active ? (
              <><UserX className="size-4" /> Disable Account</>
            ) : (
              <><UserCheck className="size-4" /> Enable Account</>
            )}
          </Button>
        </PageHeader>

        <Card className="glass max-w-2xl p-6 relative overflow-hidden">
          {/* Status Banner */}
          {!formData.is_active && (
            <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
          )}

          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={formData.full_name || ""} disabled className="bg-muted/50" />
                <p className="text-[10px] text-muted-foreground">Name cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input value={formData.email || ""} disabled className="bg-muted/50" />
                <p className="text-[10px] text-muted-foreground">Email is immutable</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="badge_number">Badge Number</Label>
                <Input
                  id="badge_number"
                  name="badge_number"
                  value={formData.badge_number || ""}
                  onChange={handleChange}
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
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Station" />
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
                  value={formData.phone || ""}
                  onChange={handleChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input
                  id="district"
                  name="district"
                  value={formData.district || ""}
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
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </AppShell>
    </AdminGuard>
  )
}
