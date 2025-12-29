import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { Text, HStack, Image, Box } from "@chakra-ui/react";
import { formatStationName } from "../utils/formatStationName";

type Props = {
  stationKey: string;
  stationName: string;
  textColor?: string;
};

export const StationLabel = ({ stationKey, stationName, textColor }: Props) => {
  const img = stationNumberImageMap[stationKey];

  return (
    <HStack width="134px" gap={1}>
      {img && (
        <Image src={img} alt={stationName} boxSize="32px" objectFit="contain" />
      )}
      <Box width="98px" textAlign="center">
        <Text
          fontSize="2xl"
          fontWeight="500"
          fontFamily='"Noto Sans JP", sans-serif'
          letterSpacing="0.02em"
          color={textColor}
          transform={
            stationName.length >= 6
              ? "scaleX(0.67)"
              : stationName.length >= 5
              ? "scaleX(0.80)"
              : ""
          }
          transformOrigin="center left"
          whiteSpace="nowrap"
        >
          {formatStationName(stationName)}
        </Text>
      </Box>
    </HStack>
  );
};
