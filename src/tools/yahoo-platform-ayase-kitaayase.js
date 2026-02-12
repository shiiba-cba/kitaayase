// ==========================================
// Yahoo!路線情報（綾瀬→北綾瀬）から
// 綾瀬発時刻・発番線・行先を収集する
// ==========================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { setTimeout as sleep } from "node:timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

function resolveOutputDir(diagramDate) {
  return path.join(
    REPO_ROOT,
    "public",
    "data",
    diagramDate,
    "yahoo-platform-ayase-kitaayase"
  );
}

const YAHOO_BASE = "https://transit.yahoo.co.jp/search/result";

function parseArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}


function parseDiagramDate(diagramDate) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(diagramDate || "");
  if (!m) throw new Error(`Invalid diagram date: ${diagramDate} (expected YYYYMMDD)`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadHolidaySet() {
  const holidayFile = path.join(REPO_ROOT, "public", "data", "holidays.json");
  const raw = JSON.parse(fs.readFileSync(holidayFile, "utf-8"));
  return new Set(Object.keys(raw));
}

function resolveSamplingDates(diagramDate) {
  const { y, m, d } = parseDiagramDate(diagramDate);
  const start = new Date(y, m - 1, d);
  const holidaySet = loadHolidaySet();

  let weekday = null;
  let holiday = null;

  for (let i = 0; i < 366 && (!weekday || !holiday); i += 1) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);

    const dateStr = formatDateYYYYMMDD(cur);
    const day = cur.getDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = isWeekend || holidaySet.has(dateStr);

    if (!holiday && isHoliday) holiday = dateStr;
    if (!weekday && !isHoliday) weekday = dateStr;
  }

  if (!weekday || !holiday) {
    throw new Error(`Failed to resolve weekday/holiday from diagramDate=${diagramDate}`);
  }

  return { weekday, holiday };
}

function parseDate(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
  if (!m) throw new Error(`Invalid date format: ${dateStr} (expected YYYY-MM-DD)`);
  return { y: m[1], m: m[2], d: m[3] };
}

function toHourMin(totalMin) {
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return { hh, mm };
}

function buildUrl({ y, m, d, hh, mm }) {
  const url = new URL(YAHOO_BASE);
  url.searchParams.set("from", "綾瀬");
  url.searchParams.set("to", "北綾瀬");
  url.searchParams.set("y", y);
  url.searchParams.set("m", m);
  url.searchParams.set("d", d);
  url.searchParams.set("hh", hh);
  url.searchParams.set("m1", mm[0]);
  url.searchParams.set("m2", mm[1]);

  // 検索条件（サイト標準に近い値）
  url.searchParams.set("type", "1"); // 出発
  url.searchParams.set("s", "0"); // 到着時刻順
  url.searchParams.set("ws", "3");
  url.searchParams.set("expkind", "1");
  url.searchParams.set("ticket", "ic");

  return url.toString();
}

function extractNextDataJson(html) {
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  return JSON.parse(m[1]);
}

function normalizePlatform(arrival) {
  if (!Array.isArray(arrival) || arrival.length === 0) return null;
  // 例: ["3・4", "番線"] / ["4", "番線"]
  return arrival.join("").replace(/\s+/g, "");
}

function extractRoutes(nextData, requestedAt) {
  const featureInfoList =
    nextData?.props?.pageProps?.naviSearchParam?.featureInfoList ?? [];

  const rows = [];

  for (const f of featureInfoList) {
    const edges = f?.edgeInfoList ?? [];
    const departureEdge = edges.find((e) => e?.stationName === "綾瀬");
    if (!departureEdge) continue;

    const departureTime =
      departureEdge?.timeInfo?.[0]?.time ?? f?.summaryInfo?.departureTime ?? null;

    const destination = f?.summaryInfo?.destination ?? departureEdge?.destination ?? null;
    const departurePlatform = normalizePlatform(
      departureEdge?.ridingPositionInfo?.departure ?? departureEdge?.ridingPositionInfo?.arrival
    );

    rows.push({
      requestedAt,
      departureTime,
      destination,
      departurePlatform,
      railName: departureEdge?.railNameExcludingDestination ?? null,
      stationCode: departureEdge?.stationCode ?? null,
    });
  }

  return rows;
}

async function fetchOne({ y, m, d, hh, mm }) {
  const url = buildUrl({ y, m, d, hh, mm });

  const controller = new globalThis.AbortController();

  const res = await Promise.race([
    fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    }),
    sleep(5000).then(() => {
      controller.abort();
      throw new Error(`Yahoo fetch timeout: ${url}`);
    }),
  ]);

  if (!res.ok) {
    throw new Error(`Yahoo fetch failed: ${res.status} ${url}`);
  }

  const html = await res.text();
  const nextData = extractNextDataJson(html);
  if (!nextData) {
    throw new Error(`__NEXT_DATA__ not found: ${url}`);
  }

  return extractRoutes(nextData, `${hh}:${mm}`);
}

function dedupeRows(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = [r.departureTime, r.destination, r.departurePlatform].join("|");
    if (!map.has(key)) map.set(key, r);
  }

  return [...map.values()].sort((a, b) => {
    if (a.departureTime === b.departureTime) {
      return (a.destination || "").localeCompare(b.destination || "", "ja");
    }
    return (a.departureTime || "").localeCompare(b.departureTime || "");
  });
}

async function collectForDate(dateStr, opts = {}) {
  const date = parseDate(dateStr);
  const startHour = Number(opts.startHour ?? 4);
  const endHour = Number(opts.endHour ?? 26);
  const stepMin = Number(opts.stepMin ?? 5);
  const concurrency = Number(opts.concurrency ?? 8);

  const allRows = [];
  const errors = [];

  const slots = [];
  for (let total = startHour * 60; total <= endHour * 60 + 59; total += stepMin) {
    const { hh, mm } = toHourMin(total);
    slots.push({ hh, mm });
  }

  let cursor = 0;

  async function worker() {
    while (cursor < slots.length) {
      const i = cursor;
      cursor += 1;
      const { hh, mm } = slots[i];

      try {
        const rows = await fetchOne({ ...date, hh, mm });
        allRows.push(...rows);
      } catch (e) {
        errors.push({ hh, mm, message: String(e) });
      }

      // 過剰アクセスを避ける
      await sleep(30);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

  return {
    date: dateStr,
    queried: allRows.length,
    uniqueRows: dedupeRows(allRows),
    errors,
  };
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function main() {
  const diagramDate = parseArg("--diagram-date", "20250315");
  const autoDates = resolveSamplingDates(diagramDate);
  const weekdayDate = parseArg("--weekday", autoDates.weekday);
  const holidayDate = parseArg("--holiday", autoDates.holiday);
  const stepMin = Number(parseArg("--step", "5"));
  const OUTPUT_DIR = resolveOutputDir(diagramDate);

  console.log(
    `[collect] diagramDate=${diagramDate}, weekday=${weekdayDate}, holiday=${holidayDate}, step=${stepMin}min`
  );

  const weekday = await collectForDate(weekdayDate, { stepMin });
  const holiday = await collectForDate(holidayDate, { stepMin });

  const meta = {
    generatedAt: new Date().toISOString(),
    diagramDate,
    from: "綾瀬",
    to: "北綾瀬",
    source: "https://transit.yahoo.co.jp/",
    note: "Yahoo!路線情報の検索結果（__NEXT_DATA__）から抽出。利用規約・権利条件に注意。",
    query: { stepMin },
  };

  writeJson(path.join(OUTPUT_DIR, "weekday.json"), {
    ...meta,
    type: "weekday",
    date: weekday.date,
    rows: weekday.uniqueRows,
    errors: weekday.errors,
  });

  writeJson(path.join(OUTPUT_DIR, "holiday.json"), {
    ...meta,
    type: "holiday",
    date: holiday.date,
    rows: holiday.uniqueRows,
    errors: holiday.errors,
  });

  writeJson(path.join(OUTPUT_DIR, "summary.json"), {
    ...meta,
    weekday: {
      date: weekday.date,
      count: weekday.uniqueRows.length,
      errorCount: weekday.errors.length,
    },
    holiday: {
      date: holiday.date,
      count: holiday.uniqueRows.length,
      errorCount: holiday.errors.length,
    },
  });

  console.log(`[done] wrote: ${OUTPUT_DIR}`);
  console.log(
    `[done] weekday=${weekday.uniqueRows.length} rows, holiday=${holiday.uniqueRows.length} rows`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
