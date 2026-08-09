import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { TRAFFIC_DATA_HEADERS, loadTrafficDataset, applyTrafficSearch } from "@/lib/traffic-data"

export async function GET(request: Request) {
  const startedAt = Date.now()
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn("[traffic-records] unauthorized request", { authError: authError?.message })
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

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
    console.info("[traffic-records] dataset loaded", {
      userId: user.id,
      rows: data.rows.length,
      durationMs: Date.now() - startedAt,
    })
    return NextResponse.json({
      ...data,
      totalCount: data.rows.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load traffic dataset"
    console.error("[traffic-records] request failed", { message, durationMs: Date.now() - startedAt })
    return NextResponse.json({ error: "Unable to load traffic records", details: message }, { status: 500 })
  }
}
