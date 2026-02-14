import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import type { TrainRow } from "../components/TrainCard";
import type { TrainDetail } from "../types/TrainDetail";
import type { DirectionKey } from "../utils/autoDirection";

function isAbortError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

const jsonCache = new Map<string, unknown>();
const jsonPromiseCache = new Map<string, Promise<unknown>>();
const MAX_JSON_CACHE_ENTRIES = 160;

const LATEST_CACHE_KEY = STORAGE_KEYS.latestDiagramDate;
const LATEST_CACHE_TTL_MS = 5 * 60 * 1000;

function touchJsonCache(key: string, value: unknown) {
  if (jsonCache.has(key)) jsonCache.delete(key);
  jsonCache.set(key, value);

  while (jsonCache.size > MAX_JSON_CACHE_ENTRIES) {
    const oldestKey = jsonCache.keys().next().value;
    if (!oldestKey) break;
    jsonCache.delete(oldestKey);
  }
}

async function fetchJsonCached<T>(url: string, init?: Omit<RequestInit, "signal">): Promise<T> {
  if (jsonCache.has(url)) {
    const cached = jsonCache.get(url) as T;
    touchJsonCache(url, cached);
    return Array.isArray(cached)
      ? ([...cached] as unknown as T)
      : typeof cached === "object" && cached !== null
      ? ({ ...cached } as T)
      : cached;
  }

  const cachedPromise = jsonPromiseCache.get(url);
  if (cachedPromise) return cachedPromise as Promise<T>;

  const p = fetch(url, init)
    .then((res) => {
      if (!res.ok) throw new Error(`failed to fetch: ${url}`);
      return res.json();
    })
    .then((data) => {
      touchJsonCache(url, data);
      return Array.isArray(data)
        ? ([...data] as unknown as T)
        : typeof data === "object" && data !== null
        ? ({ ...data } as T)
        : data;
    })
    .finally(() => {
      jsonPromiseCache.delete(url);
    });

  jsonPromiseCache.set(url, p);
  return p as Promise<T>;
}

async function fetchJsonNoStore<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`failed to fetch: ${url}`);
  return res.json();
}

function readLatestDiagramDateCache(): { diagramDate: string; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(LATEST_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { diagramDate?: string; fetchedAt?: number };
    if (!parsed.diagramDate || !parsed.fetchedAt) return null;

    return { diagramDate: parsed.diagramDate, fetchedAt: parsed.fetchedAt };
  } catch {
    return null;
  }
}

function writeLatestDiagramDateCache(diagramDate: string) {
  try {
    localStorage.setItem(
      LATEST_CACHE_KEY,
      JSON.stringify({ diagramDate, fetchedAt: Date.now() })
    );
  } catch {
    // noop
  }
}

type Params = {
  calendar: "weekday" | "holiday";
  calendarReady: boolean;
  direction: DirectionKey;
  stationKey: string;
  timetableReloadNonce: number;
  setScrollTrigger: Dispatch<SetStateAction<number>>;
  scrollRequestRef: MutableRefObject<boolean>;
  isInitialLoadRef: MutableRefObject<boolean>;
};

export function useTimetableData({
  calendar,
  calendarReady,
  direction,
  stationKey,
  timetableReloadNonce,
  setScrollTrigger,
  scrollRequestRef,
  isInitialLoadRef,
}: Params) {
  const [rows, setRows] = useState<TrainRow[]>([]);
  const [ayaseTimetable, setAyaseTimetable] = useState<TrainRow[]>([]);
  const [ayaseArrivalPlatformsByTime, setAyaseArrivalPlatformsByTime] =
    useState<Record<string, string[]> | null>(null);
  const [ayaseDeparturePlatformsByTime, setAyaseDeparturePlatformsByTime] =
    useState<Record<string, string[]> | null>(null);
  const [ayaseToKitaAyaseDeparturePlatformsByTime, setAyaseToKitaAyaseDeparturePlatformsByTime] =
    useState<Record<string, string[]> | null>(null);

  const [trainDetail, setTrainDetail] = useState<TrainDetail | null>(null);
  const trainDetailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!calendarReady) return;

    const controller = new AbortController();
    const base = "/kitaayase/data";

    (async () => {
      try {
        const latestCache = readLatestDiagramDateCache();
        const latestIsFresh =
          !!latestCache && Date.now() - latestCache.fetchedAt < LATEST_CACHE_TTL_MS;

        let diagramDate = latestIsFresh ? latestCache.diagramDate : null;

        if (!diagramDate) {
          try {
            const latest = await fetchJsonNoStore<{ diagramDate: string }>(
              `${base}/latest.json`,
              controller.signal
            );
            diagramDate = latest.diagramDate;
            writeLatestDiagramDateCache(diagramDate);
          } catch {
            if (latestCache?.diagramDate) {
              diagramDate = latestCache.diagramDate;
            } else {
              throw new Error("latest.json fetch failed");
            }
          }
        }

        if (!diagramDate) throw new Error("diagramDate unavailable");

        const url = `${base}/${diagramDate}/timetable/${calendar}/${direction}/${stationKey}.json`;
        const ayaseUrl =
          direction === "for_yoyogiuehara" || direction === "for_kitaayase"
            ? `${base}/${diagramDate}/timetable/${calendar}/${direction}/ayase.json`
            : null;
        const platformUrl = `${base}/${diagramDate}/yahoo-platform-kitasenju-ayase/${calendar}.json`;
        const departurePlatformUrl = `${base}/${diagramDate}/yahoo-platform-ayase-kitasenju/${calendar}.json`;
        const toKitaAyaseDeparturePlatformUrl = `${base}/${diagramDate}/yahoo-platform-ayase-kitaayase/${calendar}.json`;

        const [data, ayaseData, platformJson, departurePlatformJson, toKitaAyasePlatformJson] =
          await Promise.all([
            fetchJsonCached<TrainRow[]>(url, { cache: "force-cache" }),
            ayaseUrl
              ? fetchJsonCached<TrainRow[]>(ayaseUrl, { cache: "force-cache" }).catch(() => [])
              : Promise.resolve([]),
            fetchJsonCached<{ rows?: Array<{ arrivalTime?: string; arrivalPlatform?: string }> }>(
              platformUrl,
              { cache: "force-cache" }
            ).catch(() => ({ rows: [] })),
            fetchJsonCached<{
              rows?: Array<{ departureTime?: string; departurePlatform?: string }>;
            }>(departurePlatformUrl, { cache: "force-cache" }).catch(() => ({ rows: [] })),
            fetchJsonCached<{
              rows?: Array<{ departureTime?: string; departurePlatform?: string }>;
            }>(toKitaAyaseDeparturePlatformUrl, { cache: "force-cache" }).catch(() => ({ rows: [] })),
          ]);

        if (controller.signal.aborted) return;

        const arrivalByTime: Record<string, string[]> = {};
        const aRows = Array.isArray(platformJson?.rows) ? platformJson.rows : [];
        for (const r of aRows) {
          if (r?.arrivalTime && r?.arrivalPlatform) {
            if (!arrivalByTime[r.arrivalTime]) arrivalByTime[r.arrivalTime] = [];
            arrivalByTime[r.arrivalTime].push(r.arrivalPlatform);
          }
        }

        const departureByTime: Record<string, string[]> = {};
        const dRows = Array.isArray(departurePlatformJson?.rows) ? departurePlatformJson.rows : [];
        for (const r of dRows) {
          if (r?.departureTime && r?.departurePlatform) {
            if (!departureByTime[r.departureTime]) departureByTime[r.departureTime] = [];
            departureByTime[r.departureTime].push(r.departurePlatform);
          }
        }

        const toKitaAyaseByTime: Record<string, string[]> = {};
        const tkRows = Array.isArray(toKitaAyasePlatformJson?.rows)
          ? toKitaAyasePlatformJson.rows
          : [];
        for (const r of tkRows) {
          if (r?.departureTime && r?.departurePlatform) {
            if (!toKitaAyaseByTime[r.departureTime]) toKitaAyaseByTime[r.departureTime] = [];
            toKitaAyaseByTime[r.departureTime].push(r.departurePlatform);
          }
        }

        setAyaseTimetable(ayaseData);
        setAyaseArrivalPlatformsByTime(arrivalByTime);
        setAyaseDeparturePlatformsByTime(departureByTime);
        setAyaseToKitaAyaseDeparturePlatformsByTime(toKitaAyaseByTime);
        setRows(data);

        if (isInitialLoadRef.current || scrollRequestRef.current) {
          setScrollTrigger((v) => v + 1);
          isInitialLoadRef.current = false;
          scrollRequestRef.current = false;
        }
      } catch (e) {
        if (controller.signal.aborted) return;
        console.error("[Fetch] Error loading data:", e);
        setRows([]);
        setAyaseTimetable([]);
        setAyaseArrivalPlatformsByTime(null);
        setAyaseDeparturePlatformsByTime(null);
      }
    })();

    return () => controller.abort();
  }, [
    calendar,
    calendarReady,
    direction,
    stationKey,
    timetableReloadNonce,
    setScrollTrigger,
    scrollRequestRef,
    isInitialLoadRef,
  ]);

  useEffect(() => {
    trainDetailAbortRef.current?.abort();
  }, [calendar]);

  const fetchTrainDetail = useCallback(
    async (trainNumber: string) => {
      trainDetailAbortRef.current?.abort();
      const controller = new AbortController();
      trainDetailAbortRef.current = controller;

      const base = "/kitaayase/data";

      try {
        const latestCache = readLatestDiagramDateCache();
        const latestIsFresh =
          !!latestCache && Date.now() - latestCache.fetchedAt < LATEST_CACHE_TTL_MS;

        let diagramDate = latestIsFresh ? latestCache.diagramDate : null;

        if (!diagramDate) {
          const latest = await fetchJsonNoStore<{ diagramDate: string }>(
            `${base}/latest.json`,
            controller.signal
          );
          diagramDate = latest.diagramDate;
          writeLatestDiagramDateCache(diagramDate);
        }

        if (!diagramDate) throw new Error("diagramDate unavailable");

        const url = `${base}/${diagramDate}/train/${calendar}/${trainNumber}.json`;

        const data = await fetchJsonCached<TrainDetail>(url, {
          cache: "force-cache",
        });

        if (controller.signal.aborted) return false;

        setTrainDetail(data);
        return true;
      } catch (e: unknown) {
        if (isAbortError(e)) return false;
        setTrainDetail(null);
        return false;
      }
    },
    [calendar]
  );

  return {
    rows,
    ayaseTimetable,
    ayaseArrivalPlatformsByTime,
    ayaseDeparturePlatformsByTime,
    ayaseToKitaAyaseDeparturePlatformsByTime,
    trainDetail,
    setTrainDetail,
    fetchTrainDetail,
  };
}
