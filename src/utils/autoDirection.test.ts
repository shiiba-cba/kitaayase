// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  oppositeDirection,
  pickDirectionBySettings,
  readAutoDirectionSettings,
  type AutoDirectionSettings,
} from "./autoDirection";
import { STORAGE_KEYS } from "../constants/storageKeys";

describe("autoDirection utils", () => {
  it("oppositeDirection returns opposite side", () => {
    expect(oppositeDirection("for_yoyogiuehara")).toBe("for_kitaayase");
    expect(oppositeDirection("for_kitaayase")).toBe("for_yoyogiuehara");
  });

  it("pickDirectionBySettings uses service-day cutoff", () => {
    const settings: AutoDirectionSettings = {
      enabled: true,
      cutoffTime: "16:00",
      beforeCutoffDirection: "for_yoyogiuehara",
      afterCutoffDirection: "for_kitaayase",
    };

    expect(pickDirectionBySettings(settings, new Date(2026, 1, 14, 15, 59, 0))).toBe(
      "for_yoyogiuehara"
    );
    expect(pickDirectionBySettings(settings, new Date(2026, 1, 14, 16, 0, 0))).toBe(
      "for_kitaayase"
    );
  });

  it("readAutoDirectionSettings normalizes invalid/same-direction data", () => {
    localStorage.setItem(
      STORAGE_KEYS.autoDirectionSettings,
      JSON.stringify({
        enabled: true,
        cutoffTime: "16:00",
        beforeCutoffDirection: "for_yoyogiuehara",
        afterCutoffDirection: "for_yoyogiuehara",
      })
    );

    const s = readAutoDirectionSettings();
    expect(s.beforeCutoffDirection).toBe("for_yoyogiuehara");
    expect(s.afterCutoffDirection).toBe("for_kitaayase");
  });
});
