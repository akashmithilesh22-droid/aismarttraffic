const fs = require("fs")
const path = require("path")
const Papa = require("papaparse")
const { createClient } = require("@supabase/supabase-js")

const csvPath = path.join(__dirname, "..", "dataset csv file.csv")
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set both environment variables before running this script."
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const headers = [
  "id",
  "event_type",
  "latitude",
  "longitude",
  "endlatitude",
  "endlongitude",
  "address",
  "end_address",
  "event_cause",
  "requires_road_closure",
  "start_datetime",
  "end_datetime",
  "status",
  "authenticated",
  "modified_datetime",
  "map_file",
  "direction",
  "description",
  "veh_type",
  "veh_no",
  "corridor",
  "priority",
  "cargo_material",
  "reason_breakdown",
  "age_of_truck",
  "created_date",
  "route_path",
  "client_id",
  "created_by_id",
  "last_modified_by_id",
  "assigned_to_police_id",
  "citizen_accident_id",
  "comment",
  "police_station",
  "meta_data",
  "kgid",
  "resolved_at_address",
  "resolved_at_latitude",
  "resolved_at_longitude",
  "closed_by_id",
  "closed_datetime",
  "resolved_by_id",
  "resolved_datetime",
  "gba_identifier",
  "zone",
  "junction",
]

function parseCsv() {
  const text = fs.readFileSync(csvPath, "utf8")
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  if (parsed.errors.length > 0) {
    console.error("CSV parse errors:", parsed.errors)
    process.exit(1)
  }
  return parsed.data.map((row) => {
    const record = {}
    for (const key of headers) {
      const value = row[key] === undefined || row[key] === null ? "" : String(row[key])
      record[key] = value === "NULL" ? null : value
    }
    return record
  })
}

async function uploadBatch(batch, index) {
  const { data, error } = await supabase.from("traffic_records").insert(batch)
  if (error) {
    console.error(`Batch ${index} failed:`, error.message)
    process.exit(1)
  }
  return data
}

async function main() {
  console.log("Reading CSV from", csvPath)
  const rows = parseCsv()
  console.log(`Parsed ${rows.length} records`)

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize)
    console.log(`Uploading records ${i + 1} to ${i + batch.length}`)
    await uploadBatch(batch, i / chunkSize + 1)
  }

  console.log("Traffic dataset import complete.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
