"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BrainCircuit, Radar, ShieldAlert, FlaskConical, Home } from "lucide-react"

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/training", label: "Training", icon: BrainCircuit },
  { href: "/forecast", label: "Forecast", icon: Radar },
  { href: "/resources", label: "Resources", icon: ShieldAlert },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 py-2 backdrop-blur md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
