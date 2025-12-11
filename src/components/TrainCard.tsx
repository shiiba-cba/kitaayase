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
};

// ---- ref を受け取るために forwardRef を使用 ----
export const TrainCard = forwardRef<HTMLDivElement, Props>(
  ({ row, stationKey, direction }, ref) => {
    const time = (v: string | null) => (v ? v : "--");

    const stationName = stations[stationKey];

    // ===== 発側 =====
    let depTime: string | null = null;
    let depLabel = "";

    if (direction === "for_yoyogiuehara") {
      depTime = row.kitaAyaseDepartureTime ?? row.ayaseDepartureTime;
      depLabel = depTime
        ? row.kitaAyaseDepartureTime
          ? stations["kitaayase"]
          : stations["ayase"]
        : "";
    } else {
      depTime = row.stationDepartureTime ?? row.originDepartureTime;
      if (row.trainNumber?.includes("96S")) {
        depLabel = depTime ? stations["ayase"] + "0番線" : "";
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

    if (direction === "for_yoyogiuehara") {
      if (row.stationArrivalTime || row.stationDepartureTime) {
        arrTime = row.stationArrivalTime ?? row.stationDepartureTime;
        arrLabel = stationName;
      } else {
        arrTime = row.destinationArrivalTime;
        if (row.trainNumber?.includes("96S")) {
          arrLabel = stations["ayase"] + "0番線";
        } else {
          arrLabel =
            stations[row.destinationStationName.toLowerCase()] ||
            row.destinationStationName;
        }
      }
    } else {
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

    const depColor = isDepartWrong ? "whiteAlpha.700" : "white";
    const arrColor = isArrivalWrong ? "whiteAlpha.700" : "white";

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
        bg={isDepartWrong ? "rgba(255, 150, 0, 0.15)" : "rgba(255,255,255,0.08)"}
        borderLeft={isDepartWrong ? "4px solid #ffae00" : "4px solid transparent"}
        borderRadius="lg"
        w="100%"
        p={3}
      >
        <Flex justify="space-between" align="center">
          {/* 左：発 */}
          <VStack align="flex-start" w="84px" gap={0}>
            <Text fontSize="2xl" fontWeight="bold" color={depColor}>
              {time(depTime)}
            </Text>
            <Text fontSize="sm" color={depColor}>
              {depLabel}
              {isDepartWrong && depLabel && " ⚠"}
            </Text>
          </VStack>

          {/* 中央：種別・行先 */}
          <VStack flex="1" align="center" gap={1}>
            <HStack gap={2}>
              {trainType && (
                <Badge
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
                <Badge colorPalette="yellow">始発</Badge>
              )}
              {is3car && <Badge colorPalette="gray">3両</Badge>}
              <Text fontSize="lg">
                {stations[row.destinationStationName.toLowerCase()] ||
                  row.destinationStationName}
              </Text>
            </HStack>
          </VStack>

          {/* 右：着 */}
          <VStack align="flex-end" w="84px" gap={0}>
            <Text fontSize="2xl" fontWeight="bold" color={arrColor}>
              {time(arrTime)}
            </Text>
            <Text fontSize="sm" color={arrColor}>
              {arrLabel}
              {isArrivalWrong && arrLabel && " ⚠"}
            </Text>
          </VStack>
        </Flex>
      </Box>
    );
  }
);

// forwardRef を使うと displayName が必要なことがある
TrainCard.displayName = "TrainCard";
