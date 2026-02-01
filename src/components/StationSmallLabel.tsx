import { HStack, Image, Text, Box } from "@chakra-ui/react";
import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { stations } from "../data/stations";
import { FONT_JP } from "../styles/fonts";

type Props = {
  stationKey?: string;
  stationName?: string;
  isPassed?: boolean;
  highlight?: boolean;
  /** stop list connector line */
  showTopConnector?: boolean;
  showBottomConnector?: boolean;
  /** default connector color (used when top/bottom color not specified) */
  connectorColor?: string;
  topConnectorColor?: string;
  bottomConnectorColor?: string;
};

export const StationSmallLabel = ({
  stationKey,
  stationName,
  isPassed,
  highlight,
  showTopConnector,
  showBottomConnector,
  connectorColor = "#00bb85", // 千代田線カラー
  topConnectorColor,
  bottomConnectorColor,
}: Props) => {
  const effectiveKey = stationKey ?? (stationName ? "" : "unknown");
  const img = stationNumberImageMap[effectiveKey.toLowerCase()];
  const name = stationName ?? stations[effectiveKey.toLowerCase()] ?? effectiveKey;

  return (
    <HStack gap={2} align="center">
      {/* number icon + connector line */}
      <Box position="relative" w="24px" h="24px" flex="0 0 24px">
        {showTopConnector && (
          <Box
            position="absolute"
            left="50%"
            top="-20px"
            transform="translateX(-50%)"
            width="4px"
            height="20px"
            bg={topConnectorColor ?? connectorColor}
            borderRadius="full"
            opacity={0.95}
          />
        )}

        {showBottomConnector && (
          <Box
            position="absolute"
            left="50%"
            bottom="-20px"
            transform="translateX(-50%)"
            width="4px"
            height="20px"
            bg={bottomConnectorColor ?? connectorColor}
            borderRadius="full"
            opacity={0.95}
          />
        )}

        {img && (
          <Image 
            src={img} 
            alt={name} 
            boxSize="24px" 
            objectFit="contain" 
            filter={isPassed ? "grayscale(100%) opacity(50%)" : undefined}
          />
        )}
      </Box>

      <Box height="24px" display="flex" alignItems="center">
        <Text
          fontSize="sm"
          fontWeight={highlight ? "bold" : "normal"}
          lineHeight="1"
          whiteSpace="nowrap"
          fontFamily={FONT_JP}
          color={isPassed ? "gray.500" : "inherit"}
        >
          {name}
        </Text>
      </Box>
    </HStack>
  );
};
