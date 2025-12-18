import { stationNumberImageMap } from "../data/stationNumberImageMap";
import {
  Text,
  HStack,
  Image,
} from "@chakra-ui/react";

type Props = {
  stationKey: string;
  stationName: string;
  textColor?: string;
};

export const StationLabel = ({
  stationKey,
  stationName,
  textColor,
}: Props) => {
  const img = stationNumberImageMap[stationKey];

  return (
    <HStack gap={1}>
      {img && (
        <Image
          src={img}
          alt={stationName}
          boxSize="32px"
          objectFit="contain"
        />
      )}
      <Text
        fontSize="xl"
        fontWeight="400"
        fontFamily='"Noto Sans JP", sans-serif'
        letterSpacing="0.02em"
        color={textColor}
        transform={
          stationName.length >= 5
            ? "scaleX(1.00) scaleY(1.20)"
            : stationName.length >= 4
            ? "scaleX(1.10) scaleY(1.20)"
            : "scaleX(1.20) scaleY(1.20)"
        }
        transformOrigin="center left"
      >
        {stationName}
      </Text>
    </HStack>
  );
};
