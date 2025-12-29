import { HStack, Image, Text } from "@chakra-ui/react";
import { stationNumberImageMap } from "../data/stationNumberImageMap";
import { stations } from "../data/stations";

type Props = {
  stationKey: string;
  highlight?: boolean;
};

export const StationStopLabel = ({ stationKey, highlight }: Props) => {
  const img = stationNumberImageMap[stationKey];
  const name = stations[stationKey] ?? stationKey;

  return (
    <HStack gap={2}>
      {img && (
        <Image
          src={img}
          alt={name}
          boxSize="24px"
          objectFit="contain"
          opacity={highlight ? 1 : 0.85}
        />
      )}
      <Text
        fontSize="sm"
        fontWeight={highlight ? "bold" : "normal"}
        whiteSpace="nowrap"
      >
        {name}
      </Text>
    </HStack>
  );
};
