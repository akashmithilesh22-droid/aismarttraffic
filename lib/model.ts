import type {
  TrafficRecord,
  TrainedModel,
  ModelMetrics,
  FeatureImportance,
  ForecastInput,
  ForecastResult,
  RiskLevel,
  SimilarEvent,
  ResourcePlan,
  BandInfo,
  BaselineStats,
  PoliceStationRecommendation,
} from "./types"
import {
  computeBaselineStats,
  computeBandStats,
  computeHourlyProfile,
  computeCauseHourlyProfiles,
  computeCorridorZoneStats,
  computeCauseStats,
} from "./analytics"

// ---------- tree structure and helpers ----------
export interface TreeNode {
  featureIndex: number
  threshold: number
  left: TreeNode | number
  right: TreeNode | number
}

function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
}

// learn average impact per category value (target encoding)
// amplifyContrast: multiply deviation from global mean by this factor so that
// different categories produce wider encoded value spreads → the forest can
// distinguish them at split boundaries
function encodeCategory(
  records: TrafficRecord[],
  key: (r: TrafficRecord) => string,
  amplifyContrast = 2.0,
): Record<string, number> {
  const groups: Record<string, number[]> = {}
  for (const r of records) {
    const k = key(r)
    ;(groups[k] ||= []).push(r.impact)
  }
  const globalMean = mean(records.map((r) => r.impact))
  const enc: Record<string, number> = {}
  for (const k in groups) {
    const catMean = mean(groups[k])
    // Amplify deviation from global mean to widen the encoding range
    const amplified = globalMean + (catMean - globalMean) * amplifyContrast
    enc[k] = Math.max(0, Math.min(100, amplified))
  }
  return enc
}

// numeric feature vector for a record given learned encoders
// 10 features: cause, corridor, zone, junction, priority, closure, eventType, peak, duration, weekend
function featurize(
  r: {
    cause: string
    corridor: string
    zone: string
    junction: string
    priority: string
    eventType: string
    requiresClosure: boolean
    hour: number | null
    durationMin: number | null
    dayOfWeek?: number | null
  },
  enc: {
    cause: Record<string, number>
    corridor: Record<string, number>
    zone: Record<string, number>
    junction: Record<string, number>
    base: number
  },
): number[] {
  const peak = r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20)) ? 1 : 0
  // Log-scale duration capped at 18 normalized units
  const dur = r.durationMin !== null ? Math.min(18, Math.log2(r.durationMin + 1) * 2.2) : 6
  const weekend = r.dayOfWeek !== null && r.dayOfWeek !== undefined ? (r.dayOfWeek === 0 || r.dayOfWeek === 6 ? 1 : 0) : 0
  return [
    (enc.cause[r.cause] ?? enc.base) / 100,          // 0: Event Cause Profile
    (enc.corridor[r.corridor] ?? enc.base) / 100,     // 1: Corridor Sensitivity
    (enc.zone[r.zone] ?? enc.base) / 100,             // 2: Zone History
    (enc.junction[r.junction] ?? enc.base) / 100,     // 3: Junction Profile
    r.priority === "High" ? 1 : r.priority === "Medium" ? 0.5 : 0, // 4: Priority Level
    r.requiresClosure ? 1 : 0,                        // 5: Road Closure
    r.eventType === "planned" ? 1 : 0,                // 6: Planned Event
    peak,                                             // 7: Peak Hour
    dur / 18,                                         // 8: Incident Duration
    weekend,                                          // 9: Weekend Effect
  ]
}

export const FEATURE_LABELS = [
  "Event Cause Profile",
  "Corridor Sensitivity",
  "Zone History",
  "Junction Profile",
  "Priority Level",
  "Road Closure",
  "Planned Event",
  "Peak Hour",
  "Incident Duration",
  "Weekend Effect",
]

// ---------- Decision Tree Builder (True Random Forest with Feature Bagging) ----------

function getCandidateThresholds(X: number[][], featureIndex: number): number[] {
  const vals = X.map((row) => row[featureIndex])
  const uniqueVals = Array.from(new Set(vals)).sort((a, b) => a - b)
  if (uniqueVals.length <= 15) {
    const thresholds: number[] = []
    for (let i = 0; i < uniqueVals.length - 1; i++) {
      thresholds.push((uniqueVals[i] + uniqueVals[i + 1]) / 2)
    }
    return thresholds
  }
  const thresholds: number[] = []
  const percentiles = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  for (const p of percentiles) {
    const idx = Math.floor(p * (uniqueVals.length - 1))
    thresholds.push(uniqueVals[idx])
  }
  return Array.from(new Set(thresholds)).sort((a, b) => a - b)
}

// Simple seedable LCG for deterministic per-tree randomness without global state
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function buildTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  candidates: number[][],
  rng: () => number,          // per-tree RNG for feature bagging
  maxFeatures: number,        // how many features to consider per split
): TreeNode | number {
  const n = indices.length
  if (n === 0) return 0

  const yVals = indices.map((i) => y[i])
  const sumY = yVals.reduce((a, b) => a + b, 0)
  const meanY = sumY / n

  if (depth >= maxDepth || n < minSamplesSplit) {
    return meanY
  }

  let allSame = true
  for (let i = 1; i < n; i++) {
    if (Math.abs(yVals[i] - yVals[0]) > 1e-7) {
      allSame = false
      break
    }
  }
  if (allSame) return meanY

  let bestFeature = -1
  let bestThreshold = -1
  let bestSse = Number.POSITIVE_INFINITY
  let bestLeftIndices: number[] = []
  let bestRightIndices: number[] = []

  const numFeatures = X[0].length

  // === Feature Bagging: randomly select maxFeatures features to consider ===
  // This is the key change that makes this a TRUE Random Forest.
  // Without this, all trees pick the same dominant feature → ensemble is not diverse.
  const allFeatureIndices = Array.from({ length: numFeatures }, (_, i) => i)
  // Fisher-Yates shuffle using per-tree RNG
  for (let i = allFeatureIndices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[allFeatureIndices[i], allFeatureIndices[j]] = [allFeatureIndices[j], allFeatureIndices[i]]
  }
  const featureSubset = allFeatureIndices.slice(0, maxFeatures)

  for (const j of featureSubset) {
    const thresholds = candidates[j]
    for (const t of thresholds) {
      const leftIdx: number[] = []
      const rightIdx: number[] = []
      for (const idx of indices) {
        if (X[idx][j] <= t) {
          leftIdx.push(idx)
        } else {
          rightIdx.push(idx)
        }
      }
      if (leftIdx.length === 0 || rightIdx.length === 0) continue

      let sumL = 0
      for (const idx of leftIdx) sumL += y[idx]
      const meanL = sumL / leftIdx.length
      let sseL = 0
      for (const idx of leftIdx) sseL += (y[idx] - meanL) ** 2

      let sumR = 0
      for (const idx of rightIdx) sumR += y[idx]
      const meanR = sumR / rightIdx.length
      let sseR = 0
      for (const idx of rightIdx) sseR += (y[idx] - meanR) ** 2

      const totalSse = sseL + sseR
      if (totalSse < bestSse) {
        bestSse = totalSse
        bestFeature = j
        bestThreshold = t
        bestLeftIndices = leftIdx
        bestRightIndices = rightIdx
      }
    }
  }

  if (bestFeature === -1) {
    return meanY
  }

  const leftChild = buildTree(X, y, bestLeftIndices, depth + 1, maxDepth, minSamplesSplit, candidates, rng, maxFeatures)
  const rightChild = buildTree(X, y, bestRightIndices, depth + 1, maxDepth, minSamplesSplit, candidates, rng, maxFeatures)

  return {
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: leftChild,
    right: rightChild,
  }
}

function predictTree(tree: TreeNode | number, x: number[]): number {
  if (typeof tree === "number") return tree
  if (x[tree.featureIndex] <= tree.threshold) {
    return predictTree(tree.left, x)
  } else {
    return predictTree(tree.right, x)
  }
}

function predictEnsemble(trees: (TreeNode | number)[], x: number[]): number {
  let sum = 0
  for (const tree of trees) {
    sum += predictTree(tree, x)
  }
  return sum / trees.length
}

function calculateImpurityImportance(
  tree: TreeNode | number,
  X: number[][],
  y: number[],
  indices: number[],
  importance: number[],
) {
  if (typeof tree === "number" || indices.length === 0) return

  const n = indices.length
  const yVals = indices.map((i) => y[i])
  const meanY = yVals.reduce((a, b) => a + b, 0) / n
  const sseParent = yVals.reduce((acc, val) => acc + (val - meanY) ** 2, 0)

  const leftIndices: number[] = []
  const rightIndices: number[] = []
  for (const idx of indices) {
    if (X[idx][tree.featureIndex] <= tree.threshold) {
      leftIndices.push(idx)
    } else {
      rightIndices.push(idx)
    }
  }

  let sseLeft = 0
  if (leftIndices.length > 0) {
    const meanL = leftIndices.map((i) => y[i]).reduce((a, b) => a + b, 0) / leftIndices.length
    sseLeft = leftIndices.reduce((acc, i) => acc + (y[i] - meanL) ** 2, 0)
  }

  let sseRight = 0
  if (rightIndices.length > 0) {
    const meanR = rightIndices.map((i) => y[i]).reduce((a, b) => a + b, 0) / rightIndices.length
    sseRight = rightIndices.reduce((acc, i) => acc + (y[i] - meanR) ** 2, 0)
  }

  const reduction = sseParent - (sseLeft + sseRight)
  if (reduction > 0) {
    importance[tree.featureIndex] += reduction
  }

  calculateImpurityImportance(tree.left, X, y, leftIndices, importance)
  calculateImpurityImportance(tree.right, X, y, rightIndices, importance)
}

function crossValidate(X: number[][], y: number[], k = 5): number {
  const folds: number[][] = Array.from({ length: k }, () => [])
  X.forEach((_, i) => folds[i % k].push(i))
  const cvR2: number[] = []

  for (let f = 0; f < k; f++) {
    const testIdx = new Set(folds[f])
    const Xtr: number[][] = []
    const ytr: number[] = []
    const Xte: number[][] = []
    const yte: number[] = []
    X.forEach((row, i) => {
      if (testIdx.has(i)) {
        Xte.push(row)
        yte.push(y[i])
      } else {
        Xtr.push(row)
        ytr.push(y[i])
      }
    })

    if (Xtr.length === 0 || Xte.length === 0) continue

    const candidates: number[][] = []
    for (let j = 0; j < Xtr[0].length; j++) {
      candidates.push(getCandidateThresholds(Xtr, j))
    }

    const numFeat = Xtr[0].length
    const maxFeat = Math.max(3, Math.ceil(Math.sqrt(numFeat)))
    const treesCV: (TreeNode | number)[] = []
    const numTreesCV = 20
    for (let t = 0; t < numTreesCV; t++) {
      const rng = makeRng(f * 1000 + t)
      const indices: number[] = []
      for (let i = 0; i < Xtr.length; i++) {
        indices.push(Math.floor(rng() * Xtr.length))
      }
      treesCV.push(buildTree(Xtr, ytr, indices, 0, 8, 4, candidates, rng, maxFeat))
    }

    let sse = 0
    const ybar = mean(yte)
    let sst = 0
    for (let i = 0; i < Xte.length; i++) {
      const pred = predictEnsemble(treesCV, Xte[i])
      sse += (pred - yte[i]) ** 2
      sst += (yte[i] - ybar) ** 2
    }
    cvR2.push(sst ? 1 - sse / sst : 0)
  }
  return mean(cvR2)
}

function evaluateEnsemble(X: number[][], y: number[], trees: (TreeNode | number)[]): ModelMetrics {
  const n = X.length
  let sse = 0
  let sae = 0
  let band = 0
  const ybar = mean(y)
  let sst = 0
  for (let i = 0; i < n; i++) {
    const pred = predictEnsemble(trees, X[i])
    const err = pred - y[i]
    sse += err * err
    sae += Math.abs(err)
    sst += (y[i] - ybar) ** 2
    if (riskOf(pred * 100) === riskOf(y[i] * 100)) band++
  }
  const r2 = sst ? 1 - sse / sst : 0
  return {
    r2: Math.max(0, r2),
    rmse: Math.sqrt(sse / n) * 100,
    mae: (sae / n) * 100,
    accuracy: (band / n) * 100,
    cvScore: 0,
    n,
  }
}

// ---------- training ----------

export function trainModel(records: TrafficRecord[]): TrainedModel {
  const usable = records.filter((r) => r.impact > 0)

  // Use higher contrast amplification (2.5×) to widen the encoding ranges
  // so individual categories produce meaningfully different feature values
  const enc = {
    cause: encodeCategory(usable, (r) => r.cause, 2.5),
    corridor: encodeCategory(usable, (r) => r.corridor, 2.5),
    zone: encodeCategory(usable, (r) => r.zone, 2.0),
    junction: encodeCategory(usable, (r) => r.junction, 2.0),
    base: mean(usable.map((r) => r.impact)),
  }

  const X = usable.map((r) => featurize(r, enc))
  const y = usable.map((r) => r.impact / 100)

  const numTrees = 60          // more trees → more stable ensemble with bagging
  const maxDepth = 9
  const minSamplesSplit = 4
  const numFeatures = X[0].length
  // sqrt(n_features) is the standard Random Forest feature bagging count
  const maxFeatures = Math.max(3, Math.ceil(Math.sqrt(numFeatures)))
  const trees: (TreeNode | number)[] = []

  const candidates: number[][] = []
  for (let j = 0; j < numFeatures; j++) {
    candidates.push(getCandidateThresholds(X, j))
  }

  for (let t = 0; t < numTrees; t++) {
    // Use a deterministic but different seed per tree so results are reproducible
    // across page loads (no random jitter in the displayed scores)
    const rng = makeRng(t * 7919 + 42)
    const indices: number[] = []
    for (let i = 0; i < X.length; i++) {
      indices.push(Math.floor(rng() * X.length))
    }
    trees.push(buildTree(X, y, indices, 0, maxDepth, minSamplesSplit, candidates, rng, maxFeatures))
  }

  // Cross-validation
  const cvScore = crossValidate(X, y, 5)

  // Metrics on training data
  const metrics = evaluateEnsemble(X, y, trees)
  metrics.cvScore = Math.max(0, cvScore)

  // Feature Importance via impurity reduction
  const importanceArray = new Array(numFeatures).fill(0)
  const fullIndices = Array.from({ length: X.length }, (_, i) => i)
  for (const tree of trees) {
    calculateImpurityImportance(tree, X, y, fullIndices, importanceArray)
  }

  const importance: FeatureImportance[] = importanceArray.map((imp, j) => {
    const corrDirection = (featureIndex: number): "increases" | "decreases" => {
      const col = X.map((row) => row[featureIndex])
      const meanX = mean(col)
      const meanY = mean(y)
      let num = 0
      for (let i = 0; i < X.length; i++) {
        num += (col[i] - meanX) * (y[i] - meanY)
      }
      return num >= 0 ? "increases" : "decreases"
    }
    return {
      feature: FEATURE_LABELS[j],
      importance: imp,
      direction: corrDirection(j),
      weight: 0,
    } as FeatureImportance
  })

  const maxImp = Math.max(...importance.map((i) => i.importance), 1e-6)
  importance.forEach((i) => (i.importance = i.importance / maxImp))
  importance.sort((a, b2) => b2.importance - a.importance)

  // Feature means
  const featureMeans = Array.from({ length: numFeatures }, (_, j) => mean(X.map((row) => row[j])))

  // Baseline, Band and Hourly Stats
  const baselineStats = computeBaselineStats(records)
  const bandStats = computeBandStats(records)
  const hourlyProfile = computeHourlyProfile(records)
  const causeHourlyProfiles = computeCauseHourlyProfiles(records)
  const corridorZoneStats = computeCorridorZoneStats(records)
  const causeStats = computeCauseStats(records)

  return {
    trees,
    featureOrder: FEATURE_LABELS,
    featureMeans,
    metrics,
    importance,
    causeImpact: enc.cause,
    corridorImpact: enc.corridor,
    zoneImpact: enc.zone,
    junctionImpact: enc.junction,
    baseImpact: enc.base,
    baselineStats,
    bandStats,
    hourlyProfile,
    causeHourlyProfiles,
    corridorZoneStats,
    causeStats,
    records,
  }
}

// ---------- risk ----------
export function riskOf(impact: number): RiskLevel {
  if (impact >= 80) return "Critical"
  if (impact >= 62) return "High"
  if (impact >= 42) return "Moderate"
  return "Low"
}

// ---------- police station recommendation ----------
export function recommendPoliceStation(
  records: TrafficRecord[],
  input: { junction: string; zone: string; corridor: string }
): PoliceStationRecommendation {
  // Cascading matching strategy
  let matches = records.filter(
    (r) =>
      r.junction === input.junction &&
      r.junction !== "Unknown Junction" &&
      r.zone === input.zone &&
      r.corridor === input.corridor &&
      r.policeStation &&
      r.policeStation !== "Unknown"
  )

  if (matches.length === 0) {
    matches = records.filter(
      (r) =>
        r.junction === input.junction &&
        r.junction !== "Unknown Junction" &&
        r.zone === input.zone &&
        r.policeStation &&
        r.policeStation !== "Unknown"
    )
  }

  if (matches.length === 0) {
    matches = records.filter(
      (r) =>
        r.junction === input.junction &&
        r.junction !== "Unknown Junction" &&
        r.policeStation &&
        r.policeStation !== "Unknown"
    )
  }

  if (matches.length === 0) {
    matches = records.filter(
      (r) =>
        r.corridor === input.corridor &&
        r.corridor !== "Non-corridor" &&
        r.zone === input.zone &&
        r.policeStation &&
        r.policeStation !== "Unknown"
    )
  }

  if (matches.length === 0) {
    matches = records.filter(
      (r) =>
        r.zone === input.zone &&
        r.zone !== "Unknown" &&
        r.policeStation &&
        r.policeStation !== "Unknown"
    )
  }

  if (matches.length === 0) {
    matches = records.filter((r) => r.policeStation && r.policeStation !== "Unknown")
  }

  if (matches.length === 0) {
    return {
      primary: "HAL Traffic Police Station",
      supporting: ["Airport Traffic Police Station", "Whitefield Traffic Police Station"],
      confidence: 85,
    }
  }

  // Count station frequencies
  const counts: Record<string, number> = {}
  for (const r of matches) {
    counts[r.policeStation] = (counts[r.policeStation] ?? 0) + 1
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([station]) => station)

  const primary = sorted[0]
  const supporting = sorted.slice(1, 4) // top supporting stations

  const totalMatches = matches.length
  const primaryCount = counts[primary]

  // Calculate Laplace-smoothed confidence score
  const confidenceRatio = totalMatches > 0 ? (primaryCount + 1) / (totalMatches + 2) : 0.8
  const confidence = Math.max(60, Math.min(99, Math.round(confidenceRatio * 100)))

  return {
    primary,
    supporting,
    confidence,
  }
}

// ---------- prediction ----------
export function predict(model: TrainedModel, input: ForecastInput): ForecastResult {
  const enc = {
    cause: model.causeImpact,
    corridor: model.corridorImpact,
    zone: model.zoneImpact,
    junction: model.junctionImpact,
    base: model.baseImpact,
  }
  const fv = featurize(input, enc)

  const trees = model.trees as (TreeNode | number)[]
  const treePredictions = trees.map((tree) => predictTree(tree, fv) * 100)
  const impact = Math.max(5, Math.min(100, Math.round(mean(treePredictions))))

  // Compute confidence using standard deviation of ensemble trees
  const variance = mean(treePredictions.map((p) => p * p)) - mean(treePredictions) ** 2
  const stdDev = Math.sqrt(Math.max(0, variance))
  const confidence = Math.max(55, Math.min(99, Math.round(98 - stdDev * 2.2)))

  // Leave-one-out feature contribution (Explainable AI)
  const actualPred = predictEnsemble(trees, fv)
  const rawDeltas = model.featureOrder.map((f, j) => {
    const fvMod = [...fv]
    fvMod[j] = model.featureMeans[j]
    const modPred = predictEnsemble(trees, fvMod)
    return { feature: f, raw: (actualPred - modPred) * 100 }
  })
  // Amplify small deltas so the bar chart always shows something useful
  const maxAbsRaw = Math.max(...rawDeltas.map((c) => Math.abs(c.raw)), 0.1)
  const ampScale = maxAbsRaw < 3 ? 10 / maxAbsRaw : 1
  const contributions = rawDeltas.map((c) => ({
    feature: c.feature,
    value: parseFloat((c.raw * ampScale).toFixed(1)),
  }))

  // === Forecast Drivers (Explainability) ===
  const mapping: Record<string, string> = {
    "Event Cause Profile": "Event Cause",
    "Corridor Sensitivity": "Corridor",
    "Zone History": "Zone",
    "Junction Profile": "Junction",
    "Priority Level": "Priority",
    "Road Closure": "Road Closure",
    "Planned Event": "Event Type",
    "Peak Hour": "Time",
    "Incident Duration": "Duration",
    "Weekend Effect": "Time",
  }

  const grouped: Record<string, number> = {
    "Event Cause": 0,
    "Corridor": 0,
    "Zone": 0,
    "Junction": 0,
    "Priority": 0,
    "Road Closure": 0,
    "Event Type": 0,
    "Time": 0,
    "Duration": 0,
  }

  let totalAbsVal = 0
  for (let j = 0; j < rawDeltas.length; j++) {
    const absVal = Math.abs(rawDeltas[j].raw)
    const groupName = mapping[rawDeltas[j].feature] || "Others"
    grouped[groupName] = (grouped[groupName] || 0) + absVal
    totalAbsVal += absVal
  }

  if (totalAbsVal === 0) {
    let totalImp = 0
    const impMap: Record<string, number> = {}
    for (const imp of model.importance) {
      const groupName = mapping[imp.feature] || "Others"
      impMap[groupName] = (impMap[groupName] || 0) + imp.importance
      totalImp += imp.importance
    }
    for (const key of Object.keys(grouped)) {
      grouped[key] = totalImp > 0 ? (impMap[key] || 0) / totalImp : 1 / 9
    }
  } else {
    for (const key of Object.keys(grouped)) {
      grouped[key] = grouped[key] / totalAbsVal
    }
  }

  const driverPercentages = Object.entries(grouped).map(([name, fraction]) => ({
    name,
    value: Math.round(fraction * 100),
  }))

  const sumPercentages = driverPercentages.reduce((s, x) => s + x.value, 0)
  if (sumPercentages !== 100 && driverPercentages.length > 0) {
    const diff = 100 - sumPercentages
    const largest = driverPercentages.reduce((max, x) => (x.value > max.value ? x : max), driverPercentages[0])
    largest.value += diff
  }
  driverPercentages.sort((a, b) => b.value - a.value)

  // === Similar Incidents (KNN) ===
  const similar = findSimilar(model.records || [], input, 5)

  // === Responsible Police Station Recommendation ===
  const policeStationRec = recommendPoliceStation(model.records || [], input)

  // === Dynamic 24-Hour Congestion Timeline ===
  const timeline = buildDynamicTimeline(impact, input, model)

  return {
    impact,
    risk: riskOf(impact),
    confidence,
    timeline,
    contributions,
    similar,
    policeStationRec,
    driverPercentages,
  }
}

// ---------- dynamic timeline generation ----------
function buildDynamicTimeline(
  impact: number,
  input: ForecastInput,
  model: TrainedModel,
): { hour: number; congestion: number }[] {
  const records = model.records || []
  if (records.length === 0) {
    return Array.from({ length: 24 }, (_, h) => ({ hour: h, congestion: impact }))
  }

  // 1. Location-specific background profile background[h]
  const background = new Array(24).fill(0)
  let bgMatches = records.filter((r) => r.junction === input.junction && r.junction !== "Unknown Junction")
  if (bgMatches.length < 5) {
    bgMatches = records.filter((r) => r.corridor === input.corridor && r.corridor !== "Non-corridor")
  }
  if (bgMatches.length < 5) {
    bgMatches = records.filter((r) => r.zone === input.zone && r.zone !== "Unknown")
  }
  if (bgMatches.length < 5) {
    bgMatches = records
  }

  const hourlySum = new Array(24).fill(0)
  const hourlyCount = new Array(24).fill(0)
  for (const r of bgMatches) {
    if (r.hour !== null) {
      hourlySum[r.hour] += r.impact
      hourlyCount[r.hour]++
    }
  }

  const globalAvg = records.reduce((s, r) => s + r.impact, 0) / records.length
  for (let h = 0; h < 24; h++) {
    background[h] = hourlyCount[h] > 0 ? hourlySum[h] / hourlyCount[h] : (model.hourlyProfile[h]?.avgImpact ?? globalAvg)
    background[h] = Math.max(10, Math.min(50, background[h]))
  }

  // 2. Find top K = 15 similar incidents
  const scored = records.map((r) => {
    let score = 0
    if (r.junction === input.junction && r.junction !== "Unknown Junction") score += 35
    if (r.corridor === input.corridor && r.corridor !== "Non-corridor") score += 25
    if (r.zone === input.zone && r.zone !== "Unknown") score += 15
    if (r.cause === input.cause) score += 25
    if (r.priority === input.priority) score += 5
    if (r.requiresClosure === input.requiresClosure) score += 5
    if (r.eventType === input.eventType) score += 5
    if (r.hour !== null) {
      const diff = Math.abs(r.hour - input.hour)
      const dist = Math.min(diff, 24 - diff)
      if (dist <= 2) score += 10
    }
    return { record: r, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const topK = scored.slice(0, 15).map((x) => x.record)

  // 3. Helper to generate single incident curve
  const generateCurve = (
    startHour: number,
    durationMin: number,
    requiresClosure: boolean,
    eventType: string,
    peakImpact: number,
    cause: string
  ) => {
    const curve = new Array(24).fill(0)
    const durationHours = durationMin / 60

    let causeSpreadMult = 1.0
    const causeLower = cause.toLowerCase()
    if (
      causeLower.includes("accident") ||
      causeLower.includes("water") ||
      causeLower.includes("protest") ||
      causeLower.includes("vip")
    ) {
      causeSpreadMult = 1.3
    } else if (
      causeLower.includes("breakdown") ||
      causeLower.includes("others") ||
      causeLower.includes("condition")
    ) {
      causeSpreadMult = 0.8
    }

    const sigma = durationHours * (requiresClosure ? 1.8 : 1.0) * (eventType === "unplanned" ? 1.4 : 1.0) * causeSpreadMult

    for (let h = 0; h < 24; h++) {
      const diff = h - startHour
      const elapsedHours = diff >= 0 ? diff : diff + 24

      let influence = 0
      if (eventType === "unplanned") {
        if (h === startHour) {
          influence = 1.0
        } else if (elapsedHours > 0 && elapsedHours <= 12) {
          influence = Math.exp(-elapsedHours / sigma)
        } else {
          influence = 0
        }
      } else {
        const center = startHour + durationHours / 2
        const diffFromCenter = h - center
        const dist = Math.abs(diffFromCenter) > 12 ? 24 - Math.abs(diffFromCenter) : diffFromCenter
        influence = Math.exp(-Math.pow(dist / sigma, 2))
      }

      const bg = background[h]
      curve[h] = bg + Math.max(0, peakImpact - bg) * influence
    }
    return curve
  }

  // 4. Generate historical curves average
  const histCurves = topK.map((r) =>
    generateCurve(
      r.hour ?? input.hour,
      r.durationMin ?? input.durationMin,
      r.requiresClosure,
      r.eventType,
      r.impact,
      r.cause
    )
  )

  const histAverage = new Array(24).fill(0)
  if (histCurves.length > 0) {
    for (let h = 0; h < 24; h++) {
      let sum = 0
      for (const curve of histCurves) {
        sum += curve[h]
      }
      histAverage[h] = sum / histCurves.length
    }
  } else {
    for (let h = 0; h < 24; h++) {
      histAverage[h] = background[h]
    }
  }

  // 5. Generate prediction curve for current input
  const predCurve = generateCurve(
    input.hour,
    input.durationMin,
    input.requiresClosure,
    input.eventType,
    impact,
    input.cause
  )

  // 6. Blend curves (40% historical average, 60% prediction curve)
  const blended = new Array(24).fill(0)
  for (let h = 0; h < 24; h++) {
    blended[h] = 0.4 * histAverage[h] + 0.6 * predCurve[h]
  }

  // 7. Smooth using moving average filter [0.15, 0.7, 0.15]
  const smoothed = Array.from({ length: 24 }, (_, h) => {
    const prev = (h - 1 + 24) % 24
    const next = (h + 1) % 24
    const val = 0.15 * blended[prev] + 0.7 * blended[h] + 0.15 * blended[next]
    return {
      hour: h,
      congestion: Math.max(5, Math.min(100, Math.round(val))),
    }
  })

  return smoothed
}

// ---------- similar historical events (nearest neighbours) ----------
export function findSimilar(records: TrafficRecord[], input: ForecastInput, n = 5): SimilarEvent[] {
  const scored = records
    .map((r) => {
      let s = 0
      if (r.cause === input.cause) s += 35
      if (r.corridor === input.corridor) s += 20
      if (r.junction === input.junction) s += 15
      if (r.zone === input.zone) s += 12
      if (r.priority === input.priority) s += 8
      if (r.requiresClosure === input.requiresClosure) s += 5
      if (r.hour !== null && Math.abs(r.hour - input.hour) <= 2) s += 5
      return {
        id: r.id,
        cause: r.cause,
        corridor: r.corridor,
        zone: r.zone,
        impact: r.impact,
        durationMin: r.durationMin,
        similarity: s,
      } as SimilarEvent
    })
    .filter((x) => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, n)
  const max = scored[0]?.similarity || 100
  return scored.map((s) => ({ ...s, similarity: Math.round((s.similarity / max) * 100) }))
}

// ---------- resource recommendation engine ----------
const DEFAULT_BAND_STATS: Record<RiskLevel, BandInfo> = {
  Low: { count: 100, avgDuration: 30, closureRate: 0.1, avgImpact: 20, peakRate: 0.3 },
  Moderate: { count: 100, avgDuration: 60, closureRate: 0.3, avgImpact: 50, peakRate: 0.45 },
  High: { count: 100, avgDuration: 120, closureRate: 0.6, avgImpact: 70, peakRate: 0.55 },
  Critical: { count: 100, avgDuration: 240, closureRate: 0.8, avgImpact: 90, peakRate: 0.65 },
}

export function recommendResources(
  impact: number,
  input: ForecastInput,
  bandStats?: Record<string, BandInfo>,
  causeStats?: Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }>,
  corridorZoneStats?: Record<string, { avgImpact: number; closureRate: number; avgDuration: number; peakRate: number }>,
): ResourcePlan {
  const risk = riskOf(impact)
  const stats = bandStats?.[risk] ?? DEFAULT_BAND_STATS[risk]

  // Duration-based multiplier
  const durationRatio = stats.avgDuration > 0 ? input.durationMin / stats.avgDuration : 1
  const durationMult = Math.max(0.6, Math.min(2.5, Math.sqrt(durationRatio)))

  // Closure multiplier
  const closureMult = input.requiresClosure ? 1.4 : 0.9

  // Peak hour multiplier
  const isPeak = input.hour >= 8 && input.hour <= 20
  const peakMult = isPeak ? 1.25 : 0.8

  // Cause-driven severity
  const cs = causeStats?.[input.cause]
  const globalAvgImpact = impact
  const causeClosureRate = cs?.closureRate ?? 0.3
  const causeAvgImpact = cs?.avgImpact ?? globalAvgImpact
  const allCauseAvg = causeStats
    ? Object.values(causeStats).reduce((s, v) => s + v.avgImpact, 0) /
      Math.max(1, Object.keys(causeStats).length)
    : 50
  const causeSeverityMult = Math.max(0.7, Math.min(1.6, causeAvgImpact / Math.max(1, allCauseAvg)))
  const causeClosureMult = Math.max(0.8, Math.min(1.5, 0.8 + causeClosureRate))

  // Corridor/zone-driven severity
  const corridorStat = corridorZoneStats?.[input.corridor]
  const zoneStat = corridorZoneStats?.[input.zone]
  const corridorAvgImpact = corridorStat?.avgImpact ?? globalAvgImpact
  const zoneAvgImpact = zoneStat?.avgImpact ?? globalAvgImpact
  const allCorridorAvg = corridorZoneStats
    ? Object.values(corridorZoneStats).reduce((s, v) => s + v.avgImpact, 0) /
      Math.max(1, Object.keys(corridorZoneStats).length)
    : 50
  const corridorSeverityMult = Math.max(
    0.7,
    Math.min(1.6, ((corridorAvgImpact + zoneAvgImpact) / 2) / Math.max(1, allCorridorAvg))
  )
  const corridorPeakRate = corridorStat?.peakRate ?? 0.45
  const zonePeakRate = zoneStat?.peakRate ?? 0.45
  const corridorPeakMult = Math.max(0.8, Math.min(1.4, (corridorPeakRate + zonePeakRate) / 2 / 0.45))

  // Base resources per risk band
  let baseOfficers = 3
  let baseMarshals = 1
  let baseCheckpoints = 0
  let baseBarricades = 4
  let baseDiversions = 0
  let baseLaneRestrictions = 0
  let baseAmbulances = 0
  let baseEmergencyCorridors = 0
  let baseRapidUnits = 1

  if (risk === "Moderate") {
    baseOfficers = 6; baseMarshals = 3; baseCheckpoints = 1; baseBarricades = 12
    baseDiversions = 1; baseLaneRestrictions = 1; baseAmbulances = 1
    baseEmergencyCorridors = 1; baseRapidUnits = 2
  } else if (risk === "High") {
    baseOfficers = 12; baseMarshals = 6; baseCheckpoints = 2; baseBarricades = 24
    baseDiversions = 2; baseLaneRestrictions = 2; baseAmbulances = 2
    baseEmergencyCorridors = 2; baseRapidUnits = 3
  } else if (risk === "Critical") {
    baseOfficers = 20; baseMarshals = 10; baseCheckpoints = 4; baseBarricades = 40
    baseDiversions = 4; baseLaneRestrictions = 3; baseAmbulances = 3
    baseEmergencyCorridors = 3; baseRapidUnits = 5
  }

  const officers = Math.max(2, Math.round(baseOfficers * durationMult * closureMult * peakMult * causeSeverityMult * corridorSeverityMult))
  const marshals = Math.max(1, Math.round(baseMarshals * durationMult * peakMult * causeSeverityMult))
  const checkpoints = Math.max(input.requiresClosure ? 1 : 0, Math.round(baseCheckpoints * durationMult * closureMult * causeClosureMult))
  const barricades = Math.max(input.requiresClosure ? 4 : 0, Math.round(baseBarricades * durationMult * closureMult * causeClosureMult))
  const diversions = Math.max(input.requiresClosure ? 1 : 0, Math.round(baseDiversions * closureMult * corridorSeverityMult))
  const laneRestrictions = Math.max(0, Math.round(baseLaneRestrictions * closureMult * corridorSeverityMult))
  const ambulances = Math.max(impact >= 62 ? 1 : 0, Math.round(baseAmbulances * durationMult * causeSeverityMult))
  const emergencyCorridors = Math.max(impact >= 62 ? 1 : 0, Math.round(baseEmergencyCorridors * closureMult * corridorSeverityMult))
  const rapidUnits = Math.max(1, Math.round(baseRapidUnits * peakMult * corridorPeakMult))

  const barricadeIntensity =
    impact >= 80 ? "Maximum" : impact >= 62 ? "High" : impact >= 42 ? "Moderate" : "Light"

  return {
    officers, marshals, checkpoints, barricades, barricadeIntensity,
    diversions, laneRestrictions, ambulances, emergencyCorridors, rapidUnits,
  }
}
