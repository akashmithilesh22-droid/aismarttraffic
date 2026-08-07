"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, X } from "lucide-react"
import { useGIS } from "./gis-provider"
import { useMemo } from "react"
import { Card } from "@/components/ui/card"

export function MapSearch() {
  const { searchQuery, setSearchQuery, searchResults, setSelectedResult } = useGIS()

  const visibleResults = useMemo(() => searchResults.slice(0, 6), [searchResults])

  return (
    <Card className="glass p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search station, event, district, corridor..."
            className="pl-9"
          />
        </div>
        {searchQuery ? (
          <Button variant="ghost" size="icon" onClick={() => setSearchQuery("")}>
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {visibleResults.length ? (
        <div className="mt-3 space-y-2">
          {visibleResults.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedResult(item)
                setSearchQuery(item.label)
              }}
              className="flex w-full flex-col rounded-lg border border-border bg-background/60 p-2 text-left transition-colors hover:border-primary/50"
            >
              <span className="text-sm font-semibold text-foreground">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.subtitle}</span>
            </button>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
