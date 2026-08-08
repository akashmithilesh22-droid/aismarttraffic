"use client"

import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { useEngine } from "@/lib/data-provider"
import { Activity } from "lucide-react"
import { cn } from "@/lib/utils"

export function AppShell({ children, fullWidth = false }: { children: ReactNode; fullWidth?: boolean }) {
  const { loading, error } = useEngine()
  return (
    <div className="flex min-h-svh bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {error ? (
            <div className="mx-auto mt-20 max-w-md text-center text-sm text-destructive">
              Failed to load the dataset. Please refresh.
            </div>
          ) : loading ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
              <Activity className="size-7 animate-pulse-glow text-primary" />
              <p className="text-sm">Loading dataset & training model…</p>
            </div>
          ) : (
            <div className={cn("mx-auto space-y-8", fullWidth ? "max-w-full" : "max-w-7xl")}>{children}</div>
          )}
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
