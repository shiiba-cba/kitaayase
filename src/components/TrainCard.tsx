import { Icon } from "@chakra-ui/react";
import { MdWarning } from "react-icons/md";
import { forwardRef } from "react";
import {
  Box,
  Flex,
  Text,
  Badge,
  VStack,
  HStack,
} from "@chakra-ui/react";
import { stations } from "../data/stations";
import { trainTypes } from "../data/trainTypes";
import { StationLabel } from "./StationLabel";

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
  onClick?: () => void;
};

// --------------------------------------------------
// TrainCard
// --------------------------------------------------
export const TrainCard = forwardRef<HTMLDivElement, Props>(
  ({ row, stationKey, direction, themeColor, onClick }, ref) => {
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
          depLabel = stations[row.originStationName.toLowerCase()] || row.originStationName;
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
      }

      if (row.trainNumber?.includes("96S")) {
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

      if (row.trainNumber?.includes("96S")) {
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
          arrLabel = stations[row.destinationStationName.toLowerCase()] ||
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
    }

    // ==================================================
    // 異常 / 通過判定
    // ==================================================
    let isDepartWrong = false;
    let isArrivalWrong = false;

    if (direction === "for_yoyogiuehara") {
      isDepartWrong = row.originStationName !== "KitaAyase";
      const passesStation =
        row.stationArrivalTime !== null ||
        row.stationDepartureTime !== null;
      isArrivalWrong = !passesStation;
    } else {
      isDepartWrong = row.stationDepartureTime === null;
      isArrivalWrong = row.kitaAyaseArrivalTime === null;
    }

    // ==================================================
    // ハイライト判定
    // ==================================================
    const isHighlight =
      direction === "for_yoyogiuehara"
        ? row.originStationName === "KitaAyase"
        : row.stationDepartureTime !== null;

    // ==================================================
    // 表示定数
    // ==================================================
    const CARD_NORMAL_BG = "rgba(255,255,255,0.04)";
    const CARD_HIGHLIGHT_BG = "rgba(255,255,255,0.12)";

    const formatTime = (t: string | null) => {
      if (!t) return "--:--";
      const [h, m] = t.split(":").map(Number);
      return `${h}:${m.toString().padStart(2, "0")}`;
    };

    const depColor = isDepartWrong ? "whiteAlpha.700" : "white";
    const arrColor = isArrivalWrong ? "whiteAlpha.700" : "white";

    const trainType =
      trainTypes[row.type.toLowerCase()] || row.type;

    const isOrigin =
      direction === "for_yoyogiuehara"
        ? row.originStationName === "KitaAyase"
          || row.originStationName === "Ayase"
        : row.originStationName === row.stationName
          || row.originStationName === "Ayase";

    const is3car = row.trainNumber.includes("96S");

    // ==================================================
    // 描画
    // ==================================================
    return (
      <Box
        ref={ref}
        onClick={onClick}
        cursor="pointer"
        bg={
          isHighlight
            ? CARD_HIGHLIGHT_BG
            : CARD_NORMAL_BG
        }
        borderLeft={
          isHighlight
            ? `4px solid ${themeColor}`
            : "4px solid transparent"
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
                fontFamily='"Open Sans", sans-serif'
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
            <Text
              fontSize="sm"
              fontWeight="500"
              fontFamily='"Noto Sans JP", sans-serif'
              letterSpacing="0.08em"
              color={depColor}
              opacity={0.9}
              lineHeight={1.2}
            >
              {depLabel}
              {depSuffix && (
                <Text
                  as="span"
                  fontSize="xs"
                  fontFamily='"Noto Sans JP", sans-serif'
                  letterSpacing="0.04em"
                  opacity={0.7}
                  ml={1}
                >
                  {depSuffix}
                </Text>
              )}
              {isDepartWrong && depLabel && (
                <Icon
                  as={MdWarning}
                  ml={1}
                  color="yellow.300"
                  boxSize="1.4em"
                  verticalAlign="middle"
                />
              )}
            </Text>
          </VStack>

          {/* 中央：種別・行先 */}
          <VStack flex="1" align="left" gap={1}>
            <HStack gap={2}>
              {trainType && (
              <Badge
                w="66px"
                justifyContent="center"
                px={2}
                py={0.5}
                fontWeight="600"
                fontFamily='"Noto Sans JP", sans-serif'
                letterSpacing="0.04em"
                color="#ffffff"
                backgroundColor={
                  row.type.includes("SemiExpress")
                    ? "#007f00"
                    : row.type.includes("LimitedExpress")
                    ? "#c40000"
                    : row.type.includes("Express")
                    ? "#c40000"
                    : "#004cb0"
                }
                >
                  {trainType}
                </Badge>
              )}
              {isOrigin && !is3car && (
                <Badge
                  px={0}
                  py={0.5}
                  fontWeight="600"
                  fontFamily='"Noto Sans JP", sans-serif'
                  letterSpacing="0.04em"
                  color="#ff7f00"
                  backgroundColor="transparent"
                >
                  {row.originStationName === "Ayase" && stationKey !== "Ayase" ? "綾瀬始発" : "当駅始発"}
                </Badge>
              )}
              {is3car && (
                <Badge
                  px={2}
                  py={0.5}
                  fontWeight="600"
                  fontFamily='"Noto Sans JP", sans-serif'
                  letterSpacing="0.04em"
                  color="#ffffff"
                  backgroundColor="#808080"
                >
                  3両
                </Badge>
              )}
            </HStack>

            <StationLabel
              stationKey={row.destinationStationName.toLowerCase()}
              stationName={
                stations[row.destinationStationName.toLowerCase()] ||
                row.destinationStationName
              }
              textColor={depColor}
            />
          </VStack>

          {/* 右：着 */}
          <VStack align="flex-end" w="100px" gap={0}>
            <Box width="62px" justifyItems="right">
              <Text
                fontSize="3xl"
                fontWeight="600"
                fontFamily='"Open Sans", sans-serif'
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
            <Text
              fontSize="sm"
              fontWeight="500"
              fontFamily='"Noto Sans JP", sans-serif'
              letterSpacing="0.08em"
              color={arrColor}
              opacity={0.9}
              lineHeight={1.2}
            >
              {arrLabel}
              {arrSuffix && (
                <Text
                  as="span"
                  fontSize="xs"
                  fontFamily='"Noto Sans JP", sans-serif'
                  letterSpacing="0.04em"
                  opacity={0.7}
                  ml={1}
                >
                  {arrSuffix}
                </Text>
              )}
              {isArrivalWrong && arrLabel && (
                <Icon
                  as={MdWarning}
                  ml={1}
                  color="yellow.300"
                  boxSize="1.4em"
                  verticalAlign="middle"
                />
              )}
            </Text>
          </VStack>
        </Flex>
      </Box>
    );
  }
);

// forwardRef を使うと displayName が必要なことがある
TrainCard.displayName = "TrainCard";
