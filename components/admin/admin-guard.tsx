"use client"

import { useAuth } from "@/providers/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Activity } from "lucide-react"

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!profile || profile.role !== "Super Admin")) {
      router.push("/admin/forbidden")
    }
  }, [profile, loading, router])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Activity className="size-8 animate-pulse text-primary" />
        <p className="text-sm font-medium">Verifying authorization...</p>
      </div>
    )
  }

  if (!profile || profile.role !== "Super Admin") {
    return null
  }

  return <>{children}</>
}
