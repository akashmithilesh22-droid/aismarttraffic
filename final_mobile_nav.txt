"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Radar, ShieldAlert, FlaskConical, Home, LayoutDashboard } from "lucide-react"
import { ThemeToggle } from "./theme-toggle"

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/forecast", label: "Forecast", icon: Radar },
  { href: "/resources", label: "Resources", icon: ShieldAlert },
  { href: "/simulator", label: "Simulator", icon: FlaskConical },
]

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="sticky bottom-0 z-40 flex items-center justify-around border-t border-border bg-card px-1 py-2 md:hidden">
      {NAV.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
      <div className="flex flex-col items-center gap-1 px-1 py-1 text-[10px] font-medium text-muted-foreground">
        <ThemeToggle className="size-7 border-0 bg-transparent" />
        <span>Theme</span>
      </div>
    </nav>
  )
}
