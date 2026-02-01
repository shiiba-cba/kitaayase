import type { TrainRow } from "../components/TrainCard";

export interface TransferInfo {
  label: string;
  color: string;
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
  ayaseTimetable: TrainRow[]
): { hasAyaseConnection: boolean; transferInfo?: TransferInfo } {
  let hasAyaseConnection = false;
  let transferInfo: TransferInfo | undefined = undefined;

  // 1. 北綾瀬 -> 代々木上原方面の乗り換え判定
  // 北綾瀬始発の3両(96S)から、綾瀬駅で千代田線本線への乗り換え
  if (
    direction === "for_yoyogiuehara" &&
    row.trainNumber.includes("96S") &&
    row.ayaseArrivalTime
  ) {
    const [arrH, arrM] = row.ayaseArrivalTime.split(":").map(Number);
    const arrTotal = arrH * 60 + arrM;

    hasAyaseConnection = ayaseTimetable.some((conn) => {
      if (conn.originStationName !== "Ayase") return false;
      if (conn.trainNumber.includes("96S")) return false;
      if (!conn.ayaseDepartureTime) return false;

      const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
      const depTotal = depH * 60 + depM;
      const diff = depTotal - arrTotal;

      // 乗り換え時間は3分から5分の間を想定
      return diff >= 3 && diff <= 5;
    });
  }

  // 2. 代々木上原 -> 北綾瀬方面の複雑な乗り換え判定
  // 本線から北綾瀬に行く際、直通を待つか綾瀬で支線に乗り換えるか
  if (
    direction === "for_kitaayase" &&
    stationKey !== "ayase" &&
    row.destinationStationName !== "KitaAyase"
  ) {
    const currentAyaseArrival = row.ayaseArrivalTime;

    if (currentAyaseArrival) {
      const [arrH, arrM] = currentAyaseArrival.split(":").map(Number);
      let arrTotal = arrH * 60 + arrM;
      if (arrTotal < 240) arrTotal += 1440; // 4:00 AM 境界

      // (B) 綾瀬始発の北綾瀬行(3両)で、3分以上の乗り換え時間がある最初の列車を探す
      const reachableShuttle = ayaseTimetable.find((conn) => {
        if (!conn.trainNumber.includes("96S")) return false;
        if (!conn.ayaseDepartureTime) return false;

        const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
        let depTotal = depH * 60 + depM;
        if (depTotal < 240) depTotal += 1440;

        const diff = depTotal - arrTotal;
        return diff >= 3;
      });

      // (C) 現在の駅から、後続の北綾瀬行(直通10両)を探す
      const nextThroughTrain = allRows.slice(index + 1).find((r) => 
        r.destinationStationName === "KitaAyase" && !r.trainNumber.includes("96S")
      );

      // (B)と(C)を比較して、北綾瀬への到着が早い方を案内する
      if (reachableShuttle) {
        if (!nextThroughTrain) {
          transferInfo = { label: "綾瀬で0番線にのりかえ", color: "#ff7f00" };
        } else {
          const [sArrH, sArrM] = (reachableShuttle.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
          let sArrTotal = sArrH * 60 + sArrM;
          if (sArrTotal < 240) sArrTotal += 1440;

          const [tArrH, tArrM] = (nextThroughTrain.kitaAyaseArrivalTime || "00:00").split(":").map(Number);
          let tArrTotal = tArrH * 60 + tArrM;
          if (tArrTotal < 240) tArrTotal += 1440;

          if (sArrTotal <= tArrTotal) {
            transferInfo = { label: "綾瀬で0番線にのりかえ", color: "#ff7f00" };
          } else {
            transferInfo = { label: "後続の北綾瀬行まち", color: "#ff7f00" };
          }
        }
      } else if (nextThroughTrain) {
        transferInfo = { label: "後続の北綾瀬行まち", color: "#ff7f00" };
      }
    }
  }

  return { hasAyaseConnection, transferInfo };
}
