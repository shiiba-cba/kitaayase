import { HStack, Image, Text, Box } from "@chakra-ui/react";
import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { stations } from "../data/stations";
import { FONT_JP } from "../styles/fonts";

type Props = {
  stationKey: string;
  highlight?: boolean;
  /** stop list connector line */
  showTopConnector?: boolean;
  showBottomConnector?: boolean;
  connectorColor?: string;
};

export const StationSmallLabel = ({
  stationKey,
  highlight,
  showTopConnector,
  showBottomConnector,
  connectorColor = "#00bb85", // 千代田線カラー
}: Props) => {
  const img = stationNumberImageMap[stationKey];
  const name = stations[stationKey] ?? stationKey;

  return (
    <HStack gap={2} align="center">
      {/* number icon + connector line */}
      <Box position="relative" w="24px" h="24px" flex="0 0 24px">
        {showTopConnector && (
          <Box
            position="absolute"
            left="50%"
            top="-10px"
            transform="translateX(-50%)"
            width="3px"
            height="10px"
            bg={connectorColor}
            borderRadius="full"
            opacity={0.95}
          />
        )}

        {showBottomConnector && (
          <Box
            position="absolute"
            left="50%"
            bottom="-10px"
            transform="translateX(-50%)"
            width="3px"
            height="10px"
            bg={connectorColor}
            borderRadius="full"
            opacity={0.95}
          />
        )}

        {img && (
          <Image src={img} alt={name} boxSize="24px" objectFit="contain" />
        )}
      </Box>

      <Box height="24px" display="flex" alignItems="center">
        <Text
          fontSize="sm"
          fontWeight={highlight ? "bold" : "normal"}
          lineHeight="1"
          whiteSpace="nowrap"
          fontFamily={FONT_JP}
        >
          {name}
        </Text>
      </Box>
    </HStack>
  );
};
