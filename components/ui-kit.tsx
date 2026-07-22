"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/lib/types"

export function PageHeader({
  eyebrow,
  page,
  title,
  description,
  subtitle,
  children,
}: {
  eyebrow?: string
  page?: string
  title: string
  description?: string
  subtitle?: string
  children?: ReactNode
}) {
  const tag = eyebrow ?? (page ? `Page ${page}` : undefined)
  const desc = description ?? subtitle
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5">
        {tag && <p className="font-mono text-xs uppercase tracking-widest text-primary">{tag}</p>}
        <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {desc && <p className="max-w-2xl text-pretty text-sm text-muted-foreground">{desc}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string
  value: ReactNode
  sub?: string
  icon?: ReactNode
  accent?: boolean
}) {
  return (
    <div className={cn("glass rounded-xl p-4", accent && "ring-1 ring-primary/40")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "bg-accent/15 text-accent ring-accent/40",
  Moderate: "bg-primary/15 text-primary ring-primary/40",
  High: "bg-orange-500/15 text-orange-400 ring-orange-500/40",
  Critical: "bg-destructive/15 text-destructive ring-destructive/40",
}

export function RiskBadge({ level, risk, large, small }: { level?: RiskLevel; risk?: RiskLevel; large?: boolean; small?: boolean }) {
  const value = (level ?? risk) as RiskLevel
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1",
        RISK_STYLES[value],
        large ? "px-4 py-1.5 text-sm" : small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {value} Risk
    </span>
  )
}
