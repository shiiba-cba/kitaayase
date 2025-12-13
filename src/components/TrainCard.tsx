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
import { traintypes } from "../data/traintypes";

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
};

// ---- ref を受け取るために forwardRef を使用 ----
export const TrainCard = forwardRef<HTMLDivElement, Props>(
  ({ row, stationKey, direction, themeColor }, ref) => {
    const stationName = stations[stationKey];

    // ===== 発側 =====
    let depTime: string | null = null;
    let depLabel = "";
    let depSuffix = "";

    if (direction === "for_yoyogiuehara") {
      depTime = row.kitaAyaseDepartureTime ?? row.ayaseDepartureTime;
      depLabel = depTime
        ? row.kitaAyaseDepartureTime
          ? stations["kitaayase"]
          : stations["ayase"]
        : "";
    } else {
      depTime = row.stationDepartureTime ?? row.originDepartureTime;
    
      if (row.trainNumber?.includes("96S") && depTime) {
        depLabel = stations["ayase"];
        depSuffix = "0番線";
      } else {
        depLabel = depTime
          ? row.stationDepartureTime
            ? stationName
            : stations[row.originStationName.toLowerCase()] ||
              row.originStationName
          : "";
      }
    }

    // ===== 着側 =====
    let arrTime: string | null = null;
    let arrLabel = "";
    let arrSuffix = "";

    if (direction === "for_yoyogiuehara") {
      if (
        row.trainNumber?.includes("96S") &&
        row.stationName === "Ayase" &&
        row.stationArrivalTime !== null &&
        row.stationDepartureTime === null
      ) {
        arrTime = row.stationArrivalTime;
        arrLabel = stations["ayase"];
        arrSuffix = "0番線";
      } else if (row.stationArrivalTime || row.stationDepartureTime) {
        arrTime = row.stationArrivalTime ?? row.stationDepartureTime;
        arrLabel = stationName;
      } else {
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
      arrTime = row.kitaAyaseArrivalTime ?? row.ayaseArrivalTime;
      arrLabel = arrTime
        ? row.kitaAyaseArrivalTime
          ? stations["kitaayase"]
          : stations["ayase"]
        : "";
    }

    // ===== 異常判定 =====
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

    const CARD_NORMAL_BG = "rgba(255,255,255,0.12)";   // 止まる：明るい
    const CARD_PASS_BG   = "rgba(255,255,255,0.04)";   // 止まらない：減光

    const formatTime = (t: string | null) => {
      if (!t) return "--:--";
    
      const [h, m] = t.split(":").map(Number);
      return `${h}:${m.toString().padStart(2, "0")}`;
    };

    const depColor = isDepartWrong ? "whiteAlpha.700" : "white";
    const arrColor = isArrivalWrong ? "whiteAlpha.700" : "white";
    const isPassTrain = isDepartWrong || isArrivalWrong;

    const trainType =
      traintypes[row.type.toLowerCase()] || row.type;

    const is3car = row.trainNumber.includes("96S");

    const isOrigin =
      direction === "for_yoyogiuehara"
        ? row.originStationName === "KitaAyase"
        : row.originStationName === row.stationName;

    // ---- Box に ref を渡すのが重要！ ----
    return (
      <Box
        ref={ref}
        bg={isPassTrain ? CARD_PASS_BG : CARD_NORMAL_BG}
        borderLeft={
          isPassTrain
            ? "4px solid transparent"
            : `4px solid ${themeColor}`
        }
        borderRadius="md"
        w="100%"
        p={3}
      >
        <Flex justify="space-between" align="center">
          {/* 左：発 */}
          <VStack align="flex-start" w="93px" gap={0}>
            <Text
              fontSize="2xl"
              fontWeight="700"
              fontFamily='"Inter", "Noto Sans JP", sans-serif'
              fontVariantNumeric="tabular-nums"
              fontFeatureSettings="'tnum' 1"
              color={depColor}
              w="70px"
              textAlign="left"
              whiteSpace="nowrap"
            >
              {formatTime(depTime)}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="500"
              letterSpacing="0.08em"
              color={depColor}
              opacity={0.9}
              lineHeight={1.2}
            >
              {depLabel}
              <Text
                as="span"
                fontSize="xs"
                letterSpacing="0.04em"
                opacity={0.7}
                ml={1}
              >
                {depSuffix}
              </Text>
              {isDepartWrong && depLabel && (
                <Text as="span" ml={1} color="yellow.300">
                  ▲
                </Text>
              )}
            </Text>
          </VStack>

          {/* 中央：種別・行先 */}
          <VStack flex="1" align="center" gap={1}>
            <HStack gap={2}>
              {trainType && (
              <Badge
                px={2}
                py={0.5}
                fontWeight="600"
                letterSpacing="0.04em"
                  colorPalette={
                    row.type.includes("SemiExpress")
                      ? "green"
                      : row.type.includes("Express")
                      ? "red"
                      : "blue"
                  }
                >
                  {trainType}
                </Badge>
              )}
            </HStack>

            <HStack gap={2}>
              {isOrigin && !is3car && (
                <Badge
                  px={2}
                  py={0.5}
                  fontWeight="600"
                  letterSpacing="0.04em"
                  colorPalette="yellow"
                >
                  始発
                </Badge>
              )}
              {is3car && (
                <Badge
                  px={2}
                  py={0.5}
                  fontWeight="600"
                  letterSpacing="0.04em"
                  colorPalette="gray"
                >
                  3両
                </Badge>
              )}
              <Text
                fontSize="lg"
                // fontWeight="600"
                fontWeight="500"
                letterSpacing="0.06em"
                textAlign="center"
              >
                {stations[row.destinationStationName.toLowerCase()] ||
                  row.destinationStationName}
              </Text>
            </HStack>
          </VStack>

          {/* 右：着 */}
          <VStack align="flex-end" w="93px" gap={0}>
            <Text
              fontSize="2xl"
              fontWeight="700"
              fontFamily='"Inter", "Noto Sans JP", sans-serif'
              fontVariantNumeric="tabular-nums"
              fontFeatureSettings="'tnum' 1"
              color={arrColor}
              w="70px"
              textAlign="right"
              whiteSpace="nowrap"
            >
              {formatTime(arrTime)}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="500"
              letterSpacing="0.08em"
              color={arrColor}
              opacity={0.9}
              lineHeight={1.2}
            >
              {arrLabel}
              <Text
                as="span"
                fontSize="xs"
                letterSpacing="0.04em"
                opacity={0.7}
                ml={1}
              >
                {arrSuffix}
              </Text>
              {isArrivalWrong && arrLabel && (
                <Text as="span" ml={1} color="yellow.300">
                  ▲
                </Text>
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
