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

  // TrainCard refs
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement | null>(null);

  /* ==================================================
   * ① 4:00基準の休日判定
   * ================================================== */
  useEffect(() => {
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

    (async () => {
      try {
        const isNatHoliday = await isHoliday(dateStr);
        setCalendar(isWeekend || isNatHoliday ? "holiday" : "weekday");
      } catch {
        setCalendar(isWeekend ? "holiday" : "weekday");
      }
    })();
  }, []);

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

  const operationTitle = operationInfo
    ? getOperationTitle(operationInfo.text)
    : "運行情報";

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
          {operationInfo && (
            <Box
              w="100%"
              px={4}
              py={2}
              bg={
                operationInfo.state === "normal"
                  ? "gray.700"
                  : operationInfo.state === "delay"
                  ? "orange.500"
                  : "red.600"
              }
              textAlign="center"
              cursor="pointer"
              onClick={() => setIsOperationOpen((v) => !v)}
            >
              {/* 折りたたみ時も見えるヘッダー */}
              <Text fontSize="sm" fontWeight="bold">
                {operationTitle} {isOperationOpen ? "▲" : "▼"}
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
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
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
                    await fetchOperationInfo(); // ← 追加
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
          >
            {/* ×ボタン（控えめ） */}
            <DialogCloseTrigger asChild>
              <IconButton
                aria-label="close"
                size="sm"
                variant="ghost"
                color="whiteAlpha.700"
                position="absolute"
                top="3"
                right="3"
                border="none"
                outline="none"
                boxShadow="none"
                _focus={{ boxShadow: "none" }}
                _focusVisible={{ boxShadow: "none" }}
                _active={{ boxShadow: "none" }}
                _hover={{ bg: "whiteAlpha.200", color: "white" }}
              >
                <LuX size={18} />
              </IconButton>
            </DialogCloseTrigger>

            {/* ヘッダー（固定） */}
            <DialogHeader borderBottom="1px solid" borderColor="whiteAlpha.300">
              <VStack align="start" gap={2}>
                {/* 列車番号 */}
                <DialogTitle>
                  <HStack gap={2}>
                    {trainDetail?.trainNumber}
                    {/* 種別 */}
                    {trainDetail?.trainType &&
                      (() => {
                        const t = getTrainTypeInfo(trainDetail.trainType);
                        return (
                          t && (
                            <Box
                              px={2}
                              py={0.5}
                              borderRadius="md"
                              bg={t.bg}
                              color="white"
                              fontSize="xs"
                              fontWeight="600"
                            >
                              {t.label === "各駅停車" ? (
                                <>
                                  <Text lineHeight={1.5}>
                                    各駅
                                    <br />
                                    停車
                                  </Text>
                                </>
                              ) : (
                                t.label
                              )}
                            </Box>
                          )
                        );
                      })()}
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
                        px={2}
                        py={0.5}
                        borderRadius="md"
                        bg="#808080"
                        color="white"
                        fontSize="xs"
                        fontWeight="600"
                      >
                        3両
                      </Box>
                    )}
                  </HStack>
                </DialogTitle>

                {/* 行先 */}
                <HStack gap={3} flexWrap="wrap" align="center">
                  {/* ===== 行先 ===== */}
                  <Text fontSize="sm" opacity={0.9}>
                    {trainDetail?.originStation
                      ? toJaStationName(trainDetail.originStation)
                      : "小田急線"}
                    →{toJaStationName(trainDetail?.destinationStation)}
                  </Text>
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
                    >
                      <Text fontWeight={isCurrent ? "bold" : "normal"}>
                        {toJaStationName(t.station)}
                      </Text>
                      <Text fontVariantNumeric="tabular-nums">
                        {t.arrivalTime && <>{t.arrivalTime}着</>}
                        {t.departureTime && <>{t.departureTime}発</>}
                        {!t.arrivalTime && !t.departureTime && <>--:--着</>}
                      </Text>
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
