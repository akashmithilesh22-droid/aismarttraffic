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
      return NextResponse.json({ error: "Unauthorized officer access required" }, { status: 401 })
    }

    const body = await request.json()
    const {
      event_id,
      impact_score,
      risk_level,
      confidence,
      estimated_clearance,
      timeline_json,
      feature_importance_json,
      similar_events_json,
      resource_plan,
    } = body

    if (!event_id || impact_score === undefined || !risk_level) {
      return NextResponse.json({ error: "Missing required prediction parameters" }, { status: 400 })
    }

    // 1. Insert Prediction record into Supabase
    const { data: newPrediction, error: predError } = await supabase
      .from("predictions")
      .insert({
        event_id,
        impact_score,
        risk_level,
        confidence: confidence || 85.0,
        estimated_clearance: estimated_clearance || 60,
        timeline_json: timeline_json || [],
        feature_importance_json: feature_importance_json || [],
        similar_events_json: similar_events_json || [],
      })
      .select()
      .single()

    if (predError) {
      return NextResponse.json({ error: predError.message }, { status: 500 })
    }

    // 2. Insert Resource Plan record into Supabase
    let savedResourcePlan = null
    if (resource_plan) {
      const { data: newPlan, error: planError } = await supabase
        .from("resource_plans")
        .insert({
          prediction_id: newPrediction.id,
          officers: resource_plan.officers || 0,
          marshals: resource_plan.marshals || 0,
          barricades: resource_plan.barricades || 0,
          diversions: resource_plan.diversions || 0,
          checkpoints: resource_plan.checkpoints || 0,
          ambulances: resource_plan.ambulances || 0,
          rapid_response_units: resource_plan.rapid_response_units || 0,
          deployment_json: resource_plan.deployment_json || {},
        })
        .select()
        .single()

      if (!planError) {
        savedResourcePlan = newPlan
      }
    }

    // 3. Log Audit Action
    await logAuditAction(
      supabase,
      user.id,
      "Generated Prediction",
      "prediction",
      newPrediction.id,
      { event_id, impact_score, risk_level }
    )

    return NextResponse.json(
      {
        prediction: newPrediction,
        resource_plan: savedResourcePlan,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
