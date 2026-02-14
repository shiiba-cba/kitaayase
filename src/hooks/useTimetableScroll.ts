import { useCallback, useLayoutEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { TrainRow } from "../components/TrainCard";

type DirectionKey = "for_yoyogiuehara" | "for_kitaayase";

type Params = {
  displayedRows: TrainRow[];
  direction: DirectionKey;
  cardRefs: MutableRefObject<Map<number, HTMLDivElement | null>>;
  headerRef: RefObject<HTMLDivElement | null>;
  scrollTrigger: number;
  handledScrollTriggerRef: MutableRefObject<number>;
  preserveScrollDepartureMinutesRef: MutableRefObject<number | null>;
  scrollBehaviorOverrideRef: MutableRefObject<ScrollBehavior | null>;
};

function toServiceDayMinutes(hour: number, minute: number) {
  const total = hour * 60 + minute;
  return (total - 240 + 1440) % 1440; // 4:00=0
}

function parseTimeToServiceDayMinutes(time: string): number | null {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return toServiceDayMinutes(h, m);
}

export function useTimetableScroll({
  displayedRows,
  direction,
  cardRefs,
  headerRef,
  scrollTrigger,
  handledScrollTriggerRef,
  preserveScrollDepartureMinutesRef,
  scrollBehaviorOverrideRef,
}: Params) {
  const getDepartureMinutesForRow = useCallback(
    (row: TrainRow) => {
      const t =
        direction === "for_yoyogiuehara"
          ? row.kitaAyaseDepartureTime
          : row.stationDepartureTime;
      if (!t) return null;
      return parseTimeToServiceDayMinutes(t);
    },
    [direction]
  );

  const captureVisibleDepartureMinutes = useCallback(() => {
    const headerHeight = headerRef.current?.offsetHeight ?? 0;

    for (let i = 0; i < displayedRows.length; i++) {
      const el = cardRefs.current.get(i);
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom <= headerHeight) continue;

      const mins = getDepartureMinutesForRow(displayedRows[i]);
      if (mins !== null) return mins;
    }

    return null;
  }, [displayedRows, getDepartureMinutesForRow, headerRef, cardRefs]);

  const scrollToDepartureMinutes = useCallback(
    (targetMinutes: number, behavior: ScrollBehavior = "smooth") => {
      if (displayedRows.length === 0) return false;

      const targetIndex = displayedRows.findIndex((row) => {
        const mins = getDepartureMinutesForRow(row);
        return mins !== null && mins >= targetMinutes;
      });

      const index = targetIndex !== -1 ? targetIndex : displayedRows.length - 1;
      const el = cardRefs.current.get(index);
      if (!el) return false;

      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const rect = el.getBoundingClientRect();
      const absoluteTop = window.pageYOffset + rect.top;
      const targetY = absoluteTop - headerHeight - 8;

      window.scrollTo({ top: targetY, behavior });
      return true;
    },
    [displayedRows, getDepartureMinutesForRow, cardRefs, headerRef]
  );

  const scrollToNow = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (displayedRows.length === 0) return false;

      const now = new Date();
      let currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (currentMinutes < 240) currentMinutes += 1440;

      const targetIndex = displayedRows.findIndex((row) => {
        const t =
          direction === "for_yoyogiuehara"
            ? row.kitaAyaseDepartureTime
            : row.stationDepartureTime;

        if (!t) return false;

        const [h, m] = t.split(":").map(Number);
        let trainMinutes = h * 60 + m;
        if (trainMinutes < 240) trainMinutes += 1440;

        return trainMinutes >= currentMinutes;
      });

      const index = targetIndex !== -1 ? targetIndex : displayedRows.length - 1;
      const el = cardRefs.current.get(index);
      if (!el) return false;

      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const rect = el.getBoundingClientRect();
      const absoluteTop = window.pageYOffset + rect.top;
      const targetY = absoluteTop - headerHeight - 8;

      window.scrollTo({ top: targetY, behavior });
      return true;
    },
    [displayedRows, direction, cardRefs, headerRef]
  );

  useLayoutEffect(() => {
    if (displayedRows.length === 0) return;
    if (scrollTrigger === handledScrollTriggerRef.current) return;

    let retryCount = 0;
    let rafId: number | null = null;

    const attemptScroll = () => {
      if (cardRefs.current.size >= displayedRows.length) {
        const behavior = scrollBehaviorOverrideRef.current ?? "smooth";
        const preserved = preserveScrollDepartureMinutesRef.current;
        const ok =
          preserved !== null
            ? scrollToDepartureMinutes(preserved, behavior)
            : scrollToNow(behavior);

        if (ok) {
          preserveScrollDepartureMinutesRef.current = null;
          scrollBehaviorOverrideRef.current = null;
          handledScrollTriggerRef.current = scrollTrigger;
          return;
        }
      }

      if (retryCount < 10) {
        retryCount++;
        rafId = window.requestAnimationFrame(attemptScroll);
      } else {
        preserveScrollDepartureMinutesRef.current = null;
        scrollBehaviorOverrideRef.current = null;
        handledScrollTriggerRef.current = scrollTrigger;
      }
    };

    attemptScroll();

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [
    displayedRows,
    scrollToNow,
    scrollToDepartureMinutes,
    scrollTrigger,
    handledScrollTriggerRef,
    preserveScrollDepartureMinutesRef,
    scrollBehaviorOverrideRef,
    cardRefs,
  ]);

  return {
    captureVisibleDepartureMinutes,
  };
}
