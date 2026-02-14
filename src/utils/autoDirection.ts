import { STORAGE_KEYS } from "../constants/storageKeys";
import { toServiceDayMinutes } from "./time";

export type DirectionKey = "for_yoyogiuehara" | "for_kitaayase";

export type AutoDirectionSettings = {
  enabled: boolean;
  cutoffTime: string; // HH:mm
  beforeCutoffDirection: DirectionKey;
  afterCutoffDirection: DirectionKey;
};

export const DEFAULT_AUTO_DIRECTION_SETTINGS: AutoDirectionSettings = {
  enabled: false,
  cutoffTime: "16:00",
  beforeCutoffDirection: "for_yoyogiuehara",
  afterCutoffDirection: "for_kitaayase",
};

export function oppositeDirection(direction: DirectionKey): DirectionKey {
  return direction === "for_yoyogiuehara" ? "for_kitaayase" : "for_yoyogiuehara";
}

function isValidTimeString(v: string): boolean {
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return Number.isInteger(hh) && Number.isInteger(mm) && hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export function readAutoDirectionSettings(): AutoDirectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.autoDirectionSettings);
    if (!raw) return DEFAULT_AUTO_DIRECTION_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<AutoDirectionSettings>;
    const enabled = parsed.enabled === true;
    const cutoffTime =
      typeof parsed.cutoffTime === "string" && isValidTimeString(parsed.cutoffTime)
        ? parsed.cutoffTime
        : DEFAULT_AUTO_DIRECTION_SETTINGS.cutoffTime;
    const beforeCutoffDirection =
      parsed.beforeCutoffDirection === "for_yoyogiuehara" ||
      parsed.beforeCutoffDirection === "for_kitaayase"
        ? parsed.beforeCutoffDirection
        : DEFAULT_AUTO_DIRECTION_SETTINGS.beforeCutoffDirection;
    const afterCandidate =
      parsed.afterCutoffDirection === "for_yoyogiuehara" ||
      parsed.afterCutoffDirection === "for_kitaayase"
        ? parsed.afterCutoffDirection
        : DEFAULT_AUTO_DIRECTION_SETTINGS.afterCutoffDirection;

    const afterCutoffDirection =
      afterCandidate === beforeCutoffDirection
        ? oppositeDirection(beforeCutoffDirection)
        : afterCandidate;

    return {
      enabled,
      cutoffTime,
      beforeCutoffDirection,
      afterCutoffDirection,
    };
  } catch {
    return DEFAULT_AUTO_DIRECTION_SETTINGS;
  }
}

export function pickDirectionBySettings(
  settings: AutoDirectionSettings,
  now: Date = new Date()
): DirectionKey {
  const [cutoffHour, cutoffMinute] = settings.cutoffTime.split(":").map(Number);
  const nowMinutes = toServiceDayMinutes(now.getHours(), now.getMinutes());
  const cutoffMinutes = toServiceDayMinutes(cutoffHour, cutoffMinute);

  return nowMinutes < cutoffMinutes
    ? settings.beforeCutoffDirection
    : settings.afterCutoffDirection;
}
