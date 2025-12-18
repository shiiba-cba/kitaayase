// src/utils/formatStationName.ts

/**
 * 駅名が2文字の場合のみ、視認性向上のため
 * 間に半角スペースを入れて返す
 *
 * 例:
 *  - 綾瀬 -> 綾 瀬
 *  - 北綾瀬 -> 北綾瀬
 */
export const formatStationName = (name: string): string => {
  const chars = [...name];
  if (chars.length === 2) {
    return `${chars[0]} ${chars[1]}`;
  }
  return name;
};
