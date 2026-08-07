"use client"

import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useGIS } from "./gis-provider"
import { Layers3, Flame, Route, Camera, ScanEye, RadioTower } from "lucide-react"

const layerMeta = [
  { key: "stations", label: "Police Stations", description: "Operational station markers", icon: RadioTower, disabled: false },
  { key: "events", label: "Events", description: "Saved event markers", icon: Layers3, disabled: false },
  { key: "heatmap", label: "Future Heatmap", description: "Planned", icon: Flame, disabled: true },
  { key: "resources", label: "Future Resource Layer", description: "Planned", icon: ScanEye, disabled: true },
  { key: "diversions", label: "Future Diversight Routes", description: "Planned", icon: Route, disabled: true },
  { key: "cameras", label: "Future Cameras", description: "Planned", icon: Camera, disabled: true },
  { key: "sensors", label: "Future Sensors", description: "Planned", icon: ScanEye, disabled: true },
] as const

export function LayerControls() {
  const { layers, toggleLayer } = useGIS()

  return (
    <Card className="glass p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Layers3 className="size-4 text-primary" /> Layer Controls
      </div>
      <div className="mt-3 space-y-2">
        {layerMeta.map((layer) => {
          const checked = !!layers[layer.key]
          const Icon = layer.icon
          return (
            <div key={layer.key} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${layer.disabled ? "text-muted-foreground" : "text-primary"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{layer.label}</p>
                  <p className="text-xs text-muted-foreground">{layer.description}</p>
                </div>
              </div>
              <Switch checked={checked} disabled={layer.disabled} onCheckedChange={() => !layer.disabled && toggleLayer(layer.key)} />
            </div>
          )
        })}
      </div>
    </Card>
  )
}
