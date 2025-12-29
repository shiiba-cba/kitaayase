// ==========================================
// Raw TrainTimetable を加工して
// public/data/<YYYYMMDD>/ 以下に出力する
// API 呼び出しは行わない
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --------------------------------------------------
// パス解決
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// --------------------------------------------------
// 引数
// --------------------------------------------------
const diagramDate = process.argv[2];
if (!diagramDate) {
  console.error("Usage: node generateTimetable.js <YYYYMMDD>");
  process.exit(1);
}

// --------------------------------------------------
// 入出力パス
// --------------------------------------------------
const RAW_FILE = path.join(REPO_ROOT, "public", "data", "raw", "current.json");
const OUTPUT_BASE_DIR = path.join(REPO_ROOT, "public", "data", diagramDate);

// --------------------------------------------------
// 定義
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
function resolveTrainType(id) {
  return TRAIN_TYPE_MAP[id] || id;
}

function resolveStationName(id) {
  return STATION_NAME_MAP[id] || id;
}

function timeToMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function normalizeMinute(min) {
  if (min == null) return 99999;
  return min < 240 ? min + 1440 : min;
}

function extractTimes(train) {
  const list = train["odpt:trainTimetableObject"] || [];
  const times = { dep: {}, arr: {} };
  for (const t of list) {
    if (t["odpt:departureStation"])
      times.dep[t["odpt:departureStation"]] = t["odpt:departureTime"] ?? null;
    if (t["odpt:arrivalStation"])
      times.arr[t["odpt:arrivalStation"]] = t["odpt:arrivalTime"] ?? null;
  }
  return times;
}

// --------------------------------------------------
// 既存ソート
// --------------------------------------------------
function computeSortKeyAyase(ayArr, ayDep, direction, trainNumber) {
  let sameTimeSortKey = 1;
  if (direction === "for_yoyogiuehara" && trainNumber.includes("96S")) sameTimeSortKey = 2;
  if (direction === "for_kitaayase" && trainNumber.includes("96S")) sameTimeSortKey = 0;
  if (ayDep) return normalizeMinute(timeToMinutes(ayDep)) * 10 + sameTimeSortKey;
  if (ayArr) return normalizeMinute(timeToMinutes(ayArr)) * 10 + sameTimeSortKey;
  return 99999;
}

// --------------------------------------------------
// 特急用 仮想綾瀬ソート
// --------------------------------------------------
function buildOtemachiOrder(trains) {
  return trains
    .map(train => {
      const times = extractTimes(train);
      const ot = times.dep[STATIONS.otemachi] || times.arr[STATIONS.otemachi];
      if (!ot) return null;
      return {
        train,
        trainNumber: train["odpt:trainNumber"] || "",
        minute: normalizeMinute(timeToMinutes(ot)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.minute - b.minute);
}

function computeVirtualAyaseSortKey(train, ordered) {
  const trainNumber = train["odpt:trainNumber"] || "";
  const idx = ordered.findIndex(v => v.trainNumber === trainNumber);
  if (idx === -1) return 99999;

  let prev = null;
  let next = null;

  // 前方探索
  for (let i = idx - 1; i >= 0; i--) {
    const t = ordered[i];
    const times = extractTimes(t.train);
    const ay = times.dep[STATIONS.ayase] || times.arr[STATIONS.ayase];
    if (ay) {
      prev = {
        otemachi: t.minute,
        ayase: normalizeMinute(timeToMinutes(ay)),
      };
      break;
    }
  }

  // 後方探索
  for (let i = idx + 1; i < ordered.length; i++) {
    const t = ordered[i];
    const times = extractTimes(t.train);
    const ay = times.dep[STATIONS.ayase] || times.arr[STATIONS.ayase];
    if (ay) {
      next = {
        otemachi: t.minute,
        ayase: normalizeMinute(timeToMinutes(ay)),
      };
      break;
    }
  }

  // 両方無い → 末尾
  if (!prev && !next) return 99999;

  // 片側のみ
  if (prev && !next) return (prev.ayase + 0.1) * 10;
  if (!prev && next) return (next.ayase - 0.1) * 10;

  // ★ 比率補間
  const selfMinute = ordered[idx].minute;
  const ratio =
    (selfMinute - prev.otemachi) /
    (next.otemachi - prev.otemachi);

  const virtualAyase =
    prev.ayase + (next.ayase - prev.ayase) * ratio;

  return virtualAyase * 10 + 1;
}

// --------------------------------------------------
// メイン
// --------------------------------------------------
function buildTimetable(raw) {
  const result = {};

  // ★ calendar + direction ごとの大手町順
  const otemachiOrderedMap = {};
  for (const train of raw) {
    const calendar = CALENDAR_MAP[train["odpt:calendar"]];
    const direction = DIRECTION_MAP[train["odpt:railDirection"]];
    if (!calendar || !direction) continue;

    if (!otemachiOrderedMap[calendar]) otemachiOrderedMap[calendar] = {};
    if (!otemachiOrderedMap[calendar][direction]) otemachiOrderedMap[calendar][direction] = [];
    otemachiOrderedMap[calendar][direction].push(train);
  }
  for (const cal of Object.keys(otemachiOrderedMap)) {
    for (const dir of Object.keys(otemachiOrderedMap[cal])) {
      otemachiOrderedMap[cal][dir] = buildOtemachiOrder(otemachiOrderedMap[cal][dir]);
    }
  }

  for (const train of raw) {
    const calendar = CALENDAR_MAP[train["odpt:calendar"]];
    const direction = DIRECTION_MAP[train["odpt:railDirection"]];
    if (!calendar || !direction) continue;

    const otemachiOrdered = otemachiOrderedMap[calendar][direction];

    const times = extractTimes(train);
    const trainTypeId = train["odpt:trainType"];

    const originId = (train["odpt:originStation"] || [])[0] || null;
    const destId = (train["odpt:destinationStation"] || [])[0] || null;

    const ayArr = times.arr[STATIONS.ayase] || null;
    const ayDep = times.dep[STATIONS.ayase] || null;
    const kaArr = times.arr[STATIONS.kitaayase] || null;
    const kaDep = times.dep[STATIONS.kitaayase] || null;
    const yoArr = times.arr[STATIONS.yoyogiuehara] || null;
    const yoDep = times.dep[STATIONS.yoyogiuehara] || null;

    for (const stationKey of SELECTABLE_STATIONS) {
      const stationId = STATIONS[stationKey];

      const row = {
        trainNumber: train["odpt:trainNumber"] || "",
        type: resolveTrainType(trainTypeId),
        destinationStationName: resolveStationName(destId),
        originStationName: resolveStationName(originId),
        originDepartureTime: originId ? times.dep[originId] || null : null,
        stationName: resolveStationName(stationId),
        stationDepartureTime: times.dep[stationId] || null,
        stationArrivalTime: times.arr[stationId] || null,
        destinationArrivalTime: destId ? times.arr[destId] || null : null,
        kitaAyaseArrivalTime: kaArr,
        kitaAyaseDepartureTime: kaDep,
        ayaseArrivalTime: ayArr,
        ayaseDepartureTime: ayDep,
        yoyogiUeharaArrivalTime: yoArr,
        yoyogiUeharaDepartureTime: yoDep,

        sortKeyAyase:
          trainTypeId === "odpt.TrainType:TokyoMetro.LimitedExpress"
            ? computeVirtualAyaseSortKey(train, otemachiOrdered)
            : computeSortKeyAyase(
                ayArr,
                ayDep,
                direction,
                train["odpt:trainNumber"] || ""
              ),
      };

      if (!result[calendar]) result[calendar] = {};
      if (!result[calendar][direction]) result[calendar][direction] = {};
      if (!result[calendar][direction][stationKey])
        result[calendar][direction][stationKey] = [];

      result[calendar][direction][stationKey].push(row);
    }
  }

  for (const cal of Object.keys(result)) {
    for (const dir of Object.keys(result[cal])) {
      for (const station of Object.keys(result[cal][dir])) {
        result[cal][dir][station].sort((a, b) => a.sortKeyAyase - b.sortKeyAyase);
        result[cal][dir][station].forEach(r => delete r.sortKeyAyase);
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
        fs.writeFileSync(
          path.join(outDir, `${station}.json`),
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
const raw = JSON.parse(fs.readFileSync(RAW_FILE, "utf-8"));
const timetable = buildTimetable(raw);
writeFiles(timetable);
console.log(`Timetable generated: ${diagramDate}`);
