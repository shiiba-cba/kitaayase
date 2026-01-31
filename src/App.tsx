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
import { LuArrowLeftRight, LuClock, LuX } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import type { TrainRow } from "./components/TrainCard";
import { selectStations } from "./data/selectStations";
import { stations } from "./data/stations";
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

const CHIYODA_GREEN = "#00bb85";
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

function getThroughLineColorForStationKey(
  stationKey: string | null | undefined,
  opts?: { treatMissingAsOdakyu?: boolean }
): string | null {
  const key = (stationKey ?? "").toLowerCase();

  if (!key) return opts?.treatMissingAsOdakyu ? ODAKYU_BLUE : null;

  if (JOBAN_LOCAL_STATIONS.has(key)) return JOBAN_LOCAL_GRAY;
  if (ODAKYU_STATIONS.has(key)) return ODAKYU_BLUE;
  return null;
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

/* ==================================================
 * 駅名変換
 * ================================================== */
function toJaStationName(raw?: string | null): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  return stations[key] ?? raw;
}

/* ==================================================
 * モーダル用 列車バッジ判定（TrainCard互換）
 * ================================================== */
function getTrainTypeInfo(type?: string) {
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

function isThreeCars(detail: TrainDetail | null): boolean {
  return !!detail?.trainNumber?.includes("96S");
}

function formatTimeNoLeadingZero(time?: string | null): string {
  if (!time) return "";
  if (time === "--:--") return time;

  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

export default function App() {
  // ===== 永続化された設定 =====
  const [direction, setDirection] = useState<
    "for_yoyogiuehara" | "for_kitaayase"
  >(
    (localStorage.getItem("direction") as
      | "for_yoyogiuehara"
      | "for_kitaayase") ?? "for_yoyogiuehara"
  );

  const { calendar, onCalendarChange, detectCalendarForNow } = useCalendar();

  const [stationKey, setStationKey] = useState<keyof typeof selectStations>(
    (localStorage.getItem("stationKey") as keyof typeof selectStations) ??
      "otemachi"
  );

  const [rows, setRows] = useState<TrainRow[]>([]);
  const [ayaseTimetable, setAyaseTimetable] = useState<TrainRow[]>([]);

  const rowsWithConnection = useMemo(() => {
    return rows.map((row) => {
      let hasAyaseConnection = false;
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
      return { ...row, hasAyaseConnection };
    });
  }, [rows, ayaseTimetable, direction]);

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
        if (direction === "for_yoyogiuehara") {
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

  // ===== 復帰時リフレッシュ（5分以上経過なら初回起動相当） =====
  const backgroundedAtRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  const refreshOnResume = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      // モーダルを閉じる（初回起動相当）
      setIsModalOpen(false);
      setTrainDetail(null);

      // 平日/休日を現在日時で上書き
      const detected = await detectCalendarForNow();
      onCalendarChange(detected);

      // ダイヤ/運行情報を取り直し
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
      backgroundedAtRef.current = Date.now();
    };

    const onVisible = () => {
      const bgAt = backgroundedAtRef.current;
      if (!bgAt) return;
      const elapsed = Date.now() - bgAt;
      backgroundedAtRef.current = null;

      if (elapsed >= THRESHOLD_MS) {
        refreshOnResume();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) onHidden();
      else onVisible();
    };

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
            ? row.kitaAyaseDepartureTime || row.ayaseDepartureTime || row.originDepartureTime
            : row.stationDepartureTime || row.ayaseDepartureTime || row.originDepartureTime;
        
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
    if (rows.length > 0) {
      // 100ms 待つことで、ブラウザのレイアウト計算（カードの高さ確定）が完了するのを待つ
      const timer = setTimeout(() => {
        scrollToNow("smooth");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [rows, scrollToNow]);

  const parsedOperationInfo = operationInfo
    ? parseOperationInfo(operationInfo.text)
    : null;

  /* ==================================================
   * UI
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
                  // scrollToNow is triggered by rows change (due to direction change)
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

            {/* ==== 駅選択（スマホネイティブ <select>） ==== */}
            <select
              value={stationKey}
              onChange={(e) =>
                setStationKey(e.target.value as keyof typeof selectStations)
              }
              style={{
                width: "90%",
                padding: "14px",
                fontSize: "18px",
                borderRadius: "8px",
                backgroundColor: "#333",
                color: "white",
                border: "1px solid #555",
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

              <Flex flex="1" justify="center">
                <IconButton
                  aria-label="現在時刻へスクロール"
                  size="md"
                  variant="outline"
                  color={METRO_GREEN}
                  borderColor={METRO_GREEN}
                  _hover={{
                    bg: "rgba(0,187,133,0.15)",
                  }}
                  onClick={async () => {
                    await fetchOperationInfo();

                    // 「現在時刻へ」ボタン押下時は、現在日時に応じて
                    // 平日/土・休日を自動で切り替えてからスクロールする
                    const detected = await detectCalendarForNow();
                    if (detected !== calendar) {
                      onCalendarChange(detected);
                      // rows が切り替わった後に scrollToNow が発火する（useEffect）
                      return;
                    }

                    scrollToNow("smooth");
                  }}
                >
                  <LuClock />
                </IconButton>
              </Flex>
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
                    {isThreeCars(trainDetail) && (
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
