"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, Send, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import type { TrainedModel, DatasetSummary } from "@/lib/types"

interface Message {
  role: "user" | "ai"
  text: string
}

function generateAnswer(q: string, model: TrainedModel, summary: DatasetSummary): string {
  const ql = q.toLowerCase()

  const topFeature = model.importance[0]
  const topCause = Object.entries(model.causeImpact).sort((a, b) => b[1] - a[1])[0]
  const topZone = Object.entries(model.zoneImpact).sort((a, b) => b[1] - a[1])[0]
  const topCorridor = Object.entries(model.corridorImpact).sort((a, b) => b[1] - a[1])[0]

  // Congestion high
  if (ql.includes("congestion") && (ql.includes("high") || ql.includes("why"))) {
    return `According to our ensemble model trained on Bengaluru data, high congestion is primarily driven by **${topFeature.feature}** (relative importance of ${(topFeature.importance * 100).toFixed(0)}%). Historically, events caused by "${topCause[0]}" show the highest average impact of ${topCause[1].toFixed(1)}/100, while incidents in zone "${topZone[0]}" average ${topZone[1].toFixed(1)}/100. Peak hours (08:00–11:00 and 17:00–20:00) increase incident frequency and impact relative to the global baseline, while road closures introduce a significant increase in modeled severity.`
  }

  // Police station / precinct
  if (ql.includes("station") || ql.includes("precinct") || ql.includes("hal traffic police")) {
    return `The system recommends the **Responsible Police Station** based on historical frequency matching in the dataset. It runs a cascading lookup on matching records (starting from exact junction + zone + corridor match down to zone level) to find which stations historically managed similar incidents. The station with the highest count is recommended as the **Primary Response Station**, while others are listed as **Supporting Stations**, with the assignment confidence based on historical frequency proportion.`
  }

  // Officers / more officers
  if (ql.includes("officer") || ql.includes("police") || ql.includes("manpower") || ql.includes("personnel")) {
    return `The AI recommends officer counts dynamically by starting with a baseline count per risk band (Low: 3, Moderate: 6, High: 12, Critical: 20) and scaling it. The scaling factor is calculated from the ratio of your input duration against the historical average duration of the corresponding risk band (learned averages: Low = ${model.bandStats.Low.avgDuration} min, Moderate = ${model.bandStats.Moderate.avgDuration} min, High = ${model.bandStats.High.avgDuration} min, Critical = ${model.bandStats.Critical.avgDuration} min). Closure requests scale officers by ×1.4, and peak hours scale officers by ×1.25. This ensures deployments reflect the actual scale of historical incidents rather than static rules.`
  }

  // Factors / prediction explanation
  if (ql.includes("factor") || ql.includes("influenc") || ql.includes("predict") || ql.includes("how") || ql.includes("decision")) {
    const factors = model.importance.slice(0, 5).map((f, i) => `${i + 1}. **${f.feature}** (${(f.importance * 100).toFixed(0)}%) — tends to ${f.direction} risk`)
    return `The top factors influencing each prediction are:\n\n${factors.join("\n")}\n\nThe model is a bagged decision tree ensemble trained on ${summary.totalRecords.toLocaleString()} historical incidents with ${model.metrics.n.toLocaleString()} usable records. Cross-validation R² = ${model.metrics.cvScore.toFixed(2)}, meaning these factors explain ~${(model.metrics.cvScore * 100).toFixed(0)}% of impact variance.`
  }

  // Crowd size doubles
  if (ql.includes("crowd") || ql.includes("double") || ql.includes("increase") || ql.includes("bigger")) {
    return `Doubling crowd size typically increases incident duration and triggers road closures. Our model's resource recommendations are highly sensitive to duration changes relative to the learned band averages (e.g. **${model.bandStats.Moderate.avgDuration} mins** for Moderate events). A longer duration or closure request increases the duration multiplier (square root of input duration / band average) and applies a ×1.4 closure multiplier, causing the recommended officers to increase proportionally. For instance, moving from the average Low duration (**${model.bandStats.Low.avgDuration} min**) to Moderate average duration (**${model.bandStats.Moderate.avgDuration} min**) increases the baseline officers from 3 to 6.`
  }

  // Diversion
  if (ql.includes("diversion") || ql.includes("alternate") || ql.includes("route")) {
    return `Diversions are recommended for Moderate to Critical risk levels when road closure is required. The count scales based on the risk band baseline (Moderate: 1, High: 2, Critical: 4) and is multiplied by 1.4 if closure is active. The highest-impact corridor in the dataset is **${topCorridor[0]}** with an average impact of **${topCorridor[1].toFixed(1)}/100**.`
  }

  // Barricades
  if (ql.includes("barricade") || ql.includes("barrier")) {
    return `Barricade counts are derived from risk band baselines (Low: 4, Moderate: 12, High: 24, Critical: 40) and scaled by duration and closure multipliers. The barricade intensity level is classified based on predicted impact score thresholds: Low (<42), Moderate (42–61), High (62–79), and Maximum (80+). The highest-impact corridor requiring barricading is **${topCorridor[0]}** (avg impact: **${topCorridor[1].toFixed(1)}/100**).`
  }

  // Zone / location
  if (ql.includes("zone") || ql.includes("location") || ql.includes("area") || ql.includes("where")) {
    return `The highest-impact zone in our dataset is "${topZone[0]}" with an average impact score of ${topZone[1].toFixed(1)}/100. Zone history is one of the important features in the model — areas with a pattern of high-impact incidents receive a boosted risk score even for new events. This is computed via target encoding: the zone's historical average impact is used as a numeric feature.`
  }

  // Risk score
  if (ql.includes("risk") || ql.includes("score") || ql.includes("rating")) {
    return `The risk score (0–100) is predicted by a bagged ensemble of decision tree stumps trained on ${model.metrics.n.toLocaleString()} historical incidents. Risk bands: Low (<42), Moderate (42–61), High (62–79), Critical (80+). The model achieves ${model.metrics.accuracy.toFixed(0)}% band accuracy and R² of ${model.metrics.r2.toFixed(2)} on training data. The confidence percentage reflects standard deviation agreement across the trees in the ensemble.`
  }

  // Dataset / data
  if (ql.includes("dataset") || ql.includes("data") || ql.includes("training") || ql.includes("model")) {
    return `The AI was trained on ${summary.totalRecords.toLocaleString()} real Bengaluru traffic incidents with ${summary.totalFeatures} features. After filtering for valid planned/unplanned event types, ${model.metrics.n.toLocaleString()} records were used for model training. Key engineered features include cause impact encoding, corridor sensitivity, zone history, priority level, road closure flag, planned event flag, peak-hour indicator, and incident duration. No synthetic data or external datasets were used.`
  }

  // Default
  return `Based on the ${summary.totalRecords.toLocaleString()} real incidents in the dataset, I can explain: (1) why risk scores are high — primarily driven by "${topFeature.feature}"; (2) why officers are recommended in specific quantities — scaling with band averages like Moderate average duration (**${model.bandStats.Moderate.avgDuration} min**); (3) what factors the model uses — all features are derived from real CSV columns with no synthetic data. Try asking: "Why is congestion high?", "What factors influenced the prediction?", or "What happens if crowd size doubles?"`
}

interface AiAssistantProps {
  model: TrainedModel
  summary: DatasetSummary
}

export function AiAssistant({ model, summary }: AiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Hello! I'm the SmartTraffic AI Assistant. Ask me anything about the predictions, model decisions, or how to optimise your traffic management plan. For example:\n\n• Why is congestion high?\n• Why did AI recommend more officers?\n• What factors influenced the prediction?\n• What happens if crowd size doubles?",
    },
  ])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  function handleSend() {
    const q = input.trim()
    if (!q) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: q }])
    setThinking(true)
    setTimeout(() => {
      const answer = generateAnswer(q, model, summary)
      setMessages((prev) => [...prev, { role: "ai", text: answer }])
      setThinking(false)
    }, 700 + Math.random() * 500)
  }

  return (
    <Card className="glass flex flex-col p-0 overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15">
          <Bot className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Powered by Explainable AI · {model.metrics.n.toLocaleString()} records</p>
        </div>
        <Sparkles className="ml-auto size-4 text-primary animate-pulse-glow" />
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                  m.role === "ai" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"
                }`}
              >
                {m.role === "ai" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "ai"
                    ? "bg-card border border-border"
                    : "bg-primary/10 border border-primary/20 text-right"
                }`}
              >
                {m.text.split("\n").map((line, li) => {
                  const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  return (
                    <span key={li}>
                      <span dangerouslySetInnerHTML={{ __html: formatted }} />
                      {li < m.text.split("\n").length - 1 && <br />}
                    </span>
                  )
                })}
              </div>
            </motion.div>
          ))}
          {thinking && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Bot className="size-3.5" />
              </div>
              <div className="rounded-xl border border-border bg-card px-3.5 py-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="size-1.5 rounded-full bg-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <div className="border-t border-border p-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask about predictions, officers, congestion…"
          className="text-sm"
        />
        <Button onClick={handleSend} size="sm" className="gap-1.5 shrink-0" disabled={!input.trim() || thinking}>
          <Send className="size-3.5" /> Send
        </Button>
      </div>
    </Card>
  )
}
