import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { ShieldAlert, ArrowLeft } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function ForbiddenPage() {
  return (
    <AppShell>
      <div className="flex min-h-[70vh] flex-col items-center justify-center text-center p-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-6">
          <ShieldAlert className="size-10" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">403 Unauthorized</h1>
        <p className="text-muted-foreground max-w-md mb-8">
          This area is restricted to Super Admin personnel only. Your current role does not have the necessary permissions to access the Administration Portal.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "default" }), "gap-2")}>
          <ArrowLeft className="size-4" /> Return to Dashboard
        </Link>
      </div>
    </AppShell>
  )
}
