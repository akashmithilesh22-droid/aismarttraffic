const fs = require('fs');
const Papa = require('papaparse');

const text = fs.readFileSync('./dataset csv file.csv', 'utf-8');
const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

function clean(v) {
  if (v === undefined) return "";
  const t = v.trim();
  if (t === "" || t.toUpperCase() === "NULL" || t === "0") return "";
  return t;
}

const map = new Map();
let total = 0;
let validJunctions = 0;
let validZones = 0;
let validPoliceStations = 0;

for (const r of parsed.data) {
  const corridor = clean(r.corridor) || "Non-corridor";
  const junction = clean(r.junction) || "Unknown Junction";
  const zone = clean(r.zone) || "Unknown Zone";
  const policeStation = clean(r.police_station) || "Unknown Police Station";

  if (r.junction) validJunctions++;
  if (r.zone) validZones++;
  if (r.police_station) validPoliceStations++;

  const key = `${corridor} | ${junction} | ${zone} | ${policeStation}`;
  map.set(key, (map.get(key) || 0) + 1);
  total++;
}

console.log('Total rows:', total);
console.log('Rows with junction value:', validJunctions);
console.log('Rows with zone value:', validZones);
console.log('Rows with police_station value:', validPoliceStations);
console.log('Unique combinations count:', map.size);
console.log('Sample combinations (first 20):');
let count = 0;
for (const [combo, qty] of map.entries()) {
  console.log(`- ${combo}: ${qty} times`);
  count++;
  if (count >= 20) break;
}
