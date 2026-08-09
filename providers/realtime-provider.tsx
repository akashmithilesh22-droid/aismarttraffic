"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "./auth-provider"
import type { Notification } from "@/types/database"
import { toast } from "sonner"
import { BellRing, ShieldAlert, Activity } from "lucide-react"

export interface OnlineOfficer {
  id: string
  full_name: string
  role: string
  police_station: string
  last_active: string
}

interface RealtimeContextType {
  notifications: Notification[]
  unreadCount: number
  onlineOfficers: OnlineOfficer[]
  isConnected: boolean
  realtimeTick: number
  loadingNotifications: boolean
  markAsRead: (ids: string[]) => Promise<void>
  markAllRead: () => Promise<void>
  deleteNotifications: (ids: string[]) => Promise<void>
}

const RealtimeContext = createContext<RealtimeContextType>({
  notifications: [],
  unreadCount: 0,
  onlineOfficers: [],
  isConnected: false,
  realtimeTick: 0,
  loadingNotifications: true,
  markAsRead: async () => {},
  markAllRead: async () => {},
  deleteNotifications: async () => {}
})

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [onlineOfficers, setOnlineOfficers] = useState<OnlineOfficer[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [realtimeTick, setRealtimeTick] = useState(0)
  const [loadingNotifications, setLoadingNotifications] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchNotifications = useCallback(async () => {
    if (!user || !profile) return
    setLoadingNotifications(true)

    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Unable to load notifications.")
      }

      setNotifications(data.notifications || [])
    } catch (error) {
      console.error("Notification fetch failed:", error)
      toast.error("Unable to load notifications. Please try again.")
      setNotifications([])
    } finally {
      setLoadingNotifications(false)
    }
  }, [user, profile])

  useEffect(() => {
    if (!user || !profile) return
    void fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscriptions
  useEffect(() => {
    if (!user || !profile) return

    // 1. Notifications Channel
    const notificationsChannel = supabase.channel("public:notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const newNotif = payload.new as Notification
          
          // Check if it belongs to this user
          const isTargeted = 
            profile.role === "Super Admin" ||
            newNotif.recipient_user === user.id ||
            newNotif.recipient_role === profile.role ||
            newNotif.recipient_station === profile.police_station ||
            (!newNotif.recipient_user && !newNotif.recipient_role && !newNotif.recipient_station)

          if (isTargeted) {
            setNotifications(prev => [newNotif, ...prev])
            setRealtimeTick((prev) => prev + 1)
            
            // Show toast based on priority
            if (newNotif.priority === "Critical") {
              toast.error(newNotif.title, {
                description: newNotif.message,
                icon: <ShieldAlert className="size-5 text-destructive animate-pulse" />,
                duration: 10000,
              })
              // Audio alert
              try {
                const audio = new Audio('/alert.mp3') // Will silently fail if not present
                audio.play().catch(e => {})
              } catch (e) {}
            } else if (newNotif.priority === "High") {
              toast.warning(newNotif.title, {
                description: newNotif.message,
                icon: <BellRing className="size-5 text-amber-500" />
              })
            } else {
              toast.info(newNotif.title, {
                description: newNotif.message,
                icon: <Activity className="size-5 text-primary" />
              })
            }
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n))
          setRealtimeTick((prev) => prev + 1)
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications" },
        (payload) => {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
          setRealtimeTick((prev) => prev + 1)
        }
      )

    // 2. Presence Channel
    const presenceChannel = supabase.channel("online-officers", {
      config: {
        presence: {
          key: user.id
        }
      }
    })

    presenceChannel.on("presence", { event: "sync" }, () => {
      const state = presenceChannel.presenceState()
      const officers: OnlineOfficer[] = []
      
      for (const id in state) {
        // We only take the first presence instance per user to avoid duplicates if they have multiple tabs
        const presenceData = state[id][0] as any
        officers.push({
          id,
          full_name: presenceData.full_name,
          role: presenceData.role,
          police_station: presenceData.police_station,
          last_active: new Date().toISOString()
        })
      }
      setOnlineOfficers(officers)
    })

    // Subscribe to both
    notificationsChannel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setIsConnected(true)
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
        setIsConnected(false)
        if (status === "CHANNEL_ERROR") {
          toast.error("Connection Lost", { description: "Reconnecting to live command center..." })
        }
      }
    })

    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({
          full_name: profile.full_name,
          role: profile.role,
          police_station: profile.police_station
        })
      }
    })

    return () => {
      supabase.removeChannel(notificationsChannel)
      supabase.removeChannel(presenceChannel)
    }
  }, [user, profile])

  const markAsRead = async (ids: string[]) => {
    if (!ids || ids.length === 0) return
    const previousNotifications = notifications
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true, read_at: new Date().toISOString() } : n)))

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notification_ids: ids }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to mark as read")
      }

      // Refresh from backend to ensure canonical state
      await fetchNotifications()
    } catch (error) {
      console.error("Mark as read failed:", error)
      setNotifications(previousNotifications)
      toast.error("Unable to update notification state. Please try again.")
    }
  }

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return

    const previousNotifications = notifications
    setNotifications((prev) => prev.map((n) => (!n.read ? { ...n, read: true, read_at: new Date().toISOString() } : n)))

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", notification_ids: unreadIds }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to mark all as read")
      }

      await fetchNotifications()
    } catch (error) {
      console.error("Mark all as read failed:", error)
      setNotifications(previousNotifications)
      toast.error("Unable to update notifications. Please try again.")
    }
  }

  const deleteNotifications = async (ids: string[]) => {
    if (!ids || ids.length === 0) return
    const previousNotifications = notifications
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)))

    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", notification_ids: ids }),
      })

      const data = await res.json()
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete notifications")
      }

      await fetchNotifications()
    } catch (error) {
      console.error("Notification delete failed:", error)
      setNotifications(previousNotifications)
      toast.error("Unable to delete notification. Please try again.")
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <RealtimeContext.Provider value={{
      notifications,
      unreadCount,
      onlineOfficers,
      isConnected,
      realtimeTick,
      loadingNotifications,
      markAsRead,
      markAllRead,
      deleteNotifications
    }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  return useContext(RealtimeContext)
}
