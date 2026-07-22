"use client"

import { motion } from "framer-motion"

interface TwinProps {
  officers: number
  barricades: number
  diversions: number
  checkpoints: number
  intensity: string
  risk: "Low" | "Moderate" | "High" | "Critical"
}

const RISK_COLOR: Record<string, string> = {
  Low: "var(--chart-4)",
  Moderate: "var(--chart-1)",
  High: "#fb923c",
  Critical: "var(--chart-3)",
}

// Schematic (non-geographic) digital twin of an event corridor.
export function DigitalTwin({ officers, barricades, diversions, checkpoints, intensity, risk }: TwinProps) {
  const color = RISK_COLOR[risk]
  const officerDots = Math.min(14, officers)
  const barricadeMarks = Math.min(16, barricades)
  const checkpointMarks = Math.min(5, checkpoints)
  const diversionMarks = Math.min(4, diversions)

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-background/50">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <svg viewBox="0 0 800 360" className="relative w-full" role="img" aria-label="Digital twin of event corridor">
        {/* main corridor */}
        <rect x="0" y="150" width="800" height="60" fill="color-mix(in oklch, var(--muted) 70%, transparent)" />
        <line x1="0" y1="180" x2="800" y2="180" stroke={color} strokeWidth="2" strokeDasharray="22 18" className="animate-dash" opacity="0.8" />

        {/* cross streets / diversions */}
        {Array.from({ length: diversionMarks }).map((_, i) => {
          const x = 130 + i * 170
          return (
            <g key={`div-${i}`}>
              <rect x={x - 22} y="40" width="44" height="110" fill="color-mix(in oklch, var(--muted) 50%, transparent)" />
              <rect x={x - 22} y="210" width="44" height="110" fill="color-mix(in oklch, var(--muted) 50%, transparent)" />
              <motion.circle
                cx={x}
                cy="70"
                r="7"
                fill="var(--chart-2)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              />
              <text x={x} y="30" textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                Diversion {i + 1}
              </text>
            </g>
          )
        })}

        {/* barricades along the corridor */}
        {Array.from({ length: barricadeMarks }).map((_, i) => {
          const x = 30 + (i * 740) / barricadeMarks
          return (
            <motion.rect
              key={`bar-${i}`}
              x={x}
              y="142"
              width="6"
              height="76"
              rx="1.5"
              fill={color}
              initial={{ opacity: 0, y: 130 }}
              animate={{ opacity: 0.85, y: 142 }}
              transition={{ delay: i * 0.04 }}
            />
          )
        })}

        {/* checkpoints */}
        {Array.from({ length: checkpointMarks }).map((_, i) => {
          const x = 90 + (i * 620) / Math.max(1, checkpointMarks - 1 || 1)
          return (
            <g key={`cp-${i}`}>
              <motion.rect
                x={x - 14}
                y="120"
                width="28"
                height="20"
                rx="3"
                fill="var(--chart-1)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.12 }}
              />
              <text x={x} y="134" textAnchor="middle" fontSize="9" fill="var(--primary-foreground)" fontWeight="700">
                CP{i + 1}
              </text>
            </g>
          )
        })}

        {/* officers as pulsing dots */}
        {Array.from({ length: officerDots }).map((_, i) => {
          const x = 50 + (i * 700) / officerDots
          const y = i % 2 === 0 ? 230 : 240
          return (
            <motion.circle
              key={`off-${i}`}
              cx={x}
              cy={y}
              r="5"
              fill="var(--chart-4)"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.15 }}
            />
          )
        })}
        <text x="400" y="270" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
          {officers} officers deployed · {intensity} barricading
        </text>
      </svg>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Legend color={color} label="Barricades" />
        <Legend color="var(--chart-1)" label="Checkpoints" />
        <Legend color="var(--chart-4)" label="Officers" />
        <Legend color="var(--chart-2)" label="Diversions" />
      </div>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  )
}
