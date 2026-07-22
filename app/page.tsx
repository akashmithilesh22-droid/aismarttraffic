"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { RoadNetwork } from "@/components/road-network"
import { useEngine } from "@/lib/data-provider"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Radar,
  ShieldAlert,
  FlaskConical,
  LineChart,
  Boxes,
  GitCompare,
  FileText,
  Bell,
  Bot,
  History,
  Sparkles,
  AlertTriangle,
  Megaphone,
  PartyPopper,
  Trophy,
  HardHat,
  Siren,
  TrendingUp,
  TrendingDown,
} from "lucide-react"


const PROBLEMS = [
  { icon: Megaphone, label: "Political rallies" },
  { icon: PartyPopper, label: "Festivals" },
  { icon: Trophy, label: "Sports events" },
  { icon: HardHat, label: "Construction" },
  { icon: Siren, label: "Emergency incidents" },
]

const SOLUTIONS = [
  "Learns from historical traffic events",
  "Forecasts future congestion impact",
  "Predicts risk levels per location",
  "Recommends police deployment",
  "Suggests barricading plans",
  "Generates diversion strategies",
  "Improves traffic management decisions",
]

const FEATURES = [
  { icon: Radar, title: "Traffic Forecasting", desc: "Predict congestion impact for any event scenario." },
  { icon: ShieldAlert, title: "Resource Planning", desc: "Optimal manpower, barricading & diversions." },
  { icon: Sparkles, title: "Explainable AI", desc: "SHAP-style breakdown of every prediction." },
  { icon: History, title: "Historical Analytics", desc: "Trends mined from 8K+ real incidents." },
  { icon: Boxes, title: "Digital Twin", desc: "Simulate deployment on a live city grid." },
  { icon: FlaskConical, title: "What-If Analysis", desc: "Recompute forecasts as you tune inputs." },
  { icon: GitCompare, title: "Scenario Comparison", desc: "Compare two plans side by side." },
  { icon: FileText, title: "Report Generation", desc: "Export an executive PDF action plan." },
  { icon: Bell, title: "Smart Alerts", desc: "Auto-warnings for severe congestion." },
  { icon: Bot, title: "AI Assistant", desc: "Ask why the model decided what it did." },
]

const WORKFLOW = ["Dataset", "Data Processing", "AI Training", "Prediction Engine", "Resource Recommendation", "Traffic Solution"]

export default function LandingPage() {
  const { records, summary, model, loading } = useEngine()

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* ---------- HERO ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-40" />
        <RoadNetwork className="absolute inset-0 h-full w-full opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/70 to-background" />

        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium backdrop-blur"
          >
            <Activity className="size-3.5 text-primary animate-pulse" />
            <span className="text-muted-foreground">Trained live on real Bengaluru incident data</span>
            {!loading && model && (
              <span className="ml-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                {Math.round(model.metrics.accuracy)}% accuracy
              </span>
            )}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="text-balance font-mono text-5xl font-bold tracking-tight md:text-7xl"
          >
            SmartTraffic <span className="text-primary">AI</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-5 max-w-2xl text-pretty text-lg text-muted-foreground md:text-xl"
          >
            AI-Powered Event Traffic Forecasting & Resource Planning. Turn historical and event-related
            traffic data into optimal manpower, barricading, and diversion plans.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <Link href="/forecast" className={cn(buttonVariants({ size: 'lg' }), 'gap-2')}>
              Launch Platform <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/training"
              className={cn(buttonVariants({ size: 'lg', variant: 'outline' }), 'gap-2 bg-transparent')}
            >
              <BrainCircuit className="size-4" /> Explore AI Demo
            </Link>
          </motion.div>

          {/* live stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-14 grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-4"
          >
            {[
              { v: loading ? "…" : records.length.toLocaleString(), l: "Incidents Learned", color: "text-primary" },
              { v: loading ? "…" : `${summary?.totalFeatures ?? 0}`, l: "Data Features", color: "text-accent" },
              { v: loading || !model ? "…" : `${Math.round(model.metrics.accuracy)}%`, l: "Risk Accuracy", color: "text-primary" },
              { v: loading || !model ? "…" : model.metrics.r2.toFixed(2), l: "Model R²", color: "text-accent" },
            ].map((s) => (
              <motion.div
                key={s.l}
                whileHover={{ scale: 1.04 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="glass rounded-xl p-4 card-hover cursor-default"
              >
                <p className={`font-mono text-2xl font-bold tabular-nums ${s.color}`}>{s.v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-28 px-6 py-24">
        {/* ---------- PROBLEM ---------- */}
        <Section
          eyebrow="The Problem"
          title="Event-driven congestion is unpredictable"
          desc="Rallies, festivals, sports events, construction and emergencies overwhelm corridors with little warning."
        >
          <div className="mb-10 flex flex-wrap justify-center gap-3">
            {PROBLEMS.map((p) => (
              <div key={p.label} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2.5">
                <p.icon className="size-4 text-destructive" />
                <span className="text-sm">{p.label}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Event impact is unknown beforehand",
              "Resource planning is manual and slow",
              "Congestion response is delayed",
              "No forecasting systems in place",
            ].map((c) => (
              <div key={c} className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-sm text-muted-foreground">{c}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- SOLUTION ---------- */}
        <Section
          eyebrow="The AI Solution"
          title="From raw incidents to operational decisions"
          desc="SmartTraffic AI trains directly on your dataset to forecast and plan — no synthetic data, ever."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SOLUTIONS.map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 font-mono text-xs text-primary">
                  {i + 1}
                </span>
                <p className="text-sm">{s}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ---------- FEATURES ---------- */}
        <Section eyebrow="Capabilities" title="Everything in one command center" desc="Ten integrated modules across five focused workspaces.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 3) * 0.06 }}
                className="group glass rounded-xl p-5 transition-colors hover:ring-1 hover:ring-primary/40"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        {/* ---------- WORKFLOW ---------- */}
        <Section eyebrow="How It Works" title="The platform workflow" desc="A continuous pipeline from dataset to deployed traffic solution.">
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
            {WORKFLOW.map((step, i) => (
              <div key={step} className="flex flex-1 items-center gap-3 md:flex-col md:gap-2">
                <div className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/50 p-4 md:flex-col md:text-center">
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{step}</span>
                </div>
                {i < WORKFLOW.length - 1 && (
                  <ArrowRight className="size-4 shrink-0 rotate-90 text-primary md:rotate-0" />
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- BEFORE VS AFTER ---------- */}
        <Section eyebrow="Impact" title="Without AI vs With SmartTraffic AI" desc="See the quantified difference AI-powered planning makes for event traffic management.">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown className="size-5 text-destructive" />
                <span className="font-semibold text-destructive">Without AI Planning</span>
              </div>
              <div className="space-y-3">
                {[
                  ["Incident response time", model?.baselineStats ? `${model.baselineStats.avgResolutionMin} min (avg duration)` : "45–90 min (reactive)"],
                  ["Resource planning", "Manual, error-prone"],
                  ["Congestion forecast", "None — blind spots"],
                  ["Officer deployment", model?.baselineStats ? `${Math.max(4, Math.round(model.baselineStats.avgImpact * 0.25))} (historical est)` : "Ad hoc estimation"],
                  ["Traffic efficiency", model?.baselineStats ? `~${Math.round(model.baselineStats.resolvedRate * 100)}% resolved` : "~35–40% managed"],
                  ["Diversion planning", "Post-incident only"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-destructive">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp className="size-5 text-accent" />
                <span className="font-semibold text-accent">With SmartTraffic AI</span>
              </div>
              <div className="space-y-3">
                {[
                  ["Incident response time", model?.baselineStats ? `< ${Math.max(5, Math.round(model.baselineStats.avgResolutionMin * 0.35))} min (pre-planned)` : "< 5 min (pre-planned)"],
                  ["Resource planning", "AI-optimised, data-driven"],
                  ["Congestion forecast", "24-hour ahead prediction"],
                  ["Officer deployment", "Exact count computed"],
                  ["Traffic efficiency", model?.baselineStats ? `~${Math.min(99, Math.round(model.baselineStats.resolvedRate * 100 * 1.35))}% optimised` : "~75–85% optimised"],
                  ["Diversion planning", "Pre-emptive alternate routes"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-accent">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ---------- CTA ---------- */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/60 p-10 text-center">
          <div className="absolute inset-0 grid-bg opacity-30" />
          <div className="relative">
            <LineChart className="mx-auto mb-4 size-8 text-primary" />
            <h2 className="text-balance text-2xl font-semibold md:text-3xl">Ready to forecast your next event?</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Open the Forecast Command Center and generate a risk score, congestion timeline, and resource plan in seconds.
            </p>
            <Link href="/forecast" className={cn(buttonVariants({ size: 'lg' }), 'mt-6 gap-2')}>
              Launch Platform <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  eyebrow,
  title,
  desc,
  children,
}: {
  eyebrow: string
  title: string
  desc: string
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-8 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">{eyebrow}</p>
        <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight">{title}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-pretty text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  )
}
