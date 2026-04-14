import type { TrainRow } from "../types/TrainRow";

export interface TransferInfo {
  label: string;
  color: string;
}

function requiredTransferMinutes(
  ayaseArrivalTime: string,
  ayaseArrivalPlatformsByTime: Record<string, string[]> | null
): number {
  if (!ayaseArrivalPlatformsByTime) return 3;
  const platforms = ayaseArrivalPlatformsByTime[ayaseArrivalTime] ?? [];
  if (platforms.length === 0) return 3;
  const allTrack3 = platforms.every((p) => p === "3番線");
  return allTrack3 ? 2 : 3;
}

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

      // (B) 綾瀬始発の北綾瀬行(3両)で乗り換え可能なものを探す
      const reachableShuttle = ayaseTimetable.find((conn) => {
        if (!conn.trainNumber.includes("96S")) return false;
        if (!conn.ayaseDepartureTime) return false;
        const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
        let depTotal = depH * 60 + depM;
        if (depTotal < 240) depTotal += 1440;
        return (depTotal - arrTotal) >= minTransferMinutes;
      });

      // (C) 綾瀬で追いつく「直通の北綾瀬行(10両)」で乗り換え可能なものを探す
      const reachableThrough = ayaseTimetable.find((conn) => {
        if (conn.destinationStationName !== "KitaAyase" || conn.trainNumber.includes("96S")) return false;
        if (!conn.ayaseDepartureTime) return false;
        const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
        let depTotal = depH * 60 + depM;
        if (depTotal < 240) depTotal += 1440;
        return (depTotal - arrTotal) >= minTransferMinutes;
      });

      // (D) 現在の駅から、後続の「直通の北綾瀬行」を探す（乗り換えずそのまま待つ場合）
      const nextThroughTrain = allRows.slice(index + 1).find((r) => 
        r.destinationStationName === "KitaAyase" && !r.trainNumber.includes("96S")
      );

      let shuttleArrival = Infinity;
      if (reachableShuttle) {
        const [sH, sM] = (reachableShuttle.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
        shuttleArrival = sH * 60 + sM;
        if (shuttleArrival < 240) shuttleArrival += 1440;
      }

      let throughTransferArrival = Infinity;
      if (reachableThrough) {
        const [tH, tM] = (reachableThrough.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
        throughTransferArrival = tH * 60 + tM;
        if (throughTransferArrival < 240) throughTransferArrival += 1440;
      }

      let nextThroughArrival = Infinity;
      if (nextThroughTrain) {
        const [nH, nM] = (nextThroughTrain.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
        nextThroughArrival = nH * 60 + nM;
        if (nextThroughArrival < 240) nextThroughArrival += 1440;
      }

      // 最速の到着時刻を特定
      const minArrival = Math.min(shuttleArrival, throughTransferArrival, nextThroughArrival);

      if (minArrival === Infinity) return { hasAyaseConnection, transferInfo };

      if (minArrival === nextThroughArrival) {
        // 次の直通を待つのが最速
        transferInfo = { label: "後続の北綾瀬行に接続", color: "#ff7f00" };
      } else if (minArrival === throughTransferArrival) {
        // 綾瀬まで行って直通に乗り換えるのが最速
        transferInfo = { label: "綾瀬で北綾瀬行にのりかえ", color: "#ff7f00" };
      } else if (minArrival === shuttleArrival) {
        // 綾瀬まで行ってシャトルに乗り換えるのが最速
        transferInfo = { label: "綾瀬で0番線にのりかえ", color: "#ff7f00" };
      }
    }
  }

  return { hasAyaseConnection, transferInfo };
}
