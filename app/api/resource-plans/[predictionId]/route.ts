import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ predictionId: string }> }
) {
  try {
    const { predictionId } = await params
    const supabase = await createClient()

    const { data: plan, error } = await supabase
      .from("resource_plans")
      .select("*")
      .eq("prediction_id", predictionId)
      .single()

    if (error || !plan) {
      return NextResponse.json({ error: "Resource plan not found" }, { status: 404 })
    }

    return NextResponse.json({ resource_plan: plan })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
