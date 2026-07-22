"use client"

import { motion } from "framer-motion"

// Animated road network with flowing traffic particles + congestion heat nodes.
// Pure SVG, decorative.
const ROADS = [
  "M 0 120 H 800",
  "M 0 260 H 800",
  "M 0 400 H 800",
  "M 140 0 V 520",
  "M 380 0 V 520",
  "M 620 0 V 520",
  "M 0 0 L 800 520",
  "M 800 0 L 0 520",
]

const NODES = [
  { x: 140, y: 120, heat: 0.9 },
  { x: 380, y: 260, heat: 1 },
  { x: 620, y: 120, heat: 0.5 },
  { x: 140, y: 400, heat: 0.4 },
  { x: 620, y: 400, heat: 0.7 },
  { x: 380, y: 120, heat: 0.6 },
]

export function RoadNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="heat" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.62 0.22 25)" stopOpacity="0.55" />
          <stop offset="60%" stopColor="oklch(0.78 0.16 65)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* heat nodes */}
      {NODES.map((n, i) => (
        <circle key={`h${i}`} cx={n.x} cy={n.y} r={70 * n.heat + 20} fill="url(#heat)">
          <animate attributeName="opacity" values={`${0.3 * n.heat};${n.heat};${0.3 * n.heat}`} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}

      {/* roads */}
      {ROADS.map((d, i) => (
        <path key={`r${i}`} d={d} stroke="oklch(0.4 0.02 250)" strokeWidth="2" fill="none" opacity="0.5" />
      ))}

      {/* flowing dashes (traffic) */}
      {ROADS.map((d, i) => (
        <path
          key={`f${i}`}
          d={d}
          stroke={i % 3 === 0 ? "oklch(0.62 0.22 25)" : i % 3 === 1 ? "oklch(0.78 0.16 65)" : "oklch(0.72 0.13 195)"}
          strokeWidth="2.5"
          fill="none"
          strokeDasharray="6 26"
          className="animate-dash"
          style={{ animationDelay: `${i * 0.7}s`, opacity: 0.8 }}
        />
      ))}

      {/* junction dots */}
      {NODES.map((n, i) => (
        <motion.circle
          key={`d${i}`}
          cx={n.x}
          cy={n.y}
          r="4"
          fill="oklch(0.94 0.01 240)"
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.6, 1] }}
          transition={{ duration: 2 + i * 0.3, repeat: Number.POSITIVE_INFINITY }}
        />
      ))}
    </svg>
  )
}
