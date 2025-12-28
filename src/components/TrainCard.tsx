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
      // 北綾瀬発時刻 or 綾瀬発時刻 or 始発駅発時刻(特急)
      depTime = row.kitaAyaseDepartureTime ?? row.ayaseDepartureTime ?? row.originDepartureTime;
      depLabel = depTime
        ? row.kitaAyaseDepartureTime
          ? stations["kitaayase"]
          : row.ayaseDepartureTime
            ? stations["ayase"]
            : stations[row.originStationName.toLowerCase()] ||
              row.originStationName
        : "";
    } else {
      // for_kitaayase
      // 選択駅発時刻 or 綾瀬発時刻 or 選択駅着時刻(特急)
      depTime = row.stationDepartureTime ?? row.ayaseDepartureTime ?? row.stationArrivalTime;

      if (row.trainNumber?.includes("96S") && depTime) {
        depLabel = stations["ayase"];
        depSuffix = "0番線";
      } else {
        depLabel = depTime
          ? row.stationDepartureTime
            ? stationName
            : row.ayaseDepartureTime
              ? stations["ayase"]
              : stations[row.stationName.toLowerCase()] ||
                row.stationName
          : "";
      }
    }

    // ==================================================
    // 着側
    // ==================================================
    let arrTime: string | null = null;
    let arrLabel = "";
    let arrSuffix = "";

    if (direction === "for_yoyogiuehara") {
      if (
        row.stationName === "Ayase" &&
        row.trainNumber?.includes("96S")
      ) {
        // 綾瀬駅選択時は次の条件に合致するため先に96Sを処理する
        arrTime = row.stationArrivalTime;
        arrLabel = stations["ayase"];
        arrSuffix = "0番線";
      } else if (row.stationArrivalTime || row.stationDepartureTime) {
        // 選択駅着時刻 or 選択駅発時刻(途中駅)
        arrTime = row.stationArrivalTime ?? row.stationDepartureTime;
        arrLabel = stationName;
      } else if (row.destinationArrivalTime) {
        // 終着駅着時刻
        arrTime = row.destinationArrivalTime;
        if (row.trainNumber?.includes("96S")) {
          arrLabel = stations["ayase"];
          arrSuffix = "0番線";
        } else {
          arrLabel =
            stations[row.destinationStationName.toLowerCase()] ||
            row.destinationStationName;
        }
      }
    } else {
      // for_kitaayase
      // 北綾瀬着時刻 or 綾瀬着時刻 or 終着駅着時刻(特急)
      arrTime = row.kitaAyaseArrivalTime ?? row.ayaseArrivalTime ?? row.destinationArrivalTime;
      arrLabel = arrTime
        ? row.kitaAyaseArrivalTime
          ? stations["kitaayase"]
          : row.ayaseArrivalTime
            ? stations["ayase"]
            : stations[row.destinationStationName.toLowerCase()] ||
              row.destinationStationName
        : "";
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
