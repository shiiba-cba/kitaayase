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

/* (moved) OperationInfo type is now in src/types/OperationInfo.ts */

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

// (moved) OperationVisualState type is now in src/types/OperationVisualState.ts

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

/* ==================================================
 * 相対時間表示
 * ================================================== */
function formatRelativeTime(dateString: string): string {
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

export function App() {
  const [direction, setDirection] = useState<"for_yoyogiuehara" | "for_kitaayase">(
    (localStorage.getItem("direction") as "for_yoyogiuehara" | "for_kitaayase") || "for_yoyogiuehara"
  );
  const [stationKey, setStationKey] = useState<string>(
    localStorage.getItem("stationKey") || "kitaayase"
  );

  const {
    calendar,
    onCalendarChange: baseOnCalendarChange,
    detectCalendarForNow,
  } = useCalendar();

  const [rows, setRows] = useState<TrainRow[]>([]);
  const [ayaseTimetable, setAyaseTimetable] = useState<TrainRow[]>([]);

  const rowsWithConnection = useMemo(() => {
    return rows.map((row, index) => {
      let hasAyaseConnection = false;
      let transferInfo: { label: string; color: string } | undefined = undefined;

      // Old connection logic for for_yoyogiuehara
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

          return diff >= 3 && diff <= 5;
        });
      }

      // New complex transfer logic for for_kitaayase
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

          // 1. Find the earliest Kita-Ayase bound train (B) that starts from Ayase ('96S') 
          //    and is reachable from (A) with >= 3 mins transfer time.
          const reachableShuttle = ayaseTimetable.find((conn) => {
            if (!conn.trainNumber.includes("96S")) return false;
            if (!conn.ayaseDepartureTime) return false;

            const [depH, depM] = conn.ayaseDepartureTime.split(":").map(Number);
            let depTotal = depH * 60 + depM;
            if (depTotal < 240) depTotal += 1440;

            const diff = depTotal - arrTotal;
            return diff >= 3;
          });

          // 2. Find the earliest Kita-Ayase bound train (C) that is a direct through train (10-car) 
          //    and departs from the CURRENT station after (A).
          const nextThroughTrain = rows.slice(index + 1).find((r) => 
            r.destinationStationName === "KitaAyase" && !r.trainNumber.includes("96S")
          );

          // 3. Comparison
          if (reachableShuttle) {
            // (B) exists
            if (!nextThroughTrain) {
              // (C) does not exist
              transferInfo = { label: "綾瀬で0番線にのりかえ", color: "#ff7f00" };
            } else {
              // (C) exists, compare arrival times at Kita-Ayase
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
            // (B) does not exist, but (C) exists
            transferInfo = { label: "後続の北綾瀬行まち", color: "#ff7f00" };
          }
        }
      }

      return { ...row, hasAyaseConnection, transferInfo };
    });
  }, [rows, ayaseTimetable, direction, stationKey]);

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
        });
        if (!res.ok) throw new Error("failed to fetch operation info");
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

  // Wrap onCalendarChange to add custom logic (scroll to now, refresh operation info)
  const onCalendarChange = useCallback(
    async (target: "weekday" | "holiday") => {
      // 1. Fetch latest operation info
      await fetchOperationInfo({ bustCache: true });

      // 2. Refresh timetable if date boundary (4 AM) was crossed
      // This is handled via setTimetableReloadNonce which triggers useEffect for rows
      setTimetableReloadNonce((c) => c + 1);

      // 3. Set calendar (via the original onCalendarChange)
      baseOnCalendarChange(target);

      // 4. Trigger scroll to now after load
      setShouldScrollAfterLoad(true);
    },
    [fetchOperationInfo, baseOnCalendarChange]
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

  const [timetableReloadNonce, setTimetableReloadNonce] = useState(0);
  const [shouldScrollAfterLoad, setShouldScrollAfterLoad] = useState(false);

  /* ==================================================
   * ③ 時刻表 JSON 読み込み
   * ================================================== */
  useEffect(() => {
    const controller = new AbortController();
    const base = "/kitaayase/data";

    (async () => {
      try {
        const diagramDate = await fetch(`${base}/latest.json`, {
          signal: controller.signal,
        })
          .then((res) => res.json())
          .then((j) => j.diagramDate);

        const url = `${base}/${diagramDate}/timetable/${calendar}/${direction}/${stationKey}.json`;

        const data: TrainRow[] = await fetch(url, {
          signal: controller.signal,
        }).then((res) => res.json());

        setRows(data);

        // 綾瀬始発のりかえ判定用に、綾瀬駅の時刻表（同方面）を並行して取得
        if (direction === "for_yoyogiuehara" || direction === "for_kitaayase") {
          const ayaseUrl = `${base}/${diagramDate}/timetable/${calendar}/${direction}/ayase.json`;
          fetch(ayaseUrl, { signal: controller.signal })
            .then((res) => res.json())
            .then((d) => setAyaseTimetable(d))
            .catch(() => setAyaseTimetable([]));
        } else {
          setAyaseTimetable([]);
        }
      } catch {
        setRows([]);
        setAyaseTimetable([]);
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
      onCalendarChange(detected);

      // ダイヤ/運行情報を取り直し
      setShouldScrollAfterLoad(true);
      setTimetableReloadNonce((n) => n + 1);

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

  const currentStationName = selectStations[stationKey];

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
      const diagramDate = await fetch(`${base}/latest.json`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((j) => j.diagramDate);

      const url = `${base}/${diagramDate}/train/${calendar}/${trainNumber}.json`;

      const data = await fetch(url, { signal: controller.signal }).then((r) =>
        r.json()
      );
      setTrainDetail(data);
    } catch (e: unknown) {
      if (isAbortError(e)) return;
      // ここは UI 側で null 許容のはずなので握りつぶし
      setTrainDetail(null);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldScrollAfterLoad && rows.length > 0) {
        scrollToNow("smooth");
        setShouldScrollAfterLoad(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [rows, scrollToNow, shouldScrollAfterLoad]);

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
              onChange={(e) => setStationKey(e.target.value)}
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
              onClick={async () => {
                await fetchTrainDetail(row.trainNumber);
                setIsModalOpen(true);
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
            bg="#222"
            color="white"
            borderRadius="md"
            maxW="95vw"
            mt="15vh"
          >
            <DialogHeader borderBottom="1px solid #444" py={3}>
              <Flex justify="space-between" align="center">
                <DialogTitle fontSize="md" fontWeight="bold" fontFamily={FONT_JP}>
                  列車詳細 ({trainDetail?.trainNumber})
                </DialogTitle>
                <DialogCloseTrigger asChild>
                  <IconButton
                    aria-label="閉じる"
                    size="sm"
                    variant="ghost"
                    color="gray.400"
                    _hover={{ color: "white", bg: "whiteAlpha.200" }}
                  >
                    <LuX size={20} />
                  </IconButton>
                </DialogCloseTrigger>
              </Flex>
            </DialogHeader>

            <DialogBody p={0}>
              {!trainDetail ? (
                <Box p={8} textAlign="center">
                  <Text color="gray.400">読み込み中...</Text>
                </Box>
              ) : (
                <VStack align="stretch" gap={0} maxH="60vh" overflowY="auto">
                  {trainDetail.timetable.map((stop, idx) => {
                    const isTerminal = idx === trainDetail.timetable.length - 1;

                    return (
                      <Flex
                        key={idx}
                        align="center"
                        px={4}
                        py={3}
                        borderBottom="1px solid #333"
                      >
                        {/* 駅名 */}
                        <Box flex="1">
                          <StationSmallLabel
                            stationKey={stop.station.toLowerCase()}
                          />
                        </Box>

                        {/* 時刻 */}
                        <HStack gap={4} justify="flex-end" w="120px">
                          <VStack align="flex-end" gap={0}>
                            <Text
                              fontSize="xs"
                              color="gray.500"
                              fontFamily={FONT_JP}
                            >
                              {isTerminal ? "到着" : "出発"}
                            </Text>
                            <Text
                              fontSize="md"
                              fontWeight="bold"
                              fontFamily={FONT_NUM}
                              color="white"
                            >
                              {isTerminal
                                ? stop.arrivalTime
                                : stop.departureTime}
                            </Text>
                          </VStack>
                        </HStack>
                      </Flex>
                    );
                  })}
                </VStack>
              )}
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </>
  );
}
