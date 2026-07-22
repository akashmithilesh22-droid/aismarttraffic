"use client"

import { motion } from "framer-motion"
import { ArrowDown, CheckCircle2 } from "lucide-react"
import { useState, useEffect } from "react"

export function Pipeline({ steps }: { steps: string[] }) {
  const [activeStep, setActiveStep] = useState(-1)

  useEffect(() => {
    let idx = 0
    const interval = setInterval(() => {
      setActiveStep(idx)
      idx++
      if (idx >= steps.length) {
        clearInterval(interval)
        // restart after 2 seconds
        setTimeout(() => {
          setActiveStep(-1)
          setTimeout(() => {
            idx = 0
            const restart = setInterval(() => {
              setActiveStep(idx)
              idx++
              if (idx >= steps.length) clearInterval(restart)
            }, 400)
          }, 400)
        }, 2000)
      }
    }, 400)
    return () => clearInterval(interval)
  }, [steps.length])

  return (
    <div className="flex flex-col items-center gap-2">
      {steps.map((step, i) => {
        const isDone = i < activeStep
        const isCurrent = i === activeStep
        return (
          <div key={step} className="flex w-full max-w-xs flex-col items-center gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                isCurrent
                  ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(var(--primary-rgb,245,178,90),0.2)] text-foreground"
                  : isDone
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-border bg-card/60 text-muted-foreground"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex size-6 items-center justify-center rounded-full font-mono text-[11px] transition-colors ${
                    isCurrent ? "bg-primary text-primary-foreground" : isDone ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                {step}
              </div>
              {isDone && <CheckCircle2 className="size-4 text-accent shrink-0" />}
              {isCurrent && (
                <motion.div
                  className="size-2 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </motion.div>
            {i < steps.length - 1 && (
              <motion.span
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 + 0.04 }}
              >
                <ArrowDown
                  className={`size-3.5 transition-colors ${i <= activeStep ? "text-primary" : "text-border"}`}
                />
              </motion.span>
            )}
          </div>
        )
      })}
    </div>
  )
}
