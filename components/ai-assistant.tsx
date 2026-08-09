"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, Send, Sparkles, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/providers/auth-provider"
import type { DatasetSummary, ForecastResult, ResourcePlan, TrainedModel } from "@/lib/types"

interface Message {
  role: "user" | "ai"
  text: string
}

type ScenarioResult = ForecastResult & { plan: ResourcePlan }

interface AiAssistantProps {
  model: TrainedModel
  summary: DatasetSummary
  results?: { a: ScenarioResult; b: ScenarioResult }
}

const quickPrompts = [
  "Why is congestion high?",
  "What factors influenced this prediction?",
  "How many officers are needed?",
  "Explain the resource plan",
  "What are the peak traffic hours?",
  "Tell me about the dataset",
]

function getFirstName(fullName?: string | null) {
  if (!fullName) return undefined
  return fullName.split(" ")[0].trim() || undefined
}

function normalize(text: string) {
  return text.trim().toLowerCase()
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term))
}

function classifyIntent(query: string) {
  const normalized = normalize(query)

  if (containsAny(normalized, ["hello", "hi", "hey", "good morning", "good evening", "good afternoon"])) {
    return "greeting"
  }
  if (containsAny(normalized, ["thank", "thanks", "appreciate", "cheers"])) {
    return "thanks"
  }
  if (containsAny(normalized, ["bye", "goodbye", "see you", "later"])) {
    return "bye"
  }
  if (containsAny(normalized, ["what can you do", "can you do", "help", "what do you do", "capable"])) {
    return "help"
  }

  if (containsAny(normalized, ["officer", "police", "manpower", "personnel", "deploy", "resource", "support"])
      || containsAny(normalized, ["how many cops", "how many officers", "what should we deploy"])) {
    return "resources"
  }

  if (containsAny(normalized, ["barricade", "barrier"])) {
    return "barricades"
  }
  if (containsAny(normalized, ["diversion", "route", "reroute", "alternate route"])) {
    return "diversion"
  }
  if (containsAny(normalized, ["risk", "score", "confidence", "band accuracy"])) {
    return "risk"
  }
  if (containsAny(normalized, ["factor", "influenc", "why did", "why is", "explain", "prediction", "predict"])) {
    return "explanation"
  }
  if (containsAny(normalized, ["dataset", "data", "records", "incidents", "training"])) {
    return "dataset"
  }
  if (containsAny(normalized, ["peak hour", "peak hours", "most common", "when are incidents", "highest impact zone", "what causes the most congestion", "historical"])) {
    return "history"
  }

  return "fallback"
}

function buildGreeting(name?: string) {
  if (name) {
    return `Hi ${name}! 👋 How can I help you today? I can explain predictions, traffic risks, resource recommendations, or historical patterns.`
  }
  return "Hi! 👋 How can I help you today?"
}

function buildHelpResponse(name?: string) {
  if (name) {
    return `I can help with SmartTraffic AI predictions, explain why a risk score is high, compare what-if scenarios, review recommended resources, and explore the historical dataset. What would you like to check next, ${name}?`
  }
  return "I can help with SmartTraffic AI predictions, explain why a risk score is high, compare what-if scenarios, review recommended resources, and explore the historical dataset. What would you like to check next?"
}

function buildResourceAnswer(results?: { a: ScenarioResult; b: ScenarioResult }) {
  if (!results) {
    return "I can explain how the AI derives officer, barricade, checkpoint, and diversion recommendations from risk band and duration, but I need a current scenario to give exact values."
  }

  const current = results.a.impact <= results.b.impact ? results.a : results.b
  const scenario = results.a.impact <= results.b.impact ? "Scenario A" : "Scenario B"
  return `Recommended deployment for ${scenario} based on the current comparison:\n• ${current.plan.officers} Traffic Officers\n• ${current.plan.barricades} Barricades\n• ${current.plan.checkpoints} Checkpoint(s)\n• ${current.plan.diversions} Diversion Route(s)\n\nThis plan is driven by the predicted impact, risk band, and duration for the selected scenario.`
}

function buildBarricadeAnswer(results?: { a: ScenarioResult; b: ScenarioResult }) {
  if (!results) {
    return "Barricade recommendations depend on the active scenario. I need current prediction data to give you exact numbers."
  }

  return `Current recommendations are ${results.a.plan.barricades} barricades for Scenario A and ${results.b.plan.barricades} barricades for Scenario B. Higher predicted impact and duration increase the barricade intensity required to secure the route.`
}

function buildDiversionAnswer(results?: { a: ScenarioResult; b: ScenarioResult }) {
  if (!results) {
    return "Diversion guidance depends on the current risk profile. I need an active scenario to give exact values."
  }

  return `Scenario A currently recommends ${results.a.plan.diversions} diversion route(s) and Scenario B recommends ${results.b.plan.diversions} diversion route(s). More diversions are required for the scenario with the higher predicted impact to keep traffic flowing safely.`
}

function buildRiskAnswer(results?: { a: ScenarioResult; b: ScenarioResult }) {
  if (!results) {
    return "I can describe the model's risk bands and confidence scoring, but I need the active scenario to cite exact current values."
  }

  return `Scenario A predicts ${results.a.impact}/100 (${results.a.risk}) with ${results.a.confidence}% confidence. Scenario B predicts ${results.b.impact}/100 (${results.b.risk}) with ${results.b.confidence}% confidence. The higher score indicates the more severe congestion profile, while confidence shows how much the ensemble agrees on the outcome.`
}

function buildExplanation(model: TrainedModel, summary: DatasetSummary) {
  const topFeatures = model.importance.slice(0, 3)
  const lines = topFeatures.map((feature) => `• ${feature.feature} — ${feature.direction} the predicted risk (${(feature.importance * 100).toFixed(0)}%)`)

  return `Here's why the model considers this high risk:\n\n${lines.join("\n")}\n\nOverall predicted impact is based on ${summary.totalRecords.toLocaleString()} Bengaluru incidents, with the top contributors above shaping the current forecast.`
}

function buildHistoryAnswer(model: TrainedModel, summary: DatasetSummary) {
  const topZones = Object.entries(model.zoneImpact)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([zone]) => `"${zone}"`)
    .join(" and ")

  return `The dataset contains ${summary.totalRecords.toLocaleString()} Bengaluru incidents. The highest-impact zones are ${topZones}, and peak hours tend to align with the morning and evening rush periods. Incident cause, corridor history, and zone patterns are strong historical predictors.`
}

function buildDatasetAnswer(summary: DatasetSummary) {
  return `SmartTraffic is built on ${summary.totalRecords.toLocaleString()} real Bengaluru incident records with ${summary.totalFeatures} features. The model uses live dataset statistics rather than synthetic data, so the predictions reflect real Bengaluru traffic patterns.`
}

function buildFallback(name?: string) {
  if (name) {
    return `Sorry, ${name}, I couldn't process that directly. I can still help with the current prediction, traffic risk, resource plan, or dataset insights.`
  }
  return "Sorry, I couldn't process that directly. I can still help with the current prediction, traffic risk, resource plan, or dataset insights."
}

function generateAnswer(
  query: string,
  model: TrainedModel,
  summary: DatasetSummary,
  results?: { a: ScenarioResult; b: ScenarioResult },
  name?: string,
): string {
  const normalized = normalize(query)
  const intent = classifyIntent(query)

  switch (intent) {
    case "greeting":
      return buildGreeting(name)
    case "thanks":
      return name
        ? `You're welcome, ${name}! If you need anything else, I can help with forecasts, resource planning, or explain why the model made a prediction.`
        : "You're welcome! If you need anything else, I can help with forecasts, resource planning, or explain why the model made a prediction."
    case "bye":
      return name ? `See you, ${name}! Stay safe. 🚦` : "See you! Stay safe. 🚦"
    case "help":
      return buildHelpResponse(name)
    case "resources":
      return buildResourceAnswer(results)
    case "barricades":
      return buildBarricadeAnswer(results)
    case "diversion":
      return buildDiversionAnswer(results)
    case "risk":
      return buildRiskAnswer(results)
    case "explanation":
      return buildExplanation(model, summary)
    case "history":
      return buildHistoryAnswer(model, summary)
    case "dataset":
      return buildDatasetAnswer(summary)
    case "fallback":
    default:
      if (containsAny(normalized, ["what about officers", "and barricades", "and diversions", "what about resources"])) {
        if (containsAny(normalized, ["officers"])) {
          return buildResourceAnswer(results)
        }
        if (containsAny(normalized, ["barricades"])) {
          return buildBarricadeAnswer(results)
        }
        if (containsAny(normalized, ["diversion", "routes"])) {
          return buildDiversionAnswer(results)
        }
      }

      if (containsAny(normalized, ["why", "because", "cause", "what caused"]) && containsAny(normalized, ["congestion", "traffic", "risk", "score"])) {
        return buildExplanation(model, summary)
      }

      if (containsAny(normalized, ["officers", "how many cops", "manpower", "personnel"])) {
        return buildResourceAnswer(results)
      }

      if (containsAny(normalized, ["what is a", "define", "random forest", "machine learning", "ml"])) {
        return "I can answer general ML questions too, but I'm most useful for traffic predictions and SmartTraffic resources. Ask me about the current model forecast or resource plan."
      }

      return buildFallback(name)
  }
}

function renderWithBold(text: string) {
  return text.split("\n").map((line, lineIndex) => {
    const segments = line.split(/\*\*(.*?)\*\*/g)
    return (
      <span key={lineIndex} className="block whitespace-pre-wrap">
        {segments.map((segment, segmentIndex) =>
          segmentIndex % 2 === 1 ? (
            <strong key={segmentIndex} className="font-semibold">
              {segment}
            </strong>
          ) : (
            <span key={segmentIndex}>{segment}</span>
          ),
        )}
      </span>
    )
  })
}

export function AiAssistant({ model, summary, results }: AiAssistantProps) {
  const { profile } = useAuth()
  const name = getFirstName(profile?.full_name)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: `Hi ${name ?? ""}${name ? "! " : ""}I'm your SmartTraffic AI assistant. I can help you:\n• understand congestion predictions\n• explain model decisions\n• review recommended resources\n• explore historical traffic patterns`,
    },
  ])
  const [input, setInput] = useState("")
  const [thinking, setThinking] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, thinking])

  function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return

    setShowSuggestions(false)
    setMessages((prev) => [...prev, { role: "user", text: trimmed }])
    setInput("")
    setThinking(true)

    setTimeout(() => {
      const answer = generateAnswer(trimmed, model, summary, results, name)
      setMessages((prev) => [...prev, { role: "ai", text: answer }])
      setThinking(false)
    }, 400 + Math.random() * 250)
  }

  return (
    <Card className="glass flex flex-col p-0 overflow-hidden min-h-[540px]">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary/15">
          <Bot className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Powered by Explainable AI · {summary.totalRecords.toLocaleString()} records</p>
        </div>
        <Sparkles className="ml-auto size-4 text-primary animate-pulse-glow" />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[calc(100vh-380px)] sm:max-h-[420px]">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${message.role === "ai" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
                {message.role === "ai" ? <Bot className="size-4" /> : <User className="size-4" />}
              </div>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "ai" ? "bg-card border border-border" : "bg-primary/10 border border-primary/20 text-right"}`}>
                {renderWithBold(message.text)}
              </div>
            </motion.div>
          ))}
          {thinking && (
            <motion.div key="typing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Bot className="size-4" />
              </div>
              <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/70 animate-pulse delay-100" />
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/50 animate-pulse delay-200" />
                  <span className="text-[12px] text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        {showSuggestions && (
          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendMessage(prompt)}
                className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-[12px] font-medium text-foreground transition hover:border-primary/60 hover:bg-primary/10"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && sendMessage(input)}
            placeholder="Ask about predictions, officers, congestion…"
            className="text-sm"
          />
          <Button onClick={() => sendMessage(input)} size="sm" className="gap-1.5 shrink-0" disabled={!input.trim() || thinking}>
            <Send className="size-3.5" /> Send
          </Button>
        </div>
      </div>
    </Card>
  )
}
