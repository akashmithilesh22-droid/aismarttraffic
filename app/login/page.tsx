import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import Link from "next/link"
import { ArrowLeft, Activity } from "lucide-react"

export const metadata = {
  title: "Officer Authentication | SmartTraffic AI",
  description: "Secure login portal for Bengaluru Traffic Police officers.",
}

export default function LoginPage() {
  return (
    <div className="relative min-h-svh flex flex-col justify-between bg-background text-foreground overflow-hidden">
      {/* Background Glow & Pattern */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 size-[500px] rounded-full bg-amber-500/10 blur-[120px]" />

      {/* Top Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" /> Back to Public Portal
        </Link>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Activity className="size-3.5 text-emerald-500 animate-pulse" />
          <span>System Online · BTP Secure Server</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-4 sm:p-6">
        <Suspense fallback={<div className="text-xs text-muted-foreground">Loading login portal...</div>}>
          <LoginForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-4 text-center text-[11px] text-muted-foreground">
        © 2025 SmartTraffic AI · Bengaluru Traffic Police Command Portal · SIH 2025 Prototype
      </footer>
    </div>
  )
}
