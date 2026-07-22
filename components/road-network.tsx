// Static, low-key schematic road grid used as a subtle hero backdrop.
// Intentionally non-animated — operational software, not a showcase.
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
  { x: 140, y: 120 },
  { x: 380, y: 260 },
  { x: 620, y: 120 },
  { x: 140, y: 400 },
  { x: 620, y: 400 },
  { x: 380, y: 120 },
]

export function RoadNetwork({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      {/* roads */}
      {ROADS.map((d, i) => (
        <path key={`r${i}`} d={d} stroke="var(--muted-foreground)" strokeWidth="1.5" fill="none" opacity="0.22" />
      ))}

      {/* junction dots */}
      {NODES.map((n, i) => (
        <circle key={`d${i}`} cx={n.x} cy={n.y} r="3" fill="var(--muted-foreground)" opacity="0.4" />
      ))}
    </svg>
  )
}
