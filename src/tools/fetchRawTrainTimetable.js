import fs from "fs";
import path from "path";

const API_KEY = process.env.ODPT_API_KEY;
if (!API_KEY) {
  console.error("ODPT_API_KEY is not set");
  process.exit(1);
}

// 必ずリポジトリルート基準
const OUT_DIR = path.resolve(
  process.cwd(),
  "public",
  "data",
  "raw"
);

fs.mkdirSync(OUT_DIR, { recursive: true });

const OUT_FILE = path.join(OUT_DIR, "current.json");

const url = new URL("https://api.odpt.org/api/v4/odpt:TrainTimetable");
url.searchParams.set("acl:consumerKey", API_KEY);
url.searchParams.set("odpt:railway", "odpt.Railway:TokyoMetro.Chiyoda");

const res = await fetch(url);
if (!res.ok) {
  throw new Error(`API error: ${res.status}`);
}

const json = await res.json();
fs.writeFileSync(OUT_FILE, JSON.stringify(json, null, 2), "utf-8");

console.log(`Raw timetable written to ${OUT_FILE}`);
