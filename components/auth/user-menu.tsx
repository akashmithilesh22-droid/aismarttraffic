"use client"

import { useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import { Shield, LogOut, UserCheck, Building2, BadgeCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function UserMenu({ className }: { className?: string }) {
  const { profile, role, logout } = useAuth()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!profile) return null

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
  }

  return (
    <div className={cn("rounded-xl border border-border/80 bg-card/70 p-3.5 shadow-sm backdrop-blur-md space-y-3", className)}>
      {/* Officer Avatar & Primary Info */}
      <div className="flex items-center gap-3">
        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1d3a6e] text-white ring-2 ring-primary/30 font-bold">
          <Shield className="size-5 text-amber-400" />
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-background" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">{profile.full_name}</p>
            <BadgeCheck className="size-4 text-primary shrink-0" />
          </div>
          <p className="text-[11px] font-medium text-primary">
            {role || 'Officer'} {profile.badge_number ? `· ${profile.badge_number}` : ''}
          </p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Building2 className="size-3.5 text-primary" /> Station
          </span>
          <span className="font-semibold text-foreground truncate max-w-[130px]">{profile.police_station}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UserCheck className="size-3.5 text-accent" /> Role
          </span>
          <span className="font-mono text-[11px] font-bold text-accent uppercase tracking-wider">{role}</span>
        </div>
      </div>

      {/* Logout Action */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs h-8"
      >
        <LogOut className="size-3.5" />
        {isLoggingOut ? "Signing Out..." : "Sign Out"}
      </Button>
    </div>
  )
}
