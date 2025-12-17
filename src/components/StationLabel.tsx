import { stationNumberImageMap } from "../data/stationNumberImageMap";
import {
  Text,
  HStack,
  Image,
} from "@chakra-ui/react";

export const StationLabel = ({
  stationKey,
  stationName,
}: {
  stationKey: string;
  stationName: string;
}) => {
  const img = stationNumberImageMap[stationKey];

  return (
    <HStack gap={2}>
      {img && (
        <Image
          src={img}
          alt={stationName}
          boxSize="32px"
          objectFit="contain"
        />
      )}
      <Text fontSize="lg" fontWeight="700" letterSpacing="0.08em">
        {stationName}
      </Text>
    </HStack>
  );
};
