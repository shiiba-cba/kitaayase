// generateTimetable.js
// 東京メトロ千代田線 TrainTimetable を
// 駅 × 方向 × ダイヤの軽量 JSON に変換するツール。
// --- Node.js 18+（標準 fetch）前提 ---

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ====================================================================
// 設定
// ====================================================================

// API KEY（環境変数から取得）
const API_KEY = process.env.ODPT_API_KEY;

// ダイヤ改正日フォルダ
const DIAGRAM_DATE = "20250315";

// 出力ディレクトリ
const OUTPUT_BASE_DIR = "./out";

// 千代田線 ID
const CHIYODA_RAILWAY_ID = "odpt.Railway:TokyoMetro.Chiyoda";

// カレンダー → weekday/holiday
const CALENDAR_MAP = {
  "odpt.Calendar:Weekday": "weekday",
  "odpt.Calendar:SaturdayHoliday": "holiday",
};

// 方向（千代田線 → 北綾瀬＝for_kitaayase、北綾瀬 → 千代田線＝for_yoyogiuehara）
const DIRECTION_MAP = {
  "odpt.RailDirection:TokyoMetro.KitaAyase": "for_kitaayase",
  "odpt.RailDirection:TokyoMetro.YoyogiUehara": "for_yoyogiuehara",
};

// 駅 ID 一覧（千代田線）
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

// 出力対象駅（キー名＝ファイル名）
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
  // "ayase",
  // "kitaayase",
];

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

// ====================================================================
// ユーティリティ
// ====================================================================

function ensureApiKey() {
  if (!API_KEY) {
    console.error("ERROR: ODPT_API_KEY が未設定です。");
    process.exit(1);
  }
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function normalize(min) {
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

// ====================================================================
// API 呼び出し
// ====================================================================

async function fetchTrainTimetables() {
  const calendars = ["odpt.Calendar:Weekday", "odpt.Calendar:SaturdayHoliday"];
  const directions = [
    "odpt.RailDirection:TokyoMetro.KitaAyase",
    "odpt.RailDirection:TokyoMetro.YoyogiUehara",
  ];

  const all = [];

  for (const cal of calendars) {
    for (const dir of directions) {
      const url = new URL("https://api.odpt.org/api/v4/odpt:TrainTimetable");
      url.searchParams.set("acl:consumerKey", API_KEY);
      url.searchParams.set("odpt:railway", CHIYODA_RAILWAY_ID);
      url.searchParams.set("odpt:calendar", cal);
      url.searchParams.set("odpt:railDirection", dir);

      console.log("Fetching:", url.toString());

      const res = await fetch(url);
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const json = await res.json();

      console.log(`Fetched ${json.length} trains for ${cal} × ${dir}`);
      all.push(...json);
    }
  }

  console.log("Total trains fetched:", all.length);
  return all;
}

// ====================================================================
// 時刻抽出
// ====================================================================

function extractTimes(train) {
  const tt = train["odpt:trainTimetableObject"] || [];
  const times = { departure: {}, arrival: {} };

  for (const obj of tt) {
    if (obj["odpt:departureStation"]) {
      times.departure[obj["odpt:departureStation"]] =
        obj["odpt:departureTime"] || null;
    }
    if (obj["odpt:arrivalStation"]) {
      times.arrival[obj["odpt:arrivalStation"]] =
        obj["odpt:arrivalTime"] || null;
    }
  }
  return times;
}

// ====================================================================
// 綾瀬基準ソートキー
// ====================================================================

function computeSortKeyAyase(ayArr, ayDep, direction, trainNumber) {
  let sameTimeSortKey = 1;
  if (direction ==="for_yoyogiuehara" && trainNumber.includes("96S")) {
    sameTimeSortKey = 2;
  }
  if (direction === "for_kitaayase" && trainNumber.includes("96S")) {
    sameTimeSortKey = 0;
  }
  if (ayDep) return normalize(timeToMinutes(ayDep)) * 10 + sameTimeSortKey;
  if (ayArr) return normalize(timeToMinutes(ayArr)) * 10 + sameTimeSortKey;
  return 99999;
}

// ====================================================================
// メイン変換
// ====================================================================

function buildTimetableByStation(allTrains) {
  const result = {};

  for (const train of allTrains) {
    const calendar = CALENDAR_MAP[train["odpt:calendar"]];
    if (!calendar) continue;

    const direction = DIRECTION_MAP[train["odpt:railDirection"]];
    if (!direction) continue;

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
      originStationId && times.departure[originStationId]
        ? times.departure[originStationId]
        : null;

    const destinationArrivalTime =
      destinationStationId && times.arrival[destinationStationId]
        ? times.arrival[destinationStationId]
        : null;

    // 綾瀬・代々木上原の時刻
    const yoArr = times.arrival[STATIONS.yoyogiuehara] || null;
    const yoDep = times.departure[STATIONS.yoyogiuehara] || null;

    const ayArr = times.arrival[STATIONS.ayase] || null;
    const ayDep = times.departure[STATIONS.ayase] || null;

    const kaArr = times.arrival[STATIONS.kitaayase] || null;
    const kaDep = times.departure[STATIONS.kitaayase] || null;

    for (const stationKey of SELECTABLE_STATIONS) {
      const stationId = STATIONS[stationKey];

      const stationName = resolveStationName(stationId);
      const stationDepartureTime = times.departure[stationId] || null;
      const stationArrivalTime = times.arrival[stationId] || null;

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

// ====================================================================
// 出力
// ====================================================================

function writeOutputFiles(byStation) {
  const base = path.join(OUTPUT_BASE_DIR, DIAGRAM_DATE);

  for (const cal of Object.keys(byStation)) {
    for (const dir of Object.keys(byStation[cal])) {
      for (const stationKey of Object.keys(byStation[cal][dir])) {
        const rows = byStation[cal][dir][stationKey];
        const outDir = path.join(base, cal, dir);
        fs.mkdirSync(outDir, { recursive: true });

        const fileName = STATION_FILENAME[stationKey] + ".json";
        const filePath = path.join(outDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf-8");
        console.log(`Wrote ${filePath} (${rows.length} trains)`);
      }
    }
  }
}

// ====================================================================
// メイン
// ====================================================================

async function main() {
  ensureApiKey();
  const trains = await fetchTrainTimetables();
  const byStation = buildTimetableByStation(trains);
  writeOutputFiles(byStation);
  console.log("Done.");
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  main();
}
