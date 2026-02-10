import { Icon } from "@chakra-ui/react";
import { MdWarning } from "react-icons/md";
import { forwardRef } from "react";
import { Box, Flex, Text, Badge, VStack, HStack } from "@chakra-ui/react";
import { stations } from "../data/stations";
import { trainTypes } from "../data/trainTypes";
import { StationLargeLabel } from "./StationLargeLabel";
import { FONT_JP, FONT_NUM } from "../styles/fonts";

import {
  getTrainTypeInfo,
  formatTime,
  isThreeCars,
} from "../utils/trainUtils";

export type TrainRow = {
  trainNumber: string;
  type: string;
  destinationStationName: string;
  originStationName: string;
  originDepartureTime: string | null;
  stationName: string;
  stationDepartureTime: string | null;
  stationArrivalTime: string | null;
  destinationArrivalTime: string | null;
  kitaAyaseArrivalTime: string | null;
  kitaAyaseDepartureTime: string | null;
  ayaseArrivalTime: string | null;
  ayaseDepartureTime: string | null;
  yoyogiUeharaArrivalTime: string | null;
  yoyogiUeharaDepartureTime: string | null;
};

type Props = {
  row: TrainRow;
  stationKey: keyof typeof stations;
  direction: "for_yoyogiuehara" | "for_kitaayase";
  themeColor: string;
  hasAyaseConnection?: boolean;
  transferInfo?: { label: string; color: string } | null;
  showAyaseTrack2Label?: boolean;
  onClick?: () => void;
};

// --------------------------------------------------
// TrainCard
// --------------------------------------------------
export const TrainCard = forwardRef<HTMLDivElement, Props>(
  ({ row, stationKey, direction, themeColor, hasAyaseConnection, transferInfo, showAyaseTrack2Label, onClick }, ref) => {
    const stationName = stations[stationKey];

    // ==================================================
    // 発側
    // ==================================================
    let depTime: string | null = null;
    let depLabel = "";
    let depSuffix = "";

    if (direction === "for_yoyogiuehara") {
      // 北綾瀬→(綾瀬～代々木上原)
      if (row.type === "LimitedExpress") {
        // 発駅は北綾瀬固定の為、特急は始発駅発時刻(北千住始発 or 大手町始発)
        if (row.originDepartureTime) {
          depTime = row.originDepartureTime;
          depLabel =
            stations[row.originStationName.toLowerCase()] ||
            row.originStationName;
        }
      } else if (row.kitaAyaseDepartureTime) {
        // 発駅は北綾瀬固定の為、特急以外はあれば北綾瀬発時刻(北綾瀬始発)
        depTime = row.kitaAyaseDepartureTime;
        depLabel = stations["kitaayase"];
      } else if (row.ayaseDepartureTime) {
        // 発駅は北綾瀬固定の為、特急以外はなければ綾瀬発時刻(綾瀬始発 or JR常磐緩行線からの直通)
        depTime = row.ayaseDepartureTime;
        depLabel = stations["ayase"];
      }
    } else {
      // (代々木上原～綾瀬)→北綾瀬
      if (row.type === "LimitedExpress") {
        // 特急は選択駅着時刻(表参道 or 霞ケ関 or 大手町 or 北千住)
        if (row.stationArrivalTime) {
          depTime = row.stationArrivalTime;
          depLabel = stationName;
        }
      } else if (row.stationDepartureTime) {
        // 特急以外はあれば選択駅発時刻(北綾瀬行 or JR常磐緩行線方面)
        depTime = row.stationDepartureTime;
        depLabel = stationName;
      } else if (row.ayaseDepartureTime) {
        // 特急以外はなければ綾瀬発時刻(綾瀬始発北綾瀬行 3両 or 10両)
        depTime = row.ayaseDepartureTime;
        depLabel = stations["ayase"];
      } else if (row.originDepartureTime) {
        // 特急以外はなければ始発駅発時刻(途中駅始発)
        depTime = row.originDepartureTime;
        depLabel =
          stations[row.originStationName.toLowerCase()] ||
          row.originStationName;
      }

      if (isThreeCars(row.trainNumber)) {
        // 綾瀬～北綾瀬区間列車
        depLabel = depTime ? stations["ayase"] : "";
        depSuffix = depTime ? "0番線" : "";
      }
    }

    // ==================================================
    // 着側
    // ==================================================
    let arrTime: string | null = null;
    let arrLabel = "";
    let arrSuffix = "";

    if (direction === "for_yoyogiuehara") {
      // 北綾瀬→(綾瀬～代々木上原)
      if (row.stationArrivalTime || row.stationDepartureTime) {
        // 選択駅着時刻(終着駅) or 選択駅発時刻(途中駅)
        arrTime = row.stationArrivalTime ?? row.stationDepartureTime;
        arrLabel = stationName;
      } else if (row.destinationArrivalTime) {
        // 終着駅着時刻(途中駅止まり)
        arrTime = row.destinationArrivalTime;
        arrLabel =
          stations[row.destinationStationName.toLowerCase()] ||
          row.destinationStationName;
      }

      if (isThreeCars(row.trainNumber)) {
        // 綾瀬～北綾瀬区間列車
        arrLabel = stations["ayase"];
        arrSuffix = "0番線";
      }
    } else {
      // (代々木上原～綾瀬)→北綾瀬
      if (row.type === "LimitedExpress") {
        // 着駅は北綾瀬固定の為、特急は終着駅着時刻(北千住行)
        if (row.destinationArrivalTime) {
          arrTime = row.destinationArrivalTime;
          arrLabel =
            stations[row.destinationStationName.toLowerCase()] ||
            row.destinationStationName;
        }
      } else if (row.kitaAyaseArrivalTime) {
        // 着駅は北綾瀬固定の為、特急以外はあれば北綾瀬着時刻(北綾瀬行)
        arrTime = row.kitaAyaseArrivalTime;
        arrLabel = stations["kitaayase"];
      } else if (row.ayaseArrivalTime) {
        // 着駅は北綾瀬固定の為、特急以外はなければ綾瀬着時刻(綾瀬行 or JR常磐緩行線へ直通)
        arrTime = row.ayaseArrivalTime;
        arrLabel = stations["ayase"];
      }

      if (showAyaseTrack2Label && row.ayaseArrivalTime) {
        arrLabel = stations["ayase"];
        arrSuffix = "2番線";
      }
    }

    // ==================================================
    // 発着駅が同一の場合の補正
    // ==================================================
    if (depLabel && arrLabel && depLabel === arrLabel) {
      if (direction === "for_yoyogiuehara") {
        arrTime = null; // → "--:--" 表示になる
        arrLabel = ""; // 着駅をブランクに
        arrSuffix = ""; // 念のため
      } else {
        depTime = null; // → "--:--" 表示になる
        depLabel = ""; // 発駅をブランクに
        depSuffix = ""; // 念のため
      }
    }

    // ==================================================
    // 異常 / 通過判定
    // ==================================================
    let isDepartWrong = false;
    let isArrivalWrong = false;

    // ----------
    // direction別の基本判定
    // ----------
    if (direction === "for_yoyogiuehara") {
      // 北綾瀬→(綾瀬～代々木上原)
      // 発：北綾瀬始発でない
      isDepartWrong = row.originStationName !== "KitaAyase";

      // 着：選択駅に停車しない
      const passesStation = row.stationArrivalTime || row.stationDepartureTime;

      isArrivalWrong = !passesStation;
    } else {
      // (代々木上原～綾瀬)→北綾瀬
      // 発：選択駅に停車しない
      isDepartWrong = !row.stationDepartureTime;

      // 着：北綾瀬に到着しない
      isArrivalWrong = !row.kitaAyaseArrivalTime;
    }

    // ----------
    // 時刻が存在しない場合は必ず異常
    // ----------
    if (!depTime) {
      isDepartWrong = true;
    }

    if (!arrTime) {
      isArrivalWrong = true;
    }

    // ==================================================
    // ハイライト判定
    // ==================================================
    const isHighlight =
      direction === "for_yoyogiuehara"
        ? row.originStationName === "KitaAyase"
        : row.stationDepartureTime;

    // ==================================================
    // 表示定数
    // ==================================================
    const CARD_NORMAL_BG = "rgba(255,255,255,0.04)";
    const CARD_HIGHLIGHT_BG = "rgba(255,255,255,0.12)";

    const depColor = isDepartWrong ? "whiteAlpha.700" : "white";
    const arrColor = isArrivalWrong ? "whiteAlpha.700" : "white";

    const typeInfo = getTrainTypeInfo(row.type);
    const trainTypeLabel = typeInfo ? typeInfo.label : (trainTypes[row.type.toLowerCase()] || row.type);

    const isOrigin =
      direction === "for_yoyogiuehara"
        ? row.originStationName === "KitaAyase" ||
          row.originStationName === "Ayase"
        : row.originStationName === row.stationName ||
          row.originStationName === "Ayase";

    const is3car = isThreeCars(row.trainNumber);

    // ==================================================
    // 描画
    // ==================================================
    return (
      <Box
        ref={ref}
        onClick={onClick}
        cursor="pointer"
        userSelect="none"
        WebkitUserSelect="none"
        WebkitTouchCallout="none"
        touchAction="manipulation"
        transition="background-color 0.1s ease"
        _hover={{ bg: "rgba(255,255,255,0.18)" }}
        _active={{ bg: "rgba(255,255,255,0.28)" }}
        bg={isHighlight ? CARD_HIGHLIGHT_BG : CARD_NORMAL_BG}
        borderLeft={
          isHighlight ? `4px solid ${themeColor}` : "4px solid transparent"
        }
        borderRadius="md"
        w="100%"
        p={3}
      >
        <Flex justify="space-between" align="center">
          {/* 左：発 */}
          <VStack align="flex-start" w="100px" gap={0}>
            <Box width="62px" justifyItems="left">
              <Text
                fontSize="3xl"
                fontWeight="600"
                fontFamily={FONT_NUM}
                fontVariantNumeric="tabular-nums"
                fontFeatureSettings="'tnum' 1"
                color={depColor}
                whiteSpace="nowrap"
                transform="scaleX(0.8)"
                transformOrigin="center left"
              >
                {formatTime(depTime)}
              </Text>
            </Box>
            <Flex align="center">
              <Text
                fontSize="sm"
                fontWeight="500"
                fontFamily={FONT_JP}
                letterSpacing="0.08em"
                color={depColor}
                opacity={0.9}
                lineHeight={1.2}
                display="flex"
                alignItems="center"
              >
                {isDepartWrong && (
                  <Icon
                    as={MdWarning}
                    mr={1}
                    color="yellow.300"
                    boxSize="1.4em"
                  />
                )}
                {depLabel}
                {depSuffix && (
                  <Text
                    as="span"
                    fontSize="xs"
                    letterSpacing="0.04em"
                    opacity={0.7}
                    ml={1}
                  >
                    {depSuffix}
                  </Text>
                )}
              </Text>
            </Flex>
          </VStack>

          {/* 中央：種別・行先 */}
          <VStack flex="1" align="left" gap={0}>
            <HStack gap={2} mb={1}>
              {trainTypeLabel && (
                <Badge
                  w="66px"
                  justifyContent="center"
                  px={2}
                  py={0.5}
                  fontWeight="600"
                  fontFamily={FONT_JP}
                  letterSpacing="0.04em"
                  color="#ffffff"
                  backgroundColor={
                    typeInfo ? typeInfo.bg : (
                      row.type.includes("SemiExpress")
                        ? "#007f00"
                        : row.type.includes("LimitedExpress")
                        ? "#c40000"
                        : row.type.includes("Express")
                        ? "#c40000"
                        : "#004cb0"
                    )
                  }
                >
                  {trainTypeLabel}
                </Badge>
              )}
              {isOrigin && !is3car && (
                <Badge
                  px={0}
                  py={0.5}
                  fontWeight="600"
                  fontFamily={FONT_JP}
                  letterSpacing="0.04em"
                  color="#ff7f00"
                  backgroundColor="transparent"
                >
                  {row.originStationName === "Ayase" && stationKey !== "ayase"
                    ? "綾瀬始発"
                    : "当駅始発"}
                </Badge>
              )}
              {is3car && (
                <Badge
                  px={2}
                  py={0.5}
                  fontWeight="600"
                  fontFamily={FONT_JP}
                  letterSpacing="0.04em"
                  color="#ffffff"
                  backgroundColor="#808080"
                >
                  3両
                </Badge>
              )}
            </HStack>

            <StationLargeLabel
              stationKey={row.destinationStationName.toLowerCase()}
              stationName={
                stations[row.destinationStationName.toLowerCase()] ||
                row.destinationStationName
              }
              textColor={depColor}
            />

            {direction === "for_yoyogiuehara" &&
              is3car &&
              hasAyaseConnection &&
              stationKey !== "ayase" && (
                <Box mt={-1}>
                  <Badge
                    px={0}
                    py={0.5}
                    fontWeight="700"
                    fontFamily={FONT_JP}
                    letterSpacing="0.04em"
                    color="#ff7f00"
                    backgroundColor="transparent"
                  >
                    綾瀬始発にのりかえ
                  </Badge>
                </Box>
              )}

            {transferInfo && (
              <Box mt={-1}>
                <Badge
                  px={0}
                  py={0.5}
                  fontWeight="700"
                  fontFamily={FONT_JP}
                  letterSpacing="0.04em"
                  color={transferInfo.color}
                  backgroundColor="transparent"
                >
                  {transferInfo.label}
                </Badge>
              </Box>
            )}
          </VStack>

          {/* 右：着 */}
          <VStack align="flex-end" w="100px" gap={0}>
            <Box width="62px" justifyItems="right">
              <Text
                fontSize="3xl"
                fontWeight="600"
                fontFamily={FONT_NUM}
                fontVariantNumeric="tabular-nums"
                fontFeatureSettings="'tnum' 1"
                color={arrColor}
                whiteSpace="nowrap"
                transform="scaleX(0.8)"
                transformOrigin="center right"
              >
                {formatTime(arrTime)}
              </Text>
            </Box>
            <Flex align="center">
              <Text
                fontSize="sm"
                fontWeight="500"
                fontFamily={FONT_JP}
                letterSpacing="0.08em"
                color={arrColor}
                opacity={0.9}
                lineHeight={1.2}
                display="flex"
                alignItems="center"
              >
                {arrLabel}
                {arrSuffix && (
                  <Text
                    as="span"
                    fontSize="xs"
                    letterSpacing="0.04em"
                    opacity={0.7}
                    ml={1}
                  >
                    {arrSuffix}
                  </Text>
                )}
                {isArrivalWrong && (
                  <Icon
                    as={MdWarning}
                    ml={1}
                    color="yellow.300"
                    boxSize="1.4em"
                  />
                )}
              </Text>
            </Flex>
          </VStack>
        </Flex>
      </Box>
    );
  }
);

// forwardRef を使うと displayName が必要なことがある
TrainCard.displayName = "TrainCard";
