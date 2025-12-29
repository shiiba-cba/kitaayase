// src/tools/generateTrainMaster.js
// ==========================================
// Raw TrainTimetable から
// 列車単位JSONを生成（short station name）
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

const diagramDate = process.argv[2];
if (!diagramDate) {
  console.error("Usage: node generateTrainMaster.js <YYYYMMDD>");
  process.exit(1);
}

const RAW_FILE = path.join(REPO_ROOT, "public", "data", "raw", "current.json");

const OUTPUT_BASE = path.join(
  REPO_ROOT,
  "public",
  "data",
  diagramDate,
  "train"
);

const CALENDAR_MAP = {
  "odpt.Calendar:Weekday": "weekday",
  "odpt.Calendar:SaturdayHoliday": "holiday",
};

const DIRECTION_MAP = {
  "odpt.RailDirection:TokyoMetro.KitaAyase": "for_kitaayase",
  "odpt.RailDirection:TokyoMetro.YoyogiUehara": "for_yoyogiuehara",
};

const TRAIN_TYPE_MAP = {
  "odpt.TrainType:TokyoMetro.Local": "Local",
  "odpt.TrainType:TokyoMetro.SemiExpress": "SemiExpress",
  "odpt.TrainType:TokyoMetro.Express": "Express",
  "odpt.TrainType:TokyoMetro.LimitedExpress": "LimitedExpress",
};

const STATION_NAME_MAP = {
  // 小田急・箱根登山線など
  "odpt.Station:OdakyuHakone.HakoneTozan.HakoneYumoto": "HakoneYumoto",
  "odpt.Station:Odakyu.Tama.Karakida": "Karakida",
  "odpt.Station:Odakyu.Odawara.Isehara": "Isehara",
  "odpt.Station:Odakyu.Odawara.HonAtsugi": "HonAtsugi",
  "odpt.Station:Odakyu.Odawara.SagamiOno": "SagamiOno",
  "odpt.Station:Odakyu.Odawara.MukogaokaYuen": "MukogaokaYuen",
  "odpt.Station:Odakyu.Odawara.SeijogakuenMae": "SeijogakuenMae",

  // 東京メトロ千代田線
  "odpt.Station:TokyoMetro.Chiyoda.YoyogiUehara": "YoyogiUehara",
  "odpt.Station:TokyoMetro.Chiyoda.YoyogiKoen": "YoyogiKoen",
  "odpt.Station:TokyoMetro.Chiyoda.MeijiJingumae": "MeijiJingumae",
  "odpt.Station:TokyoMetro.Chiyoda.OmoteSando": "OmoteSando",
  "odpt.Station:TokyoMetro.Chiyoda.Nogizaka": "Nogizaka",
  "odpt.Station:TokyoMetro.Chiyoda.Akasaka": "Akasaka",
  "odpt.Station:TokyoMetro.Chiyoda.KokkaiGijidomae": "KokkaiGijidomae",
  "odpt.Station:TokyoMetro.Chiyoda.Kasumigaseki": "Kasumigaseki",
  "odpt.Station:TokyoMetro.Chiyoda.Hibiya": "Hibiya",
  "odpt.Station:TokyoMetro.Chiyoda.Nijubashimae": "Nijubashimae",
  "odpt.Station:TokyoMetro.Chiyoda.Otemachi": "Otemachi",
  "odpt.Station:TokyoMetro.Chiyoda.ShinOchanomizu": "ShinOchanomizu",
  "odpt.Station:TokyoMetro.Chiyoda.Yushima": "Yushima",
  "odpt.Station:TokyoMetro.Chiyoda.Nezu": "Nezu",
  "odpt.Station:TokyoMetro.Chiyoda.Sendagi": "Sendagi",
  "odpt.Station:TokyoMetro.Chiyoda.NishiNippori": "NishiNippori",
  "odpt.Station:TokyoMetro.Chiyoda.Machiya": "Machiya",
  "odpt.Station:TokyoMetro.Chiyoda.KitaSenju": "KitaSenju",
  "odpt.Station:TokyoMetro.Chiyoda.Ayase": "Ayase",
  "odpt.Station:TokyoMetro.Chiyoda.KitaAyase": "KitaAyase",

  // 常磐線各駅停車など
  "odpt.Station:JR-East.JobanLocal.Matsudo": "Matsudo",
  "odpt.Station:JR-East.JobanLocal.Kashiwa": "Kashiwa",
  "odpt.Station:JR-East.JobanLocal.Abiko": "Abiko",
  "odpt.Station:JR-East.JobanLocal.Toride": "Toride",
};

function resolveStationName(id) {
  if (!id) return "";
  return STATION_NAME_MAP[id] ?? id.split(".").pop();
}

function resolveTrainType(id) {
  return TRAIN_TYPE_MAP[id] || id;
}

function removeNullFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== null && v !== undefined)
  );
}

// --------------------------------------------------
// Main
// --------------------------------------------------
if (!fs.existsSync(RAW_FILE)) {
  console.error(`Raw file not found: ${RAW_FILE}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf-8"));

for (const train of raw) {
  const calendar = CALENDAR_MAP[train["odpt:calendar"]];
  const direction = DIRECTION_MAP[train["odpt:railDirection"]];
  if (!calendar || !direction) continue;

  const trainNumber = train["odpt:trainNumber"];
  if (!trainNumber) continue;

  const outDir = path.join(OUTPUT_BASE, calendar);
  fs.mkdirSync(outDir, { recursive: true });

  const originId = train["odpt:originStation"]?.[0];
  const destId = train["odpt:destinationStation"]?.[0];

  const timetable = [];

  for (const o of train["odpt:trainTimetableObject"] || []) {
    const stationId = o["odpt:departureStation"] ?? o["odpt:arrivalStation"];
    if (!stationId) continue;

    timetable.push(
      removeNullFields({
        station: resolveStationName(stationId),
        arrivalTime: o["odpt:arrivalTime"] ?? null,
        departureTime: o["odpt:departureTime"] ?? null,
      })
    );
  }

  const rawData = {
    trainNumber,
    calendar,
    direction,
    trainType: resolveTrainType(train["odpt:trainType"]),
    originStation: resolveStationName(originId),
    destinationStation: resolveStationName(destId),
    timetable,
  };

  const data = removeNullFields(rawData);

  fs.writeFileSync(
    path.join(outDir, `${trainNumber}.json`),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}

console.log(`Train master generated (short station names): ${diagramDate}`);
