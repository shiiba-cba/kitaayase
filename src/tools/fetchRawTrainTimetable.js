// src/tools/fetchRawTrainTimetable.js
import fs from "fs";
import path from "path";

const API_KEY = process.env.ODPT_API_KEY;
if (!API_KEY) {
  console.error("ODPT_API_KEY is not set");
  process.exit(1);
}

// =====================================================
// 出力先（必ず repo ルート基準）
// =====================================================
const OUT_DIR = path.resolve(process.cwd(), "public", "data", "raw");

fs.mkdirSync(OUT_DIR, { recursive: true });

const OUT_FILE = path.join(OUT_DIR, "current.json");

// =====================================================
// 取得条件（generateTimetable.js と一致させる）
// =====================================================
const RAILWAY = "odpt.Railway:TokyoMetro.Chiyoda";

const CALENDARS = ["odpt.Calendar:Weekday", "odpt.Calendar:SaturdayHoliday"];

const DIRECTIONS = [
  "odpt.RailDirection:TokyoMetro.KitaAyase",
  "odpt.RailDirection:TokyoMetro.YoyogiUehara",
];

// =====================================================
// API 呼び出し
// =====================================================
async function fetchAll() {
  const all = [];

  for (const calendar of CALENDARS) {
    for (const direction of DIRECTIONS) {
      const url = new URL("https://api.odpt.org/api/v4/odpt:TrainTimetable");
      url.searchParams.set("acl:consumerKey", API_KEY);
      url.searchParams.set("odpt:railway", RAILWAY);
      url.searchParams.set("odpt:calendar", calendar);
      url.searchParams.set("odpt:railDirection", direction);

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`API error ${res.status} (${calendar}, ${direction})`);
      }

      const json = await res.json();
      all.push(...json);
    }
  }

  return all;
}

// =====================================================
// Main
// =====================================================
const raw = await fetchAll();

// ※ diff 安定性向上のため一応整形
fs.writeFileSync(OUT_FILE, JSON.stringify(raw, null, 2), "utf-8");

console.log(`Raw timetable written (${raw.length} records): ${OUT_FILE}`);
