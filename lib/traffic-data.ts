import { createClient } from "./supabase/server"
import type { RawRow } from "./types"

export const TRAFFIC_DATA_HEADERS = [
  "id",
  "event_type",
  "latitude",
  "longitude",
  "endlatitude",
  "endlongitude",
  "address",
  "end_address",
  "event_cause",
  "requires_road_closure",
  "start_datetime",
  "end_datetime",
  "status",
  "authenticated",
  "modified_datetime",
  "map_file",
  "direction",
  "description",
  "veh_type",
  "veh_no",
  "corridor",
  "priority",
  "cargo_material",
  "reason_breakdown",
  "age_of_truck",
  "created_date",
  "route_path",
  "client_id",
  "created_by_id",
  "last_modified_by_id",
  "assigned_to_police_id",
  "citizen_accident_id",
  "comment",
  "police_station",
  "meta_data",
  "kgid",
  "resolved_at_address",
  "resolved_at_latitude",
  "resolved_at_longitude",
  "closed_by_id",
  "closed_datetime",
  "resolved_by_id",
  "resolved_datetime",
  "gba_identifier",
  "zone",
  "junction",
]

const SEARCHABLE_COLUMNS = [
  "id",
  "event_type",
  "address",
  "end_address",
  "event_cause",
  "status",
  "authenticated",
  "map_file",
  "direction",
  "description",
  "veh_type",
  "veh_no",
  "corridor",
  "priority",
  "cargo_material",
  "reason_breakdown",
  "age_of_truck",
  "route_path",
  "client_id",
  "created_by_id",
  "last_modified_by_id",
  "assigned_to_police_id",
  "citizen_accident_id",
  "comment",
  "police_station",
  "meta_data",
  "kgid",
  "resolved_at_address",
  "closed_by_id",
  "resolved_by_id",
  "gba_identifier",
  "zone",
  "junction",
]

const FETCH_BATCH_SIZE = 1000

export async function loadTrafficDataset(): Promise<{ rows: RawRow[]; headers: string[] }> {
  const supabase = await createClient()
  const rows: Array<Record<string, unknown>> = []
  let start = 0

  while (true) {
    const { data, error } = await (supabase.from("traffic_records") as any)
      .select(TRAFFIC_DATA_HEADERS.join(","))
      .range(start, start + FETCH_BATCH_SIZE - 1)

    if (error) {
      throw new Error(error.message)
    }

    const batch = (data ?? []) as Array<Record<string, unknown>>
    rows.push(...batch)

    if (batch.length < FETCH_BATCH_SIZE) break
    start += FETCH_BATCH_SIZE
  }

  return {
    rows: rows.map((item) => {
      const row: RawRow = {}
      for (const key of TRAFFIC_DATA_HEADERS) {
        const value = item[key]
        row[key] = value === null || value === undefined ? "" : String(value)
      }
      return row
    }),
    headers: TRAFFIC_DATA_HEADERS,
  }
}

export function applyTrafficSearch(query: any, search: string) {
  const trimmed = search.trim()
  if (!trimmed) return query

  const ilikeValue = `%${trimmed.replace(/%/g, "\\%")}%`
  const conditions = SEARCHABLE_COLUMNS.map((column) => `${column}.ilike.${ilikeValue}`)
  return query.or(conditions.join(","))
}
