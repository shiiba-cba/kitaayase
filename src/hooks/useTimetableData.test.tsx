// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTimetableData } from "./useTimetableData";
import { STORAGE_KEYS } from "../constants/storageKeys";

function row(partial: Partial<Record<string, string | null>> = {}) {
  return {
    trainNumber: "A100",
    type: "Local",
    destinationStationName: "KitaAyase",
    originStationName: "Ayase",
    originDepartureTime: "05:00",
    stationName: "Otemachi",
    stationDepartureTime: "05:10",
    stationArrivalTime: "05:09",
    destinationArrivalTime: "05:30",
    kitaAyaseArrivalTime: "05:30",
    kitaAyaseDepartureTime: "05:00",
    ayaseArrivalTime: "05:02",
    ayaseDepartureTime: "05:03",
    yoyogiUeharaArrivalTime: null,
    yoyogiUeharaDepartureTime: null,
    ...partial,
  };
}

function mockJson(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: async () => data,
    status: ok ? 200 : 500,
  });
}

describe("useTimetableData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("loads timetable + platform maps and triggers initial scroll", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/latest.json")) {
        return mockJson({ diagramDate: "2099-01-01" }) as never;
      }
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/otemachi.json")) {
        return mockJson([row()]) as never;
      }
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/ayase.json")) {
        return mockJson([row({ trainNumber: "A200" })]) as never;
      }
      if (url.includes("yahoo-platform-kitasenju-ayase")) {
        return mockJson({ rows: [{ arrivalTime: "05:02", arrivalPlatform: "3番線" }] }) as never;
      }
      if (url.includes("yahoo-platform-ayase-kitasenju")) {
        return mockJson({ rows: [{ departureTime: "05:03", departurePlatform: "2番線" }] }) as never;
      }
      if (url.includes("yahoo-platform-ayase-kitaayase")) {
        return mockJson({ rows: [{ departureTime: "05:03", departurePlatform: "3番線" }] }) as never;
      }
      return mockJson({}, false) as never;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const setScrollTrigger = vi.fn() as unknown as Dispatch<SetStateAction<number>>;
    const scrollRequestRef = { current: false };
    const isInitialLoadRef = { current: true };

    const { result } = renderHook(() =>
      useTimetableData({
        calendar: "weekday",
        calendarReady: true,
        direction: "for_yoyogiuehara",
        stationKey: "otemachi",
        timetableReloadNonce: 0,
        setScrollTrigger,
        scrollRequestRef,
        isInitialLoadRef,
      })
    );

    await waitFor(() => {
      expect(result.current.rows.length).toBe(1);
    });

    expect(result.current.ayaseTimetable.length).toBe(1);
    expect(result.current.ayaseArrivalPlatformsByTime?.["05:02"]).toEqual(["3番線"]);
    expect(result.current.ayaseDeparturePlatformsByTime?.["05:03"]).toEqual(["2番線"]);
    expect(result.current.ayaseToKitaAyaseDeparturePlatformsByTime?.["05:03"]).toEqual(["3番線"]);

    expect(setScrollTrigger).toHaveBeenCalledTimes(1);
    expect(isInitialLoadRef.current).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("falls back to cached latest diagramDate when latest.json fails", async () => {
    localStorage.setItem(
      STORAGE_KEYS.latestDiagramDate,
      JSON.stringify({ diagramDate: "2099-01-02", fetchedAt: Date.now() - 60_000 })
    );

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/latest.json")) {
        return mockJson({}, false) as never;
      }
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/otemachi.json")) {
        return mockJson([row({ trainNumber: "B100" })]) as never;
      }
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/ayase.json")) {
        return mockJson([]) as never;
      }
      if (url.includes("yahoo-platform")) {
        return mockJson({ rows: [] }) as never;
      }
      return mockJson({}, false) as never;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() =>
      useTimetableData({
        calendar: "weekday",
        calendarReady: true,
        direction: "for_yoyogiuehara",
        stationKey: "otemachi",
        timetableReloadNonce: 0,
        setScrollTrigger: vi.fn() as unknown as Dispatch<SetStateAction<number>>,
        scrollRequestRef: { current: false },
        isInitialLoadRef: { current: false },
      })
    );

    await waitFor(() => {
      expect(result.current.rows[0]?.trainNumber).toBe("B100");
    });
  });

  it("fetchTrainDetail returns true and stores detail", async () => {
    localStorage.setItem(
      STORAGE_KEYS.latestDiagramDate,
      JSON.stringify({ diagramDate: "2099-01-03", fetchedAt: Date.now() })
    );

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/otemachi.json")) {
        return mockJson([row()]) as never;
      }
      if (url.endsWith("/timetable/weekday/for_yoyogiuehara/ayase.json")) {
        return mockJson([]) as never;
      }
      if (url.includes("yahoo-platform")) {
        return mockJson({ rows: [] }) as never;
      }
      if (url.endsWith("/train/weekday/A100.json")) {
        return mockJson({ trainNumber: "A100", timetable: [] }) as never;
      }
      if (url.endsWith("/latest.json")) {
        return mockJson({ diagramDate: "2099-01-03" }) as never;
      }
      return mockJson({}, false) as never;
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { result } = renderHook(() =>
      useTimetableData({
        calendar: "weekday",
        calendarReady: true,
        direction: "for_yoyogiuehara",
        stationKey: "otemachi",
        timetableReloadNonce: 0,
        setScrollTrigger: vi.fn() as unknown as Dispatch<SetStateAction<number>>,
        scrollRequestRef: { current: false },
        isInitialLoadRef: { current: false },
      })
    );

    await waitFor(() => expect(result.current.rows.length).toBe(1));

    const ok = await result.current.fetchTrainDetail("A100");
    expect(ok).toBe(true);

    await waitFor(() => {
      expect((result.current.trainDetail as { trainNumber?: string } | null)?.trainNumber).toBe(
        "A100"
      );
    });
  });
});
