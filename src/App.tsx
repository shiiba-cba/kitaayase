import {
  Box,
  Flex,
  Button,
  VStack,
  HStack,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { LuArrowLeftRight, LuSettings2 } from "react-icons/lu";

import { TrainCard } from "./components/TrainCard";
import { TrainDetailDialog } from "./components/TrainDetailDialog";
import { selectStations } from "./data/selectStations";
import { StationLargeLabel } from "./components/StationLargeLabel";
import { AutoDirectionSettingsDialog } from "./components/AutoDirectionSettingsDialog";
import { FONT_JP } from "./styles/fonts";
import { OperationInfoBanner } from "./components/OperationInfoBanner";
import { useCalendar } from "./hooks/useCalendar";
import { useTimetableScroll } from "./hooks/useTimetableScroll";
import { useTimetableData } from "./hooks/useTimetableData";
import { useUiActions } from "./hooks/useUiActions";
import { useOperationInfo } from "./hooks/useOperationInfo";
import { STORAGE_KEYS } from "./constants/storageKeys";
import { UI_TEXT } from "./constants/uiText";
import { formatRelativeTime } from "./utils/trainUtils";
import { calculateTransferInfo } from "./utils/transferLogic";
import {
  oppositeDirection,
  pickDirectionBySettings,
  readAutoDirectionSettings,
  type AutoDirectionSettings,
  type DirectionKey,
} from "./utils/autoDirection";


function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/* ==================================================
 * 運行情報の見出し取得
 * ================================================== */
export function App() {
  const [stationKey, setStationKey] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.stationKey) || "otemachi";
  });
  const [direction, setDirection] = useState<DirectionKey>(() => {
    const savedStationKey = localStorage.getItem(STORAGE_KEYS.stationKey) || "otemachi";
    if (savedStationKey === "kitaayase") {
      return "for_yoyogiuehara";
    }

    const auto = readAutoDirectionSettings();
    if (auto.enabled) {
      return pickDirectionBySettings(auto);
    }

    const saved = localStorage.getItem(STORAGE_KEYS.direction);
    if (saved === "for_yoyogiuehara" || saved === "for_kitaayase") {
      return saved;
    }
    return "for_yoyogiuehara";
  });

  const {
    calendar,
    calendarReady,
    onCalendarChange: baseOnCalendarChange,
    detectCalendarForNow,
  } = useCalendar();

  const isInitialLoadRef = useRef(true);
  const [timetableReloadNonce, setTimetableReloadNonce] = useState(0);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const handledScrollTriggerRef = useRef(0);
  const scrollRequestRef = useRef(false);
  const preserveScrollDepartureMinutesRef = useRef<number | null>(null);
  const scrollBehaviorOverrideRef = useRef<ScrollBehavior | null>(null);

  const {
    rows,
    ayaseTimetable,
    ayaseArrivalPlatformsByTime,
    ayaseDeparturePlatformsByTime,
    ayaseToKitaAyaseDeparturePlatformsByTime,
    trainDetail,
    setTrainDetail,
    fetchTrainDetail,
  } = useTimetableData({
    calendar,
    calendarReady,
    direction,
    stationKey,
    timetableReloadNonce,
    setScrollTrigger,
    scrollRequestRef,
    isInitialLoadRef,
  });

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
        departurePlatforms.length > 0 && departurePlatforms.every((p) => p === "2番線");

      const showAyaseDepartureTrack2Label =
        direction === "for_yoyogiuehara" &&
        row.originStationName !== "KitaAyase" &&
        !!row.ayaseDepartureTime &&
        isAyaseDepartureTrack2Only;

      const toKitaAyaseDeparturePlatforms = row.ayaseDepartureTime
        ? ayaseToKitaAyaseDeparturePlatformsByTime?.[row.ayaseDepartureTime] ?? []
        : [];
      const isAyaseToKitaAyaseDepartureTrack3Only =
        toKitaAyaseDeparturePlatforms.length > 0 &&
        toKitaAyaseDeparturePlatforms.every((p) => p === "3番線");

      const showAyaseDepartureTrack3Label =
        direction === "for_kitaayase" &&
        stationKey === "ayase" &&
        row.originStationName === "Ayase" &&
        !!row.ayaseDepartureTime &&
        isAyaseToKitaAyaseDepartureTrack3Only;

      return {
        ...row,
        hasAyaseConnection,
        transferInfo,
        showAyaseTrack2Label,
        showAyaseDepartureTrack2Label,
        showAyaseDepartureTrack3Label,
      };
    });
  }, [
    rows,
    ayaseTimetable,
    ayaseArrivalPlatformsByTime,
    ayaseDeparturePlatformsByTime,
    ayaseToKitaAyaseDeparturePlatformsByTime,
    direction,
    stationKey,
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [autoDirectionSettings, setAutoDirectionSettings] =
    useState<AutoDirectionSettings>(() => readAutoDirectionSettings());
  const [showOnlyDepartures, setShowOnlyDepartures] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.showOnlyDepartures) === "1";
  });

  const displayedRows = useMemo(() => {
    if (!showOnlyDepartures) return rowsWithConnection;

    return rowsWithConnection.filter((row) => {
      const departureTime =
        direction === "for_yoyogiuehara"
          ? row.kitaAyaseDepartureTime
          : row.stationDepartureTime;
      return !!departureTime;
    });
  }, [rowsWithConnection, showOnlyDepartures, direction]);

  // ===== 運行情報 =====
  const {
    operationInfo,
    parsedOperationInfo,
    isOperationOpen,
    setIsOperationOpen,
    fetchOperationInfo,
  } = useOperationInfo();

  // TrainCard refs
  const cardRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const headerRef = useRef<HTMLDivElement | null>(null);

  // 初期表示時にブラウザの自動スクロール復元を無効化
  // （自前の scrollToNow と競合してズレるのを防ぐ）
  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;

    const prev = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = prev;
    };
  }, []);

  // Wrap onCalendarChange to add custom logic (scroll to now, refresh operation info)
  const onCalendarChange = useCallback(
    (
      target: "weekday" | "holiday",
      opts?: { skipOperationFetch?: boolean }
    ) => {
      // スクロール予約は先に立てる（fetch/再描画の競合で取りこぼさないため）
      scrollRequestRef.current = true;

      // 1. Fetch latest operation info
      if (!opts?.skipOperationFetch) {
        fetchOperationInfo({ bustCache: true }); // Await しないことで状態変更を即座に行う
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

  // 永続化
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.direction, direction); } catch { /* noop */ }
  }, [direction]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.stationKey, stationKey); } catch { /* noop */ }
  }, [stationKey]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.autoDirectionSettings,
        JSON.stringify(autoDirectionSettings)
      );
    } catch { /* noop */ }
  }, [autoDirectionSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.showOnlyDepartures,
        showOnlyDepartures ? "1" : "0"
      );
    } catch { /* noop */ }
  }, [showOnlyDepartures]);

  const applyAutoDirectionIfEnabled = useCallback(() => {
    if (!autoDirectionSettings.enabled) return;
    if (stationKey === "kitaayase") {
      setDirection("for_yoyogiuehara");
      return;
    }

    const next = pickDirectionBySettings(autoDirectionSettings);
    setDirection(next);
    scrollRequestRef.current = true;
  }, [autoDirectionSettings, stationKey]);

  const METRO_GREEN = "#00bb85";
  const METRO_RED = "#f62e36";
  const themeColor = calendar === "holiday" ? METRO_RED : METRO_GREEN;

  const { captureVisibleDepartureMinutes } = useTimetableScroll({
    displayedRows,
    direction,
    cardRefs,
    headerRef,
    scrollTrigger,
    handledScrollTriggerRef,
    preserveScrollDepartureMinutesRef,
    scrollBehaviorOverrideRef,
  });

  const { toggleDirection, changeStation, toggleDepartureOnly } = useUiActions({
    stationKey,
    direction,
    setDirection,
    setStationKey,
    setShowOnlyDepartures,
    setScrollTrigger,
    scrollRequestRef,
    preserveScrollDepartureMinutesRef,
    scrollBehaviorOverrideRef,
    captureVisibleDepartureMinutes,
  });

  // ===== 復帰時リフレッシュ（5分以上経過なら初回起動相当） =====
  const backgroundedAtRef = useRef<number | null>(null);
  const refreshingRef = useRef(false);

  useEffect(() => {
    applyAutoDirectionIfEnabled();
  }, [applyAutoDirectionIfEnabled]);

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
      onCalendarChange(detected, { skipOperationFetch: true });

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
  }, [detectCalendarForNow, onCalendarChange, fetchOperationInfo, setTrainDetail]);

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

      // 復帰時は毎回、表示方面の自動設定を再適用（有効時のみ）
      applyAutoDirectionIfEnabled();

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
  }, [refreshOnResume, applyAutoDirectionIfEnabled]);

  const currentStationName = selectStations[stationKey as keyof typeof selectStations] || stationKey;

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
                onClick={toggleDirection}
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
                changeStation(e.target.value);
              }}
            >
              {Object.entries(selectStations).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>

            <Box width="90%">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={showOnlyDepartures}
                  onChange={(e) => {
                    toggleDepartureOnly(e.target.checked);
                  }}
                />
                <Text fontSize="sm" color="whiteAlpha.900">
                  {direction === "for_yoyogiuehara"
                    ? UI_TEXT.departureOnlyKitaAyase
                    : `${currentStationName}を発車する電車のみ表示`}
                </Text>
              </label>
            </Box>

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
                    {UI_TEXT.weekday}
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
                    {UI_TEXT.holiday}
                  </Button>
                </HStack>
              </Flex>

              <Flex flex="1" justify="end" pr={4}>
                <IconButton
                  aria-label={UI_TEXT.settingsAriaLabel}
                  size="md"
                  variant="outline"
                  borderColor="whiteAlpha.500"
                  color="white"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={() => setIsSettingsOpen(true)}
                >
                  <LuSettings2 />
                </IconButton>
              </Flex>
            </Flex>
          </VStack>
        </Box>

        {/* ===== 時刻表一覧 ===== */}
        <VStack gap={4} w="100%" pt={2}>
          {displayedRows.length === 0 && (
            <Text color="whiteAlpha.700" fontFamily={FONT_JP}>
              {UI_TEXT.noMatchingTrains}
            </Text>
          )}

          {displayedRows.map((row, i) => (
            <TrainCard
              key={row.trainNumber}
              row={row}
              stationKey={stationKey}
              direction={direction}
              themeColor={themeColor}
              hasAyaseConnection={row.hasAyaseConnection}
              transferInfo={row.transferInfo}
              showAyaseTrack2Label={row.showAyaseTrack2Label}
              showAyaseDepartureTrack2Label={row.showAyaseDepartureTrack2Label}
              showAyaseDepartureTrack3Label={row.showAyaseDepartureTrack3Label}
              onClick={async () => {
                const ok = await fetchTrainDetail(row.trainNumber);
                if (ok) {
                  setIsModalOpen(true);
                }
              }}
              ref={(el) => {
                if (el) {
                  cardRefs.current.set(i, el);
                } else {
                  cardRefs.current.delete(i);
                }
              }}
            />
          ))}
        </VStack>
      </Box>

      <TrainDetailDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        trainDetail={trainDetail}
        stationKey={stationKey}
        direction={direction}
      />

      <AutoDirectionSettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          fontFamily={FONT_JP}
          enabled={autoDirectionSettings.enabled}
          onEnabledChange={(enabled) => {
            setAutoDirectionSettings((prev) => ({
              ...prev,
              enabled,
            }));
          }}
          beforeCutoffDirection={autoDirectionSettings.beforeCutoffDirection}
          onBeforeCutoffDirectionChange={(next) => {
            setAutoDirectionSettings((prev) => ({
              ...prev,
              beforeCutoffDirection: next,
              afterCutoffDirection: oppositeDirection(next),
            }));
          }}
          cutoffTime={autoDirectionSettings.cutoffTime}
          onCutoffTimeChange={(time) => {
            setAutoDirectionSettings((prev) => ({
              ...prev,
              cutoffTime: time,
            }));
          }}
          afterCutoffDirection={autoDirectionSettings.afterCutoffDirection}
      />
    </>
  );
}
