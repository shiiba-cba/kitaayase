/**
 * 東京メトロ千代田線 運行情報取得
 * - 1分間隔取得OK
 * - 意味のある変化があった時だけファイル更新
 *
 * Node.js 18+ 前提
 */

import fs from "fs";
import path from "path";

const API_KEY = process.env.ODPT_API_KEY;
if (!API_KEY) {
  console.error("ODPT_API_KEY is not set");
  process.exit(1);
}

const OUTPUT_PATH = path.resolve(
  "public/data/operation.json"
);

const RAILWAY_ID = "odpt.Railway:TokyoMetro.Chiyoda";

/* ===================================================
 * API fetch
 * =================================================== */
async function fetchOperationInfo() {
  const url = new URL(
    "https://api.odpt.org/api/v4/odpt:TrainInformation"
  );
  url.searchParams.set("acl:consumerKey", API_KEY);
  url.searchParams.set("odpt:railway", RAILWAY_ID);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const json = await res.json();
  const info = json[0];

  const text =
    info["odpt:trainInformationText"]?.ja ?? "";

  // state は文言から簡易判定（将来拡張可）
  let state = "normal";
  if (text.includes("遅れ")) state = "delay";
  if (text.includes("見合わせ")) state = "suspended";

  return {
    railway: "Chiyoda",
    state,
    text,
    originTime: info["odpt:timeOfOrigin"] ?? null,
    lastFetchedAt: info["dc:date"],
  };
}

/* ===================================================
 * Load previous
 * =================================================== */
function loadPrevious() {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
}

/* ===================================================
 * Meaningful diff check
 * =================================================== */
function hasMeaningfulChange(prev, next) {
  if (!prev) return true;

  return (
    prev.state !== next.state ||
    prev.text !== next.text ||
    prev.originTime !== next.originTime
  );
}

/* ===================================================
 * Main
 * =================================================== */
(async () => {
  const next = await fetchOperationInfo();
  const prev = loadPrevious();

  if (!hasMeaningfulChange(prev, next)) {
    console.log("No meaningful change. Skip update.");
    process.exit(0);
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), {
    recursive: true,
  });

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(next, null, 2),
    "utf-8"
  );

  console.log("Operation info updated.");
})();
