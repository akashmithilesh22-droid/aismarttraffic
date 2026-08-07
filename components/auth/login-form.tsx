"use client"

import React, { useState } from "react"
import { useAuth } from "@/providers/auth-provider"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Eye, EyeOff, Lock, Mail, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { motion } from "framer-motion"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { login, profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams?.get("redirectTo") || "/dashboard"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!email || !password) {
      setErrorMsg("Please enter both email and password.")
      return
    }

    setIsSubmitting(true)
    const res = await login(email, password)

    if (res.error) {
      setErrorMsg(res.error)
      setIsSubmitting(false)
      toast.error("Authentication Failed", { description: res.error })
    } else {
      setIsSuccess(true)
      
      // We need to fetch the profile from auth-provider or wait a tick,
      // but since login returns once profile is set in auth provider, we can check it.
      // Actually `login` sets profile in context but here we don't have the updated context immediately.
      // So let's check `res.mustChangePassword` if we change login to return it.
      // However, we didn't change `login` to return it yet. Let's redirect to a wrapper or handle it directly here if we update `auth-provider.tsx`.
      
      // Wait a bit to allow context to update, then check profile? No, let's just push to /change-password if we need to.
      // For now, let's just let the route handler middleware or component deal with it, OR we can check it directly by fetching it here.
    }
  }

  // Effect to handle success redirect once profile is available
  React.useEffect(() => {
    if (isSuccess && profile) {
      if (profile.must_change_password) {
        toast.info("Password Change Required", {
          description: "Please update your temporary password to continue.",
        })
        setTimeout(() => {
          router.push("/change-password")
        }, 600)
      } else {
        toast.success("Authentication Successful", {
          description: "Welcome back to SmartTraffic AI Command Center.",
        })
        setTimeout(() => {
          router.push(redirectTo)
          router.refresh()
        }, 600)
      }
    }
  }, [isSuccess, profile, router, redirectTo])

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md space-y-6"
    >
      {/* Header & Crest */}
      <div className="text-center space-y-3">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#1d3a6e] text-white shadow-xl ring-4 ring-[#1d3a6e]/20">
          <Shield className="size-9 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            SmartTraffic <span className="text-primary">AI</span>
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-1">
            Bengaluru Traffic Police Portal
          </p>
        </div>
      </div>

      {/* Login Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl relative overflow-hidden">
        {/* Top Accent Line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#1d3a6e] via-primary to-amber-500" />

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive"
          >
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Authentication Error</p>
              <p className="mt-0.5 opacity-90">{errorMsg}</p>
            </div>
          </motion.div>
        )}

        {isSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 flex items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:text-emerald-400"
          >
            <CheckCircle2 className="size-4 shrink-0" />
            <p className="font-semibold">Identity Verified. Accessing Dashboard...</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">
              Official Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="officer.name@btp.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 bg-background/60"
                disabled={isSubmitting || isSuccess}
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
                Security Password
              </Label>
              <button
                type="button"
                onClick={() =>
                  toast.info("Password Reset Information", {
                    description: "Password resets are managed by BTP System Administrator.",
                  })
                }
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9 pr-9 bg-background/60"
                disabled={isSubmitting || isSuccess}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-border text-primary focus:ring-primary accent-primary"
            />
            <Label htmlFor="remember" className="text-xs text-muted-foreground font-normal cursor-pointer">
              Keep my session active on this station
            </Label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || isSuccess}
            className="w-full gap-2 mt-2 font-semibold shadow-md rounded-xl"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Verifying Credentials...
              </>
            ) : isSuccess ? (
              <>
                <ShieldCheck className="size-4 text-emerald-400" /> Redirecting...
              </>
            ) : (
              <>
                Authorize & Login <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </form>
      </div>

      {/* Security Disclaimer Footer */}
      <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
        Protected Official Portal · Restricted access for authorized Bengaluru Traffic Police personnel only. Direct Supabase Authentication.
      </p>
    </motion.div>
  )
}
