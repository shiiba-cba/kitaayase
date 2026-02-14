import { describe, expect, it, vi } from "vitest";
import {
  applyFourAmCutoff,
  detectCalendarForDate,
  formatDateYYYYMMDD,
} from "./useCalendar";

describe("useCalendar helpers", () => {
  it("applyFourAmCutoff shifts date back before 04:00", () => {
    const d = new Date("2026-02-14T03:30:00+09:00");
    const shifted = applyFourAmCutoff(d);
    expect(formatDateYYYYMMDD(shifted)).toBe("2026-02-13");
  });

  it("detectCalendarForDate returns holiday on weekend", async () => {
    const saturday = new Date("2026-02-14T12:00:00+09:00");
    const isHoliday = vi.fn().mockResolvedValue(false);
    const cal = await detectCalendarForDate(saturday, isHoliday);
    expect(cal).toBe("holiday");
  });

  it("detectCalendarForDate uses holiday API on weekday", async () => {
    const weekday = new Date("2026-02-16T12:00:00+09:00"); // Monday
    const isHoliday = vi.fn().mockResolvedValue(true);
    const cal = await detectCalendarForDate(weekday, isHoliday);
    expect(cal).toBe("holiday");
    expect(isHoliday).toHaveBeenCalledTimes(1);
  });

  it("falls back to weekend-only when holiday API fails", async () => {
    const weekday = new Date("2026-02-16T12:00:00+09:00"); // Monday
    const isHoliday = vi.fn().mockRejectedValue(new Error("network"));
    const cal = await detectCalendarForDate(weekday, isHoliday);
    expect(cal).toBe("weekday");
  });
});
