import {
  Box,
  Flex,
  Button,
  VStack,
  HStack,
  IconButton,
  Text,
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { LuArrowLeftRight, LuX } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import type { TrainRow } from "./components/TrainCard";
import { selectStations } from "./data/selectStations";
import { StationLargeLabel } from "./components/StationLargeLabel";
import type { TrainDetail } from "./types/TrainDetail";
import { StationSmallLabel } from "./components/StationSmallLabel";
import { FONT_JP, FONT_NUM } from "./styles/fonts";
import { OperationInfoBanner } from "./components/OperationInfoBanner";
import type { OperationInfo } from "./types/OperationInfo";
import type { OperationVisualState } from "./types/OperationVisualState";
import { useCalendar } from "./hooks/useCalendar";
import {
  formatRelativeTime,
  toJaStationName,
  getTrainTypeInfo,
  isThreeCars,
  formatTimeNoLeadingZero,
  getThroughLineColorForStationKey,
} from "./utils/trainUtils";
import { calculateTransferInfo } from "./utils/transferLogic";

function isAbortError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "name" in e &&
    (e as { name?: unknown }).name === "AbortError"
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const CHIYODA_GREEN = "#00bb85";

const jsonCache = new Map<string, unknown>();
const jsonPromiseCache = new Map<string, Promise<unknown>>();
const MAX_JSON_CACHE_ENTRIES = 160;

const LATEST_CACHE_KEY = "kitaayase:latestDiagramDate:v1";
const LATEST_CACHE_TTL_MS = 5 * 60 * 1000;

function touchJsonCache(key: string, value: unknown) {
  if (jsonCache.has(key)) {
    jsonCache.delete(key);
  }
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
    return cached;
  }

  const cachedPromise = jsonPromiseCache.get(url);
  if (cachedPromise) {
    return cachedPromise as Promise<T>;
  }

  const p = fetch(url, init)
    .then((res) => {
      if (!res.ok) throw new Error(`failed to fetch: ${url}`);
      return res.json();
    })
    .then((data) => {
      touchJsonCache(url, data);
      return data;
    })
    .finally(() => {
      jsonPromiseCache.delete(url);
    });

  jsonPromiseCache.set(url, p);
  return p as Promise<T>;
}

async function fetchJsonNoStore<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(`failed to fetch: ${url}`);
  return res.json();
}

function readLatestDiagramDateCache(): { diagramDate: string; fetchedAt: number } | null {
  try {
    const raw = localStorage.getItem(LATEST_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      diagramDate?: string;
      fetchedAt?: number;
    };

    if (!parsed.diagramDate || !parsed.fetchedAt) return null;

    return {
      diagramDate: parsed.diagramDate,
      fetchedAt: parsed.fetchedAt,
    };
  } catch {
    return null;
  }
}

function writeLatestDiagramDateCache(diagramDate: string) {
  try {
    localStorage.setItem(
      LATEST_CACHE_KEY,
      JSON.stringify({
        diagramDate,
        fetchedAt: Date.now(),
      })
    );
  } catch {
    // noop
  }
}

/* ==================================================
 * 運行情報の見出し取得
 * ================================================== */
function getOperationTitle(text: string): string {
  if (text.includes("運転を見合わせ")) {
    return "運転見合わせ";
  }

  if (text.includes("折返し運転")) {
    return "折返し運転";
  }

  if (text.includes("運転を再開")) {
    return text.includes("ダイヤが乱れ") ? "運転再開・ダイヤ乱れ" : "運転再開";
  }

  if (text.includes("直通運転を中止")) {
    return "直通運転中止";
  }

  if (text.includes("直通運転を再開")) {
    return "直通運転再開";
  }

  if (text.includes("運休")) {
    // 列車名があれば拾う
    const m = text.match(/(メトロ[^\s、。]+号)/);
    return m ? `${m[1]}運休` : "列車運休";
  }

  if (text.includes("一部の列車に遅れ")) {
    return "一部列車遅延";
  }

  if (text.includes("ダイヤが乱れ")) {
    return "ダイヤ乱れ";
  }

  if (text.includes("平常どおり運転")) {
    return "平常運転";
  }

  return "運行情報";
}

function getOperationVisualState(text: string): OperationVisualState {
  // 最優先：運転見合わせ
  if (text.includes("運転を見合わせ")) {
    return "suspended";
  }

  // 明確に「平常」
  if (text.includes("平常どおり運転")) {
    return "normal";
  }

  // 再開だが乱れあり
  if (text.includes("運転を再開") && text.includes("ダイヤが乱れ")) {
    return "delay";
  }

  // 遅延・乱れ系
  if (
    text.includes("ダイヤが乱れ") ||
    text.includes("遅れ") ||
    text.includes("運休") ||
    text.includes("折返し運転") ||
    text.includes("直通運転を中止")
  ) {
    return "delay";
  }

  // それ以外は無難に normal
  return "normal";
}

function parseOperationInfo(text: string) {
  return {
    title: getOperationTitle(text),
    state: getOperationVisualState(text),
  };
}

export function App() {
  const [stationKey, setStationKey] = useState<string>(() => {
    return localStorage.getItem("stationKey") || "otemachi";
  });
  const [direction, setDirection] = useState<"for_yoyogiuehara" | "for_kitaayase">(() => {
    const savedStationKey = localStorage.getItem("stationKey") || "otemachi";
    if (savedStationKey === "kitaayase") {
      return "for_yoyogiuehara";
    }

    const saved = localStorage.getItem("direction");
    if (saved === "for_yoyogiuehara" || saved === "for_kitaayase") {
      return saved;
    }
    return "for_yoyogiuehara";
  });

  const {
    calendar,
    onCalendarChange: baseOnCalendarChange,
    detectCalendarForNow,
  } = useCalendar();

  const [rows, setRows] = useState<TrainRow[]>([]);
  const isInitialLoadRef = useRef(true);
  const [ayaseTimetable, setAyaseTimetable] = useState<TrainRow[]>([]);
  const [ayaseArrivalPlatformsByTime, setAyaseArrivalPlatformsByTime] = useState<Record<string, string[]> | null>(null);
  const [ayaseDeparturePlatformsByTime, setAyaseDeparturePlatformsByTime] = useState<Record<string, string[]> | null>(null);

  const rowsWithConnection = useMemo(() => {
    return rows.map((row, index) => {
      const { hasAyaseConnection, transferInfo } = calculateTransferInfo(
        direction,
        stationKey,
        row,
        index,
        rows,
        ayaseTimetable,
        ayaseArrivalPlatformsByTime
      );

      const platforms = row.ayaseArrivalTime
        ? ayaseArrivalPlatformsByTime?.[row.ayaseArrivalTime] ?? []
        : [];
      const isAyaseTrack3Only =
        platforms.length > 0 && platforms.every((p) => p === "3番線");

      const showAyaseTrack2Label =
        direction === "for_kitaayase" &&
        row.destinationStationName !== "KitaAyase" &&
        !!row.ayaseArrivalTime &&
        isAyaseTrack3Only;

      const departurePlatforms = row.ayaseDepartureTime
        ? ayaseDeparturePlatformsByTime?.[row.ayaseDepartureTime] ?? []
        : [];
      const isAyaseDepartureTrack2Only =
        departurePlatforms.length > 0 &&
        departurePlatforms.every((p) => p === "2番線");

      const showAyaseDepartureTrack2Label =
        direction === "for_yoyogiuehara" &&
        row.originStationName !== "KitaAyase" &&
        !!row.ayaseDepartureTime &&
        isAyaseDepartureTrack2Only;

      return {
        ...row,
        hasAyaseConnection,
        transferInfo,
        showAyaseTrack2Label,
        showAyaseDepartureTrack2Label,
      };
    });
  }, [rows, ayaseTimetable, ayaseArrivalPlatformsByTime, ayaseDeparturePlatformsByTime, direction, stationKey]);

  const [trainDetail, setTrainDetail] = useState<TrainDetail | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===== 運行情報 =====
  const [operationInfo, setOperationInfo] = useState<OperationInfo | null>(
    null
  );

  // ===== 運行情報 折りたたみ =====
  // デフォルトは折りたたみ（平常運転時にスッキリ見せる）
  const [isOperationOpen, setIsOperationOpen] = useState(false);

  // TrainCard refs
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const headerRef = useRef<HTMLDivElement | null>(null);

  // Sync refs map with rows
  useEffect(() => {
    // rows が変わったら一旦クリアして、無効な ref が残らないようにする
    cardRefs.current.clear();
  }, [rows]);

  const OPERATION_URL =
    "https://throbbing-dust-144d.kitaayase-worker.workers.dev";

  const operationAbortRef = useRef<AbortController | null>(null);
  const operationEtagRef = useRef<string | null>(null);

  const fetchOperationInfo = useCallback(
    async (opts?: { preserveOnError?: boolean; bustCache?: boolean }) => {
      // 連打・再取得で古いレスポンスが刺さらないようにする
      operationAbortRef.current?.abort();
      const controller = new AbortController();
      operationAbortRef.current = controller;

      try {
        const url = opts?.bustCache ? `${OPERATION_URL}?t=${Date.now()}` : OPERATION_URL;

        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: operationEtagRef.current
            ? {
                "If-None-Match": operationEtagRef.current,
              }
            : undefined,
        });

        if (res.status === 304) {
          return true;
        }

        if (!res.ok) throw new Error("failed to fetch operation info");

        const etag = res.headers.get("etag");
        if (etag) {
          operationEtagRef.current = etag;
        }

        const data: OperationInfo = await res.json();
        setOperationInfo(data);
        return true;
      } catch (e: unknown) {
        if (isAbortError(e)) return false;
        if (!opts?.preserveOnError) {
          setOperationInfo(null);
        }
        return false;
      }
    },
    []
  );

  const [timetableReloadNonce, setTimetableReloadNonce] = useState(0);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const handledScrollTriggerRef = useRef(0);
  const scrollRequestRef = useRef(false);

  // Wrap onCalendarChange to add custom logic (scroll to now, refresh operation info)
  const onCalendarChange = useCallback(
    async (
      target: "weekday" | "holiday",
      opts?: { skipOperationFetch?: boolean }
    ) => {
      // スクロール予約は先に立てる（fetch/再描画の競合で取りこぼさないため）
      scrollRequestRef.current = true;

      // 1. Fetch latest operation info
      if (!opts?.skipOperationFetch) {
        await fetchOperationInfo({ bustCache: true });
      }

      // 2. Set calendar first
      baseOnCalendarChange(target);

      // 3. Refresh timetable only when calendar value itself does not change
      // （同じボタン再押下や 4:00 境界リフレッシュ用途）
      if (target === calendar) {
        setTimetableReloadNonce((c) => c + 1);
      }

      // 4. Trigger scroll to now after load
      // （scrollRequestRef を使ってデータ取得完了後に scrollTrigger を進める）
    },
    [fetchOperationInfo, baseOnCalendarChange, calendar]
  );

  /* ==================================================
   * ② 運行情報取得（raw 直参照）
   * ================================================== */
  useEffect(() => {
    fetchOperationInfo();

    return () => {
      operationAbortRef.current?.abort();
    };
  }, [fetchOperationInfo]);

  // 運行情報が平常運転でない場合は自動で開く（重要情報の見逃し防止）
  // ※平常運転に戻ったときは自動で閉じない（ユーザー操作を尊重）
  useEffect(() => {
    if (!operationInfo) return;

    const state = getOperationVisualState(operationInfo.text);
    if (state !== "normal") {
      setIsOperationOpen(true);
    }
  }, [operationInfo]);

  // 永続化
  useEffect(() => {
    localStorage.setItem("direction", direction);
  }, [direction]);

  useEffect(() => {
    localStorage.setItem("stationKey", stationKey);
  }, [stationKey]);

  /* ==================================================
   * ③ 時刻表 JSON 読み込み
   * ================================================== */
  useEffect(() => {
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
            // latest 取得失敗時はキャッシュにフォールバック
            if (latestCache?.diagramDate) {
              diagramDate = latestCache.diagramDate;
            } else {
              throw new Error("latest.json fetch failed");
            }
          }
        }

        if (!diagramDate) throw new Error("diagramDate unavailable");

        const url = `${base}/${diagramDate}/timetable/${calendar}/${direction}/${stationKey}.json`;

        const data = await fetchJsonCached<TrainRow[]>(url, {
          cache: "force-cache",
        });

        if (controller.signal.aborted) return;

        setRows(data);
        if (isInitialLoadRef.current || scrollRequestRef.current) {
          setScrollTrigger((v) => v + 1);
          isInitialLoadRef.current = false;
          scrollRequestRef.current = false;
        }

        // 綾瀬始発のりかえ判定用に、綾瀬駅の時刻表（同方面）を並行して取得
        if (direction === "for_yoyogiuehara" || direction === "for_kitaayase") {
          const ayaseUrl = `${base}/${diagramDate}/timetable/${calendar}/${direction}/ayase.json`;
          fetchJsonCached<TrainRow[]>(ayaseUrl, {
            cache: "force-cache",
          })
            .then((d) => {
              if (controller.signal.aborted) return;
              setAyaseTimetable(d);
            })
            .catch(() => {
              if (controller.signal.aborted) return;
              setAyaseTimetable([]);
            });
        } else {
          setAyaseTimetable([]);
        }

        // 綾瀬到着番線データ（あれば利用、なければ null）
        const platformUrl = `${base}/${diagramDate}/yahoo-ayase-platform/${calendar}.json`;
        fetchJsonCached<{ rows?: Array<{ arrivalTime?: string; arrivalPlatform?: string }> }>(platformUrl, {
          cache: "force-cache",
        })
          .then((j) => {
            if (controller.signal.aborted) return;
            const byTime: Record<string, string[]> = {};
            const rows = Array.isArray(j?.rows) ? j.rows : [];
            for (const r of rows) {
              const t = r?.arrivalTime;
              const p = r?.arrivalPlatform;
              if (!t || !p) continue;
              if (!byTime[t]) byTime[t] = [];
              byTime[t].push(p);
            }
            setAyaseArrivalPlatformsByTime(byTime);
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setAyaseArrivalPlatformsByTime(null);
          });

        // 綾瀬発番線データ（あれば利用、なければ null）
        const departurePlatformUrl = `${base}/${diagramDate}/yahoo-ayase-departure-platform/${calendar}.json`;
        fetchJsonCached<{ rows?: Array<{ departureTime?: string; departurePlatform?: string }> }>(departurePlatformUrl, {
          cache: "force-cache",
        })
          .then((j) => {
            if (controller.signal.aborted) return;
            const byTime: Record<string, string[]> = {};
            const rows = Array.isArray(j?.rows) ? j.rows : [];
            for (const r of rows) {
              const t = r?.departureTime;
              const p = r?.departurePlatform;
              if (!t || !p) continue;
              if (!byTime[t]) byTime[t] = [];
              byTime[t].push(p);
            }
            setAyaseDeparturePlatformsByTime(byTime);
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setAyaseDeparturePlatformsByTime(null);
          });
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setAyaseTimetable([]);
        setAyaseArrivalPlatformsByTime(null);
        setAyaseDeparturePlatformsByTime(null);
      }
    })();

    return () => controller.abort();
  }, [calendar, direction, stationKey, timetableReloadNonce]);

  const METRO_GREEN = "#00bb85";
  const METRO_RED = "#f62e36";
  const themeColor = calendar === "holiday" ? METRO_RED : METRO_GREEN;

  /* ==================================================
   * ④ 現在時刻へスクロール
   * ================================================== */
  const scrollToNow = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (rows.length === 0) return;

      const now = new Date();
      let currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < 240) currentMinutes += 1440;

      const targetIndex = rows.findIndex((row) => {
        const t =
          direction === "for_yoyogiuehara"
            ? row.kitaAyaseDepartureTime
            : row.stationDepartureTime;
        
        if (!t) return false;

        const [h, m] = t.split(":").map(Number);
        let trainMinutes = h * 60 + m;
        if (trainMinutes < 240) trainMinutes += 1440;

        return trainMinutes >= currentMinutes;
      });

      const index = targetIndex !== -1 ? targetIndex : rows.length - 1;
      const el = cardRefs.current.get(index);
      if (!el) return;

      const headerHeight = headerRef.current?.offsetHeight ?? 0;

      // 要素の絶対座標を計算して、ヘッダー分だけ引いた位置にスクロール
      const rect = el.getBoundingClientRect();
      const absoluteTop = window.pageYOffset + rect.top;
      const targetY = absoluteTop - headerHeight - 8;

      window.scrollTo({
        top: targetY,
        behavior
      });
    },
    [rows, direction]
  );

  // ===== 復帰時リフレッシュ（5分以上経過なら初回起動相当） =====
  const backgroundedAtRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const refreshOnResume = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      console.warn("[Resume] Triggering refresh...");
      // モーダルを閉じる（初回起動相当）
      setIsModalOpen(false);
      setTrainDetail(null);

      // 平日/休日を現在日時で上書き
      const detected = await detectCalendarForNow();
      await onCalendarChange(detected, { skipOperationFetch: true });

      // ダイヤ/運行情報を取り直し
      // スクロール予約は onCalendarChange 内で設定済み

      // 運行情報は復帰直後に失敗しがちなので、キャッシュバスター + リトライ
      // 取得失敗でも前回表示を消さない（ネットワーク復帰直後で落ちやすい）
      const backoffMs = [0, 1000, 3000];
      for (const ms of backoffMs) {
        if (ms) await sleep(ms);
        const ok = await fetchOperationInfo({
          preserveOnError: true,
          bustCache: true,
        });
        if (ok) break;
      }
    } finally {
      refreshingRef.current = false;
    }
  }, [detectCalendarForNow, onCalendarChange, fetchOperationInfo]);

  useEffect(() => {
    const THRESHOLD_MS = 5 * 60 * 1000;

    const onHidden = () => {
      // 既に背景にいる場合は上書きしない（最初の隠れた時間を保持）
      if (backgroundedAtRef.current === null) {
        backgroundedAtRef.current = Date.now();
      }
    };

    const onVisible = () => {
      const bgAt = backgroundedAtRef.current;
      if (bgAt === null) return;
      
      const elapsed = Date.now() - bgAt;
      console.warn(`[Resume] Visibility changed to visible. Elapsed: ${Math.floor(elapsed / 1000)}s`);
      
      // 判定が終わったらクリア
      backgroundedAtRef.current = null;

      if (elapsed >= THRESHOLD_MS) {
        console.warn("[Resume] Threshold exceeded. Refreshing...");
        refreshOnResume();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        onHidden();
      } else {
        onVisible();
      }
    };

    // iOS/Android PWA 等では blur/focus だけだと不十分な場合があるため
    // visibilitychange を主軸にしつつ、補完的に window focus も拾う
    window.addEventListener("blur", onHidden);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("blur", onHidden);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshOnResume]);

  const currentStationName = selectStations[stationKey as keyof typeof selectStations] || stationKey;

  const trainDetailAbortRef = useRef<AbortController | null>(null);

  // calendar 切替時に、進行中の詳細取得が旧calendarで刺さらないように abort
  useEffect(() => {
    trainDetailAbortRef.current?.abort();
  }, [calendar]);

  const fetchTrainDetail = async (trainNumber: string) => {
    // 連打で古いレスポンスが刺さらないようにする
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
      // ここは UI 側で null 許容のはずなので握りつぶし
      setTrainDetail(null);
      return false;
    }
  };

  useEffect(() => {
    if (rows.length === 0) return;
    if (scrollTrigger === handledScrollTriggerRef.current) return;

    // 100ms is often enough, but for initial load or slow devices,
    // we add a slightly longer delay or verify refs are ready.
    const timer = setTimeout(() => {
      // Double check refs are populated
      if (cardRefs.current.size >= rows.length) {
        scrollToNow("smooth");
        handledScrollTriggerRef.current = scrollTrigger;
      } else {
        // Retry once if refs aren't ready
        console.warn("[Scroll] Refs not ready, retrying...");
        setTimeout(() => {
          scrollToNow("smooth");
          handledScrollTriggerRef.current = scrollTrigger;
        }, 200);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [rows, scrollToNow, scrollTrigger]);

  const parsedOperationInfo = useMemo(() => {
    if (!operationInfo) return null;
    return parseOperationInfo(operationInfo.text);
  }, [operationInfo]);

  /* ==================================================
   * メインレンダリング
   * ================================================== */
  return (
    <>
      <Box bg="#111111" minH="100vh" color="white">
        {/* ===== 固定ヘッダー ===== */}
        <Box
          ref={headerRef}
          position="sticky"
          top="0"
          zIndex={1000}
          bg="#111111"
          borderBottom={`4px solid ${METRO_GREEN}`}
        >
          {/* ==== 運行情報 ==== */}
          {operationInfo && parsedOperationInfo && (
            <OperationInfoBanner
              operationInfo={operationInfo}
              parsed={parsedOperationInfo}
              isOpen={isOperationOpen}
              onToggle={() => setIsOperationOpen((v) => !v)}
              relativeText={formatRelativeTime(operationInfo.updatedAt)}
            />
          )}

          <VStack gap={4} pb={3} pt={3}>
            {/* ==== 方面 ==== */}
            <Flex w="100%" align="center">
              <Flex flex="1" justify="center">
                <StationLargeLabel
                  stationKey={
                    direction === "for_yoyogiuehara" ? "kitaayase" : stationKey
                  }
                  stationName={
                    direction === "for_yoyogiuehara"
                      ? "北綾瀬"
                      : currentStationName
                  }
                />
              </Flex>

              <IconButton
                aria-label="方向入れ替え"
                size="md"
                bg={METRO_GREEN}
                _hover={{ bg: METRO_GREEN }}
                onClick={() => {
                  setDirection(
                    direction === "for_yoyogiuehara"
                      ? "for_kitaayase"
                      : "for_yoyogiuehara"
                  );
                  scrollRequestRef.current = true;
                }}
              >
                <LuArrowLeftRight />
              </IconButton>

              <Flex flex="1" justify="center">
                <StationLargeLabel
                  stationKey={
                    direction === "for_yoyogiuehara" ? stationKey : "kitaayase"
                  }
                  stationName={
                    direction === "for_yoyogiuehara"
                      ? currentStationName
                      : "北綾瀬"
                  }
                />
              </Flex>
            </Flex>

            {/* ==== 駅選択 ==== */}
            <select
              style={{
                width: "90%",
                background: "#222",
                color: "white",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #444",
                fontFamily: FONT_JP,
              }}
              value={stationKey}
              onChange={(e) => {
                const newStationKey = e.target.value;
                const willChangeStation = newStationKey !== stationKey;
                const willChangeDirection =
                  newStationKey === "kitaayase" && direction !== "for_yoyogiuehara";

                if (willChangeStation || willChangeDirection) {
                  scrollRequestRef.current = true;
                }

                setStationKey(newStationKey);
                if (newStationKey === "kitaayase") {
                  setDirection("for_yoyogiuehara");
                }
              }}
            >
              {Object.entries(selectStations).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>

            {/* ==== 平日 / 休日 ==== */}
            <Flex w="100%" align="center">
              <Flex flex="1" justify="center"></Flex>

              <Flex flex="0" px={1}>
                <HStack gap={4}>
                  <Button
                    w="90px"
                    bg={calendar === "weekday" ? METRO_GREEN : "gray.700"}
                    _hover={{
                      bg: calendar === "weekday" ? METRO_GREEN : "gray.600",
                    }}
                    color="white"
                    onClick={() => onCalendarChange("weekday")}
                  >
                    平日
                  </Button>

                  <Button
                    w="90px"
                    bg={calendar === "holiday" ? METRO_RED : "gray.700"}
                    _hover={{
                      bg: calendar === "holiday" ? METRO_RED : "gray.600",
                    }}
                    color="white"
                    onClick={() => onCalendarChange("holiday")}
                  >
                    土・休日
                  </Button>
                </HStack>
              </Flex>

              <Flex flex="1" justify="center"></Flex>
            </Flex>
          </VStack>
        </Box>

        {/* ===== 時刻表一覧 ===== */}
        <VStack gap={4} w="100%" pt={2}>
          {rowsWithConnection.map((row, i) => (
            <TrainCard
              key={i}
              row={row}
              stationKey={stationKey}
              direction={direction}
              themeColor={themeColor}
              hasAyaseConnection={row.hasAyaseConnection}
              transferInfo={row.transferInfo}
              showAyaseTrack2Label={row.showAyaseTrack2Label}
              showAyaseDepartureTrack2Label={row.showAyaseDepartureTrack2Label}
              onClick={async () => {
                const ok = await fetchTrainDetail(row.trainNumber);
                if (ok) {
                  setIsModalOpen(true);
                }
              }}
              ref={(el) => {
                cardRefs.current.set(i, el);
              }}
            />
          ))}
        </VStack>
      </Box>

      <DialogRoot
        open={isModalOpen}
        onOpenChange={(e) => setIsModalOpen(e.open)}
        closeOnInteractOutside
        closeOnEscape
      >
        <DialogBackdrop />

        <DialogPositioner>
          <DialogContent
            bg="#111"
            color="white"
            maxH="90dvh" // 画面に収める
            display="flex"
            flexDirection="column"
            position="relative"
            fontFamily={FONT_JP}
          >
            {/* ×ボタン */}
            <DialogCloseTrigger asChild>
              <IconButton
                aria-label="close"
                tabIndex={-1}
                position="absolute"
                top="3"
                right="3"
                zIndex={10}
                minW="40px"
                minH="40px"
                borderRadius="full"
                color="white"
                onClick={() => setIsModalOpen(false)}
                userSelect="none"
                WebkitUserSelect="none"
                touchAction="manipulation"
                _hover={{ bg: "whiteAlpha.300" }}
                _active={{ bg: "whiteAlpha.400" }}
              >
                <LuX size={18} />
              </IconButton>
            </DialogCloseTrigger>

            {/* ヘッダー（固定） */}
            <DialogHeader borderBottom="1px solid" borderColor="whiteAlpha.300">
              <VStack align="start" gap={2}>
                <DialogTitle>
                  <HStack gap={2} align="center">
                    {/* 列車番号 */}
                    <Box height="32px" display="flex" alignItems="center">
                      <Text
                        fontSize="md"
                        fontWeight="600"
                        fontFamily={FONT_NUM}
                        fontVariantNumeric="tabular-nums"
                        fontFeatureSettings="'tnum' 1"
                      >
                        {trainDetail?.trainNumber}
                      </Text>
                    </Box>

                    {/* 種別 */}
                    {trainDetail?.trainType &&
                      (() => {
                        const t = getTrainTypeInfo(trainDetail.trainType);
                        return (
                          t && (
                            <Box
                              height="32px"
                              px={2}
                              borderRadius="md"
                              bg={t.bg}
                              color="white"
                              fontSize="xs"
                              fontWeight="600"
                              fontFamily={FONT_JP}
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                              textAlign="center"
                              lineHeight="1.2"
                            >
                              {t.label === "各駅停車" ? (
                                <>
                                  各駅
                                  <br />
                                  停車
                                </>
                              ) : (
                                t.label
                              )}
                            </Box>
                          )
                        );
                      })()}

                    {/* 行先 */}
                    <StationLargeLabel
                      stationKey={
                        trainDetail?.destinationStation.toLowerCase() || ""
                      }
                      stationName={toJaStationName(
                        trainDetail?.destinationStation
                      )}
                    />

                    {/* 3両 */}
                    {isThreeCars(trainDetail?.trainNumber) && (
                      <Box
                        height="32px"
                        px={2}
                        borderRadius="md"
                        bg="#808080"
                        color="white"
                        fontSize="xs"
                        fontWeight="600"
                        fontFamily={FONT_JP}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        lineHeight="1"
                      >
                        3両
                      </Box>
                    )}
                  </HStack>
                </DialogTitle>

                {/* 始発駅 → 終着駅 */}
                <HStack gap={3} flexWrap="wrap" align="center">
                  <StationSmallLabel
                    stationKey={
                      trainDetail?.originStation.toLowerCase() || "odakyu"
                    }
                    highlight={false}
                  />

                  <Box height="24px" display="flex" alignItems="center">
                    <Text fontSize="sm" opacity={0.9}>
                      →
                    </Text>
                  </Box>

                  <StationSmallLabel
                    stationKey={
                      trainDetail?.destinationStation.toLowerCase() || ""
                    }
                    highlight={false}
                  />
                </HStack>
              </VStack>
            </DialogHeader>

            {/* 本文（ここだけスクロール） */}
            <DialogBody flex="1" overflowY="auto" py={3}>
              <VStack align="stretch" gap={0}>
                {trainDetail?.timetable.map((t, i) => {
                  const isCurrent = t.station.toLowerCase() === stationKey;

                  const lastIndex = (trainDetail?.timetable.length ?? 1) - 1;

                  // 直通線（小田急 / 常磐緩行）を最初/最後にだけ色付きで表示
                  const topExtraColor =
                    i === 0
                      ? getThroughLineColorForStationKey(
                          trainDetail?.originStation,
                          { treatMissingAsOdakyu: true }
                        )
                      : null;

                  const bottomExtraColor =
                    i === lastIndex
                      ? getThroughLineColorForStationKey(trainDetail?.destinationStation)
                      : null;

                  return (
                    <Flex
                      key={i}
                      px={3}
                      py={2}
                      borderRadius="md"
                      bg={isCurrent ? "whiteAlpha.200" : "transparent"}
                      justify="space-between"
                      align="center" // ← 重要
                    >
                      <StationSmallLabel
                        stationKey={t.station.toLowerCase()}
                        highlight={isCurrent}
                        connectorColor={CHIYODA_GREEN}
                        showTopConnector={i !== 0 || !!topExtraColor}
                        showBottomConnector={i !== lastIndex || !!bottomExtraColor}
                        topConnectorColor={topExtraColor ?? undefined}
                        bottomConnectorColor={bottomExtraColor ?? undefined}
                      />

                      <Box
                        height="24px" // ← StationStopLabel と揃える
                        display="flex"
                        alignItems="center"
                      >
                        <Text
                          fontFamily={FONT_NUM}
                          fontVariantNumeric="tabular-nums"
                          fontFeatureSettings="'tnum' 1"
                        >
                          {t.arrivalTime && (
                            <>{formatTimeNoLeadingZero(t.arrivalTime)}着</>
                          )}
                          {t.departureTime && (
                            <>{formatTimeNoLeadingZero(t.departureTime)}発</>
                          )}
                          {!t.arrivalTime &&
                            !t.departureTime &&
                            direction === "for_yoyogiuehara" && <>--:--着</>}
                          {!t.arrivalTime &&
                            !t.departureTime &&
                            direction === "for_kitaayase" && <>--:--発</>}
                        </Text>
                      </Box>
                    </Flex>
                  );
                })}
              </VStack>
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
