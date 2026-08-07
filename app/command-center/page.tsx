"use client"

import dynamic from "next/dynamic"
import { AppShell } from "@/components/app-shell"
import { PageHeader } from "@/components/ui-kit"
import { GisProvider } from "@/components/gis/gis-provider"
import { EventOperationsPanel } from "@/components/gis/event-operations-panel"
import { CommandCenterShell } from "@/components/gis/command-center-shell"

const MapView = dynamic(() => import("@/components/gis/map-view").then((mod) => mod.MapView), {
  ssr: false,
  loading: () => (
    <div className="flex h-[72vh] min-h-[560px] items-center justify-center rounded-xl border border-dashed border-border bg-background/50 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

function CommandCenterContent() {
  return (
    <CommandCenterShell mapView={<MapView />} rightPanel={<EventOperationsPanel />} />
  )
}

export default function CommandCenterPage() {
  return (
    <AppShell>
      <PageHeader
        page="GIS"
        title="Command Center"
        description="A responsive operational map foundation for Bengaluru stations, live events, and future mission layers."
      />
      <GisProvider>
        <CommandCenterContent />
      </GisProvider>
    </AppShell>
  )
}
