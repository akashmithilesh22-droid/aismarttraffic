"use client"

import { useRealtime } from "@/providers/realtime-provider"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Bell, Trash2, CheckCircle2, AlertTriangle, ShieldAlert, Clock } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export function NotificationDrawer({ triggerClassName }: { triggerClassName?: string }) {
  const { notifications, unreadCount, markAsRead, markAllRead, deleteNotifications, loadingNotifications } = useRealtime()

  const markAllAsRead = () => {
    markAllRead()
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Critical": return <ShieldAlert className="size-4 text-destructive" />
      case "High": return <AlertTriangle className="size-4 text-amber-500" />
      default: return <Bell className="size-4 text-primary" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical": return "bg-destructive/10 text-destructive border-destructive/20"
      case "High": return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      case "Medium": return "bg-sky-500/10 text-sky-500 border-sky-500/20"
      default: return "bg-primary/10 text-primary border-primary/20"
    }
  }

  return (
    <Sheet>
      <SheetTrigger className={cn("relative flex items-center justify-center rounded-md p-2 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground text-muted-foreground", triggerClassName)}>
        <Bell className="size-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-in zoom-in">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border shadow-sm">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="size-5" /> Notifications
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount} New
                </span>
              )}
            </SheetTitle>
            <div className="flex gap-2">
              <button 
                onClick={markAllAsRead}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Mark all read
              </button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingNotifications ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
              <CheckCircle2 className="size-10 opacity-20 mb-3" />
              <p className="text-sm font-medium">You're all caught up.</p>
              <p className="text-xs">No notifications right now.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div 
                key={n.id}
                className={cn(
                  "relative rounded-xl border p-4 transition-all hover:shadow-md",
                  n.read ? "bg-card border-border/50" : "bg-primary/5 border-primary/30"
                )}
              >
                {!n.read && (
                  <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-primary" />
                )}
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(n.priority)}
                      <p className={cn("text-sm font-bold", !n.read ? "text-foreground" : "text-muted-foreground")}>
                        {n.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-3 pt-2">
                      <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", getPriorityColor(n.priority))}>
                        {n.type}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="size-3" />
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {!n.read && (
                      <button 
                        onClick={() => markAsRead([n.id])}
                        className="rounded bg-primary/10 p-1.5 text-primary hover:bg-primary/20 transition-colors"
                        title="Mark as read"
                      >
                        <CheckCircle2 className="size-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteNotifications([n.id])}
                      className="rounded bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
