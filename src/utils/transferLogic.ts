import type { TrainRow } from "../types/TrainRow";

export interface TransferInfo {
  label: string;
  color: string;
}

function requiredTransferMinutes(
  ayaseArrivalTime: string,
  ayaseArrivalPlatformsByTime: Record<string, string[]> | null
): number {
  // データファイルがない場合は 3 分
  if (!ayaseArrivalPlatformsByTime) return 3;

  const platforms = ayaseArrivalPlatformsByTime[ayaseArrivalTime] ?? [];

  // 一致データがない場合は保守的に 3 分
  if (platforms.length === 0) return 3;

  // 一致データがすべて「3番線」の場合のみ 2 分
  const allTrack3 = platforms.every((p) => p === "3番線");
  return allTrack3 ? 2 : 3;
}

/**
 * 綾瀬駅での乗り換え情報を計算する
 */
export function calculateTransferInfo(
  direction: "for_yoyogiuehara" | "for_kitaayase",
  stationKey: string,
  row: TrainRow,
  index: number,
  allRows: TrainRow[],
  ayaseTimetable: TrainRow[],
  ayaseArrivalPlatformsByTime: Record<string, string[]> | null
): { hasAyaseConnection: boolean; transferInfo?: TransferInfo } {
  let hasAyaseConnection = false;
  let transferInfo: TransferInfo | undefined = undefined;

  // 1. 北綾瀬 -> 代々木上原方面の乗り換え判定
  if (
    direction === "for_yoyogiuehara" &&
    row.trainNumber.includes("96S") &&
    row.ayaseArrivalTime
  ) {
    const [arrH, arrM] = row.ayaseArrivalTime.split(":").map(Number);
    let arrTotal = arrH * 60 + arrM;
    if (arrTotal < 240) arrTotal += 1440;

    const nextTrainAfterTransfer = ayaseTimetable
      .filter((conn) => {
        if (!conn.ayaseDepartureTime) return false;
        if (conn.trainNumber.includes("96S")) return false;

        const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
        let depTotal = depH * 60 + depM;
        if (depTotal < 240) depTotal += 1440;

        return depTotal - arrTotal >= 2;
      })
      .sort((a, b) => {
        const [aH, aM] = (a.ayaseDepartureTime || "00:00").split(":").map(Number);
        const [bH, bM] = (b.ayaseDepartureTime || "00:00").split(":").map(Number);
        let aTotal = aH * 60 + aM;
        let bTotal = bH * 60 + bM;
        if (aTotal < 240) aTotal += 1440;
        if (bTotal < 240) bTotal += 1440;
        return aTotal - bTotal;
      })[0];

    hasAyaseConnection = nextTrainAfterTransfer?.originStationName === "Ayase";
  }

  // 2. 代々木上原 -> 北綾瀬方面の複雑な乗り換え判定
  if (
    direction === "for_kitaayase" &&
    stationKey !== "ayase" &&
    row.destinationStationName !== "KitaAyase"
  ) {
    const currentAyaseArrival = row.ayaseArrivalTime;

    if (currentAyaseArrival) {
      const [arrH, arrM] = currentAyaseArrival.split(":").map(Number);
      let arrTotal = arrH * 60 + arrM;
      if (arrTotal < 240) arrTotal += 1440;

      const minTransferMinutes = requiredTransferMinutes(
        currentAyaseArrival,
        ayaseArrivalPlatformsByTime
      );

      // (B) 綾瀬始発の北綾瀬行(3両)で、必要乗り換え時間以上がある最初の列車を探す
      const reachableShuttle = ayaseTimetable.find((conn) => {
        if (!conn.trainNumber.includes("96S")) return false;
        if (!conn.ayaseDepartureTime) return false;

        const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
        let depTotal = depH * 60 + depM;
        if (depTotal < 240) depTotal += 1440;

        const diff = depTotal - arrTotal;
        return diff >= minTransferMinutes;
      });

      // (C) 現在の駅から、後続の北綾瀬行(直通10両)を探す
      const nextThroughTrain = allRows.slice(index + 1).find((r) => 
        r.destinationStationName === "KitaAyase" && !r.trainNumber.includes("96S")
      );

      // 到着時刻の比較
      let shuttleArrivalTime: number | null = null;
      if (reachableShuttle) {
        const [sArrH, sArrM] = (reachableShuttle.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
        shuttleArrivalTime = sArrH * 60 + sArrM;
        if (shuttleArrivalTime < 240) shuttleArrivalTime += 1440;
      }

      let throughArrivalTime: number | null = null;
      if (nextThroughTrain) {
        const [tArrH, tArrM] = (nextThroughTrain.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
        throughArrivalTime = tArrH * 60 + tArrM;
        if (throughArrivalTime < 240) throughArrivalTime += 1440;
      }

      // ロジックの判定
      if (shuttleArrivalTime !== null) {
        if (throughArrivalTime === null || shuttleArrivalTime <= throughArrivalTime) {
          // シャトルが早い、または同着の場合はシャトル（乗り換え案内）
          // 指示通り、我孫子行などから綾瀬始発に繋がる場合はこちら
          transferInfo = { label: "綾瀬で0番線にのりかえ", color: "#ff7f00" };
        } else {
          // 直通の方が早い
          transferInfo = { label: "後続の北綾瀬行に接続", color: "#ff7f00" };
        }
      } else if (throughArrivalTime !== null) {
        // シャトルに間に合わないが直通はある
        transferInfo = { label: "後続の北綾瀬行に接続", color: "#ff7f00" };
      }
    }
  }

  return { hasAyaseConnection, transferInfo };
}
