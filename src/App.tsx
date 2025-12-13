import {
  Box,
  Flex,
  Button,
  VStack,
  HStack,
  Text,
  IconButton,
} from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeftRight } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import type { TrainRow } from "./components/TrainCard";
import { selectstations } from "./data/selectstations";
import { isHoliday } from "./utils/holiday";

export default function App() {
  // ===== 永続化された設定を初期値に使用 =====
  const [direction, setDirection] = useState<
    "for_yoyogiuehara" | "for_kitaayase"
  >(
    (localStorage.getItem("direction") as
      | "for_yoyogiuehara"
      | "for_kitaayase") ?? "for_yoyogiuehara"
  );

  const [calendar, setCalendar] = useState<"weekday" | "holiday">("weekday");

  const [stationKey, setStationKey] = useState<
    keyof typeof selectstations
  >(
    (localStorage.getItem("stationKey") as keyof typeof selectstations) ??
      "otemachi"
  );

  const [rows, setRows] = useState<TrainRow[]>([]);

  const base = "/kitaayase/";

  // TrainCard への複数 ref
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // sticky ヘッダーの高さ測定用
  const headerRef = useRef<HTMLDivElement | null>(null);

  // --------------------------------------------------
  // ① 一日の始まりを 4:00 として休日判定
  // --------------------------------------------------
  useEffect(() => {
    const now = new Date();
  
    if (now.getHours() < 4) {
      now.setDate(now.getDate() - 1);
    }
  
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
  
    const day = now.getDay(); // 0:日, 6:土
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

  // --------------------------------------------------
  // JSON 読み込み
  // --------------------------------------------------
  useEffect(() => {
    const url = `${base}data/20250315/${calendar}/${direction}/${stationKey}.json`;

    fetch(url)
      .then((res) => res.json())
      .then((data: TrainRow[]) => setRows(data))
      .catch(() => setRows([]));
  }, [base, calendar, direction, stationKey]);

  const isHolidayTheme = calendar === "holiday";
  const themeColor = isHolidayTheme ? "red.400" : "#009944";

  const currentStationName = selectstations[stationKey];

  // --------------------------------------------------
  // ② 方向別にスクロール基準時刻を変える
  //     ・代々木上原方面 → 北綾瀬発
  //     ・北綾瀬方面 → 当駅発
  // --------------------------------------------------
  useEffect(() => {
    if (rows.length === 0) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const targetIndex = rows.findIndex((row) => {
      let t: string | null = null;

      if (direction === "for_yoyogiuehara") {
        t = row.kitaAyaseDepartureTime;
      } else {
        t = row.stationDepartureTime;
      }

      if (!t) return false;

      const [h, m] = t.split(":").map(Number);
      return h * 60 + m >= currentMinutes;
    });

    if (targetIndex !== -1 && cardRefs.current[targetIndex]) {
      // === sticky ヘッダーの高さを動的に算出 ===
      const headerHeight = headerRef.current?.offsetHeight ?? 0;

      // カードの上端位置
      const cardTop =
        cardRefs.current[targetIndex]!.getBoundingClientRect().top +
        window.scrollY;

      // ぴったりヘッダー直下にくるようにスクロール
      window.scrollTo({
        top: cardTop - headerHeight - 8, // 余裕 8px
        behavior: "smooth",
      });
    }
  }, [rows, direction]);

  // ==================================================
  //                     UI 本体
  // ==================================================

  return (
    <Box bg="#222" minH="100vh" color="white">
      {/* 固定ヘッダー */}
      <Box
        ref={headerRef}
        position="sticky"
        top="0"
        zIndex={1000}
        bg="#222"
        pb={2}
        pt={2}
      >
        <VStack gap={4}>
          {/* ==== 方面（⇔） ==== */}
          <Flex w="100%" align="center">
            <Flex flex="1" justify="flex-end">
              <Text fontSize="lg" fontWeight="bold">
                {direction === "for_yoyogiuehara"
                  ? "北綾瀬"
                  : currentStationName}
              </Text>
            </Flex>

            <Flex flex="0" px={4}>
              <IconButton
                aria-label="方向入れ替え"
                size="md"
                rounded="full"
                bg={themeColor}
                _hover={{ bg: themeColor }}
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
            </Flex>

            <Flex flex="1" justify="flex-start">
              <Text fontSize="lg" fontWeight="bold">
                {direction === "for_yoyogiuehara"
                  ? currentStationName
                  : "北綾瀬"}
              </Text>
            </Flex>
          </Flex>

          {/* ==== 駅選択（スマホネイティブ <select>） ==== */}
          <select
            value={stationKey}
            onChange={(e) =>
              setStationKey(e.target.value as keyof typeof selectstations)
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
            {Object.entries(selectstations).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>

          {/* ==== 平日 / 休日 ==== */}
          <HStack gap={4}>
            <Button
              bg={calendar === "weekday" ? "green.500" : "gray.700"}
              _hover={{
                bg: calendar === "weekday" ? "green.600" : "gray.600",
              }}
              color="white"
              onClick={() => onCalendarChange("weekday")}
            >
              平日
            </Button>

            <Button
              bg={calendar === "holiday" ? "red.500" : "gray.700"}
              _hover={{
                bg: calendar === "holiday" ? "red.600" : "gray.600",
              }}
              color="white"
              onClick={() => onCalendarChange("holiday")}
            >
              土・休日
            </Button>
          </HStack>
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
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}
      </VStack>
    </Box>
  );
}
