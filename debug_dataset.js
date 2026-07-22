const fs = require('fs');
const Papa = require('papaparse');

function clean(v) {
  if (v === undefined) return ""
  const t = v.trim()
  if (t === "" || t.toUpperCase() === "NULL" || t === "0") return ""
  return t
}

function parseDate(v) {
  const c = clean(v)
  if (!c) return null
  let iso = c.replace(" ", "T")
  if (/[-+]\d{2}$/.test(iso)) {
    iso += ":00"
  }
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d
}

function mean(a) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
}

const csvPath = './dataset csv file.csv';
const text = fs.readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

const records = [];
for (const r of parsed.data) {
  const eventType = clean(r.event_type).toLowerCase()
  if (eventType !== "planned" && eventType !== "unplanned") continue
  const start = parseDate(r.start_datetime)
  const resolved = parseDate(r.resolved_datetime) || parseDate(r.closed_datetime) || parseDate(r.modified_datetime)
  let durationMin = null
  if (start && resolved) {
    const diff = (resolved.getTime() - start.getTime()) / 60000
    if (diff > 0 && diff < 60 * 24 * 7) durationMin = Math.round(diff)
  }
  const cause = clean(r.event_cause).toLowerCase() || "others"
  const priority = clean(r.priority) || "Low"
  const corridor = clean(r.corridor) || "Non-corridor"
  const zone = clean(r.zone) || clean(r.police_station) || "Unknown"
  const requiresClosure = clean(r.requires_road_closure).toUpperCase() === "TRUE"
  const hour = start ? start.getHours() : null
  
  // computeImpact
  const PRIORITY_SCORE = { High: 20, Medium: 10, Low: 0 };
  const CAUSE_SEVERITY = {
    congestion:           18,
    public_event:         16,
    vip_movement:         15,
    construction:         14,
    "fog / low visibility": 13,
    protest:              12,
    accident:             11,
    procession:           10,
    water_logging:        9,
    road_conditions:      8,
    tree_fall:            8,
    vehicle_breakdown:     7,
    debris:                6,
    others:                5,
    pot_holes:             4,
    test_demo:             2,
  };
  const CORRIDOR_SEVERITY = {
    "Mysore Road": 10,
    "Bellary Road 1": 9,
    "Tumkur Road": 8,
    "Bellary Road 2": 8,
    "Hosur Road": 8,
    "ORR North 1": 9,
    "Old Madras Road": 8,
    "Magadi Road": 7,
    "ORR East 1": 9,
    "ORR North 2": 8,
    "Bannerghata Road": 8,
    "ORR East 2": 8,
    "West of Chord Road": 7,
    "ORR West 1": 8,
    "CBD 1": 9,
    "CBD 2": 8,
    "Old Airport Road": 8,
    "Hennur Main Road": 6,
    "Airport New South Road": 5,
    "Varthur Road": 7,
    "IRR(Thanisandra road)": 6,
    "Non-corridor": 0,
  };
  const ZONE_SEVERITY = {
    "Central Zone 2": 10,
    "West Zone 1": 9,
    "North Zone 2": 8,
    "West Zone 2": 8,
    "South Zone 2": 7,
    "North Zone 1": 8,
    "Central Zone 1": 8,
    "East Zone 1": 7,
    "South Zone 1": 7,
    "East Zone 2": 6,
    "HSR Layout": 8,
    "Peenya": 7,
    "Sadashivanagar": 7,
    "Cubbon Park": 7,
    "Hennuru": 6,
    "Byatarayanapura": 7,
    "Mahadevapura": 7,
    "Halasur": 6,
    "Kodigehalli": 6,
    "Jayanagara": 5,
    "Madiwala": 8,
    "Whitefield": 8,
    "Shivajinagar": 7,
    "Electronic City": 7,
    "Hebbala": 8,
    "Yeshwanthpura": 8,
    "Vijayanagara": 7,
    "Chamarajpet": 6,
    "Kamakshipalya": 6,
    "Ashok Nagar": 7,
    "Banaswadi": 6,
    "Yelahanka": 7,
  };

  let score = 0;
  if (durationMin !== null && durationMin > 0) {
    score += Math.min(35, Math.log2(durationMin + 1) * 4.2);
  } else {
    const baseSeverity = CAUSE_SEVERITY[cause] ?? 5;
    score += 15 + baseSeverity * 0.4;
  }
  score += CAUSE_SEVERITY[cause] ?? 5;
  score += CORRIDOR_SEVERITY[corridor] ?? (corridor !== "Non-corridor" ? 6 : 0);
  score += ZONE_SEVERITY[zone] ?? 4;
  score += PRIORITY_SCORE[priority] ?? 0;
  if (requiresClosure) score += 12;
  if (hour !== null && ((hour >= 8 && hour <= 11) || (hour >= 17 && hour <= 20))) {
    score += 5;
  }
  const impact = Math.max(5, Math.min(100, Math.round(score)));
  
  records.push({
    eventType,
    cause,
    priority,
    corridor,
    zone,
    requiresClosure,
    hour,
    dayOfWeek: start ? start.getDay() : null,
    durationMin,
    impact
  });
}

const usable = records.filter(r => r.impact > 0);
const enc = {
  cause: encodeCategory(usable, r => r.cause),
  corridor: encodeCategory(usable, r => r.corridor),
  zone: encodeCategory(usable, r => r.zone),
  base: mean(usable.map(r => r.impact))
};
const X = usable.map(r => featurize(r, enc));
const y = usable.map(r => r.impact / 100);

function featurize(r, enc) {
  const peak = r.hour !== null && ((r.hour >= 8 && r.hour <= 11) || (r.hour >= 17 && r.hour <= 20)) ? 1 : 0
  const dur = r.durationMin !== null ? Math.min(18, Math.log2(r.durationMin + 1) * 2.2) : 6
  const weekend = r.dayOfWeek !== null && r.dayOfWeek !== undefined ? (r.dayOfWeek === 0 || r.dayOfWeek === 6 ? 1 : 0) : 0
  return [
    (enc.cause[r.cause] ?? enc.base) / 100,
    (enc.corridor[r.corridor] ?? enc.base) / 100,
    (enc.zone[r.zone] ?? enc.base) / 100,
    r.priority === "High" ? 1 : r.priority === "Medium" ? 0.5 : 0,
    r.requiresClosure ? 1 : 0,
    r.eventType === "planned" ? 1 : 0,
    peak,
    dur / 18,
    weekend,
  ]
}

function encodeCategory(records, key) {
  const groups = {}
  for (const r of records) {
    const k = key(r)
    ;(groups[k] ||= []).push(r.impact)
  }
  const enc = {}
  for (const k in groups) enc[k] = mean(groups[k])
  return enc
}

function getCandidateThresholds(X, featureIndex) {
  const vals = X.map(row => row[featureIndex])
  const uniqueVals = Array.from(new Set(vals)).sort((a, b) => a - b)
  if (uniqueVals.length <= 15) {
    const thresholds = []
    for (let i = 0; i < uniqueVals.length - 1; i++) {
      thresholds.push((uniqueVals[i] + uniqueVals[i + 1]) / 2)
    }
    return thresholds
  }
  const thresholds = []
  const percentiles = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  for (const p of percentiles) {
    const idx = Math.floor(p * (uniqueVals.length - 1))
    thresholds.push(uniqueVals[idx])
  }
  return Array.from(new Set(thresholds)).sort((a, b) => a - b)
}

function buildTree(X, y, indices, depth, maxDepth, minSamplesSplit, candidates) {
  const n = indices.length
  if (n === 0) return 0
  const yVals = indices.map((i) => y[i])
  const sumY = yVals.reduce((a, b) => a + b, 0)
  const meanY = sumY / n
  if (depth >= maxDepth || n < minSamplesSplit) return meanY
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
  let bestLeftIndices = []
  let bestRightIndices = []

  const numFeatures = X[0].length
  for (let j = 0; j < numFeatures; j++) {
    const thresholds = candidates[j]
    for (const t of thresholds) {
      const leftIdx = []
      const rightIdx = []
      for (const idx of indices) {
        if (X[idx][j] <= t) leftIdx.push(idx)
        else rightIdx.push(idx)
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

  if (bestFeature === -1) return meanY

  const leftChild = buildTree(X, y, bestLeftIndices, depth + 1, maxDepth, minSamplesSplit, candidates)
  const rightChild = buildTree(X, y, bestRightIndices, depth + 1, maxDepth, minSamplesSplit, candidates)

  return {
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: leftChild,
    right: rightChild
  }
}

const numTrees = 45;
const maxDepth = 8;
const minSamplesSplit = 4;
const trees = [];
const candidates = [];
for (let j = 0; j < X[0].length; j++) {
  candidates.push(getCandidateThresholds(X, j));
}
for (let t = 0; t < numTrees; t++) {
  const indices = []
  for (let i = 0; i < X.length; i++) {
    indices.push(Math.floor(Math.random() * X.length))
  }
  trees.push(buildTree(X, y, indices, 0, maxDepth, minSamplesSplit, candidates))
}

function predictTree(tree, x) {
  if (typeof tree === "number") return tree;
  if (x[tree.featureIndex] <= tree.threshold) {
    return predictTree(tree.left, x);
  } else {
    return predictTree(tree.right, x);
  }
}

function predict(input) {
  const fv = featurize(input, enc);
  const treePredictions = trees.map(tree => predictTree(tree, fv) * 100);
  return Math.round(mean(treePredictions));
}

const baseInput = {
  cause: 'vehicle_breakdown',
  corridor: 'Tumkur Road',
  zone: 'Peenya',
  priority: 'High',
  eventType: 'unplanned',
  requiresClosure: false,
  hour: 18,
  durationMin: 60
};

console.log('Base prediction:', predict(baseInput));

// 1. Change cause
console.log('Change cause to construction:', predict({ ...baseInput, cause: 'construction' }));
console.log('Change cause to pot_holes:', predict({ ...baseInput, cause: 'pot_holes' }));

// 2. Change corridor
console.log('Change corridor to Mysore Road:', predict({ ...baseInput, corridor: 'Mysore Road' }));
console.log('Change corridor to Non-corridor:', predict({ ...baseInput, corridor: 'Non-corridor' }));

// 3. Change closure
console.log('Change closure to true:', predict({ ...baseInput, requiresClosure: true }));

// 4. Change priority
console.log('Change priority to Low:', predict({ ...baseInput, priority: 'Low' }));

// 5. Change duration
console.log('Change duration to 360:', predict({ ...baseInput, durationMin: 360 }));
console.log('Change duration to 15:', predict({ ...baseInput, durationMin: 15 }));
