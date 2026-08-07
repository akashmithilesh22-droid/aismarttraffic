"use client"

import { useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import { useRouter } from "next/navigation"
import { Shield, Lock, ArrowRight, Loader2, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { user, profile, refreshProfile } = useAuth()
  const router = useRouter()

  if (!user || !profile) {
    return <div className="p-8 text-center">Loading...</div>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    
    try {
      // 1. Update auth.users password
      const { error: authError } = await supabase.auth.updateUser({
        password: password,
        data: { must_change_password: false }
      })

      if (authError) throw authError

      // 2. Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id)

      if (profileError) throw profileError

      toast.success("Password updated successfully", {
        description: "You have securely updated your account password."
      })

      await refreshProfile()
      
      setTimeout(() => {
        router.push("/dashboard")
      }, 1000)

    } catch (err: any) {
      toast.error("Failed to update password", { description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-svh flex flex-col justify-center items-center bg-background text-foreground overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
      <div className="pointer-events-none absolute -top-40 -left-40 size-[500px] rounded-full bg-primary/10 blur-[120px]" />
      
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6 z-10"
      >
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shadow-xl ring-4 ring-amber-500/20">
            <KeyRound className="size-8" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Security Notice</h1>
            <p className="text-sm text-muted-foreground mt-2 px-4">
              You are required to change your temporary password before accessing the system.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 to-primary" />
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  disabled={isSubmitting}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9"
                  disabled={isSubmitting}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isSubmitting}
              className="w-full gap-2 mt-4 font-semibold shadow-md rounded-xl"
            >
              {isSubmitting ? (
                <><Loader2 className="size-4 animate-spin" /> Updating...</>
              ) : (
                <>Save & Continue <ArrowRight className="size-4" /></>
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
