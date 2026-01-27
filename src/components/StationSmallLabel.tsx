import { HStack, Image, Text, Box } from "@chakra-ui/react";
import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { stations } from "../data/stations";
import { FONT_JP } from "../styles/fonts";

type Props = {
  stationKey: string;
  highlight?: boolean;
};

export const StationSmallLabel = ({ stationKey, highlight }: Props) => {
  const img = stationNumberImageMap[stationKey];
  const name = stations[stationKey] ?? stationKey;

  return (
    <HStack gap={2} align="center">
      {img && <Image src={img} alt={name} boxSize="24px" objectFit="contain" />}

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
