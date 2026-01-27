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
import { useEffect, useRef, useState, useCallback } from "react";
import { LuArrowLeftRight, LuClock, LuX } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import type { TrainRow } from "./components/TrainCard";
import { selectStations } from "./data/selectStations";
import { stations } from "./data/stations";
import { isHoliday } from "./utils/holiday";
import { StationLabel } from "./components/StationLabel";
import type { TrainDetail } from "./types/TrainDetail";
import { StationStopLabel } from "./components/StationStopLabel";

/* ==================================================
 * 運行情報型
 * ================================================== */
type OperationInfo = {
  railway: string;
  state: "normal" | "delay" | "suspended";
  text: string;
  operationDate?: string;
  originTime?: string | null;
  updatedAt: string;
};

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

type OperationVisualState = "normal" | "delay" | "suspended";

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

  const [calendar, setCalendar] = useState<"weekday" | "holiday">("weekday");

  const [stationKey, setStationKey] = useState<keyof typeof selectStations>(
    (localStorage.getItem("stationKey") as keyof typeof selectStations) ??
      "otemachi"
  );

  const [rows, setRows] = useState<TrainRow[]>([]);

  const [trainDetail, setTrainDetail] = useState<TrainDetail | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // ===== 運行情報 =====
  const [operationInfo, setOperationInfo] = useState<OperationInfo | null>(
    null
  );

  // ===== 運行情報 折りたたみ =====
  const [isOperationOpen, setIsOperationOpen] = useState(true);
  const operationOpenInitialized = useRef(false);

  // TrainCard refs
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement | null>(null);

  const detectCalendarForNow = useCallback(async () => {
    // 4:00 までは前日扱い
    const now = new Date();
    if (now.getHours() < 4) {
      now.setDate(now.getDate() - 1);
    }

    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const day = now.getDay();
    const isWeekend = day === 0 || day === 6;

    try {
      const isNatHoliday = await isHoliday(dateStr);
      return isWeekend || isNatHoliday ? "holiday" : "weekday";
    } catch {
      // 祝日データが取れない場合は土日だけを休日扱い
      return isWeekend ? "holiday" : "weekday";
    }
  }, []);

  /* ==================================================
   * ① 4:00基準の休日判定（初期表示）
   * ================================================== */
  useEffect(() => {
    (async () => {
      const detected = await detectCalendarForNow();
      setCalendar(detected);
    })();
  }, [detectCalendarForNow]);

  const OPERATION_URL =
    "https://throbbing-dust-144d.kitaayase-worker.workers.dev";

  const fetchOperationInfo = async () => {
    try {
      const res = await fetch(OPERATION_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("failed to fetch operation info");
      const data: OperationInfo = await res.json();
      setOperationInfo(data);
    } catch {
      setOperationInfo(null);
    }
  };

  /* ==================================================
   * ② 運行情報取得（raw 直参照）
   * ================================================== */
  useEffect(() => {
    fetchOperationInfo();
  }, []);

  // 初期表示時のみ：平常運転なら折りたたみ、異常時は展開
  useEffect(() => {
    if (!operationInfo) return;
    if (operationOpenInitialized.current) return;

    // UIの表示ロジック（parseOperationInfo/getOperationVisualState）と揃えるため、本文から判定する
    const state = getOperationVisualState(operationInfo.text);
    setIsOperationOpen(state !== "normal");
    operationOpenInitialized.current = true;
  }, [operationInfo]);

  // 永続化
  useEffect(() => {
    localStorage.setItem("direction", direction);
  }, [direction]);

  useEffect(() => {
    localStorage.setItem("stationKey", stationKey);
  }, [stationKey]);

  const onCalendarChange = (v: "weekday" | "holiday") => {
    setCalendar(v);
    localStorage.setItem("calendar", v);
  };

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
      } catch {
        setRows([]);
      }
    })();

    return () => controller.abort();
  }, [calendar, direction, stationKey]);

  const METRO_GREEN = "#00bb85";
  const METRO_RED = "#f62e36";
  const themeColor = calendar === "holiday" ? METRO_RED : METRO_GREEN;

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
            ? row.kitaAyaseDepartureTime
            : row.stationDepartureTime;
        if (!t) return false;

        const [h, m] = t.split(":").map(Number);
        let trainMinutes = h * 60 + m;
        if (trainMinutes < 240) trainMinutes += 1440;

        return trainMinutes >= currentMinutes;
      });

      const index = targetIndex !== -1 ? targetIndex : rows.length - 1;
      const el = cardRefs.current[index];
      if (!el) return;

      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const top = el.getBoundingClientRect().top + window.scrollY;

      window.scrollTo({
        top: top - headerHeight - 8,
        behavior,
      });
    },
    [rows, direction]
  );

  const fetchTrainDetail = async (trainNumber: string) => {
    const base = "/kitaayase/data";

    const diagramDate = await fetch(`${base}/latest.json`)
      .then((r) => r.json())
      .then((j) => j.diagramDate);

    const url = `${base}/${diagramDate}/train/${calendar}/${trainNumber}.json`;

    const data = await fetch(url).then((r) => r.json());
    setTrainDetail(data);
  };

  useEffect(() => {
    scrollToNow("smooth");
  }, [scrollToNow]);

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
            <Box
              w="100%"
              px={4}
              py={2}
              bg={
                parsedOperationInfo.state === "normal"
                  ? "gray.700"
                  : parsedOperationInfo.state === "delay"
                  ? "orange.500"
                  : "red.600"
              }
              textAlign="center"
              cursor="pointer"
              onClick={() => setIsOperationOpen((v) => !v)}
            >
              {/* 折りたたみ時も見えるヘッダー */}
              <Text fontSize="sm" fontWeight="bold">
                {parsedOperationInfo.title} {isOperationOpen ? "▲" : "▼"}
              </Text>

              {/* 本文（折りたたみ対象） */}
              {isOperationOpen && (
                <Text fontSize="sm" mt={1}>
                  {operationInfo.text}
                </Text>
              )}

              {/* 最終更新（常に表示） */}
              <Text fontSize="xs" opacity={0.8} mt={1}>
                最終更新：
                {new Date(operationInfo.updatedAt).toLocaleString("ja-JP", {
                  month: "numeric",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                （{formatRelativeTime(operationInfo.updatedAt)}）
              </Text>
            </Box>
          )}

          <VStack gap={4} pb={3} pt={3}>
            {/* ==== 方面 ==== */}
            <Flex w="100%" align="center">
              <Flex flex="1" justify="center">
                <StationLabel
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
                onClick={() =>
                  setDirection(
                    direction === "for_yoyogiuehara"
                      ? "for_kitaayase"
                      : "for_yoyogiuehara"
                  )
                }
              >
                <LuArrowLeftRight />
              </IconButton>

              <Flex flex="1" justify="center">
                <StationLabel
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
          {rows.map((row, i) => (
            <TrainCard
              key={i}
              row={row}
              stationKey={stationKey}
              direction={direction}
              themeColor={themeColor}
              onClick={async () => {
                await fetchTrainDetail(row.trainNumber);
                setIsModalOpen(true);
              }}
              ref={(el) => {
                cardRefs.current[i] = el;
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
            fontFamily='"Noto Sans JP", sans-serif'
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
                        fontFamily='"Open Sans", sans-serif'
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
                              fontFamily='"Noto Sans JP", sans-serif'
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
                    <StationLabel
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
                        fontFamily='"Noto Sans JP", sans-serif'
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
                  <StationStopLabel
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

                  <StationStopLabel
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
              <VStack align="stretch" gap={2}>
                {trainDetail?.timetable.map((t, i) => {
                  const isCurrent = t.station.toLowerCase() === stationKey;

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
                      <StationStopLabel
                        stationKey={t.station.toLowerCase()}
                        highlight={isCurrent}
                      />

                      <Box
                        height="24px" // ← StationStopLabel と揃える
                        display="flex"
                        alignItems="center"
                      >
                        <Text
                          fontFamily='"Open Sans", sans-serif'
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
