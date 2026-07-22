"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import useSWR from "swr"
import Papa from "papaparse"
import type { RawRow, TrafficRecord, DatasetSummary, TrainedModel, LocationHierarchy } from "./types"
import { recordsFromRows, summarize } from "./data"
import { trainModel } from "./model"
import { buildLocationHierarchy } from "./analytics"

interface EngineData {
  loading: boolean
  error: boolean
  rawRows: RawRow[]
  headers: string[]
  records: TrafficRecord[]
  summary: DatasetSummary | null
  model: TrainedModel | null
  hierarchy: LocationHierarchy
  /** Lookup: "cause|||corridor|||zone" → alphabetically sorted unique junction list */
  junctionLookup: Record<string, string[]>
  options: {
    causes: string[]
    corridors: string[]
    junctions: string[]
    zones: string[]
    policeStations: string[]
    priorities: string[]
    eventTypes: string[]
  }
}

const EMPTY_HIERARCHY: LocationHierarchy = {
  corridorToJunctions: {},
  junctionToZone: {},
  junctionToPoliceStation: {},
}

const Ctx = createContext<EngineData | null>(null)

async function fetchCsv(url: string): Promise<{ rows: RawRow[]; headers: string[] }> {
  const res = await fetch(url)
  const text = await res.text()
  const parsed = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  return { rows: parsed.data, headers: parsed.meta.fields ?? [] }
}

function uniqueSorted(records: TrafficRecord[], key: (r: TrafficRecord) => string, min = 1, max = 120) {
  const m = new Map<string, number>()
  for (const r of records) {
    const k = key(r)
    if (!k || k === "Unknown" || k === "Unknown Junction") continue
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([k]) => k)
}

/**
 * Build a lookup map from dataset records:
 * key = "cause|||corridor|||zone"  →  sorted, deduplicated junction list
 */
function buildJunctionLookup(records: TrafficRecord[]): Record<string, string[]> {
  const m: Record<string, Set<string>> = {}
  for (const r of records) {
    const j = r.junction
    if (!j || j === "Unknown Junction") continue
    const key = `${r.cause}|||${r.corridor}|||${r.zone}`
    if (!m[key]) m[key] = new Set()
    m[key].add(j)
  }
  const result: Record<string, string[]> = {}
  for (const [key, junctions] of Object.entries(m)) {
    result[key] = [...junctions].sort()
  }
  return result
}

/**
 * Resolve junctions for given selection with cascading fallbacks:
 * 1. Exact cause + corridor + zone match
 * 2. Corridor + zone (ignore cause)
 * 3. Zone only
 * 4. All junctions in dataset
 */
export function resolveJunctions(
  lookup: Record<string, string[]>,
  allJunctions: string[],
  cause: string,
  corridor: string,
  zone: string,
): string[] {
  // 1. Exact match
  const exactKey = `${cause}|||${corridor}|||${zone}`
  const exact = lookup[exactKey]
  if (exact && exact.length > 0) return exact

  // 2. Corridor + zone (any cause)
  const byCorrZone = new Set<string>()
  for (const [k, junctions] of Object.entries(lookup)) {
    const parts = k.split("|||")
    if (parts[1] === corridor && parts[2] === zone) junctions.forEach((j) => byCorrZone.add(j))
  }
  if (byCorrZone.size > 0) return [...byCorrZone].sort()

  // 3. Zone only (any cause, any corridor)
  const byZone = new Set<string>()
  for (const [k, junctions] of Object.entries(lookup)) {
    const parts = k.split("|||")
    if (parts[2] === zone) junctions.forEach((j) => byZone.add(j))
  }
  if (byZone.size > 0) return [...byZone].sort()

  // 4. Full junction list as last resort
  return allJunctions
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { data, error, isLoading } = useSWR("/dataset.csv", fetchCsv, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })

  const value = useMemo<EngineData>(() => {
    if (!data) {
      return {
        loading: isLoading,
        error: !!error,
        rawRows: [],
        headers: [],
        records: [],
        summary: null,
        model: null,
        hierarchy: EMPTY_HIERARCHY,
        junctionLookup: {},
        options: {
          causes: [],
          corridors: [],
          junctions: [],
          zones: [],
          policeStations: [],
          priorities: [],
          eventTypes: [],
        },
      }
    }
    const records = recordsFromRows(data.rows)
    const summary = summarize(data.rows, data.headers)
    const model = trainModel(records)
    const hierarchy = buildLocationHierarchy(records)
    const junctionLookup = buildJunctionLookup(records)

    return {
      loading: false,
      error: false,
      rawRows: data.rows,
      headers: data.headers,
      records,
      summary,
      model,
      hierarchy,
      junctionLookup,
      options: {
        causes: uniqueSorted(records, (r) => r.cause),
        corridors: uniqueSorted(records, (r) => r.corridor),
        junctions: uniqueSorted(records, (r) => r.junction, 1, 200),
        zones: uniqueSorted(records, (r) => r.zone),
        policeStations: uniqueSorted(records, (r) => r.policeStation, 1, 200),
        priorities: uniqueSorted(records, (r) => r.priority, 1, 10),
        eventTypes: uniqueSorted(records, (r) => r.eventType, 1, 10),
      },
    }
  }, [data, error, isLoading])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEngine() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useEngine must be used within DataProvider")
  return ctx
}
