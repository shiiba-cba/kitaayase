import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { Text, HStack, Image, Box } from "@chakra-ui/react";
import { formatStationName } from "../utils/formatStationName";
import { FONT_JP } from "../styles/fonts";

type Props = {
  stationKey: string;
  stationName: string;
  textColor?: string;
};

export const StationLargeLabel = ({
  stationKey,
  stationName,
  textColor,
}: Props) => {
  const img = stationNumberImageMap[stationKey];

  return (
    <HStack width="134px" gap={1} align="center">
      {img && (
        <Image src={img} alt={stationName} boxSize="32px" objectFit="contain" />
      )}

      <Box
        width="98px"
        height="32px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        transform={
          stationName.length >= 6
            ? "scaleX(0.67)"
            : stationName.length >= 5
            ? "scaleX(0.80)"
            : undefined
        }
        transformOrigin="center"
      >
        <Text
          fontSize="2xl"
          fontWeight="500"
          fontFamily={FONT_JP}
          letterSpacing="0.02em"
          color={textColor}
          lineHeight="1"
          whiteSpace="nowrap"
        >
          {formatStationName(stationName)}
        </Text>
      </Box>
    </HStack>
  );
};
