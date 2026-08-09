"use client"

import { Bot } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AiAssistant } from "@/components/ai-assistant"
import { DataProvider, useEngine } from "@/lib/data-provider"

function FloatingAiAssistantPanel() {
  const { loading, error, model, summary } = useEngine()

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/90 px-4 py-3 text-sm font-semibold text-card shadow-[0_18px_40px_rgba(67,56,202,0.18)] transition hover:bg-primary/95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
        <Bot className="size-4" /> SmartTraffic AI
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-[520px] p-0">
        <SheetHeader className="border-b border-border px-4 py-4">
          <SheetTitle>SmartTraffic AI Assistant</SheetTitle>
          <p className="text-xs text-muted-foreground">
            Reused from Simulator & Reports. Ask about congestion, risk, resource planning, or dataset insights.
          </p>
        </SheetHeader>
        <div className="h-[calc(100vh-5rem)] overflow-hidden">
          {loading || !model || !summary ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-muted-foreground">
              {error ? "Unable to load SmartTraffic assistant right now." : "Loading SmartTraffic assistant..."}
            </div>
          ) : (
            <AiAssistant model={model} summary={summary} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function FloatingAiAssistant() {
  return (
    <DataProvider>
      <FloatingAiAssistantPanel />
    </DataProvider>
  )
}
