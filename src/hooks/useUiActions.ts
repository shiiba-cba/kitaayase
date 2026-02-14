import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type DirectionKey = "for_yoyogiuehara" | "for_kitaayase";

type Params = {
  stationKey: string;
  direction: DirectionKey;
  setDirection: Dispatch<SetStateAction<DirectionKey>>;
  setStationKey: Dispatch<SetStateAction<string>>;
  setShowOnlyDepartures: Dispatch<SetStateAction<boolean>>;
  setScrollTrigger: Dispatch<SetStateAction<number>>;
  scrollRequestRef: MutableRefObject<boolean>;
  preserveScrollDepartureMinutesRef: MutableRefObject<number | null>;
  scrollBehaviorOverrideRef: MutableRefObject<ScrollBehavior | null>;
  captureVisibleDepartureMinutes: () => number | null;
};

export function useUiActions({
  stationKey,
  direction,
  setDirection,
  setStationKey,
  setShowOnlyDepartures,
  setScrollTrigger,
  scrollRequestRef,
  preserveScrollDepartureMinutesRef,
  scrollBehaviorOverrideRef,
  captureVisibleDepartureMinutes,
}: Params) {
  const toggleDirection = useCallback(() => {
    setDirection((prev) =>
      prev === "for_yoyogiuehara" ? "for_kitaayase" : "for_yoyogiuehara"
    );
    scrollRequestRef.current = true;
  }, [setDirection, scrollRequestRef]);

  const changeStation = useCallback(
    (newStationKey: string) => {
      const willChangeStation = newStationKey !== stationKey;
      const willChangeDirection =
        newStationKey === "kitaayase" && direction !== "for_yoyogiuehara";

      if (willChangeStation || willChangeDirection) {
        scrollRequestRef.current = true;
      }

      setStationKey(newStationKey);
      if (newStationKey === "kitaayase") {
        setDirection("for_yoyogiuehara");
      }
    },
    [stationKey, direction, setStationKey, setDirection, scrollRequestRef]
  );

  const toggleDepartureOnly = useCallback(
    (checked: boolean) => {
      preserveScrollDepartureMinutesRef.current = captureVisibleDepartureMinutes();
      scrollBehaviorOverrideRef.current = "auto";
      setShowOnlyDepartures(checked);
      setScrollTrigger((c) => c + 1);
    },
    [
      captureVisibleDepartureMinutes,
      preserveScrollDepartureMinutesRef,
      scrollBehaviorOverrideRef,
      setShowOnlyDepartures,
      setScrollTrigger,
    ]
  );

  return {
    toggleDirection,
    changeStation,
    toggleDepartureOnly,
  };
}
