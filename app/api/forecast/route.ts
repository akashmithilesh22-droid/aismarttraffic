import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { recordsFromRows } from "@/lib/data"
import { trainModel, predict } from "@/lib/model"
import type { RawRow, ForecastInput } from "@/lib/types"

// In Next.js serverless/API routes, module-level variables are cached in memory
// across multiple invocations of the same serverless function container.
let cachedModel: any = null

function getModel() {
  if (cachedModel) return cachedModel

  const filePath = path.join(process.cwd(), "dataset csv file.csv")
  const fileContent = fs.readFileSync(filePath, "utf-8")
  const parsed = Papa.parse<RawRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const records = recordsFromRows(parsed.data)
  cachedModel = trainModel(records)
  return cachedModel
}

export async function POST(request: Request) {
  try {
    const input: ForecastInput = await request.json()

    // Validate input fields
    if (!input.cause || !input.corridor || !input.zone || !input.junction) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (cause, corridor, zone, junction)" },
        { status: 400 }
      )
    }

    const model = getModel()
    const result = predict(model, input)

    return NextResponse.json({
      success: true,
      message: "Prediction generated successfully by backend server.",
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "An error occurred during prediction" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const model = getModel()
    return NextResponse.json({
      success: true,
      message: "Traffic model metadata retrieved from backend.",
      trainedAt: new Date().toISOString(),
      metrics: {
        accuracy: model.metrics.accuracy,
        r2: model.metrics.r2,
        cvScore: model.metrics.cvScore,
        rmse: model.metrics.rmse,
        mae: model.metrics.mae,
        sampleCount: model.metrics.n,
      },
      features: model.featureOrder,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load model" },
      { status: 500 }
    )
  }
}
