import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants/storageKeys";
import { isHoliday as isHolidayDefault } from "../utils/holiday";

export type CalendarType = "weekday" | "holiday";

/**
 * 4:00 までは前日扱い（終電〜深夜帯の表示ゆれ対策）
 */
export function applyFourAmCutoff(now: Date): Date {
  const d = new Date(now);
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

export function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function detectCalendarForDate(
  now: Date,
  isHoliday: (dateStr: string) => Promise<boolean> = isHolidayDefault
): Promise<CalendarType> {
  const d = applyFourAmCutoff(now);

  const dateStr = formatDateYYYYMMDD(d);
  const day = d.getDay();
  const isWeekend = day === 0 || day === 6;

  try {
    const isNatHoliday = await isHoliday(dateStr);
    return isWeekend || isNatHoliday ? "holiday" : "weekday";
  } catch {
    // 祝日データが取れない場合は土日だけを休日扱い
    return isWeekend ? "holiday" : "weekday";
  }
}

/**
 * useCalendar:
 * - 初期表示時に現在日時から平日/休日を自動判定
 * - UI操作での切替も提供
 * - 判定ロジックは detectCalendarForDate に切り出しているのでテストしやすい
 */
export function useCalendar(opts?: {
  initial?: CalendarType;
  isHoliday?: (dateStr: string) => Promise<boolean>;
  persistKey?: string;
}) {
  const initial = opts?.initial ?? "weekday";
  const persistKey = opts?.persistKey ?? STORAGE_KEYS.calendar;
  const isHoliday = opts?.isHoliday ?? isHolidayDefault;

  const [calendar, setCalendar] = useState<CalendarType>(initial);
  const [calendarReady, setCalendarReady] = useState(false);

  const detectCalendarForNow = useCallback(async () => {
    return detectCalendarForDate(new Date(), isHoliday);
  }, [isHoliday]);

  // 初期表示時の自動判定
  useEffect(() => {
    (async () => {
      const detected = await detectCalendarForNow();
      setCalendar(detected);
      setCalendarReady(true);
    })();
  }, [detectCalendarForNow]);

  const onCalendarChange = useCallback(
    (v: CalendarType) => {
      setCalendar(v);
      localStorage.setItem(persistKey, v);
    },
    [persistKey]
  );

  return {
    calendar,
    calendarReady,
    setCalendar,
    onCalendarChange,
    detectCalendarForNow,
  };
}
