import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: prediction, error } = await supabase
      .from("predictions")
      .select(`
        *,
        event:events(*),
        resource_plan:resource_plans(*)
      `)
      .eq("id", id)
      .single()

    if (error || !prediction) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
    }

    return NextResponse.json({ prediction })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
