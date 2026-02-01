import { stations } from "../data/stations";

/**
 * 列車種別の表示情報を取得
 */
export function getTrainTypeInfo(type?: string) {
  switch (type) {
    case "Local":
      return { label: "各駅停車", bg: "#004cb0" };
    case "SemiExpress":
      return { label: "準急", bg: "#007f00" };
    case "Express":
      return { label: "急行", bg: "#c40000" };
    case "LimitedExpress":
      return { label: "特急", bg: "#c40000" };
    default:
      return null;
  }
}

/**
 * 英語の駅名を日本語に変換
 */
export function toJaStationName(raw?: string | null): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  return stations[key] ?? raw;
}

/**
 * 相対時間（～分前など）をフォーマット
 */
export function formatRelativeTime(dateString: string): string {
  const updatedAt = new Date(dateString);
  const now = new Date();

  const diffMs = now.getTime() - updatedAt.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 5) return "数分前";
  if (diffMin < 60) return `${diffMin}分前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}日前`;
}

/**
 * 先頭の0を削除して時刻をフォーマット (08:05 -> 8:05)
 */
export function formatTimeNoLeadingZero(time?: string | null): string {
  if (!time) return "";
  if (time === "--:--") return time;

  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

/**
 * 時刻をフォーマット (8:5 -> 8:05)
 */
export function formatTime(t: string | null): string {
  if (!t) return "--:--";
  const [h, m] = t.split(":").map(Number);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

/**
 * 3両編成（0番線折り返し運用など）かどうかを判定
 */
export function isThreeCars(trainNumber?: string | null): boolean {
  return !!trainNumber?.includes("96S");
}

const JOBAN_LOCAL_GRAY = "#A8A39D";
const ODAKYU_BLUE = "#06559D";

const JOBAN_LOCAL_STATIONS = new Set(["matsudo", "kashiwa", "abiko", "toride"]);
const ODAKYU_STATIONS = new Set([
  "odakyu",
  "hakoneyumoto",
  "karakida",
  "isehara",
  "honatsugi",
  "sagamiono",
  "mukogaokayuen",
  "seijogakuenmae",
]);

/**
 * 直通先のラインカラーを取得
 */
export function getThroughLineColorForStationKey(
  stationKey: string | null | undefined,
  opts?: { treatMissingAsOdakyu?: boolean }
): string | null {
  const key = (stationKey ?? "").toLowerCase();

  if (!key) return opts?.treatMissingAsOdakyu ? ODAKYU_BLUE : null;

  if (JOBAN_LOCAL_STATIONS.has(key)) return JOBAN_LOCAL_GRAY;
  if (ODAKYU_STATIONS.has(key)) return ODAKYU_BLUE;
  return null;
}
