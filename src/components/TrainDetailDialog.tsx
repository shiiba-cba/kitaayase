import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  IconButton,
  DialogRoot,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

import { StationLargeLabel } from "./StationLargeLabel";
import { StationSmallLabel } from "./StationSmallLabel";
import { FONT_JP, FONT_NUM } from "../styles/fonts";
import {
  getTrainTypeInfo,
  isThreeCars,
  formatTimeNoLeadingZero,
  toJaStationName,
  getThroughLineColorForStationKey,
} from "../utils/trainUtils";
import type { TrainDetail } from "../types/TrainDetail";
import type { DirectionKey } from "../utils/autoDirection";

const CHIYODA_GREEN = "#00bb85";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainDetail: TrainDetail | null;
  stationKey: string;
  direction: DirectionKey;
};

export function TrainDetailDialog({
  open,
  onOpenChange,
  trainDetail,
  stationKey,
  direction,
}: Props) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => onOpenChange(e.open)}
      closeOnInteractOutside
      closeOnEscape
    >
      <DialogBackdrop />

      <DialogPositioner>
        <DialogContent
          bg="#111"
          color="white"
          maxH="90dvh"
          display="flex"
          flexDirection="column"
          position="relative"
          fontFamily={FONT_JP}
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
              onClick={() => onOpenChange(false)}
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
                      fontFamily={FONT_NUM}
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
                            fontFamily={FONT_JP}
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
                  <StationLargeLabel
                    stationKey={
                      trainDetail?.destinationStation.toLowerCase() || ""
                    }
                    stationName={toJaStationName(
                      trainDetail?.destinationStation
                    )}
                  />

                  {/* 3両 */}
                  {isThreeCars(trainDetail?.trainNumber) && (
                    <Box
                      height="32px"
                      px={2}
                      borderRadius="md"
                      bg="#808080"
                      color="white"
                      fontSize="xs"
                      fontWeight="600"
                      fontFamily={FONT_JP}
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
                <StationSmallLabel
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

                <StationSmallLabel
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
            <VStack align="stretch" gap={0}>
              {trainDetail?.timetable.map((t, i) => {
                const isCurrent = t.station.toLowerCase() === stationKey;

                const lastIndex = (trainDetail?.timetable.length ?? 1) - 1;

                const topExtraColor =
                  i === 0
                    ? getThroughLineColorForStationKey(
                        trainDetail?.originStation,
                        { treatMissingAsOdakyu: true }
                      )
                    : null;

                const bottomExtraColor =
                  i === lastIndex
                    ? getThroughLineColorForStationKey(
                        trainDetail?.destinationStation
                      )
                    : null;

                return (
                  <Flex
                    key={i}
                    px={3}
                    py={2}
                    borderRadius="md"
                    bg={isCurrent ? "whiteAlpha.200" : "transparent"}
                    justify="space-between"
                    align="center"
                  >
                    <StationSmallLabel
                      stationKey={t.station.toLowerCase()}
                      highlight={isCurrent}
                      connectorColor={CHIYODA_GREEN}
                      showTopConnector={i !== 0 || !!topExtraColor}
                      showBottomConnector={
                        i !== lastIndex || !!bottomExtraColor
                      }
                      topConnectorColor={topExtraColor ?? undefined}
                      bottomConnectorColor={bottomExtraColor ?? undefined}
                    />

                    <Box
                      height="24px"
                      display="flex"
                      alignItems="center"
                    >
                      <Text
                        fontFamily={FONT_NUM}
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
  );
}
