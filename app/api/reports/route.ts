import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { logAuditAction } from "@/lib/services/audit"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { prediction_id, pdf_url } = body

    if (!prediction_id) {
      return NextResponse.json({ error: "Missing prediction_id" }, { status: 400 })
    }

    const { data: newReport, error } = await supabase
      .from("reports")
      .insert({
        prediction_id,
        pdf_url: pdf_url || null,
        generated_by: user.id,
      })
      .select(`
        *,
        creator_profile:profiles!reports_generated_by_fkey(full_name, role)
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto audit log
    await logAuditAction(
      supabase,
      user.id,
      "Exported Report",
      "report",
      newReport.id,
      { prediction_id }
    )

    return NextResponse.json({ report: newReport }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
