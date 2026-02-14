import {
  Box,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  IconButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

type DirectionKey = "for_yoyogiuehara" | "for_kitaayase";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fontFamily: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  beforeCutoffDirection: DirectionKey;
  onBeforeCutoffDirectionChange: (direction: DirectionKey) => void;
  cutoffTime: string;
  onCutoffTimeChange: (time: string) => void;
  afterCutoffDirection: DirectionKey;
};

export function AutoDirectionSettingsDialog({
  open,
  onOpenChange,
  fontFamily,
  enabled,
  onEnabledChange,
  beforeCutoffDirection,
  onBeforeCutoffDirectionChange,
  cutoffTime,
  onCutoffTimeChange,
  afterCutoffDirection,
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
          fontFamily={fontFamily}
          position="relative"
        >
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

          <DialogHeader borderBottom="1px solid" borderColor="whiteAlpha.300">
            <DialogTitle>表示方面の自動設定</DialogTitle>
          </DialogHeader>

          <DialogBody py={4}>
            <VStack align="stretch" gap={4}>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onEnabledChange(e.target.checked)}
                />
                <Text>初期表示・復帰時に時刻で方面を自動切替する</Text>
              </label>

              <Box>
                <Text fontSize="sm" mb={1} color="whiteAlpha.800">
                  表示方面（切替前）
                </Text>
                <select
                  value={beforeCutoffDirection}
                  onChange={(e) =>
                    onBeforeCutoffDirectionChange(e.target.value as DirectionKey)
                  }
                  style={{
                    width: "100%",
                    background: "#222",
                    color: "white",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #444",
                    fontFamily,
                  }}
                >
                  <option value="for_yoyogiuehara">代々木上原方面</option>
                  <option value="for_kitaayase">北綾瀬方面</option>
                </select>
              </Box>

              <Box>
                <Text fontSize="sm" mb={1} color="whiteAlpha.800">
                  切替時刻
                </Text>
                <input
                  type="time"
                  value={cutoffTime}
                  onChange={(e) => onCutoffTimeChange(e.target.value || "16:00")}
                  style={{
                    width: "100%",
                    background: "#222",
                    color: "white",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #444",
                    fontFamily,
                  }}
                />
              </Box>

              <Box>
                <Text fontSize="sm" mb={1} color="whiteAlpha.800">
                  表示方面（切替後）
                </Text>
                <Box
                  width="100%"
                  bg="#222"
                  color="white"
                  px={3}
                  py={2}
                  borderRadius="4px"
                  border="1px solid #444"
                  fontFamily={fontFamily}
                >
                  {afterCutoffDirection === "for_yoyogiuehara"
                    ? "代々木上原方面"
                    : "北綾瀬方面"}
                </Box>
              </Box>
            </VStack>
          </DialogBody>
        </DialogContent>
      </DialogPositioner>
    </DialogRoot>
  );
}
