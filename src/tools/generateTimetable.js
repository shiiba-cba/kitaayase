// src/tools/generateTimetable.js
// ==========================================
// Raw TrainTimetable を加工して
// public/data/<YYYYMMDD>/ 以下に出力する
// API 呼び出しは行わない
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --------------------------------------------------
// パス解決（どこから実行しても repo ルート基準）
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// --------------------------------------------------
// 引数
// --------------------------------------------------
/**
 * Usage:
 *   node src/tools/generateTimetable.js 20250315
 */
const diagramDate = process.argv[2];
if (!diagramDate) {
  console.error("Usage: node generateTimetable.js <YYYYMMDD>");
  process.exit(1);
}

// --------------------------------------------------
// 入出力パス
// --------------------------------------------------
const RAW_FILE = path.join(
  REPO_ROOT,
  "public",
  "data",
  "raw",
  "current.json"
);

const OUTPUT_BASE_DIR = path.join(
  REPO_ROOT,
  "public",
  "data",
  diagramDate
);

// --------------------------------------------------
// 定義（既存仕様と同一）
// --------------------------------------------------
// カレンダー → weekday / holiday
const CALENDAR_MAP = {
  "odpt.Calendar:Weekday": "weekday",
  "odpt.Calendar:SaturdayHoliday": "holiday",
};

// 方向
const DIRECTION_MAP = {
  "odpt.RailDirection:TokyoMetro.KitaAyase": "for_kitaayase",
  "odpt.RailDirection:TokyoMetro.YoyogiUehara": "for_yoyogiuehara",
};

// 駅 ID
const STATIONS = {
  yoyogiuehara: "odpt.Station:TokyoMetro.Chiyoda.YoyogiUehara",
  yoyogikoen: "odpt.Station:TokyoMetro.Chiyoda.YoyogiKoen",
  meijijingumae: "odpt.Station:TokyoMetro.Chiyoda.MeijiJingumae",
  omotesando: "odpt.Station:TokyoMetro.Chiyoda.OmoteSando",
  nogizaka: "odpt.Station:TokyoMetro.Chiyoda.Nogizaka",
  akasaka: "odpt.Station:TokyoMetro.Chiyoda.Akasaka",
  kokkaigijidomae: "odpt.Station:TokyoMetro.Chiyoda.KokkaiGijidomae",
  kasumigaseki: "odpt.Station:TokyoMetro.Chiyoda.Kasumigaseki",
  hibiya: "odpt.Station:TokyoMetro.Chiyoda.Hibiya",
  nijubashimae: "odpt.Station:TokyoMetro.Chiyoda.Nijubashimae",
  otemachi: "odpt.Station:TokyoMetro.Chiyoda.Otemachi",
  shinochanomizu: "odpt.Station:TokyoMetro.Chiyoda.ShinOchanomizu",
  yushima: "odpt.Station:TokyoMetro.Chiyoda.Yushima",
  nezu: "odpt.Station:TokyoMetro.Chiyoda.Nezu",
  sendagi: "odpt.Station:TokyoMetro.Chiyoda.Sendagi",
  nishinippori: "odpt.Station:TokyoMetro.Chiyoda.NishiNippori",
  machiya: "odpt.Station:TokyoMetro.Chiyoda.Machiya",
  kitasenju: "odpt.Station:TokyoMetro.Chiyoda.KitaSenju",
  ayase: "odpt.Station:TokyoMetro.Chiyoda.Ayase",
  kitaayase: "odpt.Station:TokyoMetro.Chiyoda.KitaAyase",
};

// 出力対象駅
const SELECTABLE_STATIONS = [
  "yoyogiuehara",
  "yoyogikoen",
  "meijijingumae",
  "omotesando",
  "nogizaka",
  "akasaka",
  "kokkaigijidomae",
  "kasumigaseki",
  "hibiya",
  "nijubashimae",
  "otemachi",
  "shinochanomizu",
  "yushima",
  "nezu",
  "sendagi",
  "nishinippori",
  "machiya",
  "kitasenju",
  "ayase",
  // "kitaayase",
];

// ファイル名
const STATION_FILENAME = {
  yoyogiuehara: "yoyogiuehara",
  yoyogikoen: "yoyogikoen",
  meijijingumae: "meijijingumae",
  omotesando: "omotesando",
  nogizaka: "nogizaka",
  akasaka: "akasaka",
  kokkaigijidomae: "kokkaigijidomae",
  kasumigaseki: "kasumigaseki",
  hibiya: "hibiya",
  nijubashimae: "nijubashimae",
  otemachi: "otemachi",
  shinochanomizu: "shinochanomizu",
  yushima: "yushima",
  nezu: "nezu",
  sendagi: "sendagi",
  nishinippori: "nishinippori",
  machiya: "machiya",
  kitasenju: "kitasenju",
  ayase: "ayase",
  kitaayase: "kitaayase",
};

// 列車種別
const TRAIN_TYPE_MAP = {
  "odpt.TrainType:TokyoMetro.Local": "Local",
  "odpt.TrainType:TokyoMetro.SemiExpress": "SemiExpress",
  "odpt.TrainType:TokyoMetro.Express": "Express",
  "odpt.TrainType:TokyoMetro.LimitedExpress": "LimitedExpress",
};

// 駅 ID → 日本語駅名（千代田線全駅 + 直通先を統合）
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

// --------------------------------------------------
// ユーティリティ
// --------------------------------------------------
function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function normalizeMinute(min) {
  if (min == null) return 99999;
  return min < 240 ? min + 1440 : min;
}

function resolveTrainType(id) {
  return TRAIN_TYPE_MAP[id] || id;
}

function resolveStationName(stationId) {
  if (!stationId) return "";
  return STATION_NAME_MAP[stationId] || stationId;
}

// --------------------------------------------------
// 時刻抽出
// --------------------------------------------------
function extractTimes(train) {
  const list = train["odpt:trainTimetableObject"] || [];
  const times = { dep: {}, arr: {} };

  for (const t of list) {
    if (t["odpt:departureStation"]) {
      times.dep[t["odpt:departureStation"]] =
        t["odpt:departureTime"] ?? null;
    }
    if (t["odpt:arrivalStation"]) {
      times.arr[t["odpt:arrivalStation"]] =
        t["odpt:arrivalTime"] ?? null;
    }
  }
  return times;
}

// --------------------------------------------------
// 綾瀬基準ソートキー
// --------------------------------------------------
function computeSortKeyAyase(ayArr, ayDep, direction, trainNumber) {
  let sameTimeSortKey = 1;
  if (direction ==="for_yoyogiuehara" && trainNumber.includes("96S")) {
    sameTimeSortKey = 2;
  }
  if (direction === "for_kitaayase" && trainNumber.includes("96S")) {
    sameTimeSortKey = 0;
  }
  if (ayDep) return normalizeMinute(timeToMinutes(ayDep)) * 10 + sameTimeSortKey;
  if (ayArr) return normalizeMinute(timeToMinutes(ayArr)) * 10 + sameTimeSortKey;
  return 99999;
}

// --------------------------------------------------
// メイン加工ロジック
// --------------------------------------------------
function buildTimetable(raw) {
  const result = {};

  for (const train of raw) {
    const calendar = CALENDAR_MAP[train["odpt:calendar"]];
    const direction = DIRECTION_MAP[train["odpt:railDirection"]];
    if (!calendar || !direction) continue;

    const trainTypeId = train["odpt:trainType"];

    // 特急は完全除外
    if (trainTypeId === "odpt.TrainType:TokyoMetro.LimitedExpress") continue;

    if (!result[calendar]) result[calendar] = {};
    if (!result[calendar][direction]) result[calendar][direction] = {};

    const times = extractTimes(train);
    const type = resolveTrainType(trainTypeId);

    const originStationIdArr = train["odpt:originStation"] || [];
    const destinationStationIdArr = train["odpt:destinationStation"] || [];

    const originStationId = originStationIdArr[0] || null;
    const destinationStationId = destinationStationIdArr[0] || null;

    const originStationName = resolveStationName(originStationId);
    const destinationStationName = resolveStationName(destinationStationId);

    const originDepartureTime =
      originStationId && times.dep[originStationId]
        ? times.dep[originStationId]
        : null;

    const destinationArrivalTime =
      destinationStationId && times.arr[destinationStationId]
        ? times.arr[destinationStationId]
        : null;

    // 綾瀬・代々木上原の時刻
    const yoArr = times.arr[STATIONS.yoyogiuehara] || null;
    const yoDep = times.dep[STATIONS.yoyogiuehara] || null;

    const ayArr = times.arr[STATIONS.ayase] || null;
    const ayDep = times.dep[STATIONS.ayase] || null;

    const kaArr = times.arr[STATIONS.kitaayase] || null;
    const kaDep = times.dep[STATIONS.kitaayase] || null;

    for (const stationKey of SELECTABLE_STATIONS) {
      // ===============================
      // 綾瀬駅の出力制御（要件対応）
      // ===============================
      if (stationKey === "ayase") {
        if (direction === "for_yoyogiuehara") {
          // 北綾瀬始発のみ出力
          if (originStationId !== STATIONS.kitaayase) {
            continue;
          }
        }
      
        if (direction === "for_kitaayase") {
          // 北綾瀬行のみ出力
          if (destinationStationId !== STATIONS.kitaayase) {
            continue;
          }
        }
      }

      const stationId = STATIONS[stationKey];

      const stationName = resolveStationName(stationId);
      const stationDepartureTime = times.dep[stationId] || null;
      const stationArrivalTime = times.arr[stationId] || null;

      const row = {
        // ① 列車番号
        trainNumber: train["odpt:trainNumber"] || "",

        // ② 種別
        type,

        // ③ 終着駅名
        destinationStationName,

        // ④ 始発駅名
        originStationName,

        // ⑤ 始発駅発時刻
        originDepartureTime,

        // ⑥ 当駅名
        stationName,

        // ⑦ 当駅発時刻
        stationDepartureTime,

        // ⑧ 当駅発時刻
        stationArrivalTime,

        // ⑨ 終着駅着時刻
        destinationArrivalTime,

        // ⑩ 北綾瀬
        kitaAyaseArrivalTime: kaArr,
        kitaAyaseDepartureTime: kaDep,

        // ⑪ 綾瀬
        ayaseArrivalTime: ayArr,
        ayaseDepartureTime: ayDep,

        // ⑫ 代々木上原
        yoyogiUeharaArrivalTime: yoArr,
        yoyogiUeharaDepartureTime: yoDep,

        // ソートキー（後で削除）
        sortKeyAyase: computeSortKeyAyase(ayArr, ayDep, direction, train["odpt:trainNumber"] || ""),
      };

      if (!result[calendar][direction][stationKey]) {
        result[calendar][direction][stationKey] = [];
      }
      result[calendar][direction][stationKey].push(row);
    }
  }

  // ---- ソート & 軽量化 ----
  for (const cal of Object.keys(result)) {
    for (const dir of Object.keys(result[cal])) {
      for (const stationKey of Object.keys(result[cal][dir])) {
        const rows = result[cal][dir][stationKey];

        rows.sort((a, b) => a.sortKeyAyase - b.sortKeyAyase);
        for (const row of rows) {
          delete row.sortKeyAyase;
        }
      }
    }
  }

  return result;
}

// --------------------------------------------------
// 出力
// --------------------------------------------------
function writeFiles(data) {
  for (const cal of Object.keys(data)) {
    for (const dir of Object.keys(data[cal])) {
      for (const station of Object.keys(data[cal][dir])) {
        const outDir = path.join(OUTPUT_BASE_DIR, cal, dir);
        fs.mkdirSync(outDir, { recursive: true });

        const filePath = path.join(outDir, `${station}.json`);
        fs.writeFileSync(
          filePath,
          JSON.stringify(data[cal][dir][station], null, 2),
          "utf-8"
        );
      }
    }
  }
}

// --------------------------------------------------
// Main
// --------------------------------------------------
if (!fs.existsSync(RAW_FILE)) {
  console.error(`Raw file not found: ${RAW_FILE}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf-8"));
const timetable = buildTimetable(raw);
writeFiles(timetable);

console.log(`Timetable generated: ${diagramDate}`);
