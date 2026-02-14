import { describe, it, expect } from "vitest";
import { calculateTransferInfo } from "./transferLogic";
import type { TrainRow } from "../components/TrainCard";

function makeRow(overrides: Partial<TrainRow> = {}): TrainRow {
  return {
    trainNumber: "A1001S",
    type: "Local",
    destinationStationName: "YoyogiUehara",
    originStationName: "KitaAyase",
    originDepartureTime: null,
    stationName: "kitaayase",
    stationDepartureTime: null,
    stationArrivalTime: null,
    destinationArrivalTime: null,
    kitaAyaseArrivalTime: null,
    kitaAyaseDepartureTime: null,
    ayaseArrivalTime: null,
    ayaseDepartureTime: null,
    yoyogiUeharaArrivalTime: null,
    yoyogiUeharaDepartureTime: null,
    ...overrides,
  };
}

describe("transferLogic", () => {
  describe("for_yoyogiuehara: 3-car shuttle connection at Ayase", () => {
    it("finds Ayase-origin connection when shuttle arrives and next train departs ≥2min later", () => {
      const shuttle = makeRow({
        trainNumber: "A196S",
        ayaseArrivalTime: "08:00",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B501S",
          originStationName: "Ayase",
          ayaseDepartureTime: "08:02",
        }),
      ];

      const result = calculateTransferInfo(
        "for_yoyogiuehara",
        "kitaayase",
        shuttle,
        0,
        [shuttle],
        ayaseTimetable,
        null
      );

      expect(result.hasAyaseConnection).toBe(true);
    });

    it("no connection when next train departs <2min after shuttle arrival", () => {
      const shuttle = makeRow({
        trainNumber: "A196S",
        ayaseArrivalTime: "08:00",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B501S",
          originStationName: "Ayase",
          ayaseDepartureTime: "08:01",
        }),
      ];

      const result = calculateTransferInfo(
        "for_yoyogiuehara",
        "kitaayase",
        shuttle,
        0,
        [shuttle],
        ayaseTimetable,
        null
      );

      expect(result.hasAyaseConnection).toBe(false);
    });

    it("no connection when non-96S train", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        ayaseArrivalTime: "08:00",
      });

      const result = calculateTransferInfo(
        "for_yoyogiuehara",
        "kitaayase",
        row,
        0,
        [row],
        [],
        null
      );

      expect(result.hasAyaseConnection).toBe(false);
    });

    it("no connection when shuttle has no ayaseArrivalTime", () => {
      const shuttle = makeRow({
        trainNumber: "A196S",
        ayaseArrivalTime: null,
      });

      const result = calculateTransferInfo(
        "for_yoyogiuehara",
        "kitaayase",
        shuttle,
        0,
        [shuttle],
        [],
        null
      );

      expect(result.hasAyaseConnection).toBe(false);
    });
  });

  describe("for_kitaayase: transfer at Ayase for non-KitaAyase-bound trains", () => {
    it("recommends shuttle transfer when reachable and no through train", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B196S",
          ayaseDepartureTime: "09:03",
          kitaAyaseArrivalTime: "09:06",
        }),
      ];

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row],
        ayaseTimetable,
        null
      );

      expect(result.transferInfo).toBeDefined();
      expect(result.transferInfo!.label).toBe("綾瀬で0番線にのりかえ");
    });

    it("recommends through train when shuttle arrives later", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const throughTrain = makeRow({
        trainNumber: "A2001S",
        destinationStationName: "KitaAyase",
        kitaAyaseArrivalTime: "09:08",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B196S",
          ayaseDepartureTime: "09:05",
          kitaAyaseArrivalTime: "09:10", // arrives later than through train
        }),
      ];

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row, throughTrain],
        ayaseTimetable,
        null
      );

      expect(result.transferInfo).toBeDefined();
      expect(result.transferInfo!.label).toBe("後続の北綾瀬行に接続");
    });

    it("recommends shuttle when it arrives before through train", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const throughTrain = makeRow({
        trainNumber: "A2001S",
        destinationStationName: "KitaAyase",
        kitaAyaseArrivalTime: "09:12",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B196S",
          ayaseDepartureTime: "09:03",
          kitaAyaseArrivalTime: "09:06", // arrives before through train
        }),
      ];

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row, throughTrain],
        ayaseTimetable,
        null
      );

      expect(result.transferInfo).toBeDefined();
      expect(result.transferInfo!.label).toBe("綾瀬で0番線にのりかえ");
    });

    it("no transfer info for KitaAyase-bound trains", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "KitaAyase",
        ayaseArrivalTime: "09:00",
      });

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row],
        [],
        null
      );

      expect(result.transferInfo).toBeUndefined();
    });

    it("no transfer info when stationKey is ayase", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const result = calculateTransferInfo(
        "for_kitaayase",
        "ayase",
        row,
        0,
        [row],
        [],
        null
      );

      expect(result.transferInfo).toBeUndefined();
    });

    it("no transfer info when no ayaseArrivalTime", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: null,
      });

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row],
        [],
        null
      );

      expect(result.transferInfo).toBeUndefined();
    });
  });

  describe("platform-based transfer time", () => {
    it("uses 2min transfer when all arrivals are track 3", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B196S",
          ayaseDepartureTime: "09:02", // exactly 2min
          kitaAyaseArrivalTime: "09:05",
        }),
      ];

      const platformData: Record<string, string[]> = {
        "09:00": ["3番線"],
      };

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row],
        ayaseTimetable,
        platformData
      );

      expect(result.transferInfo).toBeDefined();
      expect(result.transferInfo!.label).toBe("綾瀬で0番線にのりかえ");
    });

    it("uses 3min transfer when arrival is not track 3", () => {
      const row = makeRow({
        trainNumber: "A1001S",
        destinationStationName: "Ayase",
        ayaseArrivalTime: "09:00",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B196S",
          ayaseDepartureTime: "09:02", // only 2min but needs 3min (non-track-3)
          kitaAyaseArrivalTime: "09:05",
        }),
      ];

      const platformData: Record<string, string[]> = {
        "09:00": ["2番線"],
      };

      const result = calculateTransferInfo(
        "for_kitaayase",
        "meijijinguumae",
        row,
        0,
        [row],
        ayaseTimetable,
        platformData
      );

      // 2min is insufficient when platform is not track 3 (needs 3min)
      expect(result.transferInfo).toBeUndefined();
    });
  });

  describe("4:00 AM boundary handling", () => {
    it("handles pre-4AM times correctly (wraps to next service day)", () => {
      const shuttle = makeRow({
        trainNumber: "A196S",
        ayaseArrivalTime: "03:50",
      });

      const ayaseTimetable = [
        makeRow({
          trainNumber: "B501S",
          originStationName: "Ayase",
          ayaseDepartureTime: "03:52",
        }),
      ];

      const result = calculateTransferInfo(
        "for_yoyogiuehara",
        "kitaayase",
        shuttle,
        0,
        [shuttle],
        ayaseTimetable,
        null
      );

      expect(result.hasAyaseConnection).toBe(true);
    });
  });
});
