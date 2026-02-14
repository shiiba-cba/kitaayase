// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  applyFourAmCutoff,
  detectCalendarForDate,
  formatDateYYYYMMDD,
  useCalendar,
} from "./useCalendar";

describe("useCalendar helpers", () => {
  it("applyFourAmCutoff shifts date back before 04:00", () => {
    const d = new Date(2026, 1, 14, 3, 30, 0);
    const shifted = applyFourAmCutoff(d);
    expect(formatDateYYYYMMDD(shifted)).toBe("2026-02-13");
  });

  it("detectCalendarForDate returns holiday on weekend", async () => {
    const saturday = new Date(2026, 1, 14, 12, 0, 0);
    const isHoliday = vi.fn().mockResolvedValue(false);
    const cal = await detectCalendarForDate(saturday, isHoliday);
    expect(cal).toBe("holiday");
  });

  it("detectCalendarForDate uses holiday API on weekday", async () => {
    const weekday = new Date(2026, 1, 16, 12, 0, 0); // Monday
    const isHoliday = vi.fn().mockResolvedValue(true);
    const cal = await detectCalendarForDate(weekday, isHoliday);
    expect(cal).toBe("holiday");
    expect(isHoliday).toHaveBeenCalledTimes(1);
  });

  it("falls back to weekend-only when holiday API fails", async () => {
    const weekday = new Date(2026, 1, 16, 12, 0, 0); // Monday
    const isHoliday = vi.fn().mockRejectedValue(new Error("network"));
    const cal = await detectCalendarForDate(weekday, isHoliday);
    expect(cal).toBe("weekday");
  });

  it("03:59 is treated as previous day, 04:00 is current day", async () => {
    const monday359 = new Date(2026, 1, 16, 3, 59, 0); // service-day => Sunday
    const monday400 = new Date(2026, 1, 16, 4, 0, 0); // service-day => Monday
    const isHoliday = vi.fn().mockResolvedValue(false);

    const before = await detectCalendarForDate(monday359, isHoliday);
    const after = await detectCalendarForDate(monday400, isHoliday);

    expect(before).toBe("holiday");
    expect(after).toBe("weekday");
  });

  it("useCalendar uses persisted value as initial state", () => {
    localStorage.setItem("calendar", "holiday");
    const { result } = renderHook(() => useCalendar());
    expect(result.current.calendar).toBe("holiday");
  });
});
