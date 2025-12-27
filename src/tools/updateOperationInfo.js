/**
 * 東京メトロ千代田線 運行情報取得スクリプト
 *
 * 仕様:
 * - Node.js 18+ 前提
 * - 意味のある変化があった場合のみ更新
 * - ただし「4:00 基準の運行日」が変わった場合は
 *   内容が同じでも必ず更新（＝毎日1回は fresh commit）
 */

import fs from "fs";
import path from "path";

/* ===================================================
 * 設定
 * =================================================== */
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
 * 運行日（4:00 基準）を計算
 * =================================================== */
function getOperationDate(now = new Date()) {
  const d = new Date(now);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

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
  if (!Array.isArray(json) || json.length === 0) {
    throw new Error("No operation info returned");
  }

  const info = json[0];

  const text =
    info["odpt:trainInformationText"]?.ja ?? "";

  // state は文言から簡易判定（必要に応じて拡張）
  let state = "normal";
  if (text.includes("遅れ")) state = "delay";
  if (text.includes("見合わせ")) state = "suspended";

  const now = new Date();

  return {
    railway: "Chiyoda",
    state,
    text,

    // 4:00 基準の運行日（★差分判定に使う）
    operationDate: getOperationDate(now),

    // 障害の起点（同一障害かどうかの判定に使える）
    originTime: info["odpt:timeOfOrigin"] ?? null,

    // 取得時刻（表示専用・差分判定には使わない）
    lastFetchedAt: info["dc:date"] ?? now.toISOString(),
  };
}

/* ===================================================
 * 前回データの読み込み
 * =================================================== */
function loadPrevious() {
  if (!fs.existsSync(OUTPUT_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
  } catch {
    return null;
  }
}

/* ===================================================
 * 差分判定
 * =================================================== */
function hasMeaningfulChange(prev, next) {
  if (!prev) return true;

  // 通常の意味差分
  if (
    prev.state !== next.state ||
    prev.text !== next.text ||
    prev.originTime !== next.originTime
  ) {
    return true;
  }

  // 運行日が変わった（4:00 以降の初回取得）
  if (prev.operationDate !== next.operationDate) {
    return true;
  }

  return false;
}

/* ===================================================
 * Main
 * =================================================== */
(async () => {
  try {
    const next = await fetchOperationInfo();
    const prev = loadPrevious();

    if (!hasMeaningfulChange(prev, next)) {
      console.log(
        `[skip] No meaningful change (operationDate=${next.operationDate})`
      );
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

    console.log(
      `[update] Operation info updated (operationDate=${next.operationDate})`
    );
  } catch (err) {
    console.error("[error] Failed to update operation info:", err);
    process.exit(1);
  }
})();
