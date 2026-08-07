"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile, UserRole } from "@/types/auth"
import type { User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

interface AuthContextType {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  loading: boolean
  login: (email: string, pass: string) => Promise<{ error: string | null }>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  role: null,
  loading: true,
  login: async () => ({ error: null }),
  logout: async () => {},
  refreshProfile: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Helper to fetch profile from Supabase profiles table directly
  const fetchProfile = useCallback(async (userId: string, email: string): Promise<Profile | null> => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error || !data) {
        console.warn("Profile fetch issue:", error?.message)
        return {
          id: userId,
          full_name: email.split('@')[0].toUpperCase(),
          email,
          role: 'Traffic Officer',
          police_station: 'Bengaluru Central',
          district: 'Bengaluru City',
          phone: null,
          badge_number: 'BTP-OFFICER',
          is_active: true,
          photo_url: null,
          must_change_password: true,
          archived_at: null,
          archived_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }
      return data as Profile
    } catch (err) {
      console.error("Error fetching profile from Supabase:", err)
      return null
    }
  }, [])

  // Initialize auth state directly from Supabase
  useEffect(() => {
    let isMounted = true
    const supabase = createClient()

    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const prof = await fetchProfile(session.user.id, session.user.email || '')
          if (isMounted) {
            setUser(session.user)
            setProfile(prof)
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err)
      } finally {
        if (isMounted) setLoading(false)
      }

      // Supabase real-time auth state change listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          const prof = await fetchProfile(session.user.id, session.user.email || '')
          setProfile(prof)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    }

    initAuth()
    return () => { isMounted = false }
  }, [fetchProfile])

  const login = async (email: string, pass: string): Promise<{ error: string | null }> => {
    setLoading(true)
    const normalizedEmail = email.toLowerCase().trim()

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: pass,
      })

      if (error) {
        setLoading(false)
        return { error: error.message }
      }

      if (data.user) {
        const prof = await fetchProfile(data.user.id, data.user.email || '')
        setUser(data.user)
        setProfile(prof)
      }
      setLoading(false)
      return { error: null }
    } catch (err: unknown) {
      setLoading(false)
      const msg = err instanceof Error ? err.message : 'Authentication failed'
      return { error: msg }
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (e) {
      console.error("Signout error:", e)
    }

    setUser(null)
    setProfile(null)
    setLoading(false)
    router.push('/login')
    router.refresh()
  }

  const refreshProfile = async () => {
    if (user) {
      const prof = await fetchProfile(user.id, user.email || '')
      setProfile(prof)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        loading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
