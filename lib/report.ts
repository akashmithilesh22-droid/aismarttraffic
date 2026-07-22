import jsPDF from "jspdf"
import type { DatasetSummary, TrainedModel, ForecastInput, ForecastResult } from "./types"

interface ScenarioData {
  input: ForecastInput
  result: ForecastResult & { plan?: any }
}

interface ReportArgs {
  summary: DatasetSummary
  model: TrainedModel
  scenarioA: ScenarioData
  scenarioB: ScenarioData
}

export function generateReport({ summary, model, scenarioA, scenarioB }: ReportArgs) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = 0

  // header band
  doc.setFillColor(20, 26, 38)
  doc.rect(0, 0, W, 96, "F")
  doc.setTextColor(245, 178, 90)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.text("SmartTraffic AI", M, 46)
  doc.setTextColor(220, 224, 230)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text("Event Traffic Forecast & Resource Plan Report", M, 68)
  doc.setFontSize(9)
  doc.setTextColor(150, 156, 166)
  doc.text(`Generated ${new Date().toLocaleString()}`, M, 84)

  y = 128

  const heading = (t: string) => {
    doc.setTextColor(245, 178, 90)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.text(t, M, y)
    doc.setDrawColor(70, 76, 88)
    doc.line(M, y + 6, W - M, y + 6)
    y += 26
  }
  const row = (label: string, value: string) => {
    doc.setTextColor(120, 126, 138)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text(label, M, y)
    doc.setTextColor(30, 36, 48)
    doc.setFont("helvetica", "bold")
    doc.text(value, M + 220, y)
    y += 19
  }

  // model summary
  heading("Model & Dataset Summary")
  row("Records analysed", summary.totalRecords.toLocaleString())
  row("Features engineered", String(summary.totalFeatures))
  row("Model R-squared", model.metrics.r2.toFixed(3))
  row("Cross-validation score", model.metrics.cvScore.toFixed(3))
  row("Risk-band accuracy", `${model.metrics.accuracy.toFixed(1)}%`)
  row("Data health score", `${summary.healthScore}/100`)
  y += 10

  // top drivers
  heading("Top Risk Drivers (Explainable AI)")
  model.importance.slice(0, 5).forEach((f, i) => {
    row(`${i + 1}. ${f.feature}`, `${(f.importance * 100).toFixed(0)}% · ${f.direction}`)
  })
  y += 10

  // scenarios
  const scenario = (name: string, s: ScenarioData) => {
    heading(`${name}`)
    row("Event cause", s.input.cause)
    row("Corridor", s.input.corridor || "—")
    row("Zone", s.input.zone || "—")
    row("Junction", s.input.junction || "—")
    row("Priority", s.input.priority)
    row("Time / duration", `${String(s.input.hour).padStart(2, "0")}:00 · ${s.input.durationMin} min`)
    row("Road closure", s.input.requiresClosure ? "Yes" : "No")
    row("Predicted impact", `${s.result.impact}/100 (${s.result.risk} Risk)`)
    row("Model confidence", `${s.result.confidence}%`)
    row("Primary Police Station", s.result.policeStationRec.primary)
    if (s.result.policeStationRec.supporting && s.result.policeStationRec.supporting.length > 0) {
      row("Supporting Station(s)", s.result.policeStationRec.supporting.join(", "))
    }
    row("Station Confidence", `${s.result.policeStationRec.confidence}%`)
    if (s.result.plan) {
      row("Police officers", String(s.result.plan.officers))
      row("Barricades", `${s.result.plan.barricades} (${s.result.plan.barricadeIntensity})`)
      row("Diversions", String(s.result.plan.diversions))
    }
    y += 10
  }

  if (y > 500) {
    doc.addPage()
    y = 64
  }
  scenario("Scenario A", scenarioA)

  if (y > 500) {
    doc.addPage()
    y = 64
  }
  scenario("Scenario B", scenarioB)

  // recommendation
  if (y > 600) {
    doc.addPage()
    y = 64
  }
  heading("Recommendation")
  const better = scenarioA.result.impact <= scenarioB.result.impact ? "A" : "B"
  doc.setTextColor(60, 66, 78)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  const recText = doc.splitTextToSize(
    `Scenario ${better} presents the lower congestion impact. Prioritise the resource plan associated with the higher-risk scenario when both events may occur, and pre-stage rapid-response units to allow dynamic redeployment. All figures are derived live from the historical incident dataset.`,
    W - M * 2,
  )
  doc.text(recText, M, y)

  // footer
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(150, 156, 166)
    doc.text("SmartTraffic AI · Confidential operational planning document", M, doc.internal.pageSize.getHeight() - 24)
    doc.text(`Page ${p} / ${pages}`, W - M - 50, doc.internal.pageSize.getHeight() - 24)
  }

  doc.save(`smarttraffic-report-${Date.now()}.pdf`)
}
