import {
  Box,
  Flex,
  Button,
  VStack,
  HStack,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeftRight, LuClock } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import type { TrainRow } from "./components/TrainCard";
import { selectStations } from "./data/selectStations";
import { isHoliday } from "./utils/holiday";
import { StationLabel } from "./components/StationLabel";

/* ==================================================
 * 運行情報型
 * ================================================== */
type OperationInfo = {
  railway: string;
  state: "normal" | "delay" | "suspended";
  text: string;
  operationDate?: string;
  originTime?: string | null;
  lastFetchedAt: string;
};

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

  const [stationKey, setStationKey] = useState<
    keyof typeof selectStations
  >(
    (localStorage.getItem("stationKey") as keyof typeof selectStations) ??
      "otemachi"
  );

  const [rows, setRows] = useState<TrainRow[]>([]);

  // ===== 運行情報 =====
  const [operationInfo, setOperationInfo] =
    useState<OperationInfo | null>(null);

  const base = "/kitaayase/";

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

  /* ==================================================
   * ② 運行情報取得（raw 直参照）
   * ================================================== */
  useEffect(() => {
    const OPERATION_URL =
      "https://raw.githubusercontent.com/shiiba-cba/kitaayase/main/public/data/operation.json";

    fetch(OPERATION_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("failed to fetch operation info");
        return res.json();
      })
      .then((data: OperationInfo) => {
        setOperationInfo(data);
      })
      .catch(() => {
        setOperationInfo(null);
      });
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
    const url = `${base}data/20250315/${calendar}/${direction}/${stationKey}.json`;

    fetch(url)
      .then((res) => res.json())
      .then((data: TrainRow[]) => setRows(data))
      .catch(() => setRows([]));
  }, [base, calendar, direction, stationKey]);

  const METRO_GREEN = "#00bb85";
  const METRO_RED = "#f62e36";
  const themeColor = calendar === "holiday" ? METRO_RED : METRO_GREEN;

  const currentStationName = selectStations[stationKey];

  /* ==================================================
   * ④ 現在時刻へスクロール
   * ================================================== */
  const scrollToNow = (behavior: ScrollBehavior = "smooth") => {
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

      let [h, m] = t.split(":").map(Number);
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
  };

  useEffect(() => {
    scrollToNow("smooth");
  }, [rows, direction]);

  /* ==================================================
   * UI
   * ================================================== */
  return (
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
        {/* {operationInfo && (
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
          >
            <Text fontSize="sm">{operationInfo.text}</Text>
            <Text fontSize="xs" opacity={0.8}>
              最終更新：
              {new Date(operationInfo.lastFetchedAt).toLocaleString("ja-JP", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              （{formatRelativeTime(operationInfo.lastFetchedAt)}）
            </Text>
          </Box>
        )} */}

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
            <Flex flex="1" justify="center">
            </Flex>

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
                onClick={() => scrollToNow("smooth")}
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
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}
      </VStack>
    </Box>
  );
}
