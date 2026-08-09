import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { TRAFFIC_DATA_HEADERS, loadTrafficDataset, applyTrafficSearch } from "@/lib/traffic-data"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const page = url.searchParams.get("page")
    const pageSize = parseInt(url.searchParams.get("pageSize") || "100", 10)
    const search = url.searchParams.get("search") || ""

    if (page) {
      const requestedPage = Number(page)
      const pageNumber = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1
      const limit = Math.min(Math.max(pageSize, 1), 200)
      const start = (pageNumber - 1) * limit
      const end = start + limit - 1

      const supabase = await createClient()
      let query = supabase
        .from("traffic_records")
        .select(TRAFFIC_DATA_HEADERS.join(","), { count: "exact" })

      if (search.trim()) {
        query = applyTrafficSearch(query, search)
      }

      const { data, error, count } = await query.range(start, end)

      if (error) {
        throw error
      }

      return NextResponse.json({
        rows: data || [],
        headers: TRAFFIC_DATA_HEADERS,
        totalCount: count ?? 0,
        page: pageNumber,
        pageSize: limit,
      })
    }

    const data = await loadTrafficDataset()
    return NextResponse.json({
      ...data,
      totalCount: data.rows.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load traffic dataset"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
