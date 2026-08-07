"use client"

import { Card } from "@/components/ui/card"
import { Circle, MapPinned, RadioTower } from "lucide-react"

export function MapLegend() {
  return (
    <Card className="glass p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MapPinned className="size-4 text-primary" /> Map Legend
      </div>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-emerald-600" /> Operational station</div>
        <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-amber-500" /> Moderate activity</div>
        <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-red-600" /> Low staffing / alert</div>
        <div className="flex items-center gap-2"><span className="size-3 rounded-full bg-blue-700" /> Event marker</div>
      </div>
    </Card>
  )
}
