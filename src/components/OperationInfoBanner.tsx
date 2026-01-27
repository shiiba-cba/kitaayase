import { Box, Text } from "@chakra-ui/react";
import type { OperationInfo } from "../types/OperationInfo";
import type { ParsedOperationInfo } from "../types/OperationVisualState";

type Props = {
  operationInfo: OperationInfo;
  parsed: ParsedOperationInfo;
  isOpen: boolean;
  onToggle: () => void;
  relativeText: string;
};

export function OperationInfoBanner({
  operationInfo,
  parsed,
  isOpen,
  onToggle,
  relativeText,
}: Props) {
  const bg =
    parsed.state === "normal"
      ? "gray.700"
      : parsed.state === "delay"
      ? "orange.500"
      : "red.600";

  return (
    <Box
      w="100%"
      px={4}
      py={2}
      bg={bg}
      textAlign="center"
      cursor="pointer"
      onClick={onToggle}
    >
      {/* 折りたたみ時も見えるヘッダー */}
      <Text fontSize="sm" fontWeight="bold">
        {parsed.title} {isOpen ? "▲" : "▼"}
      </Text>

      {/* 本文（折りたたみ対象） */}
      {isOpen && (
        <Text fontSize="sm" mt={1}>
          {operationInfo.text}
        </Text>
      )}

      {/* 最終更新（常に表示） */}
      <Text fontSize="xs" opacity={0.8} mt={1}>
        最終更新：
        {new Date(operationInfo.updatedAt).toLocaleString("ja-JP", {
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        （{relativeText}）
      </Text>
    </Box>
  );
}
