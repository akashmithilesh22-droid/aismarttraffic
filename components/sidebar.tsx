"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Activity, BrainCircuit, Radar, ShieldAlert, FlaskConical, Home, Cpu, Database } from "lucide-react"
import { useEngine } from "@/lib/data-provider"

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/training", label: "AI Training Center", icon: BrainCircuit },
  { href: "/forecast", label: "Forecast Command Center", icon: Radar },
  { href: "/resources", label: "Resource Planning", icon: ShieldAlert },
  { href: "/simulator", label: "Simulator & Reports", icon: FlaskConical },
]

export function Sidebar() {
  const pathname = usePathname()
  const { records, loading, model } = useEngine()

  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground neon-glow">
          <Activity className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="font-mono text-sm font-semibold tracking-tight text-sidebar-foreground">SmartTraffic</p>
          <p className="text-[11px] uppercase tracking-widest text-primary">AI Command</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
              {item.label}
              {active && (
                <span className="ml-auto size-1.5 rounded-full bg-primary animate-pulse-glow" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Live stats panel */}
      {!loading && model && (
        <div className="mx-3 mb-3 rounded-lg border border-border bg-background/40 p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Live Model Stats</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Accuracy</p>
              <p className="font-mono text-sm font-bold text-primary">{Math.round(model.metrics.accuracy)}%</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">R² Score</p>
              <p className="font-mono text-sm font-bold text-accent">{model.metrics.r2.toFixed(2)}</p>
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center gap-1.5">
            <Database className="size-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">{records.length.toLocaleString()} records</p>
          </div>
        </div>
      )}

      {/* Status footer */}
      <div className="border-t border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-2">
          {loading ? (
            <>
              <span className="size-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[11px] text-muted-foreground">Loading dataset…</p>
            </>
          ) : (
            <>
              <Cpu className="size-3 text-accent" />
              <p className="text-[11px] text-muted-foreground">
                Model <span className="text-accent font-semibold">live</span> · {records.length.toLocaleString()} incidents
              </p>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
