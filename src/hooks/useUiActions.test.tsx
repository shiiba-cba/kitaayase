// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useUiActions } from "./useUiActions";

describe("useUiActions", () => {
  it("toggleDirection flips direction and sets scroll request", () => {
    const setDirection = vi.fn();
    const setStationKey = vi.fn();
    const setShowOnlyDepartures = vi.fn();
    const setScrollTrigger = vi.fn();

    const scrollRequestRef = { current: false };
    const preserveRef = { current: null as number | null };
    const behaviorRef = { current: null as ScrollBehavior | null };

    const { result } = renderHook(() =>
      useUiActions({
        stationKey: "otemachi",
        direction: "for_yoyogiuehara",
        setDirection,
        setStationKey,
        setShowOnlyDepartures,
        setScrollTrigger,
        scrollRequestRef,
        preserveScrollDepartureMinutesRef: preserveRef,
        scrollBehaviorOverrideRef: behaviorRef,
        captureVisibleDepartureMinutes: () => 777,
      })
    );

    act(() => {
      result.current.toggleDirection();
    });

    expect(setDirection).toHaveBeenCalledTimes(1);
    const updater = setDirection.mock.calls[0][0] as (p: string) => string;
    expect(updater("for_yoyogiuehara")).toBe("for_kitaayase");
    expect(updater("for_kitaayase")).toBe("for_yoyogiuehara");
    expect(scrollRequestRef.current).toBe(true);
  });

  it("changeStation to kitaayase forces direction and marks scroll request", () => {
    const setDirection = vi.fn();
    const setStationKey = vi.fn();
    const setShowOnlyDepartures = vi.fn();
    const setScrollTrigger = vi.fn();

    const scrollRequestRef = { current: false };
    const preserveRef = { current: null as number | null };
    const behaviorRef = { current: null as ScrollBehavior | null };

    const { result } = renderHook(() =>
      useUiActions({
        stationKey: "otemachi",
        direction: "for_kitaayase",
        setDirection,
        setStationKey,
        setShowOnlyDepartures,
        setScrollTrigger,
        scrollRequestRef,
        preserveScrollDepartureMinutesRef: preserveRef,
        scrollBehaviorOverrideRef: behaviorRef,
        captureVisibleDepartureMinutes: () => 123,
      })
    );

    act(() => {
      result.current.changeStation("kitaayase");
    });

    expect(setStationKey).toHaveBeenCalledWith("kitaayase");
    expect(setDirection).toHaveBeenCalledWith("for_yoyogiuehara");
    expect(scrollRequestRef.current).toBe(true);
  });

  it("toggleDepartureOnly preserves visible time, sets auto behavior, and increments trigger", () => {
    const setDirection = vi.fn();
    const setStationKey = vi.fn();
    const setShowOnlyDepartures = vi.fn();
    const setScrollTrigger = vi.fn();

    const scrollRequestRef = { current: false };
    const preserveRef = { current: null as number | null };
    const behaviorRef = { current: null as ScrollBehavior | null };

    const { result } = renderHook(() =>
      useUiActions({
        stationKey: "otemachi",
        direction: "for_yoyogiuehara",
        setDirection,
        setStationKey,
        setShowOnlyDepartures,
        setScrollTrigger,
        scrollRequestRef,
        preserveScrollDepartureMinutesRef: preserveRef,
        scrollBehaviorOverrideRef: behaviorRef,
        captureVisibleDepartureMinutes: () => 456,
      })
    );

    act(() => {
      result.current.toggleDepartureOnly(true);
    });

    expect(preserveRef.current).toBe(456);
    expect(behaviorRef.current).toBe("auto");
    expect(setShowOnlyDepartures).toHaveBeenCalledWith(true);
    expect(setScrollTrigger).toHaveBeenCalledTimes(1);
    const inc = setScrollTrigger.mock.calls[0][0] as (n: number) => number;
    expect(inc(10)).toBe(11);
  });
});
