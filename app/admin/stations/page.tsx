"use client"

import { useEffect, useState } from "react"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/ui-kit"
import { AdminGuard } from "@/components/admin/admin-guard"
import { Card } from "@/components/ui/card"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Ban,
  Loader2,
  Save,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { PoliceStation } from "@/types/database"

type StationFormData = {
  station_name: string
  station_code: string
  zone: string
  district: string
  address: string
  jurisdiction: string
  latitude: string
  longitude: string
  contact_number: string
  email: string
  is_active: boolean
}

type StationFormErrors = Partial<Record<keyof StationFormData, string>>

const emptyStationForm: StationFormData = {
  station_name: "",
  station_code: "",
  zone: "",
  district: "",
  address: "",
  jurisdiction: "",
  latitude: "",
  longitude: "",
  contact_number: "",
  email: "",
  is_active: true,
}

export default function StationsPage() {
  const [stations, setStations] = useState<PoliceStation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<StationFormData>(emptyStationForm)
  const [formErrors, setFormErrors] = useState<StationFormErrors>({})
  const [formError, setFormError] = useState("")

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

  const validateStation = () => {
    const errors: StationFormErrors = {}
    const name = formData.station_name.trim()
    const code = formData.station_code.trim()
    const phone = formData.contact_number.trim()
    const email = formData.email.trim()
    const latitude = formData.latitude.trim()
    const longitude = formData.longitude.trim()

    if (!name) errors.station_name = "Station name is required."
    else if (name.length < 2 || name.length > 120) errors.station_name = "Use a name between 2 and 120 characters."
    if (code && !/^[A-Za-z0-9][A-Za-z0-9-]{1,24}$/.test(code)) errors.station_code = "Use 2-25 letters, numbers, or hyphens."
    if (!formData.zone.trim()) errors.zone = "Zone is required."
    if (!formData.district.trim()) errors.district = "District is required."
    if (phone && !/^\+?[0-9][0-9\s().-]{6,19}$/.test(phone)) errors.contact_number = "Enter a valid contact number."
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address."
    if (latitude && (Number.isNaN(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) errors.latitude = "Latitude must be between -90 and 90."
    if (longitude && (Number.isNaN(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) errors.longitude = "Longitude must be between -180 and 180."

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreateStation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError("")
    if (!validateStation() || isCreating) return

    setIsCreating(true)
    try {
      const res = await fetch("/api/admin/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          station_name: formData.station_name.trim(),
          station_code: formData.station_code.trim(),
          zone: formData.zone.trim(),
          district: formData.district.trim(),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        const message = data.error || "Failed to create station."
        if (res.status === 409) setFormErrors((current) => ({ ...current, station_code: message }))
        setFormError(message)
        return
      }

      toast.success("Station created successfully")
      setFormData(emptyStationForm)
      setFormErrors({})
      setIsCreateOpen(false)
      await fetchStations()
    } catch (error) {
      console.error(error)
      setFormError("Unable to reach the server. Check your connection and try again.")
    } finally {
      setIsCreating(false)
    }
  }

  const updateFormField = (field: keyof StationFormData, value: string | boolean) => {
    setFormData((current) => ({ ...current, [field]: value }))
    setFormErrors((current) => ({ ...current, [field]: undefined }))
    setFormError("")
  }

  const fieldError = (field: keyof StationFormData) => formErrors[field]

  return (
    <AdminGuard>
      <AppShell>
        <PageHeader
          page="Admin"
          title="Police Stations"
          subtitle="Manage Bengaluru Traffic Police stations and jurisdictions."
        >
          <Button variant="default" className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" /> Add Station
          </Button>
        </PageHeader>

        <Sheet open={isCreateOpen} onOpenChange={(open) => {
          if (!isCreating) setIsCreateOpen(open)
        }}>
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle className="flex items-center gap-2 text-lg"><Building2 className="size-5 text-primary" /> Create Police Station</SheetTitle>
              <SheetDescription>Add a station to the active Bengaluru Traffic Police jurisdiction.</SheetDescription>
            </SheetHeader>
            <form onSubmit={handleCreateStation} className="space-y-5 px-6 py-5">
              {formError && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>}
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ["station_name", "Station name", "e.g. Indiranagar Traffic PS", true],
                  ["station_code", "Station code", "e.g. ITP-01", false],
                  ["zone", "Zone", "e.g. East", true],
                  ["district", "District", "e.g. Bengaluru Urban", true],
                  ["contact_number", "Contact number", "+91 98765 43210", false],
                  ["email", "Station email", "station@btp.gov.in", false],
                  ["jurisdiction", "Jurisdiction", "e.g. Indiranagar and Domlur", false],
                  ["latitude", "Latitude", "12.9716", false],
                  ["longitude", "Longitude", "77.5946", false],
                ] as const).map(([field, label, placeholder, required]) => (
                  <div key={field} className={field === "jurisdiction" ? "sm:col-span-2 space-y-2" : "space-y-2"}>
                    <Label htmlFor={`station-${field}`}>{label}{required && <span className="text-destructive"> *</span>}</Label>
                    <Input
                      id={`station-${field}`}
                      name={field}
                      type={field === "email" ? "email" : field === "latitude" || field === "longitude" ? "number" : "text"}
                      step={field === "latitude" || field === "longitude" ? "any" : undefined}
                      required={required}
                      value={formData[field] as string}
                      onChange={(event) => updateFormField(field, event.target.value)}
                      placeholder={placeholder}
                      aria-invalid={Boolean(fieldError(field))}
                    />
                    {fieldError(field) && <p className="text-xs text-destructive">{fieldError(field)}</p>}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="station-address">Address</Label>
                <textarea
                  id="station-address"
                  name="address"
                  value={formData.address}
                  onChange={(event) => updateFormField("address", event.target.value)}
                  placeholder="Full station address"
                  rows={3}
                  className="flex min-h-20 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={formData.is_active} onChange={(event) => updateFormField("is_active", event.target.checked)} className="size-4 accent-primary" />
                Station is active
              </label>
              <SheetFooter className="flex-row justify-end border-t border-border px-0 pt-5">
                <Button type="button" variant="outline" disabled={isCreating} onClick={() => setIsCreateOpen(false)}><X className="size-4" /> Cancel</Button>
                <Button type="submit" disabled={isCreating} className="gap-2">
                  {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {isCreating ? "Creating..." : "Create Station"}
                </Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>

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
