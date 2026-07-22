"use client"

import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { MobileNav } from "./mobile-nav"
import { useEngine } from "@/lib/data-provider"
import { Activity } from "lucide-react"

export function AppShell({ children }: { children: ReactNode }) {
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
            <div className="mx-auto max-w-7xl space-y-8">{children}</div>
          )}
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
